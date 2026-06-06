"use client";
import { API_BASE } from "@/lib/api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminLang } from "../../context";
import { useTranslations } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgDetail = {
  id:                 string;
  name:               string;
  nameAr:             string | null;
  slug:               string;
  industry:           string | null;
  sizeRange:          string | null;
  cycleFrequencyDays: number | null;
  departments:        Array<{ id: string; name: string; nameAr: string | null }>;
  users:              User[];
  cycles:             Cycle[];
};

type User = {
  id:           string;
  email:        string;
  firstName:    string;
  lastName:     string;
  role:         string;
  isActive:     boolean;
  lastLoginAt:  string | null;
};

type Cycle = {
  id:                  string;
  title:               string;
  status:              "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  startsAt:            string;
  endsAt:              string;
  linkToken:           string;
  resultsPublishedAt?: string | null;
  recipientEmails?:    string[] | null;
  assessment:          { type: string; name: string; nameAr: string | null };
  _count:              { respondents: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all";
const SELECT = INPUT + " cursor-pointer";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  DRAFT:    "bg-gray-100 text-gray-600",
  CLOSED:   "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};
const STATUS_AR: Record<string, string> = {
  ACTIVE: "نشط", DRAFT: "مسودة", CLOSED: "مغلق", ARCHIVED: "مؤرشف",
};

const FREQ_OPTIONS = [
  { value: 0,  labelKey: "freq_adhoc"     },
  { value: 7,  labelKey: "freq_weekly"    },
  { value: 30, labelKey: "freq_monthly"   },
  { value: 90, labelKey: "freq_quarterly" },
] as const;

const ASSESSMENT_TYPE_OPTIONS = [
  { value: "CBI",          disabled: false },
  { value: "CULTURE",      disabled: false },
  { value: "PSYCH_SAFETY", disabled: false },
  { value: "TURNOVER",     disabled: false },
  { value: "LMX7",         disabled: false },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SA", {
    year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Riyadh",
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const lang    = useAdminLang();
  const t       = useTranslations(lang);

  const [org, setOrg]         = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab]         = useState<"cycles" | "contacts" | "settings">("cycles");

  const authHeader = useCallback(() => {
    const token = localStorage.getItem("mindlign_token");
    return {
      Authorization:  `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
    };
  }, []);

  const loadOrg = useCallback(() => {
    const token = localStorage.getItem("mindlign_token");
    if (!token) { router.push("/login"); return; }
    fetch(`${API_BASE}/admin/organisations/${id}`, {
      headers: authHeader(),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "not_found" : "error");
        return r.json();
      })
      .then(setOrg)
      .catch((err) => setLoadError(err.message === "not_found"
        ? (lang === "ar" ? "المنظمة غير موجودة." : "Organisation not found.")
        : (lang === "ar" ? "تعذّر تحميل البيانات." : "Failed to load organisation.")))
      .finally(() => setLoading(false));
  }, [id, authHeader, router, lang]);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  );
  if (loadError) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700 text-sm max-w-md mx-auto mt-10">
      {loadError}
    </div>
  );
  if (!org) return <p className="text-red-500">{t("admin_error")}</p>;

  const tabs = [
    { key: "cycles",   label: t("admin_tab_cycles") },
    { key: "contacts", label: t("admin_tab_contacts") },
    { key: "settings", label: t("admin_tab_settings") },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/admin/organisations" className="hover:text-brand-600 transition-colors">
            {t("admin_clients")}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{org.name}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            {org.nameAr && <p className="text-gray-400 text-sm mt-0.5" dir="rtl">{org.nameAr}</p>}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {org.industry && <Badge>{org.industry}</Badge>}
              {org.sizeRange && <Badge>{org.sizeRange}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-gray-100 p-1 rounded-2xl w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "px-5 py-2 rounded-xl text-sm font-medium transition-all",
              tab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "cycles"   && <CyclesTab   org={org} lang={lang} t={t} reload={loadOrg} authHeader={authHeader} />}
      {tab === "contacts" && <ContactsTab org={org} lang={lang} t={t} reload={loadOrg} authHeader={authHeader} />}
      {tab === "settings" && <SettingsTab org={org} lang={lang} t={t} reload={loadOrg} authHeader={authHeader} />}
    </div>
  );
}

// ─── Badge helper ─────────────────────────────────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLES TAB
// ─────────────────────────────────────────────────────────────────────────────

function CyclesTab({
  org, lang, t, reload, authHeader,
}: { org: OrgDetail; lang: string; t: (k: any) => string; reload: () => void; authHeader: () => Record<string, string> }) {
  const [showForm, setShowForm] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  // New cycle form state
  const [type,   setType]   = useState("CBI");
  const [title,  setTitle]  = useState("");
  const [starts, setStarts] = useState("");
  const [ends,   setEnds]   = useState("");
  const [emails, setEmails] = useState("");
  const [creating, setCreating] = useState(false);
  const [formErr,  setFormErr]  = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/admin/organisations/${org.id}/employees/summary`, { headers: authHeader() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setEmployeeCount(d.total ?? 0); })
      .catch(() => {});
  }, [org.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createCycle(e: React.FormEvent) {
    e.preventDefault();
    setFormErr("");
    setCreating(true);

    const base = API_BASE;
    const emailList = emails.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    try {
      // Create cycle
      const res = await fetch(`${base}/assessments/cycles`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          organisationId: org.id,
          assessmentType: type,
          title,
          startsAt: starts,
          endsAt:   ends,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create cycle");
      const cycle = await res.json();

      // Activate immediately and store email list
      const actRes = await fetch(`${base}/assessments/cycles/${cycle.id}/activate`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ recipientEmails: emailList }),
      });
      if (!actRes.ok) throw new Error("Cycle created but failed to activate");

      setShowForm(false);
      setTitle(""); setStarts(""); setEnds(""); setEmails(""); setType("CBI");
      setActionMsg({ text: lang === "ar" ? "تم إنشاء الدورة وتفعيلها." : "Cycle created and activated.", ok: true });
      reload();
    } catch (err: any) {
      setFormErr(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function cycleAction(cycleId: string, action: "remind" | "close" | "publish", confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    const base = API_BASE;
    const endpoint = `${base}/assessments/cycles/${cycleId}/${action}`;
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setActionMsg({ text: data.message ?? (lang === "ar" ? "تم." : "Done."), ok: true });
      reload();
    } catch (err: any) {
      setActionMsg({ text: err.message, ok: false });
    }
  }

  return (
    <div className="space-y-5">

      {/* Action message toast */}
      {actionMsg && (
        <div className={[
          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
          actionMsg.ok
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700",
        ].join(" ")}>
          <span>{actionMsg.ok ? "✓" : "✕"}</span>
          <span className="flex-1">{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">{t("admin_tab_cycles")}</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
        >
          + {t("admin_new_cycle")}
        </button>
      </div>

      {/* New cycle form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-700 mb-4">{t("admin_new_cycle")}</h3>
          {formErr && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{formErr}</div>
          )}
          <form onSubmit={createCycle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_cycle_type")}</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className={SELECT}>
                  {ASSESSMENT_TYPE_OPTIONS.map(({ value }) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_cycle_title_f")}</label>
                <input
                  required value={title} onChange={(e) => setTitle(e.target.value)}
                  className={INPUT}
                  placeholder={lang === "ar" ? "مثال: تقييم Q1 2026" : "e.g. Q2 2026 Wellbeing Check"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_cycle_starts")}</label>
                <input required type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_cycle_ends")}</label>
                <input required type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={INPUT} />
              </div>
            </div>

            {employeeCount != null && employeeCount > 0 ? (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-green-500 mt-0.5 text-base" aria-hidden>✓</span>
                <p className="text-sm text-green-800">
                  {lang === "ar"
                    ? `سيتم إشعار ${employeeCount} موظف من قائمة الموظفين المرفوعة.`
                    : `${employeeCount} ${employeeCount === 1 ? "employee" : "employees"} will be notified from your uploaded employee list.`}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_cycle_emails")}</label>
                <textarea
                  rows={5}
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  className={INPUT + " font-mono resize-y"}
                  placeholder={"employee@company.com\nanother@company.com"}
                  dir="ltr"
                />
                <p className="mt-1 text-xs text-gray-400">{t("admin_cycle_emails_hint")}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {creating ? t("admin_creating_cycle") : t("admin_create_cycle")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t("admin_cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cycle list */}
      {org.cycles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          {t("admin_no_cycles")}
        </div>
      ) : (
        <div className="space-y-3">
          {org.cycles.map((cycle) => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              lang={lang}
              t={t}
              orgId={org.id}
              onRemind={() => cycleAction(cycle.id, "remind", t("admin_act_remind_confirm"))}
              onClose={() => cycleAction(cycle.id, "close", t("admin_act_close_confirm"))}
              onPublish={() => cycleAction(cycle.id, "publish", lang === "ar" ? "نشر النتائج للمشاركين؟" : "Publish results to all participants?")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cycle card ───────────────────────────────────────────────────────────────

function CycleCard({
  cycle, lang, t, orgId, onRemind, onClose, onPublish,
}: {
  cycle:     Cycle;
  lang:      string;
  t:         (k: any) => string;
  orgId:     string;
  onRemind:  () => void;
  onClose:   () => void;
  onPublish: () => void;
}) {
  const status   = cycle.status;
  const hasEmails = (cycle.recipientEmails?.length ?? 0) > 0;
  const detailHref = `/admin/organisations/${orgId}/cycles/${cycle.id}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={detailHref} className="flex-1 min-w-0 group">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
              {lang === "ar" ? (STATUS_AR[status] ?? status) : status}
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
              {lang === "ar" && cycle.assessment.nameAr ? cycle.assessment.nameAr : cycle.assessment.name}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mt-2 truncate group-hover:text-brand-600 transition-colors">
            {cycle.title}
          </h3>
          <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-gray-400">
            <span>{fmtDate(cycle.startsAt)} → {fmtDate(cycle.endsAt)}</span>
            <span className="font-medium text-gray-600">
              {cycle._count.respondents} {t("admin_respondents_label")}
            </span>
            {hasEmails && (
              <span className="text-green-600">
                ✓ {cycle.recipientEmails!.length} {lang === "ar" ? "بريد مخزّن" : "emails stored"}
              </span>
            )}
          </div>
        </Link>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {status === "ACTIVE" && (
            <>
              {hasEmails && (
                <ActionBtn onClick={onRemind} variant="secondary">
                  {t("admin_act_remind")}
                </ActionBtn>
              )}
              <ActionBtn onClick={onClose} variant="danger">
                {t("admin_act_close")}
              </ActionBtn>
            </>
          )}
          {status === "CLOSED" && !cycle.resultsPublishedAt && hasEmails && (
            <ActionBtn onClick={onPublish} variant="primary">
              {t("admin_act_publish")}
            </ActionBtn>
          )}
          {status === "CLOSED" && cycle.resultsPublishedAt && (
            <span className="text-xs text-gray-400 self-center">
              {lang === "ar" ? "تم النشر" : "Published"} {fmtDate(cycle.resultsPublishedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children, onClick, variant = "secondary",
}: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" | "danger" }) {
  const base = "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors";
  const cls = {
    primary:   "bg-brand-500 text-white hover:bg-brand-600",
    secondary: "border border-gray-300 text-gray-600 hover:bg-gray-50",
    danger:    "border border-red-200 text-red-600 hover:bg-red-50",
  }[variant];
  return <button onClick={onClick} className={`${base} ${cls}`}>{children}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ContactsTab({
  org, lang, t, reload, authHeader,
}: { org: OrgDetail; lang: string; t: (k: any) => string; reload: () => void; authHeader: () => Record<string, string> }) {
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [adding, setAdding] = useState(false);
  const [err,    setErr]    = useState("");
  const [msg,    setMsg]    = useState("");

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          email, password, firstName, lastName,
          role: "EXECUTIVE",
          organisationId: org.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setShowForm(false);
      setFirstName(""); setLastName(""); setEmail(""); setPassword("");
      setMsg(lang === "ar" ? "تم إضافة جهة الاتصال." : "Contact added successfully.");
      reload();
    } catch (err: any) {
      setErr(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeUser(userId: string) {
    if (!window.confirm(lang === "ar" ? "إزالة هذا المستخدم؟" : "Remove this user?")) return;
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (res.ok) { setMsg(lang === "ar" ? "تم الإزالة." : "User removed."); reload(); }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
          <span>✓</span>
          <span className="flex-1">{msg}</span>
          <button onClick={() => setMsg("")}>✕</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">{t("admin_tab_contacts")}</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
        >
          + {t("admin_add_contact")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{err}</div>}
          <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_field_fname")}</label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_field_lname")}</label>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_field_email")}</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} placeholder="hr@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("admin_field_password")}</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} placeholder="••••••••" minLength={8} />
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-1">
              <button type="submit" disabled={adding} className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors">
                {adding ? t("admin_adding") : t("admin_add_contact")}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                {t("admin_cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      {org.users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          {t("admin_no_contacts")}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-start px-5 py-3 font-medium text-gray-500">
                {lang === "ar" ? "الاسم" : "Name"}
              </th>
                <th className="text-start px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">{t("admin_contact_role")}</th>
                <th className="text-start px-5 py-3 font-medium text-gray-500 hidden md:table-cell">{t("admin_last_login")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {org.users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">
                    {u.lastLoginAt ? fmtDate(u.lastLoginAt) : t("admin_never")}
                  </td>
                  <td className="px-5 py-3 text-end">
                    <button
                      onClick={() => removeUser(u.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      {t("admin_contact_remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────────

function EmployeeListSection({
  orgId, lang, authHeader,
}: { orgId: string; lang: string; authHeader: () => Record<string, string> }) {
  const [summary,    setSummary]    = useState<{ total: number; byDepartment: { department: string; count: number }[] } | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null); // kept for value-reset after upload

  useEffect(() => {
    fetch(`${API_BASE}/admin/organisations/${orgId}/employees/summary`, { headers: authHeader() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSummary(d); })
      .catch(() => {});
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  function parseCSV(text: string): { email: string; department: string }[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: { email: string; department: string }[] = [];
    for (const line of lines) {
      // Skip header row if it looks like one
      if (/^email/i.test(line)) continue;
      const [rawEmail, rawDept] = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (rawEmail) rows.push({ email: rawEmail.toLowerCase(), department: rawDept ?? "" });
    }
    return rows;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg(null);
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error(lang === "ar" ? "لم يتم العثور على سجلات صالحة في الملف." : "No valid records found in the file.");

      const res  = await fetch(`${API_BASE}/admin/organisations/${orgId}/employees/upload`, {
        method:  "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body:    JSON.stringify(rows),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setSummary(data);
      setUploadMsg({
        text: lang === "ar"
          ? `تم رفع ${data.total} موظف بنجاح.`
          : `${data.total} employees uploaded successfully.`,
        ok: true,
      });
    } catch (err: any) {
      setUploadMsg({ text: err.message, ok: false });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mt-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">
            {lang === "ar" ? "قائمة الموظفين" : "Employee List"}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {lang === "ar"
              ? "رفع ملف CSV بعمودين: email و department. تستخدم القائمة تلقائياً عند إنشاء الدورات."
              : "Upload a CSV with two columns: email and department. Used automatically when cycles are created."}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          disabled={uploading}
          onChange={handleFile}
          className={[
            "shrink-0 text-sm text-gray-500",
            "file:px-4 file:py-2 file:rounded-xl file:border-0",
            "file:text-sm file:font-semibold file:cursor-pointer file:transition-colors",
            uploading
              ? "file:bg-gray-100 file:text-gray-400 opacity-60 cursor-not-allowed"
              : "file:bg-brand-500 file:text-white hover:file:bg-brand-600",
          ].join(" ")}
        />
      </div>

      {uploadMsg && (
        <div className={[
          "mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm",
          uploadMsg.ok ? "bg-green-50 border border-green-200 text-green-700"
                       : "bg-red-50 border border-red-200 text-red-700",
        ].join(" ")}>
          <span>{uploadMsg.ok ? "✓" : "✕"}</span>
          <span className="flex-1">{uploadMsg.text}</span>
          <button onClick={() => setUploadMsg(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {summary && summary.total > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 font-medium">
            {lang === "ar" ? `إجمالي: ${summary.total} موظف` : `Total: ${summary.total} employees`}
          </p>
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
            {summary.byDepartment.map(({ department, count }) => (
              <div key={department} className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50">
                <span className="text-sm text-gray-700">{department}</span>
                <span className="text-sm font-semibold text-gray-500">
                  {count} {lang === "ar" ? "موظف" : count === 1 ? "employee" : "employees"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 pt-1">
            {lang === "ar"
              ? "تُعرض الأعداد فقط — لا تُعرض عناوين البريد الإلكتروني الفردية."
              : "Only counts are shown — individual email addresses are never displayed."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          {lang === "ar" ? "لم يتم رفع أي قائمة موظفين بعد." : "No employee list uploaded yet."}
        </p>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-700 font-medium mb-1">
          {lang === "ar" ? "تنسيق CSV المتوقع:" : "Expected CSV format:"}
        </p>
        <code className="text-xs text-blue-600 font-mono block">
          email,department<br />
          ahmed@company.com,Engineering<br />
          sara@company.com,HR
        </code>
      </div>
    </div>
  );
}

function SettingsTab({
  org, lang, t, reload, authHeader,
}: { org: OrgDetail; lang: string; t: (k: any) => string; reload: () => void; authHeader: () => Record<string, string> }) {
  const [name,     setName]     = useState(org.name);
  const [nameAr,   setNameAr]   = useState(org.nameAr ?? "");
  const [industry, setIndustry] = useState(org.industry ?? "");
  const [size,     setSize]     = useState(org.sizeRange ?? "");
  const [freq,     setFreq]     = useState(org.cycleFrequencyDays ?? 30);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  const SIZE_OPTIONS = ["<50", "50–200", "200–500", "500–2000", "2000+"];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setSaved(false); setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/organisations/${org.id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({
          name,
          nameAr: nameAr || null,
          industry: industry || null,
          sizeRange: size || null,
          cycleFrequencyDays: freq,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setSaved(true);
      reload();
    } catch (err: any) {
      setErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="font-semibold text-gray-800 mb-6">{t("admin_settings_title")}</h2>

        {err  && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{err}</div>}
        {saved && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">✓ {t("admin_saved")}</div>}

        <form onSubmit={save} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_field_name_en")}</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_field_name_ar")}</label>
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={INPUT} dir="rtl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_field_industry")}</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_field_size")}</label>
              <select value={size} onChange={(e) => setSize(e.target.value)} className={SELECT}>
                <option value="">—</option>
                {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("admin_field_freq")}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FREQ_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFreq(value)}
                  className={[
                    "py-2.5 rounded-xl border text-sm font-medium transition-all",
                    freq === value
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-brand-300",
                  ].join(" ")}
                >
                  {t(labelKey as any)}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving ? t("admin_saving") : t("admin_save")}
            </button>
          </div>
        </form>
      </div>

      <EmployeeListSection orgId={org.id} lang={lang} authHeader={authHeader} />
    </div>
  );
}
