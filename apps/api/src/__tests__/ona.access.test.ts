/**
 * Access-control tests for ONA result endpoints.
 *
 * Rules under test:
 *   - EMPLOYEE          → 403 on any ONA results route
 *   - EXECUTIVE (other) → 403 when requesting a different org's data
 *   - EXECUTIVE (own)   → 200
 *   - ADMIN             → 200 (platform-wide access)
 */

process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { onaRouter } from "../routes/ona";

const SECRET = process.env.JWT_SECRET!;
const ORG_A = "org-a-00000000";
const ORG_B = "org-b-00000000";

function token(role: "ADMIN" | "EXECUTIVE" | "EMPLOYEE", orgId: string | null = null) {
  return jwt.sign({ userId: `user-${role}`, email: `${role}@test.com`, role, organisationId: orgId }, SECRET, {
    expiresIn: "1h",
  });
}

const adminToken     = token("ADMIN",     null);
const execSameToken  = token("EXECUTIVE", ORG_A);
const execOtherToken = token("EXECUTIVE", ORG_B);
const employeeToken  = token("EMPLOYEE",  ORG_A);

const app = express();
app.use(express.json());
app.use("/api/ona", onaRouter);

// ─── GET /api/ona/results/:orgId ──────────────────────────────────────────────

describe("GET /api/ona/results/:orgId", () => {
  it("EMPLOYEE → 403", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("EXECUTIVE of a different organisation → 403", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}`)
      .set("Authorization", `Bearer ${execOtherToken}`);
    expect(res.status).toBe(403);
  });

  it("EXECUTIVE of the same organisation → 200", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}`)
      .set("Authorization", `Bearer ${execSameToken}`);
    expect(res.status).toBe(200);
  });

  it("ADMIN → 200", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("No token → 401", async () => {
    const res = await request(app).get(`/api/ona/results/${ORG_A}`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/ona/results/:orgId/department/:deptId ───────────────────────────

describe("GET /api/ona/results/:orgId/department/:deptId", () => {
  it("EMPLOYEE → 403", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}/department/dept-1`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("EXECUTIVE of a different organisation → 403", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}/department/dept-1`)
      .set("Authorization", `Bearer ${execOtherToken}`);
    expect(res.status).toBe(403);
  });

  it("EXECUTIVE of the same organisation but deptId not in org → 404", async () => {
    // Mock returns null for department.findFirst (dept doesn't belong to org)
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}/department/dept-unknown`)
      .set("Authorization", `Bearer ${execSameToken}`);
    expect(res.status).toBe(404);
  });

  it("ADMIN with unknown deptId → 404 (not 403)", async () => {
    const res = await request(app)
      .get(`/api/ona/results/${ORG_A}/department/dept-unknown`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
