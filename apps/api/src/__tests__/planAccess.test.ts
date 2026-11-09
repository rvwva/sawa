import { canViewPlan, canUpdateStep } from "../services/planAccess";
import { AuthPayload } from "../middleware/auth";

const ORG_A = "org-a";
const ORG_B = "org-b";
const DEPT_1 = "dept-1";
const DEPT_2 = "dept-2";

const admin: AuthPayload = { userId: "admin", email: "a@x.com", role: "ADMIN", organisationId: null };
const exec = (org: string): AuthPayload => ({ userId: "exec", email: "e@x.com", role: "EXECUTIVE", organisationId: org });
const manager = (org: string, dept: string | null, userId = "mgr"): AuthPayload => ({
  userId,
  email: "m@x.com",
  role: "MANAGER",
  organisationId: org,
  departmentId: dept,
});
const employee: AuthPayload = { userId: "emp", email: "x@x.com", role: "EMPLOYEE", organisationId: ORG_A };

describe("canViewPlan", () => {
  const deptPlan = { organisationId: ORG_A, departmentId: DEPT_1 };
  const orgWide = { organisationId: ORG_A, departmentId: null };

  it("ADMIN sees every plan", () => {
    expect(canViewPlan(admin, deptPlan)).toBe(true);
    expect(canViewPlan(admin, orgWide)).toBe(true);
  });

  it("EXECUTIVE sees own-org plans, including org-wide", () => {
    expect(canViewPlan(exec(ORG_A), deptPlan)).toBe(true);
    expect(canViewPlan(exec(ORG_A), orgWide)).toBe(true);
  });

  it("EXECUTIVE of another org → false", () => {
    expect(canViewPlan(exec(ORG_B), deptPlan)).toBe(false);
  });

  it("MANAGER sees own department's plan", () => {
    expect(canViewPlan(manager(ORG_A, DEPT_1), deptPlan)).toBe(true);
  });

  it("MANAGER cannot see another department's plan", () => {
    expect(canViewPlan(manager(ORG_A, DEPT_2), deptPlan)).toBe(false);
  });

  it("MANAGER cannot see organisation-wide plans", () => {
    expect(canViewPlan(manager(ORG_A, DEPT_1), orgWide)).toBe(false);
  });

  it("MANAGER without a department sees nothing", () => {
    expect(canViewPlan(manager(ORG_A, null), deptPlan)).toBe(false);
    expect(canViewPlan(manager(ORG_A, null), orgWide)).toBe(false);
  });

  it("MANAGER of another org with same dept id → false", () => {
    expect(canViewPlan(manager(ORG_B, DEPT_1), deptPlan)).toBe(false);
  });

  it("EMPLOYEE → false", () => {
    expect(canViewPlan(employee, deptPlan)).toBe(false);
  });
});

describe("canUpdateStep", () => {
  const plan = { organisationId: ORG_A, departmentId: DEPT_1 };
  const ownedByMgr = { ownerUserId: "mgr", plan };
  const ownedByOther = { ownerUserId: "someone-else", plan };
  const unowned = { ownerUserId: null, plan };

  it("ADMIN → true", () => {
    expect(canUpdateStep(admin, ownedByOther)).toBe(true);
  });

  it("EXECUTIVE same org → true regardless of owner", () => {
    expect(canUpdateStep(exec(ORG_A), ownedByOther)).toBe(true);
    expect(canUpdateStep(exec(ORG_A), unowned)).toBe(true);
  });

  it("EXECUTIVE other org → false", () => {
    expect(canUpdateStep(exec(ORG_B), ownedByOther)).toBe(false);
  });

  it("MANAGER who owns the step → true", () => {
    expect(canUpdateStep(manager(ORG_A, DEPT_1, "mgr"), ownedByMgr)).toBe(true);
  });

  it("MANAGER in the same department but not the owner → false", () => {
    expect(canUpdateStep(manager(ORG_A, DEPT_1, "mgr"), ownedByOther)).toBe(false);
  });

  it("MANAGER on an unassigned step → false", () => {
    expect(canUpdateStep(manager(ORG_A, DEPT_1, "mgr"), unowned)).toBe(false);
  });

  it("EMPLOYEE → false", () => {
    expect(canUpdateStep(employee, ownedByMgr)).toBe(false);
  });
});
