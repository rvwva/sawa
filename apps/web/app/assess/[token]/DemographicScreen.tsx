"use client";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemographicAnswers = {
  isSaudiNational?: boolean;
  tenureRange?: "UNDER_1Y" | "ONE_TO_3Y" | "THREE_TO_7Y" | "OVER_7Y";
  seniorityLevel?: "INDIVIDUAL_CONTRIBUTOR" | "MANAGER";
};

type Props = {
  lang: Lang;
  onComplete: (answers: DemographicAnswers) => void;
};

// ─── Radio group ──────────────────────────────────────────────────────────────

function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T | "__skip__"; label: string; isSkip?: boolean }[];
  value: T | "__skip__" | undefined;
  onChange: (v: T | "__skip__") => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
              selected
                ? opt.isSkip
                  ? "border-gray-400 bg-gray-50"
                  : "border-brand-500 bg-brand-50"
                : opt.isSkip
                ? "border-dashed border-gray-200 hover:border-gray-300 bg-white"
                : "border-gray-200 hover:border-gray-300 bg-white",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <div
              className={[
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                selected
                  ? opt.isSkip
                    ? "border-gray-500"
                    : "border-brand-500"
                  : "border-gray-300",
              ].join(" ")}
            >
              {selected && (
                <div
                  className={[
                    "w-2.5 h-2.5 rounded-full",
                    opt.isSkip ? "bg-gray-500" : "bg-brand-500",
                  ].join(" ")}
                />
              )}
            </div>
            <span
              className={[
                "text-sm font-medium",
                selected
                  ? opt.isSkip
                    ? "text-gray-700"
                    : "text-brand-700"
                  : opt.isSkip
                  ? "text-gray-500"
                  : "text-gray-700",
              ].join(" ")}
            >
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DemographicScreen({ lang, onComplete }: Props) {
  const t = useTranslations(lang);

  const [nationality, setNationality] = useState<"true" | "false" | "__skip__" | undefined>();
  const [tenure, setTenure]           = useState<DemographicAnswers["tenureRange"] | "__skip__" | undefined>();
  const [seniority, setSeniority]     = useState<DemographicAnswers["seniorityLevel"] | "__skip__" | undefined>();

  function buildAnswers(): DemographicAnswers {
    return {
      isSaudiNational:
        nationality === "true"  ? true
        : nationality === "false" ? false
        : undefined,
      tenureRange:
        tenure && tenure !== "__skip__" ? tenure : undefined,
      seniorityLevel:
        seniority && seniority !== "__skip__" ? seniority : undefined,
    };
  }

  function handleContinue() {
    onComplete(buildAnswers());
  }

  function handleSkipAll() {
    onComplete({});
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-5">
          <div className="text-white text-3xl mb-2" aria-hidden>📊</div>
          <h2 className="text-white text-xl font-bold">{t("demog_title")}</h2>
        </div>

        <div className="px-6 py-5 space-y-6">
          <p className="text-sm text-gray-600 leading-relaxed">{t("demog_subtitle")}</p>

          {/* Q1: Saudi national */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">{t("demog_q1_label")}</p>
            <RadioGroup
              name="nationality"
              value={nationality}
              onChange={setNationality}
              options={[
                { value: "true",     label: t("demog_q1_yes") },
                { value: "false",    label: t("demog_q1_no") },
                { value: "__skip__", label: t("demog_q1_skip"), isSkip: true },
              ]}
            />
          </div>

          <div className="border-t border-gray-100" />

          {/* Q2: Tenure */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">{t("demog_q2_label")}</p>
            <RadioGroup
              name="tenure"
              value={tenure}
              onChange={setTenure}
              options={[
                { value: "UNDER_1Y",    label: t("demog_q2_under1") },
                { value: "ONE_TO_3Y",   label: t("demog_q2_one3") },
                { value: "THREE_TO_7Y", label: t("demog_q2_three7") },
                { value: "OVER_7Y",     label: t("demog_q2_over7") },
                { value: "__skip__",    label: t("demog_q2_skip"), isSkip: true },
              ]}
            />
          </div>

          <div className="border-t border-gray-100" />

          {/* Q3: Seniority */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">{t("demog_q3_label")}</p>
            <RadioGroup
              name="seniority"
              value={seniority}
              onChange={setSeniority}
              options={[
                { value: "INDIVIDUAL_CONTRIBUTOR", label: t("demog_q3_ic") },
                { value: "MANAGER",                label: t("demog_q3_mgr") },
                { value: "__skip__",               label: t("demog_q3_skip"), isSkip: true },
              ]}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleContinue}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-brand-500 hover:bg-brand-600 text-white transition-all duration-200 shadow-sm"
            >
              {t("demog_cta")}
            </button>
            <button
              onClick={handleSkipAll}
              className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t("demog_skip_all")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
