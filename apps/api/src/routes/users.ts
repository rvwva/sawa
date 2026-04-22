import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";

export const usersRouter = Router();

// POST /api/users — create a new EXECUTIVE/HR user (ADMIN only)
usersRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("firstName").notEmpty(),
    body("lastName").notEmpty(),
    body("role").isIn(["ADMIN", "EXECUTIVE"]),
    body("organisationId").optional().isString(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password, firstName, lastName, role, organisationId } = req.body;

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return res.status(409).json({ error: "Email already in use" });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, passwordHash, firstName, lastName, role, organisationId: organisationId ?? null },
      });

      await auditLog(AuditAction.USER_CREATED, {
        userId: req.user!.userId,
        entityType: "User",
        entityId: user.id,
        req,
      });

      return res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: "Email already in use" });
      }
      next(err);
    }
  }
);

// GET /api/users — list users (ADMIN only, or EXECUTIVE sees their org)
usersRouter.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter =
        req.user!.role === "ADMIN"
          ? (req.query.organisationId as string | undefined)
          : req.user!.organisationId!;

      const where = orgFilter ? { organisationId: orgFilter } : {};

      const users = await prisma.user.findMany({
        where: { ...where, deletedAt: null },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, organisationId: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json(users);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:id — soft-delete (ADMIN only)
usersRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ error: "User not found" });

      await prisma.user.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await auditLog(AuditAction.USER_DELETED, {
        userId: req.user!.userId,
        entityType: "User",
        entityId: req.params.id,
        req,
      });

      return res.json({ message: "User deactivated" });
    } catch (err) {
      next(err);
    }
  }
);
