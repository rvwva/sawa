"use client";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { useTranslations, dir } from "@/lib/i18n";
import type { CycleInfo } from "./page";

type Props = {
  lang: Lang;
  cycleInfo: CycleInfo;
  onAccept: (email?: string) => void;
};

const privacyItems = (t: ReturnType<typeof useTranslations>) => [
  {
    icon: "🔒",
    heading: t("consent_anonymous_h"),
    body:    t("consent_anonymous_p"),
  },
  {
    icon: "📊",
    heading: t("consent_usage_h"),
    body:    t("consent_usage_p"),
  },
  {
    icon: "🗄",
    heading: t("consent_retention_h"),
    body:    t("consent_retention_p"),
  },
  {
    icon: "✋",
    heading: t("consent_rights_h"),
    body:    t("consent_rights_p"),
  },
  {
    icon: "🚪",
    heading: t("consent_voluntary_h"),
    body:    t("consent_voluntary_p"),
  },
];

export default function ConsentScreen({ lang, cycleInfo, onAccept }: Props) {
  const t = useTranslations(lang);
  const [checked,   setChecked]   = useState(false);
  const [showError, setShowError] = useState(false);
  const [email,     setEmail]     = useState("");

  const assessmentName =
    lang === "ar" && cycleInfo.assessment.nameAr
      ? cycleInfo.assessment.nameAr
      : cycleInfo.assessment.name;

  const mins = Math.ceil(cycleInfo.assessment.itemCount * 0.5);

  function handleCta() {
    if (!checked) { setShowError(true); return; }
    onAccept(email.trim().toLowerCase() || undefined);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Assessment header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-5">
          <h1 className="text-white text-xl font-bold leading-tight">{assessmentName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {cycleInfo.assessment.itemCount}
              {lang === "ar" ? " سؤالاً" : " questions"}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {lang === "ar"
                ? `${mins}–${mins + 5} دقائق`
                : `${mins}–${mins + 5} min`}
            </span>
          </div>
        </div>

        <div className="px-6 py-5">
          <h2 className="font-bold text-gray-900 text-base mb-1">{t("consent_title")}</h2>
          <p className="text-sm text-gray-500">{t("consent_subtitle")}</p>
        </div>
      </div>

      {/* Privacy items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {privacyItems(t).map(({ icon, heading, body }, i) => (
          <div key={i} className="flex gap-3 px-5 py-4">
            <span className="text-xl shrink-0 mt-0.5" aria-hidden>{icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{heading}</p>
              <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Wellbeing notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
        <span className="text-xl shrink-0" aria-hidden>💛</span>
        <p className="text-sm text-amber-800 leading-relaxed">
          {t("consent_wellbeing_notice")}
        </p>
      </div>

      {/* Consent checkbox + CTA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5 space-y-4">
        {/* Optional email for department auto-assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {lang === "ar" ? "البريد الإلكتروني (اختياري)" : "Work email (optional)"}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={lang === "ar" ? "name@company.com" : "name@company.com"}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all"
          />
          <p className="text-xs text-gray-400 mt-1">
            {lang === "ar"
              ? "يُستخدم فقط لتحديد قسمك تلقائياً. لا يُخزَّن مع إجاباتك."
              : "Used only to auto-assign your department. Never stored with your responses."}
          </p>
        </div>

        <label className="flex gap-3 cursor-pointer group">
          <div className="relative shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => { setChecked(e.target.checked); setShowError(false); }}
              className="sr-only"
            />
            <div
              className={[
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                checked
                  ? "bg-brand-500 border-brand-500"
                  : showError
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300 group-hover:border-brand-400",
              ].join(" ")}
            >
              {checked && (
                <svg viewBox="0 0 12 10" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1,5 4.5,9 11,1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-700 leading-relaxed">{t("consent_checkbox")}</span>
        </label>

        {showError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <span aria-hidden>⚠</span> {t("consent_must_agree")}
          </p>
        )}

        <button
          onClick={handleCta}
          className={[
            "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm",
            checked
              ? "bg-brand-500 hover:bg-brand-600 text-white shadow-brand-200"
              : "bg-gray-100 text-gray-400 cursor-pointer hover:bg-gray-200",
          ].join(" ")}
        >
          {t("consent_cta")}
        </button>
      </div>
    </div>
  );
}
