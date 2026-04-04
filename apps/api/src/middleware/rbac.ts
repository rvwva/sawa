import { Request, Response, NextFunction } from "express";
import { AuthPayload } from "./auth";

type Role = "ADMIN" | "EXECUTIVE" | "EMPLOYEE";

/**
 * Require one of the given roles to access a route.
 * Must be used after requireAuth middleware.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/**
 * Ensure that an EXECUTIVE user can only access data for their own organisation.
 * Admins bypass this check.
 */
export function requireOrgAccess(getOrgId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthPayload;
    if (user.role === "ADMIN") return next();

    const targetOrgId = getOrgId(req);
    if (targetOrgId && targetOrgId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied: wrong organisation" });
    }
    next();
  };
}
