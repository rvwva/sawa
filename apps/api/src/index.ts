import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth";
import { assessmentsRouter } from "./routes/assessments";
import { responsesRouter } from "./routes/responses";
import { resultsRouter } from "./routes/results";
import { reportsRouter } from "./routes/reports";
import { usersRouter } from "./routes/users";
import { adminRouter } from "./routes/admin";
import { dataRightsRouter } from "./routes/dataRights";
import { onaRouter } from "./routes/ona";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./lib/logger";
import { checkDatabaseConnection } from "./lib/prisma";
import { startScheduler } from "./services/scheduler";

const app = express();
app.set("trust proxy", 1);
const PORT = parseInt(process.env.API_PORT ?? "4000", 10);

// ─── Security & parsing ────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "https://mindlign.com",
      "https://www.mindlign.com",
      "https://web-service-production-a431.up.railway.app",
    ],
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Rate limiting ─────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Stricter limit on submission endpoints to prevent flooding
const submissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  message: { error: "Too many submissions from this IP. Please wait and try again." },
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/assessments", assessmentsRouter);
app.use("/api/responses", submissionLimiter, responsesRouter);
app.use("/api/results", resultsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/data-rights", dataRightsRouter);
app.use("/api/ona", onaRouter);

app.get("/api/health", async (_req, res) => {
  const dbOk = await checkDatabaseConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});

// ─── Error handler ─────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Mindlign API running on port ${PORT} [${process.env.NODE_ENV}]`);
  startScheduler();
});

export default app;
