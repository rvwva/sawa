import type { Lang } from "@/lib/i18n";
import { translateBand } from "@/lib/i18n";
import clsx from "clsx";

type Props = {
  band: string;
  score: number;
  guidance?: string;
  compact?: boolean;
  lang?: Lang;
};

const BAND_CONFIG: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  Low:             { bg: "bg-green-50",   border: "border-green-200", text: "text-green-800",  icon: "✓" },
  Good:            { bg: "bg-green-50",   border: "border-green-200", text: "text-green-800",  icon: "✓" },
  Thriving:        { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: "★" },
  Healthy:         { bg: "bg-blue-50",    border: "border-blue-200",  text: "text-blue-800",   icon: "●" },
  Moderate:        { bg: "bg-amber-50",   border: "border-amber-200", text: "text-amber-800",  icon: "◑" },
  Developing:      { bg: "bg-amber-50",   border: "border-amber-200", text: "text-amber-800",  icon: "◑" },
  "Below Average": { bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-800", icon: "▽" },
  High:            { bg: "bg-red-50",     border: "border-red-200",   text: "text-red-800",    icon: "!" },
  "Needs Attention": { bg: "bg-red-50",   border: "border-red-200",   text: "text-red-800",    icon: "!" },
};

const DEFAULT_CONFIG = { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", icon: "–" };

export default function BandCard({ band, score, guidance, compact = false, lang = "en" }: Props) {
  const cfg = BAND_CONFIG[band] ?? DEFAULT_CONFIG;
  const label = translateBand(band, lang);

  if (compact) {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
          cfg.bg, cfg.border, cfg.text
        )}
      >
        <span aria-hidden>{cfg.icon}</span>
        {label}
      </span>
    );
  }

  return (
    <div className={clsx("rounded-xl border p-4", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx("text-lg font-bold", cfg.text)} aria-hidden>{cfg.icon}</span>
        <span className={clsx("font-semibold text-sm", cfg.text)}>{label}</span>
        <span className="ml-auto text-sm font-bold text-gray-800">
          {Math.round(score)}<span className="text-gray-400 font-normal">/100</span>
        </span>
      </div>
      {guidance && <p className={clsx("text-sm leading-relaxed", cfg.text)}>{guidance}</p>}
    </div>
  );
}
