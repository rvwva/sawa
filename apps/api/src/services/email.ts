/**
 * Sawa Email Service — SendGrid
 * ================================
 * All transactional emails sent by the platform.
 * Templates are inline HTML; in production swap for SendGrid dynamic templates.
 */

import sgMail from "@sendgrid/mail";
import { logger } from "../lib/logger";

sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");

const FROM = {
  email: process.env.EMAIL_FROM ?? "noreply@sawa.app",
  name: process.env.EMAIL_FROM_NAME ?? "Sawa Platform",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CycleInviteParams {
  recipientEmails: string[];   // HR distributes to employees
  organisationName: string;
  assessmentName: string;
  cycleTitle: string;
  assessmentUrl: string;       // full URL with link token
  endsAt: Date;
}

export interface CycleReminderParams extends CycleInviteParams {
  daysRemaining: number;
}

export interface CycleClosedParams {
  recipientEmail: string;
  organisationName: string;
  cycleTitle: string;
  assessmentName: string;
  respondentCount: number;
  dashboardUrl: string;
}

export interface WeeklyReportParams {
  recipientEmail: string;
  recipientName: string;
  organisationName: string;
  periodLabel: string;          // e.g. "Week of 1–7 April 2026"
  dashboardUrl: string;
  highlights: {
    totalRespondents: number;
    avgScore: number | null;
    topDimension?: string;
    lowestDimension?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

function htmlWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin:0; padding:0; background:#f9fafb; color:#111827; }
    .container { max-width:600px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background:#d97c2a; padding:28px 32px; }
    .header h1 { color:#fff; margin:0; font-size:24px; font-weight:700; }
    .header p { color:rgba(255,255,255,.85); margin:4px 0 0; font-size:14px; }
    .body { padding:32px; }
    .body p { line-height:1.7; color:#374151; margin:0 0 16px; }
    .cta { display:inline-block; background:#d97c2a; color:#fff !important; text-decoration:none; padding:14px 28px; border-radius:10px; font-weight:600; font-size:15px; margin:8px 0 24px; }
    .footer { padding:20px 32px; border-top:1px solid #f3f4f6; font-size:12px; color:#9ca3af; }
    .stat { display:inline-block; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 20px; margin:6px; text-align:center; }
    .stat-value { font-size:28px; font-weight:700; color:#d97c2a; }
    .stat-label { font-size:12px; color:#6b7280; margin-top:4px; }
    .notice { background:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:12px 16px; font-size:13px; color:#92400e; margin:16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sawa · سواء</h1>
      <p>Workplace Culture & People Intelligence</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      © Sawa Platform · Riyadh, Saudi Arabia<br>
      This message is confidential and intended only for the named recipient.
    </div>
  </div>
</body>
</html>`;
}

// ─── Email senders ────────────────────────────────────────────────────────────

/**
 * Send assessment invitations to a list of employee emails.
 * Each recipient gets their own email (BCC not used — each may be unique in future).
 */
export async function sendCycleInvite(params: CycleInviteParams): Promise<void> {
  const body = `
    <p>Hi there,</p>
    <p>
      <strong>${params.organisationName}</strong> has launched a new assessment:
      <strong>${params.cycleTitle}</strong>.
    </p>
    <p>
      This is an anonymous ${params.assessmentName} — your responses cannot be linked
      back to you individually. The assessment takes approximately 5–10 minutes to complete.
    </p>
    <div class="notice">
      📅 <strong>Deadline:</strong> ${formatDate(params.endsAt)}
    </div>
    <a href="${params.assessmentUrl}" class="cta">Start Assessment →</a>
    <p style="font-size:13px;color:#6b7280;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <span style="color:#d97c2a;">${params.assessmentUrl}</span>
    </p>
    <p>
      Your participation helps build a healthier workplace for everyone.
      Participation is completely voluntary.
    </p>
  `;

  const messages = params.recipientEmails.map((to) => ({
    to,
    from: FROM,
    subject: `Action required: ${params.cycleTitle} — ${params.organisationName}`,
    html: htmlWrapper(`${params.cycleTitle} — Assessment Invitation`, body),
  }));

  try {
    await sgMail.send(messages as any);
    logger.info(`Cycle invite sent to ${messages.length} recipients`, {
      cycleTitle: params.cycleTitle,
    });
  } catch (err) {
    logger.error("Failed to send cycle invite emails", { err });
    throw err;
  }
}

/**
 * Reminder email sent N days before the cycle closes.
 */
export async function sendCycleReminder(params: CycleReminderParams): Promise<void> {
  const body = `
    <p>Hi there,</p>
    <p>
      A friendly reminder: the <strong>${params.cycleTitle}</strong> assessment at
      <strong>${params.organisationName}</strong> closes in
      <strong>${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""}</strong>.
    </p>
    <div class="notice">
      ⏰ <strong>Deadline:</strong> ${formatDate(params.endsAt)}
    </div>
    <p>If you haven't already responded, please take a few minutes to complete it.</p>
    <a href="${params.assessmentUrl}" class="cta">Complete Assessment →</a>
    <p style="font-size:13px;color:#6b7280;">
      Your participation is anonymous and voluntary.
    </p>
  `;

  const messages = params.recipientEmails.map((to) => ({
    to,
    from: FROM,
    subject: `Reminder: ${params.cycleTitle} closes in ${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""}`,
    html: htmlWrapper("Assessment Reminder", body),
  }));

  try {
    await sgMail.send(messages as any);
    logger.info(`Cycle reminder sent to ${messages.length} recipients`);
  } catch (err) {
    logger.error("Failed to send reminder emails", { err });
    throw err;
  }
}

/**
 * Notification to HR/Executive when a cycle closes — links to results dashboard.
 */
export async function sendCycleClosedNotification(params: CycleClosedParams): Promise<void> {
  const body = `
    <p>Hi,</p>
    <p>
      The assessment cycle <strong>${params.cycleTitle}</strong>
      (${params.assessmentName}) for <strong>${params.organisationName}</strong> has closed.
    </p>
    <div style="text-align:center;padding:16px 0;">
      <div class="stat">
        <div class="stat-value">${params.respondentCount}</div>
        <div class="stat-label">Total Respondents</div>
      </div>
    </div>
    <p>
      Your results dashboard is now ready. Click below to view aggregated scores,
      department breakdowns, and trend data.
    </p>
    <a href="${params.dashboardUrl}" class="cta">View Results Dashboard →</a>
    <p style="font-size:13px;color:#6b7280;">
      All results are aggregated — individual responses are never displayed.
      Department breakdowns are only shown where there are 5 or more respondents.
    </p>
  `;

  try {
    await sgMail.send({
      to: params.recipientEmail,
      from: FROM,
      subject: `Results ready: ${params.cycleTitle} — ${params.respondentCount} responses`,
      html: htmlWrapper("Assessment Results Ready", body),
    });
    logger.info("Cycle closed notification sent", { to: params.recipientEmail });
  } catch (err) {
    logger.error("Failed to send cycle closed notification", { err });
    throw err;
  }
}

/**
 * Weekly/monthly summary report email for HR/Executive users.
 */
export async function sendReportEmail(params: WeeklyReportParams): Promise<void> {
  const avgScoreHtml = params.highlights.avgScore !== null
    ? `<div class="stat"><div class="stat-value">${params.highlights.avgScore.toFixed(1)}</div><div class="stat-label">Avg Score / 100</div></div>`
    : "";

  const dimensionHtml = params.highlights.topDimension
    ? `<p>
        💪 <strong>Strongest dimension:</strong> ${params.highlights.topDimension}<br>
        ${params.highlights.lowestDimension ? `⚠ <strong>Needs attention:</strong> ${params.highlights.lowestDimension}` : ""}
       </p>`
    : "";

  const body = `
    <p>Hi ${params.recipientName},</p>
    <p>Here is your Sawa people intelligence summary for <strong>${params.organisationName}</strong>.</p>
    <p style="font-size:13px;color:#6b7280;">Period: ${params.periodLabel}</p>
    <div style="text-align:center;padding:16px 0;">
      <div class="stat">
        <div class="stat-value">${params.highlights.totalRespondents}</div>
        <div class="stat-label">Respondents</div>
      </div>
      ${avgScoreHtml}
    </div>
    ${dimensionHtml}
    <a href="${params.dashboardUrl}" class="cta">Open Full Dashboard →</a>
    <p style="font-size:13px;color:#6b7280;">
      This report is generated automatically. Results are aggregated and anonymous.
    </p>
  `;

  try {
    await sgMail.send({
      to: params.recipientEmail,
      from: FROM,
      subject: `Sawa report — ${params.periodLabel} · ${params.organisationName}`,
      html: htmlWrapper("People Intelligence Report", body),
    });
    logger.info("Report email sent", { to: params.recipientEmail });
  } catch (err) {
    logger.error("Failed to send report email", { err });
    throw err;
  }
}
