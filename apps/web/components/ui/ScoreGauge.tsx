"use client";
import { useEffect, useState } from "react";

type Props = {
  score: number;   // 0–100
  size?: number;
  label?: string;
  animate?: boolean;
};

function scoreColor(score: number): string {
  if (score >= 68) return "#16a34a";   // green
  if (score >= 51) return "#d97706";   // amber
  if (score >= 29) return "#f59e0b";   // yellow-amber
  return "#dc2626";                    // red
}

export default function ScoreGauge({ score, size = 140, label, animate = true }: Props) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) { setDisplayed(score); return; }
    let start = 0;
    const step = score / 40;
    const id = setInterval(() => {
      start += step;
      if (start >= score) { setDisplayed(score); clearInterval(id); }
      else setDisplayed(Math.round(start));
    }, 20);
    return () => clearInterval(id);
  }, [score, animate]);

  const r = 52;
  const cx = 70;
  const cy = 68;
  const circumference = Math.PI * r;          // half-circle arc length
  const dash = (displayed / 100) * circumference;
  const gap  = circumference - dash;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size * 0.62}
        viewBox="0 0 140 90"
        className="overflow-visible"
        aria-label={`Score ${Math.round(score)} out of 100`}
        role="img"
      >
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: animate ? "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" : "none" }}
        />
        {/* Score number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="30"
          fontWeight="800"
          fill="#111827"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {Math.round(displayed)}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="11"
          fill="#9ca3af"
          fontFamily="Inter, system-ui, sans-serif"
        >
          / 100
        </text>
      </svg>
      {label && (
        <p className="text-xs text-gray-500 font-medium text-center">{label}</p>
      )}
    </div>
  );
}
