"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminLang } from "../../context";
import { useTranslations } from "@/lib/i18n";

const FREQ_OPTIONS = [
  { value: 0,   labelKey: "freq_adhoc"     },
  { value: 7,   labelKey: "freq_weekly"    },
  { value: 30,  labelKey: "freq_monthly"   },
  { value: 90,  labelKey: "freq_quarterly" },
] as const;

const SIZE_OPTIONS = ["<50", "50–200", "200–500", "500–2000", "2000+"];

const INDUSTRIES = [
  "Banking & Finance", "Healthcare", "Technology", "Education", "Government",
  "Manufacturing", "Retail & E-commerce", "Energy & Utilities", "Real Estate",
  "Hospitality & Tourism", "Logistics & Transportation", "Professional Services", "Other",
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-7 h-7 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
        {step}
      </span>
      <h2 className="font-semibold text-gray-800 text-base">{title}</h2>
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all";
const SELECT = INPUT + " cursor-pointer";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewClientPage() {
  const router = useRouter();
  const lang   = useAdminLang();
  const t      = useTranslations(lang);

  // Org fields
  const [name,     setName]     = useState("");
  const [nameAr,   setNameAr]   = useState("");
  const [slug,     setSlug]     = useState("");
  const [industry, setIndustry] = useState("");
  const [size,     setSize]     = useState("");
  const [freq,     setFreq]     = useState<number>(30);

  // HR contact fields
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = localStorage.getItem("mindlign_token");
    const headers = {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const base = process.env.NEXT_PUBLIC_API_URL;

    try {
      // 1. Create organisation
      const orgRes = await fetch(`${base}/admin/organisations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name, nameAr: nameAr || null, slug,
          industry: industry || null,
          sizeRange: size || null,
          cycleFrequencyDays: freq,
        }),
      });
      if (!orgRes.ok) {
        const d = await orgRes.json();
        throw new Error(d.error ?? "Failed to create organisation");
      }
      const org = await orgRes.json();

      // 2. Create primary HR contact (if email provided)
      if (email && firstName && lastName && password) {
        const userRes = await fetch(`${base}/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email, password, firstName, lastName,
            role: "EXECUTIVE",
            organisationId: org.id,
          }),
        });
        if (!userRes.ok) {
          const d = await userRes.json();
          throw new Error(d.error ?? "Organisation created but failed to add HR contact");
        }
      }

      router.push(`/admin/organisations/${org.id}`);
    } catch (err: any) {
      setError(err.message ?? t("admin_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/organisations" className="hover:text-brand-600 transition-colors">
          {t("admin_clients")}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{t("admin_onboard_title")}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-8">{t("admin_onboard_title")}</h1>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">

          {/* ── Section 1: Organisation ── */}
          <div>
            <Section step={1} title={t("admin_section_org")} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("admin_field_name_en")}>
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
                  }}
                  className={INPUT}
                  placeholder="Acme Corporation"
                />
              </Field>

              <Field label={t("admin_field_name_ar")}>
                <input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className={INPUT}
                  dir="rtl"
                  placeholder="شركة أكمي"
                />
              </Field>

              <Field label={t("admin_field_slug")} hint={t("admin_slug_hint")}>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  className={INPUT}
                  placeholder="acme-corp"
                />
              </Field>

              <Field label={t("admin_field_industry")}>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className={SELECT}
                >
                  <option value="">— {lang === "ar" ? "اختر" : "Select"} —</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </Field>

              <Field label={t("admin_field_size")}>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className={SELECT}
                >
                  <option value="">— {lang === "ar" ? "اختر" : "Select"} —</option>
                  {SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* ── Section 2: Frequency ── */}
          <div>
            <Section step={2} title={t("admin_section_freq")} />
            <Field label={t("admin_field_freq")} hint={t("admin_freq_hint")}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                {FREQ_OPTIONS.map(({ value, labelKey }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFreq(value)}
                    className={[
                      "py-3 rounded-xl border text-sm font-medium transition-all",
                      freq === value
                        ? "border-brand-400 bg-brand-50 text-brand-700 shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:border-brand-300",
                    ].join(" ")}
                  >
                    {t(labelKey as any)}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* ── Section 3: HR Contact ── */}
          <div>
            <Section step={3} title={t("admin_section_contact")} />
            <p className="text-sm text-gray-400 -mt-3 mb-5">
              {lang === "ar"
                ? "اختياري — يمكن إضافة جهات اتصال لاحقاً."
                : "Optional — contacts can be added later."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("admin_field_fname")}>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT}
                  placeholder={lang === "ar" ? "محمد" : "Sarah"}
                />
              </Field>
              <Field label={t("admin_field_lname")}>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={INPUT}
                  placeholder={lang === "ar" ? "الأحمد" : "Al-Rashid"}
                />
              </Field>
              <Field label={t("admin_field_email")}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT}
                  placeholder="hr@company.com"
                />
              </Field>
              <Field
                label={t("admin_field_password")}
                hint={lang === "ar" ? "10 أحرف على الأقل" : "Minimum 10 characters"}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT}
                  placeholder="••••••••••"
                />
              </Field>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-60 transition-colors shadow-sm"
            >
              {loading ? t("admin_creating") : t("admin_create_btn")}
            </button>
            <Link
              href="/admin/organisations"
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {t("admin_cancel")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
