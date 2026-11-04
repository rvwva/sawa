/**
 * Unit tests for planAccess.ts — canViewPlan and canUpdateStep.
 */

import { canViewPlan, canUpdateStep } from "../services/planAccess";
import { AuthPayload } from "../middleware/auth";

const ORG_A = "org-a";
const ORG_B = "org-b";
const DEPT_1 = "dept-1";
const DEPT_2 = "dept-2";

function admin(): AuthPayload {
  return { userId: "u1", email: "a@a.com", role: "ADMIN", organisationId: null };
}

function executive(orgId: string): AuthPayload {
  return { userId: "u2", email: "e@a.com", role: "EXECUTIVE", organisationId: orgId };
}

function manager(orgId: string, deptId: string): AuthPayload {
  return { userId: "u3", email: "m@a.com", role: "MANAGER", organisationId: orgId, departmentId: deptId };
}

function employee(): AuthPayload {
  return { userId: "u4", email: "emp@a.com", role: "EMPLOYEE", organisationId: ORG_A };
}

// ─── canViewPlan ─────────────────────────────────────────────────────────────

describe("canViewPlan", () => {
  const deptPlan = { organisationId: ORG_A, departmentId: DEPT_1 };
  const orgWidePlan = { organisationId: ORG_A, departmentId: null };

  it("ADMIN → true for any plan", () => {
    expect(canViewPlan(admin(), deptPlan)).toBe(true);
    expect(canViewPlan(admin(), orgWidePlan)).toBe(true);
  });

  it("EXECUTIVE same org → true", () => {
    expect(canViewPlan(executive(ORG_A), deptPlan)).toBe(true);
    expect(canViewPlan(executive(ORG_A), orgWidePlan)).toBe(true);
  });

  it("EXECUTIVE different org → false", () => {
    expect(canViewPlan(executive(ORG_B), deptPlan)).toBe(false);
  });

  it("MANAGER same org same dept → true", () => {
    expect(canViewPlan(manager(ORG_A, DEPT_1), deptPlan)).toBe(true);
  });

  it("MANAGER same org different dept → false", () => {
    expect(canViewPlan(manager(ORG_A, DEPT_2), deptPlan)).toBe(false);
  });

  it("MANAGER same org org-wide plan (null dept) → true", () => {
    expect(canViewPlan(manager(ORG_A, DEPT_1), orgWidePlan)).toBe(true);
  });

  it("MANAGER different org → false", () => {
    expect(canViewPlan(manager(ORG_B, DEPT_1), deptPlan)).toBe(false);
  });

  it("EMPLOYEE → false", () => {
    expect(canViewPlan(employee(), deptPlan)).toBe(false);
  });
});

// ─── canUpdateStep ───────────────────────────────────────────────────────────

describe("canUpdateStep", () => {
  const step = { plan: { organisationId: ORG_A, departmentId: DEPT_1 } };

  it("ADMIN → true", () => {
    expect(canUpdateStep(admin(), step)).toBe(true);
  });

  it("EXECUTIVE same org → true", () => {
    expect(canUpdateStep(executive(ORG_A), step)).toBe(true);
  });

  it("EXECUTIVE wrong org → false", () => {
    expect(canUpdateStep(executive(ORG_B), step)).toBe(false);
  });

  it("MANAGER same dept → true", () => {
    expect(canUpdateStep(manager(ORG_A, DEPT_1), step)).toBe(true);
  });

  it("MANAGER different dept → false", () => {
    expect(canUpdateStep(manager(ORG_A, DEPT_2), step)).toBe(false);
  });
});
