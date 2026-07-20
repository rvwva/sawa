/**
 * Mindlign Passive ONA — Graph API Sync
 * ======================================
 * Fetches email + calendar metadata from Microsoft Graph API for a given
 * organisation, builds a weighted interaction graph, computes network metrics
 * per employee, and stores results in the database.
 *
 * PRIVACY: metadata only — sender/recipient/timestamp for email,
 * attendees/duration for calendar. No content, no subject lines, no titles.
 */

import { createHash } from "crypto";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { ClientSecretCredential } from "@azure/identity";
import DirectedGraph from "graphology";
import { degreeCentrality } from "graphology-metrics/centrality/degree";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import eigenvectorCentrality from "graphology-metrics/centrality/eigenvector";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

function hashEmail(email: string, orgSalt: string): string {
  return createHash("sha256")
    .update(`${orgSalt}:${email.toLowerCase()}`)
    .digest("hex");
}

const SYSTEM_EMAIL_PATTERNS = [
  "noreply@", "no-reply@", "notifications@", "donotreply@",
  "mailer-daemon@", "postmaster@", "bounce@", "auto-reply@",
  "automated@", "system@", "support@", "help@", "info@",
];

function isSystemEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return SYSTEM_EMAIL_PATTERNS.some((pattern) => lower.includes(pattern));
}

const DAYS_LOOKBACK = 90;
const EMAIL_WEIGHT = 1.0;
const MEETING_WEIGHT = 2.0;
const OVERLOAD_PERCENTILE = 0.9;
const MIN_EDGE_WEIGHT = 3.0;

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  department?: string;
  managerId?: string;
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function runOnaSync(
  orgId: string
): Promise<{ reciprocityReliable: boolean; employeesProcessed: number }> {
  logger.info(`ONA sync starting for org ${orgId}`);

  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    include: { departments: true },
  });

  if (!org || !org.m365TenantId || !org.m365ClientId || !org.m365ClientSecret) {
    throw new Error(`Org ${orgId} missing M365 credentials`);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const credential = new ClientSecretCredential(
    org.m365TenantId,
    org.m365ClientId,
    org.m365ClientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const graphClient = Client.initWithMiddleware({ authProvider });

  // ── Fetch employee directory ──────────────────────────────────────────────
  const users = await fetchUsers(graphClient);
  const emailToUser = new Map(users.map((u) => [hashEmail(u.email, org.id), u]));

  // ── Manager relationship data quality check ───────────────────────────────
  const usersWithManager = users.filter((u) => u.managerId).length;
  const managerCoverageRate = users.length > 0 ? usersWithManager / users.length : 0;
  const reciprocityReliable = managerCoverageRate >= 0.20;

  if (!reciprocityReliable) {
    logger.warn(
      `ONA sync org ${orgId}: only ${Math.round(managerCoverageRate * 100)}% of users have manager relationships in M365 directory. Reciprocity scores will default to 0.5 and should not be used for insight card generation.`
    );
  }

  // ── Build email department mapping using org departments ──────────────────
  const deptNameToId = new Map(org.departments.map((d) => [d.name.toLowerCase(), d.id]));

  // ── Fetch interactions ────────────────────────────────────────────────────
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000);

  const interactionMap = new Map<string, number>(); // "from|to|type" -> count

  for (const user of users) {
    try {
      // Email metadata
      const emailPairs = await fetchEmailMetadata(graphClient, user.id, periodStart);
      for (const [from, to] of emailPairs) {
        const key = `${from}|${to}|email`;
        interactionMap.set(key, (interactionMap.get(key) ?? 0) + 1);
      }

      // Calendar metadata
      const meetingPairs = await fetchMeetingMetadata(graphClient, user.id, periodStart, periodEnd);
      for (const [from, to] of meetingPairs) {
        const key = `${from}|${to}|meeting`;
        interactionMap.set(key, (interactionMap.get(key) ?? 0) + 1);
      }
    } catch (err) {
      logger.warn(`ONA: skipping user ${user.email} — ${(err as Error).message}`);
    }
  }

  // ── Build weighted graph ──────────────────────────────────────────────────
  const graph = new DirectedGraph();

  for (const user of users) {
    graph.addNode(hashEmail(user.email, org.id));
  }

  const edgeWeights = new Map<string, number>(); // "from|to" -> weight

  for (const [key, count] of interactionMap) {
    const [from, to, type] = key.split("|");
    if (isSystemEmail(from) || isSystemEmail(to)) continue;
    const hFrom = hashEmail(from, org.id);
    const hTo = hashEmail(to, org.id);
    if (!emailToUser.has(hFrom) || !emailToUser.has(hTo) || from === to) continue;
    const edgeKey = `${hFrom}|${hTo}`;
    const w = type === "meeting" ? MEETING_WEIGHT * count : EMAIL_WEIGHT * count;
    edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) ?? 0) + w);
  }

  // Only keep edges where both directions have at least one interaction.
  // This filters out broadcast emails where A sends to B but B never responds.
  const bidirectionalEdges = new Set<string>();
  for (const [edgeKey] of edgeWeights) {
    const [from, to] = edgeKey.split("|");
    const reverseKey = `${to}|${from}`;
    if (edgeWeights.has(reverseKey)) {
      bidirectionalEdges.add(edgeKey);
    }
  }

  for (const [edgeKey, weight] of edgeWeights) {
    if (weight < MIN_EDGE_WEIGHT) continue;
    if (!bidirectionalEdges.has(edgeKey)) continue;
    const [from, to] = edgeKey.split("|");
    if (graph.hasEdge(from, to)) {
      graph.setEdgeAttribute(from, to, "weight", weight);
    } else {
      graph.addEdge(from, to, { weight });
    }
  }

  // ── Compute metrics ───────────────────────────────────────────────────────
  const degCentrality = degreeCentrality(graph);
  const btwnCentrality = betweennessCentrality(graph, { normalized: true });
  let eigCentrality: Record<string, number> = {};
  try {
    eigCentrality = eigenvectorCentrality(graph, { maxIterations: 200 });
  } catch {
    // Eigenvector may fail to converge on sparse graphs — fall back to 0
    logger.warn(`ONA: eigenvector centrality failed to converge for org ${orgId}, defaulting to 0`);
  }

  // Normalize degree values for isolation + overload detection
  const degValues = Object.values(degCentrality);
  const maxDeg = Math.max(...degValues, 1);
  const sortedDeg = [...degValues].sort((a, b) => a - b);
  const overloadThreshold = sortedDeg[Math.floor(sortedDeg.length * OVERLOAD_PERCENTILE)] ?? maxDeg;

  // ── Store interactions ────────────────────────────────────────────────────
  await prisma.onaInteraction.deleteMany({
    where: { organisationId: orgId, periodStart: { gte: periodStart } },
  });

  const interactionRows = [];
  for (const [key, count] of interactionMap) {
    const [from, to, type] = key.split("|");
    if (isSystemEmail(from) || isSystemEmail(to)) continue;
    const hFrom = hashEmail(from, org.id);
    const hTo = hashEmail(to, org.id);
    if (!emailToUser.has(hFrom) || !emailToUser.has(hTo) || from === to) continue;
    const edgeKey = `${hFrom}|${hTo}`;
    if ((edgeWeights.get(edgeKey) ?? 0) < MIN_EDGE_WEIGHT) continue;
    if (!bidirectionalEdges.has(edgeKey)) continue;
    interactionRows.push({
      organisationId: orgId,
      fromUserEmail: hFrom,
      toUserEmail: hTo,
      type,
      weight: type === "meeting" ? MEETING_WEIGHT * count : EMAIL_WEIGHT * count,
      periodStart,
      periodEnd,
    });
  }

  await prisma.onaInteraction.createMany({ data: interactionRows });

  // ── Store metrics ─────────────────────────────────────────────────────────
  await prisma.onaMetric.deleteMany({
    where: { organisationId: orgId },
  });

  const metricRows = [];
  for (const user of users) {
    const email = user.email.toLowerCase();
    const hEmail = hashEmail(email, org.id);
    const deg = degCentrality[hEmail] ?? 0;
    const normalizedDeg = deg / maxDeg;

    // Reciprocity: ratio of manager-initiated interactions with direct reports
    const reports = users.filter((u) => u.managerId === user.id);
    let reciprocityScore = 0.5; // neutral default
    if (reciprocityReliable && reports.length > 0) {
      let managerInitiated = 0;
      let total = 0;
      for (const report of reports) {
        const hReport = hashEmail(report.email, org.id);
        const outbound = edgeWeights.get(`${hEmail}|${hReport}`) ?? 0;
        const inbound = edgeWeights.get(`${hReport}|${hEmail}`) ?? 0;
        managerInitiated += outbound;
        total += outbound + inbound;
      }
      reciprocityScore = total > 0 ? managerInitiated / total : 0.5;
    }

    // Map M365 department to Mindlign department ID
    const deptId = user.department
      ? (deptNameToId.get(user.department.toLowerCase()) ?? null)
      : null;

    metricRows.push({
      organisationId: orgId,
      userEmail: hEmail,
      departmentId: deptId,
      degreeCentrality: normalizedDeg,
      betweenness: btwnCentrality[hEmail] ?? 0,
      eigenvector: eigCentrality[hEmail] ?? 0,
      isolationScore: 1 - normalizedDeg,
      collaborationLoad: deg >= overloadThreshold ? 1.0 : deg / overloadThreshold,
      reciprocityScore,
      periodStart,
      periodEnd,
    });
  }

  await prisma.onaMetric.createMany({ data: metricRows });

  // ── Update org sync timestamp ─────────────────────────────────────────────
  await prisma.organisation.update({
    where: { id: orgId },
    data: { onaLastSyncAt: new Date() },
  });

  logger.info(`ONA sync complete for org ${orgId} — ${metricRows.length} employees processed`);

  return { reciprocityReliable, employeesProcessed: metricRows.length };
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

async function fetchUsers(client: Client): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let url: string | null =
    "/users?$select=id,displayName,mail,department,manager&$top=100";

  while (url) {
    const res = await client.api(url).get();
    for (const u of res.value ?? []) {
      if (!u.mail) continue;
      users.push({
        id: u.id,
        email: u.mail.toLowerCase(),
        displayName: u.displayName ?? "",
        department: u.department ?? undefined,
        managerId: u.manager?.id ?? undefined,
      });
    }
    url = res["@odata.nextLink"] ?? null;
  }

  return users;
}

async function fetchEmailMetadata(
  client: Client,
  userId: string,
  since: Date
): Promise<[string, string][]> {
  const pairs: [string, string][] = [];
  const filter = `sentDateTime ge ${since.toISOString()}`;
  // PRIVACY: $select intentionally excludes subject, body, bodyPreview, and attachments.
  // Mail.ReadBasic.All returns all properties except body/attachments, but subject IS
  // accessible. We explicitly exclude it here to maintain metadata-only access.
  // Never add 'subject' or 'body' to this $select — this is a legal compliance boundary.
  let url: string | null =
    `/users/${userId}/mailFolders/SentItems/messages?$select=sender,toRecipients,sentDateTime&$filter=${encodeURIComponent(filter)}&$top=100`;

  while (url) {
    const res = await client.api(url).get();
    for (const msg of res.value ?? []) {
      const from = msg.sender?.emailAddress?.address?.toLowerCase();
      if (!from) continue;
      for (const recipient of msg.toRecipients ?? []) {
        const to = recipient.emailAddress?.address?.toLowerCase();
        if (to && to !== from) pairs.push([from, to]);
      }
    }
    url = res["@odata.nextLink"] ?? null;
  }

  return pairs;
}

async function fetchMeetingMetadata(
  client: Client,
  userId: string,
  start: Date,
  end: Date
): Promise<[string, string][]> {
  const pairs: [string, string][] = [];
  // PRIVACY: $select intentionally excludes subject, location, body, and extensions.
  // Calendars.ReadBasic.All returns subject and location if requested — we explicitly
  // exclude them here to maintain metadata-only access.
  // Never add 'subject' or 'location' to this $select — this is a legal compliance boundary.
  let url: string | null =
    `/users/${userId}/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$select=attendees,organizer,start,end&$top=100`;

  while (url) {
    const res = await client.api(url).get();
    for (const event of res.value ?? []) {
      const organizer = event.organizer?.emailAddress?.address?.toLowerCase();
      const attendees: string[] = (event.attendees ?? [])
        .map((a: { emailAddress?: { address?: string } }) =>
          a.emailAddress?.address?.toLowerCase()
        )
        .filter(Boolean);

      for (const attendee of attendees) {
        if (organizer && attendee !== organizer) {
          pairs.push([organizer, attendee]);
          pairs.push([attendee, organizer]);
        }
      }
    }
    url = res["@odata.nextLink"] ?? null;
  }

  return pairs;
}
