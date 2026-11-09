import { AuthPayload } from "../middleware/auth";

export interface PlanRef {
  organisationId: string;
  departmentId: string | null;
}

export interface StepRef {
  ownerUserId: string | null;
  plan: PlanRef;
}

/**
 * - ADMIN: always.
 * - EXECUTIVE: same organisation.
 * - MANAGER: same organisation and the plan's department is the manager's own.
 *   Organisation-wide plans (departmentId null) are not visible to managers.
 */
export function canViewPlan(user: AuthPayload, plan: PlanRef): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "EXECUTIVE") return user.organisationId === plan.organisationId;
  if (user.role === "MANAGER") {
    return (
      !!user.departmentId &&
      plan.departmentId !== null &&
      user.organisationId === plan.organisationId &&
      user.departmentId === plan.departmentId
    );
  }
  return false;
}

/**
 * - ADMIN: always.
 * - EXECUTIVE: same organisation.
 * - MANAGER: only steps assigned to them.
 */
export function canUpdateStep(user: AuthPayload, step: StepRef): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "EXECUTIVE") return user.organisationId === step.plan.organisationId;
  if (user.role === "MANAGER") return step.ownerUserId !== null && step.ownerUserId === user.userId;
  return false;
}
