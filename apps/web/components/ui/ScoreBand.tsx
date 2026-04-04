type Props = {
  label: string;
  score: number;
  band: string;
  bandColors: Record<string, string>;
};

export default function ScoreBand({ label, score, band, bandColors }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium text-gray-700 truncate">{label}</p>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
            bandColors[band] ?? "text-gray-600 bg-gray-50 border-gray-200"
          }`}
        >
          {band}
        </span>
      </div>
      <div className="flex-1">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              backgroundColor: scoreToColor(score),
            }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5 text-right">{Math.round(score)}/100</p>
      </div>
    </div>
  );
}

function scoreToColor(score: number): string {
  if (score >= 68) return "#5e875e";  // sage green — good
  if (score >= 51) return "#e09548";  // amber — moderate
  if (score >= 29) return "#f59e0b";  // yellow — below average
  return "#ef4444";                   // red — low / poor
}
