"use client";

type Props = {
  score: number;  // 0–100
  size?: number;
};

export default function ScoreGauge({ score, size = 120 }: Props) {
  const r = 45;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * r;  // half-circle
  const dash = (score / 100) * circumference;
  const gap = circumference - dash;

  const color =
    score >= 68 ? "#5e875e" :
    score >= 51 ? "#e09548" :
    score >= 29 ? "#f59e0b" :
    "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.6}
        viewBox="0 0 120 75"
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M 15 60 A 45 45 0 0 1 105 60`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M 15 60 A 45 45 0 0 1 105 60`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        {/* Score text */}
        <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="#111827">
          {Math.round(score)}
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="9" fill="#6b7280">
          out of 100
        </text>
      </svg>
    </div>
  );
}
