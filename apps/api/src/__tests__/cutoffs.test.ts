/**
 * Unit tests for SCALE_SIGNALS comparison logic.
 *
 * Tests every band edge named in the task spec:
 *   CBI         ≥50 = risk, ≥75 = urgent
 *   PSYCH_SAFETY ≤49 = risk
 *   LMX7         ≤44 = risk
 *   TURNOVER     ≥60 = risk
 *
 * Uses the exported classifyScaleScore helper so there is no
 * Prisma or Express dependency here.
 */

import { classifyScaleScore, classifyScaleScores } from "../services/onaCorrelation";

// ─── CBI:total ─────────────────────────────────────────────────────────────

describe("CBI:total — higher_is_worse, risk ≥50, urgent ≥75", () => {
  it("score 49 → healthy", () => {
    expect(classifyScaleScore("CBI:total", 49)).toBe("healthy");
  });

  it("score 50 → risk", () => {
    expect(classifyScaleScore("CBI:total", 50)).toBe("risk");
  });

  it("score 74 → risk (not yet urgent)", () => {
    expect(classifyScaleScore("CBI:total", 74)).toBe("risk");
  });

  it("score 75 → urgent", () => {
    expect(classifyScaleScore("CBI:total", 75)).toBe("urgent");
  });

  it("score 100 → urgent", () => {
    expect(classifyScaleScore("CBI:total", 100)).toBe("urgent");
  });
});

// ─── PSYCH_SAFETY:total ────────────────────────────────────────────────────

describe("PSYCH_SAFETY:total — higher_is_better, risk ≤49", () => {
  it("score 49 → risk", () => {
    expect(classifyScaleScore("PSYCH_SAFETY:total", 49)).toBe("risk");
  });

  it("score 50 → healthy", () => {
    expect(classifyScaleScore("PSYCH_SAFETY:total", 50)).toBe("healthy");
  });

  it("score 0 → risk", () => {
    expect(classifyScaleScore("PSYCH_SAFETY:total", 0)).toBe("risk");
  });
});

// ─── LMX7:total ────────────────────────────────────────────────────────────

describe("LMX7:total — higher_is_better, risk ≤44", () => {
  it("score 44 → risk", () => {
    expect(classifyScaleScore("LMX7:total", 44)).toBe("risk");
  });

  it("score 45 → healthy", () => {
    expect(classifyScaleScore("LMX7:total", 45)).toBe("healthy");
  });
});

// ─── TURNOVER:total ────────────────────────────────────────────────────────

describe("TURNOVER:total — higher_is_worse, risk ≥60", () => {
  it("score 59 → healthy", () => {
    expect(classifyScaleScore("TURNOVER:total", 59)).toBe("healthy");
  });

  it("score 60 → risk", () => {
    expect(classifyScaleScore("TURNOVER:total", 60)).toBe("risk");
  });

  it("score 100 → risk", () => {
    expect(classifyScaleScore("TURNOVER:total", 100)).toBe("risk");
  });
});

// ─── Minimum respondent floor (anonymity guard) ────────────────────────────

describe("classifyScaleScores — MIN_DEPT_RESPONDENTS floor", () => {
  it("4 CBI scores of 90 → null (below minimum, no signal emitted)", () => {
    expect(classifyScaleScores("CBI:total", [90, 90, 90, 90])).toBeNull();
  });

  it("5 CBI scores of 90 → urgent (above minimum, signal emitted)", () => {
    expect(classifyScaleScores("CBI:total", [90, 90, 90, 90, 90])).toBe("urgent");
  });
});

// ─── Unknown scale key ─────────────────────────────────────────────────────

describe("unknown scale key", () => {
  it("returns healthy", () => {
    expect(classifyScaleScore("UNKNOWN:total", 99)).toBe("healthy");
  });
});
