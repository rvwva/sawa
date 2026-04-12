import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";

export const authRouter = Router();

const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }),
];

function issueTokens(userId: string, email: string, role: string, organisationId: string | null) {
  const payload = { userId, email, role, organisationId };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as StringValue,
  });
  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN ?? "30d") as StringValue,
  });
  return { accessToken, refreshToken };
}

// POST /api/auth/login
authRouter.post("/login", loginValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.deletedAt) {
    await auditLog(AuditAction.LOGIN_FAILED, { metadata: { email }, req });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await auditLog(AuditAction.LOGIN_FAILED, { userId: user.id, req });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const { accessToken, refreshToken } = issueTokens(
    user.id,
    user.email,
    user.role,
    user.organisationId
  );

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditLog(AuditAction.LOGIN_SUCCESS, { userId: user.id, req });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organisationId: user.organisationId,
    },
  });
});

// POST /api/auth/refresh
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as { userId: string };

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "Refresh token invalid or expired" });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found" });

    const tokens = issueTokens(user.id, user.email, user.role, user.organisationId);

    // Rotate refresh token
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: tokens.refreshToken, expiresAt },
    });

    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// POST /api/auth/logout
authRouter.post("/logout", requireAuth, async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }
  await auditLog(AuditAction.LOGOUT, { userId: req.user?.userId, req });
  return res.json({ message: "Logged out" });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organisationId: true,
      lastLoginAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
});
