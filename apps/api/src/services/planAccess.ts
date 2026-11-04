import { AuthPayload } from "../middleware/auth";

export interface PlanRef {
  organisationId: string;
  departmentId: string | null;
}

export interface StepRef {
  plan: PlanRef;
}

/**
 * Returns true if the user may read the plan.
 * - ADMIN: always.
 * - EXECUTIVE: same org.
 * - MANAGER: same org, and either org-wide plan (departmentId null) or same dept.
 */
export function canViewPlan(user: AuthPayload, plan: PlanRef): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "EXECUTIVE") return user.organisationId === plan.organisationId;
  if (user.role === "MANAGER") {
    if (user.organisationId !== plan.organisationId) return false;
    if (plan.departmentId === null) return true;
    return (user.departmentId ?? null) === plan.departmentId;
  }
  return false;
}

/**
 * Returns true if the user may update a step (change state, add update entry).
 * Same rules as canViewPlan.
 */
export function canUpdateStep(user: AuthPayload, step: StepRef): boolean {
  return canViewPlan(user, step.plan);
}
