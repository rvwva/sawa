"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminLang } from "../../../../context";
import { useTranslations } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type CycleDetail = {
  id:                 string;
  title:              string;
  status:             "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  startsAt:           string;
  endsAt:             string;
  linkToken:          string;
  recipientEmails:    string[] | null;
  resultsPublishedAt: string | null;
  reminderSentAt:     string | null;
  assessment:         { type: string; name: string; nameAr: string | null };
  organisation:       { id: string; name: string; nameAr: string | null };
  _count:             { respondents: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  DRAFT:    "bg-gray-100 text-gray-600",
  CLOSED:   "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SA", {
    year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Riyadh",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-SA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CycleDetailPage() {
  const { id: orgId, cycleId } = useParams<{ id: string; cycleId: string }>();
  const router  = useRouter();
  const lang    = useAdminLang();
  const t       = useTranslations(lang);

  const [cycle,   setCycle]   = useState<CycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [copied,  setCopied]  = useState(false);

  const authHeader = useCallback(() => ({
    Authorization:  `Bearer ${localStorage.getItem("mindlign_token") ?? ""}`,
    "Content-Type": "application/json",
  }), []);

  const loadCycle = useCallback(() => {
    fetch(`${API_BASE}/assessments/cycles/${cycleId}`, { headers: authHeader() })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { router.push("/login"); throw new Error("auth"); }
        if (!r.ok) throw new Error("load");
        return r.json();
      })
      .then(setCycle)
      .catch((e) => { if (e.message !== "auth") setError(lang === "ar" ? "تعذّر تحميل الدورة." : "Failed to load cycle."); })
      .finally(() => setLoading(false));
  }, [cycleId, authHeader, router, lang]);

  useEffect(() => { loadCycle(); }, [loadCycle]);

  async function doAction(action: "remind" | "close" | "publish", confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    try {
      const res  = await fetch(`${API_BASE}/assessments/cycles/${cycleId}/${action}`, {
        method: "PATCH",
        headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setMsg({ text: data.message ?? (lang === "ar" ? "تم." : "Done."), ok: true });
      loadCycle();
    } catch (err: any) {
      setMsg({ text: err.message, ok: false });
    }
  }

  function copyLink() {
    if (!cycle) return;
    navigator.clipboard.writeText(`${window.location.origin}/assess/${cycle.linkToken}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700 text-sm max-w-md mx-auto mt-10">
      {error}
    </div>
  );

  if (!cycle) return null;

  const hasEmails = (cycle.recipientEmails?.length ?? 0) > 0;
  const assessUrl = `${window.location.origin}/assess/${cycle.linkToken}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
        <Link href="/admin/organisations" className="hover:text-brand-600 transition-colors">
          {t("admin_clients")}
        </Link>
        <span>/</span>
        <Link href={`/admin/organisations/${orgId}`} className="hover:text-brand-600 transition-colors">
          {cycle.organisation.name}
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium truncate">{cycle.title}</span>
      </div>

      {/* Toast */}
      {msg && (
        <div className={[
          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
          msg.ok ? "bg-green-50 border border-green-200 text-green-700"
                 : "bg-red-50 border border-red-200 text-red-700",
        ].join(" ")}>
          <span>{msg.ok ? "✓" : "✕"}</span>
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[cycle.status]}`}>
                {cycle.status}
              </span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                {lang === "ar" && cycle.assessment.nameAr ? cycle.assessment.nameAr : cycle.assessment.name}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{cycle.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {fmtDate(cycle.startsAt)} → {fmtDate(cycle.endsAt)}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {cycle.status === "ACTIVE" && hasEmails && (
              <button
                onClick={() => doAction("remind", t("admin_act_remind_confirm"))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t("admin_act_remind")}
              </button>
            )}
            {cycle.status === "ACTIVE" && (
              <button
                onClick={() => doAction("close", t("admin_act_close_confirm"))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                {t("admin_act_close")}
              </button>
            )}
            {cycle.status === "CLOSED" && !cycle.resultsPublishedAt && hasEmails && (
              <button
                onClick={() => doAction("publish", lang === "ar" ? "نشر النتائج للمشاركين؟" : "Publish results to all participants?")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {t("admin_act_publish")}
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <Stat label={lang === "ar" ? "المشاركون" : "Respondents"} value={String(cycle._count.respondents)} />
          <Stat label={lang === "ar" ? "البريد المخزّن" : "Emails stored"} value={String(cycle.recipientEmails?.length ?? 0)} />
          {cycle.reminderSentAt && (
            <Stat label={lang === "ar" ? "آخر تذكير" : "Last reminder"} value={fmtDateTime(cycle.reminderSentAt)} />
          )}
          {cycle.resultsPublishedAt && (
            <Stat label={lang === "ar" ? "نُشر في" : "Published"} value={fmtDate(cycle.resultsPublishedAt)} />
          )}
        </div>
      </div>

      {/* Assessment link */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-3">
          {lang === "ar" ? "رابط التقييم" : "Assessment Link"}
        </h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-700 font-mono truncate">
            {assessUrl}
          </code>
          <button
            onClick={copyLink}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {lang === "ar"
            ? "شارك هذا الرابط مع الموظفين للوصول إلى التقييم."
            : "Share this link with employees to access the assessment."}
        </p>
      </div>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}
