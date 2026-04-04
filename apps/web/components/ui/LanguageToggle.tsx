"use client";
import type { Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  onChange: (lang: Lang) => void;
};

export default function LanguageToggle({ lang, onChange }: Props) {
  const next: Lang = lang === "en" ? "ar" : "en";
  const label = lang === "en" ? "عربي" : "English";

  return (
    <button
      onClick={() => onChange(next)}
      aria-label="Switch language"
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium",
        "transition-colors duration-200",
        "border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-600",
        "bg-white/80 backdrop-blur-sm",
      ].join(" ")}
    >
      <span className="text-base leading-none">🌐</span>
      <span>{label}</span>
    </button>
  );
}
