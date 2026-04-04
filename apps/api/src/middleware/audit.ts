import { Request, Response, NextFunction } from "express";
import { AuditAction } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

/**
 * Log an audit event to the database.
 * Fire-and-forget — never throws.
 */
export async function auditLog(
  action: AuditAction,
  options: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    req?: Request;
  } = {}
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: options.userId ?? null,
        entityType: options.entityType ?? null,
        entityId: options.entityId ?? null,
        metadata: options.metadata ?? undefined,
        ipAddress: options.req
          ? (options.req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
            options.req.socket.remoteAddress ??
            null
          : null,
        userAgent: options.req?.headers["user-agent"] ?? null,
      },
    });
  } catch (err) {
    logger.error("Failed to write audit log", { err, action });
  }
}

/**
 * Express middleware that logs the authenticated user action.
 * Use via: router.post("/path", auditMiddleware(AuditAction.RESPONSE_SUBMITTED), handler)
 */
export function auditMiddleware(action: AuditAction) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Non-blocking
    auditLog(action, { userId: req.user?.userId, req }).catch(() => {});
    next();
  };
}
