"use client";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";

type Department = { id: string; name: string; nameAr?: string };

type Props = {
  lang: Lang;
  departments: Department[];
  onSelect: (deptId: string | undefined) => void;
};

export default function DepartmentSelector({ lang, departments, onSelect }: Props) {
  const t = useTranslations(lang);
  const [selected, setSelected] = useState<string>("__none__");

  function handleContinue() {
    onSelect(selected === "__none__" || selected === "__skip__" ? undefined : selected);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sage-500 to-sage-600 px-6 py-5">
          <div className="text-white text-3xl mb-2" aria-hidden>🏢</div>
          <h2 className="text-white text-xl font-bold">{t("dept_title")}</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{t("dept_subtitle")}</p>

          {/* Department list as large touch-friendly radios */}
          <div className="space-y-2">
            {departments.map((dept) => {
              const label =
                lang === "ar" && dept.nameAr ? dept.nameAr : dept.name;
              const isSelected = selected === dept.id;
              return (
                <label
                  key={dept.id}
                  className={[
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all",
                    isSelected
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300 bg-white",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="department"
                    value={dept.id}
                    checked={isSelected}
                    onChange={() => setSelected(dept.id)}
                    className="sr-only"
                  />
                  {/* Custom radio dot */}
                  <div
                    className={[
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      isSelected ? "border-brand-500" : "border-gray-300",
                    ].join(" ")}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                    )}
                  </div>
                  <span className={[
                    "text-sm font-medium",
                    isSelected ? "text-brand-700" : "text-gray-700",
                  ].join(" ")}>
                    {label}
                  </span>
                </label>
              );
            })}

            {/* Skip option */}
            <label
              className={[
                "flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all",
                selected === "__skip__"
                  ? "border-gray-400 bg-gray-50"
                  : "border-dashed border-gray-200 hover:border-gray-300 bg-white",
              ].join(" ")}
            >
              <input
                type="radio"
                name="department"
                value="__skip__"
                checked={selected === "__skip__"}
                onChange={() => setSelected("__skip__")}
                className="sr-only"
              />
              <div
                className={[
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  selected === "__skip__" ? "border-gray-500" : "border-gray-300",
                ].join(" ")}
              >
                {selected === "__skip__" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                )}
              </div>
              <span className={[
                "text-sm",
                selected === "__skip__" ? "text-gray-700 font-medium" : "text-gray-500",
              ].join(" ")}>
                {t("dept_skip")}
              </span>
            </label>
          </div>

          <button
            onClick={handleContinue}
            disabled={selected === "__none__"}
            className={[
              "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm mt-2",
              selected !== "__none__"
                ? "bg-brand-500 hover:bg-brand-600 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {t("dept_cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
