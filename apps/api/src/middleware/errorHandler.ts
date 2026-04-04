import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(err.message, { stack: err.stack });
  const status = (err as any).status ?? 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production" && status === 500
        ? "Internal server error"
        : err.message,
  });
}
