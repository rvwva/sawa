"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import ScoreGauge from "@/components/ui/ScoreGauge";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { dir, Lang, useTranslations, translateBand } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashStats = {
  totalCycles: number;
  activeCycles: number;
  totalRespondents: number;
  avgScore: number | null;
};

type Cycle = {
  id: string;
  title: string;
  status: string;
  assessment: { type: string; name: string; nameAr?: string };
  _count: { respondents: number };
  startsAt: string;
  endsAt: string;
};

type SubscaleAgg = {
  subscale: string;
  label: string;
  avg: number;
  band: string;
  bandDistribution: Record<string, number>;
  count: number;
};

type CycleResult = {
  cycleId: string;
  title: string;
  status: string;
  assessment: { type: string; name: string; nameAr?: string };
  organisation: { id: string; name: string };
  respondentCount: number;
  subscales: SubscaleAgg[];
  overall: SubscaleAgg | null;
};

type DeptResult = {
  departmentId: string;
  departmentName: string;
  respondentCount: number;
  subscales: SubscaleAgg[];
};

type DeptResponse = {
  cycleId: string;
  departments: DeptResult[];
  organisation: { respondentCount: number; subscales: SubscaleAgg[] };
  minimumRespondentsRequired: number;
};

type TrendPoint = {
  cycleId: string;
  cycleTitle: string;
  endsAt: string;
  respondentCount: number;
  avgTotal: number | null;
};

type TrendData = {
  assessmentType: string;
  assessmentName: string;
  dataPoints: TrendPoint[];
};

type ResponseRate = {
  submitted: number;
  started: number;
  total: number;
  submissionRate: number;
  byDepartment: Array<{
    departmentId: string;
    departmentName: string;
    submitted: number;
    meetsMinimum: boolean;
  }>;
};

// ─── Arabic subscale label map ────────────────────────────────────────────────

const subscaleAr: Record<string, string> = {
  personal_burnout:    "الإرهاق الشخصي",
  work_burnout:        "الإرهاق المهني",
  client_burnout:      "إرهاق العميل",
  total:               "الإجمالي",
  leadership:          "القيادة الفعّالة",
  communication:       "التواصل والشفافية",
  innovation:          "الابتكار والمرونة",
  psychological_safety:"السلامة النفسية",
  inclusion:           "الشمول والانتماء",
  growth:              "النمو والتطوير",
  work_life_balance:   "التوازن بين العمل والحياة",
  recognition:         "التقدير والمكافأة",
  collaboration:       "التعاون والعمل الجماعي",
};

// ─── Score colour helpers ─────────────────────────────────────────────────────

function bandColor(band: string): string {
  if (band === "Good" || band === "Thriving" || band === "Healthy") return "text-green-600";
  if (band === "Moderate") return "text-amber-600";
  if (band === "Below Average" || band === "Developing") return "text-orange-500";
  return "text-red-600";
}

function bandBg(band: string): string {
  if (band === "Good" || band === "Thriving" || band === "Healthy") return "bg-green-50 border-green-200";
  if (band === "Moderate") return "bg-amber-50 border-amber-200";
  if (band === "Below Average" || band === "Developing") return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function scoreBarColor(band: string): string {
  if (band === "Good" || band === "Thriving" || band === "Healthy") return "#16a34a";
  if (band === "Moderate") return "#d97706";
  if (band === "Below Average" || band === "Developing") return "#f97316";
  return "#dc2626";
}

function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = useTranslations(lang);

  const [user, setUser]             = useState<any>(null);
  const [stats, setStats]           = useState<DashStats | null>(null);
  const [cycles, setCycles]         = useState<Cycle[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  // Per-cycle detail
  const [cycleResult, setCycleResult] = useState<CycleResult | null>(null);
  const [deptData, setDeptData]       = useState<DeptResponse | null>(null);
  const [trendData, setTrendData]     = useState<TrendData | null>(null);
  const [rateData, setRateData]       = useState<ResponseRate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const storedUser = localStorage.getItem("sawa_user");
    const token = localStorage.getItem("sawa_token");
    if (!storedUser || !token) { router.push("/login"); return; }

    const u = JSON.parse(storedUser);
    setUser(u);
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/dashboard/${u.organisationId}`, { headers }).then((r) => r.ok ? r.json() : null),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/cycles?organisationId=${u.organisationId}`, { headers }).then((r) => r.ok ? r.json() : []),
    ])
      .then(([s, c]) => {
        if (s) setStats(s);
        const list: Cycle[] = Array.isArray(c) ? c : [];
        setCycles(list);
        // Auto-select the most recent active cycle
        const active = list.find((x) => x.status === "ACTIVE") ?? list[0];
        if (active) setSelectedId(active.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // ── Load cycle detail when selection changes ───────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    const token = localStorage.getItem("sawa_token");
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    setDetailLoading(true);
    setCycleResult(null);
    setDeptData(null);
    setTrendData(null);
    setRateData(null);
    setDetailError("");

    const base = `${process.env.NEXT_PUBLIC_API_URL}/results/cycle/${selectedId}`;

    Promise.all([
      fetch(base, { headers }).then((r) => { if (!r.ok) throw new Error("cycle"); return r.json(); }),
      fetch(`${base}/departments`, { headers }).then((r) => { if (!r.ok) throw new Error("dept"); return r.json(); }),
      fetch(`${base}/trend`, { headers }).then((r) => { if (!r.ok) throw new Error("trend"); return r.json(); }),
      fetch(`${base}/response-rate`, { headers }).then((r) => { if (!r.ok) throw new Error("rate"); return r.json(); }),
    ])
      .then(([cr, dd, td, rd]) => {
        setCycleResult(cr);
        setDeptData(dd);
        setTrendData(td);
        setRateData(rd);
      })
      .catch(() => setDetailError(lang === "ar" ? "تعذّر تحميل بيانات الدورة." : "Failed to load cycle data."))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Live polling: refresh response-rate every 30s for ACTIVE cycles ──────

  useEffect(() => {
    if (!selectedId) return;
    const cycle = cycles.find((c) => c.id === selectedId);
    if (cycle?.status !== "ACTIVE") return;

    const token = localStorage.getItem("sawa_token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const base = `${process.env.NEXT_PUBLIC_API_URL}/results/cycle/${selectedId}`;

    const id = setInterval(() => {
      fetch(`${base}/response-rate`, { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((rd) => { if (rd) setRateData(rd); })
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(id);
  }, [selectedId, cycles]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function downloadPDF() {
    if (!exportRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF }       = await import("jspdf");

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f9fafb",
      });

      const imgData   = canvas.toDataURL("image/jpeg", 0.88);
      const pdf       = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW     = pdf.internal.pageSize.getWidth();
      const pageH     = pdf.internal.pageSize.getHeight();
      const imgH      = (canvas.height / canvas.width) * pageW;
      let   y         = 0;

      // Multi-page support: slice canvas across A4 pages
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -y, pageW, imgH);
        y += pageH;
      }

      const cycleName = cycleResult?.title ?? "dashboard";
      const dateStr   = new Date().toISOString().split("T")[0];
      pdf.save(`sawa-${cycleName.replace(/\s+/g, "-").toLowerCase()}-${dateStr}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setPdfLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem("sawa_token");
    localStorage.removeItem("sawa_user");
    router.push("/login");
  }

  // Risk flag: score dropped ≥10 points vs previous cycle
  const riskDrop = (() => {
    if (!trendData || trendData.dataPoints.length < 2) return null;
    const pts = [...trendData.dataPoints].sort(
      (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()
    );
    const curr = pts[0]?.avgTotal;
    const prev = pts[1]?.avgTotal;
    if (curr == null || prev == null) return null;
    const drop = Math.round(prev - curr);
    return drop >= 10 ? drop : null;
  })();

  // Trend chart data (ascending chronological)
  const trendChartData = trendData
    ? [...trendData.dataPoints]
        .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
        .map((p) => ({
          name: p.cycleTitle.length > 14 ? p.cycleTitle.slice(0, 14) + "…" : p.cycleTitle,
          score: p.avgTotal,
          n: p.respondentCount,
        }))
    : [];

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div dir={dir(lang)} className="min-h-screen bg-gray-50">

      {/* ── Nav ── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span className="font-bold text-brand-600 text-xl tracking-tight">Sawa · سواء</span>
          <div className="flex items-center gap-3">
            <LanguageToggle lang={lang} onChange={setLang} />
            <button
              onClick={downloadPDF}
              disabled={pdfLoading}
              title={lang === "ar" ? "تنزيل PDF" : "Download PDF"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 bg-white/80 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>
            <span className="text-sm text-gray-500 hidden sm:block">
              {user.firstName} {user.lastName}
            </span>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              {t("exec_sign_out")}
            </button>
          </div>
        </div>
      </header>

      <main ref={exportRef} className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Title ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("exec_title")}</h1>
          <p className="text-gray-500 mt-1">{t("exec_welcome")}, {user.firstName}.</p>
        </div>

        {/* ── KPI Stats ── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={t("stat_total_cycles")}  value={stats.totalCycles} />
            <StatCard label={t("stat_active_cycles")} value={stats.activeCycles} highlight />
            <StatCard label={t("stat_respondents")}   value={stats.totalRespondents} />
            <StatCard
              label={t("stat_avg_score")}
              value={stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
            />
          </div>
        )}

        {/* ── Cycle selector ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          {cycles.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-gray-500">{t("cycle_no_cycles")}</p>
              <p className="text-sm text-gray-400">{t("cycle_create_first")}</p>
              <Link
                href="/dashboard/cycles/new"
                className="inline-block mt-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                {t("exec_new_cycle")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700 shrink-0">
                {t("cycle_prompt")}
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.assessment?.name} ({c.status})
                  </option>
                ))}
              </select>
              <Link
                href="/dashboard/cycles/new"
                className="shrink-0 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                {t("exec_new_cycle")}
              </Link>
            </div>
          )}
        </div>

        {/* ── Cycle detail ── */}
        {selectedId && (
          <div className="space-y-6">
            {detailLoading ? (
              <div className="flex justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                  <p className="text-sm text-gray-500">{t("loading_results")}</p>
                </div>
              </div>
            ) : detailError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700 text-sm">
                {detailError}
              </div>
            ) : (
              <>
                {/* Risk flag */}
                {riskDrop !== null && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                    <span className="text-2xl mt-0.5">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-700">{t("risk_title")}</p>
                      <p className="text-sm text-red-600 mt-0.5">
                        {t("risk_desc_pre")} <strong>{riskDrop}</strong> {t("risk_desc_post")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Participation panel */}
                {rateData && (
                  <ParticipationPanel rateData={rateData} lang={lang} t={t} />
                )}

                {/* Organisation scores */}
                {cycleResult && cycleResult.respondentCount > 0 ? (
                  <ScorePanel result={cycleResult} lang={lang} t={t} />
                ) : cycleResult ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
                    {t("no_submissions")}
                  </div>
                ) : null}

                {/* Trend chart */}
                {trendData && trendChartData.length > 0 && (
                  <TrendPanel
                    chartData={trendChartData}
                    assessmentName={trendData.assessmentName}
                    lang={lang}
                    t={t}
                  />
                )}

                {/* Department breakdown */}
                {deptData && (
                  <DeptPanel deptData={deptData} lang={lang} t={t} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Cycles table ── */}
        <CyclesTable
          cycles={cycles}
          selectedId={selectedId}
          onSelect={setSelectedId}
          lang={lang}
          t={t}
        />

      </main>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "bg-brand-500 border-brand-600 text-white" : "bg-white border-gray-200"}`}>
      <p className={`text-sm ${highlight ? "text-brand-100" : "text-gray-500"}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

// ─── Score Panel ──────────────────────────────────────────────────────────────

function ScorePanel({ result, lang, t }: { result: CycleResult; lang: Lang; t: (k: any) => string }) {
  const overall = result.overall ?? result.subscales.find((s) => s.subscale === "total");
  const subs = result.subscales.filter((s) => s.subscale !== "total");

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{t("section_scores")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {result.respondentCount} respondents · {result.assessment?.name}
        </p>
      </div>
      <div className="p-6 space-y-6">
        {/* Overall gauge */}
        {overall && (
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-100">
            <ScoreGauge score={overall.avg} size={160} />
            <div className="flex-1 space-y-1">
              <p className="text-lg font-bold text-gray-900">{t("overall_score")}</p>
              <p className={`text-sm font-medium ${bandColor(overall.band)}`}>
                {translateBand(overall.band, lang)}
              </p>
              <BandDistBar distribution={overall.bandDistribution} lang={lang} />
            </div>
          </div>
        )}

        {/* Subscales */}
        {subs.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-4">{t("subscales_title")}</p>
            <div className="space-y-3">
              {subs.map((s) => (
                <SubscaleRow key={s.subscale} sub={s} lang={lang} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Subscale Row ─────────────────────────────────────────────────────────────

function SubscaleRow({ sub, lang }: { sub: SubscaleAgg; lang: Lang }) {
  const label = lang === "ar" ? (subscaleAr[sub.subscale] ?? sub.label) : sub.label;
  const pct = Math.round(sub.avg);

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-36 shrink-0 text-sm text-gray-700 truncate" title={label}>{label}</div>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: scoreBarColor(sub.band) }}
        />
      </div>
      <div className={`w-8 text-right text-sm font-semibold ${bandColor(sub.band)}`}>{pct}</div>
      <div className={`hidden sm:block text-xs px-2 py-0.5 rounded-full border font-medium ${bandBg(sub.band)} ${bandColor(sub.band)}`}>
        {translateBand(sub.band, lang)}
      </div>
    </div>
  );
}

// ─── Band Distribution Bar ────────────────────────────────────────────────────

function BandDistBar({ distribution, lang }: { distribution: Record<string, number>; lang: Lang }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const segments: Array<{ band: string; pct: number }> = Object.entries(distribution).map(
    ([band, cnt]) => ({ band, pct: (cnt / total) * 100 })
  );

  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-gray-100">
        {segments.map(({ band, pct }) => (
          <div
            key={band}
            style={{ width: `${pct}%`, backgroundColor: scoreBarColor(band) }}
            title={`${translateBand(band, lang)}: ${Math.round(pct)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map(({ band, pct }) => (
          <span key={band} className={`text-xs ${bandColor(band)}`}>
            {translateBand(band, lang)} {Math.round(pct)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Trend Panel ──────────────────────────────────────────────────────────────

function TrendPanel({
  chartData,
  assessmentName,
  lang,
  t,
}: {
  chartData: Array<{ name: string; score: number | null; n: number }>;
  assessmentName: string;
  lang: Lang;
  t: (k: any) => string;
}) {
  const hasData = chartData.some((p) => p.score != null);

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{t("section_trend")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{assessmentName}</p>
      </div>
      <div className="p-6">
        {!hasData ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("trend_no_data")}</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    fontSize: "13px",
                  }}
                  formatter={(v: any) => [`${v}/100`, t("trend_score")]}
                />
                {/* Threshold lines */}
                <ReferenceLine y={68} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={51} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={29} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#d97c2a"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#d97c2a", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#c56220" }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* Band legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" />≥68 Good</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" />51–67 Moderate</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" />29–50 Below Avg</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" />&lt;29 Low</span>
        </div>
      </div>
    </section>
  );
}

// ─── Participation Panel ──────────────────────────────────────────────────────

function ParticipationPanel({
  rateData,
  lang,
  t,
}: {
  rateData: ResponseRate;
  lang: Lang;
  t: (k: any) => string;
}) {
  const pct = rateData.submissionRate;
  const color =
    pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{t("section_participation")}</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Overall ring */}
          <div className="flex flex-col items-center gap-2">
            <svg width="110" height="110" viewBox="0 0 110 110" className="overflow-visible">
              <circle cx="55" cy="55" r="44" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="55" cy="55" r="44"
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * (2 * Math.PI * 44)} ${2 * Math.PI * 44}`}
                strokeDashoffset={2 * Math.PI * 44 * 0.25}
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
              <text x="55" y="50" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">
                {Math.round(pct)}%
              </text>
              <text x="55" y="66" textAnchor="middle" fontSize="10" fill="#9ca3af">
                {t("part_rate")}
              </text>
            </svg>
          </div>

          {/* Submitted / Started */}
          <div className="flex flex-col justify-center gap-4 sm:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="text-xl font-bold text-gray-900">{rateData.submitted}</p>
                <p className="text-xs text-gray-500">{t("part_submitted")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-300 shrink-0" />
              <div>
                <p className="text-xl font-bold text-gray-900">{rateData.started}</p>
                <p className="text-xs text-gray-500">{t("part_started")}</p>
              </div>
            </div>
          </div>

          {/* By department */}
          {rateData.byDepartment.length > 0 && (
            <div className="sm:col-span-1">
              <p className="text-xs font-semibold text-gray-600 mb-2">{t("part_by_dept")}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {rateData.byDepartment.map((d) => (
                  <div key={d.departmentId} className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${d.meetsMinimum ? "bg-green-500" : "bg-gray-300"}`}
                    />
                    <span className="text-xs text-gray-700 truncate flex-1">{d.departmentName}</span>
                    <span
                      className={`text-xs font-semibold shrink-0 ${d.meetsMinimum ? "text-green-600" : "text-gray-400"}`}
                    >
                      {d.submitted}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {t("part_meets_min")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Department Panel ─────────────────────────────────────────────────────────

function DeptPanel({
  deptData,
  lang,
  t,
}: {
  deptData: DeptResponse;
  lang: Lang;
  t: (k: any) => string;
}) {
  const depts = deptData.departments;
  // Find the "total" subscale for each dept (or the first available)
  const getDeptScore = (dept: DeptResult) =>
    dept.subscales.find((s) => s.subscale === "total") ?? dept.subscales[0] ?? null;

  // Also show per-subscale comparison columns (use org subscale keys)
  const orgSubs = deptData.organisation.subscales.filter((s) => s.subscale !== "total");
  const showExtra = orgSubs.length > 0 && orgSubs.length <= 5; // only show if manageable

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{t("section_departments")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{t("dept_suppressed")}</p>
      </div>
      <div className="p-6">
        {depts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t("dept_no_data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-3 pr-4 font-medium text-gray-500">{t("dept_col_dept")}</th>
                  <th className="text-right pb-3 px-4 font-medium text-gray-500">{t("dept_col_n")}</th>
                  <th className="text-right pb-3 px-4 font-medium text-gray-500">{t("dept_col_score")}</th>
                  <th className="text-left pb-3 px-4 font-medium text-gray-500 hidden sm:table-cell">
                    {t("dept_col_band")}
                  </th>
                  {showExtra && orgSubs.map((s) => (
                    <th key={s.subscale} className="text-right pb-3 px-2 font-medium text-gray-400 hidden lg:table-cell text-xs">
                      {lang === "ar" ? (subscaleAr[s.subscale] ?? s.label) : s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Org average row */}
                <OrgAvgRow deptData={deptData} showExtra={showExtra} orgSubs={orgSubs} lang={lang} t={t} />
                {/* Department rows */}
                {depts.map((dept) => {
                  const main = getDeptScore(dept);
                  return (
                    <tr key={dept.departmentId} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-800">{dept.departmentName}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{dept.respondentCount}</td>
                      <td className="py-3 px-4 text-right">
                        {main ? (
                          <span className={`font-bold ${bandColor(main.band)}`}>
                            {Math.round(main.avg)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {main ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${bandBg(main.band)} ${bandColor(main.band)}`}>
                            {translateBand(main.band, lang)}
                          </span>
                        ) : "—"}
                      </td>
                      {showExtra && orgSubs.map((os) => {
                        const ds = dept.subscales.find((s) => s.subscale === os.subscale);
                        return (
                          <td key={os.subscale} className="py-3 px-2 text-right hidden lg:table-cell">
                            {ds ? (
                              <span className={`text-xs font-semibold ${bandColor(ds.band)}`}>
                                {Math.round(ds.avg)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function OrgAvgRow({
  deptData,
  showExtra,
  orgSubs,
  lang,
  t,
}: {
  deptData: DeptResponse;
  showExtra: boolean;
  orgSubs: SubscaleAgg[];
  lang: Lang;
  t: (k: any) => string;
}) {
  const orgTotal = deptData.organisation.subscales.find((s) => s.subscale === "total");
  if (!orgTotal) return null;
  return (
    <tr className="bg-gray-50 border-b border-gray-200 font-medium">
      <td className="py-3 pr-4 text-gray-600 text-sm italic">
        {lang === "ar" ? "متوسط المؤسسة" : "Organisation avg"}
      </td>
      <td className="py-3 px-4 text-right text-gray-500 text-sm">
        {deptData.organisation.respondentCount}
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`font-bold ${bandColor(orgTotal.band)}`}>
          {Math.round(orgTotal.avg)}
        </span>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${bandBg(orgTotal.band)} ${bandColor(orgTotal.band)}`}>
          {translateBand(orgTotal.band, lang)}
        </span>
      </td>
      {showExtra && orgSubs.map((s) => (
        <td key={s.subscale} className="py-3 px-2 text-right hidden lg:table-cell">
          <span className={`text-xs font-semibold ${bandColor(s.band)}`}>
            {Math.round(s.avg)}
          </span>
        </td>
      ))}
    </tr>
  );
}

// ─── Cycles Table ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  DRAFT:    "bg-gray-100 text-gray-600",
  CLOSED:   "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

const STATUS_AR: Record<string, string> = {
  ACTIVE: "نشط", DRAFT: "مسودة", CLOSED: "مغلق", ARCHIVED: "مؤرشف",
};

function CyclesTable({
  cycles,
  selectedId,
  onSelect,
  lang,
  t,
}: {
  cycles: Cycle[];
  selectedId: string;
  onSelect: (id: string) => void;
  lang: Lang;
  t: (k: any) => string;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{t("section_cycles")}</h2>
      {cycles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          {t("cycle_no_cycles")}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">{t("cycle_col_title")}</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">{t("cycle_col_type")}</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">{t("cycle_col_status")}</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">{t("cycle_col_n")}</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">{t("cycle_col_closes")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  className={`border-b border-gray-100 transition-colors ${
                    cycle.id === selectedId ? "bg-brand-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-gray-800">{cycle.title}</td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">
                    {lang === "ar" && cycle.assessment?.nameAr
                      ? cycle.assessment.nameAr
                      : cycle.assessment?.name}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cycle.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {lang === "ar" ? (STATUS_AR[cycle.status] ?? cycle.status) : cycle.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">
                    {cycle._count?.respondents ?? 0}
                  </td>
                  <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">
                    {formatDate(cycle.endsAt, lang)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => onSelect(cycle.id)}
                      className={`font-medium transition-colors ${
                        cycle.id === selectedId
                          ? "text-brand-700 cursor-default"
                          : "text-brand-600 hover:text-brand-800"
                      }`}
                    >
                      {cycle.id === selectedId ? "✓" : t("cycle_view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
