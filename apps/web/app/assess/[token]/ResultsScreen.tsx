"use client";
import { useEffect, useState } from "react";
import ScoreBand from "@/components/ui/ScoreBand";
import ScoreGauge from "@/components/ui/ScoreGauge";

type Props = {
  scores: Record<string, any>;
  sessionToken: string;
  assessmentType: string;
  assessmentName: string;
};

const BAND_COLORS: Record<string, string> = {
  Low: "text-green-700 bg-green-50 border-green-200",
  "Below Average": "text-yellow-700 bg-yellow-50 border-yellow-200",
  Moderate: "text-orange-700 bg-orange-50 border-orange-200",
  High: "text-red-700 bg-red-50 border-red-200",
  "Needs Attention": "text-red-700 bg-red-50 border-red-200",
  Developing: "text-orange-700 bg-orange-50 border-orange-200",
  Healthy: "text-blue-700 bg-blue-50 border-blue-200",
  Thriving: "text-green-700 bg-green-50 border-green-200",
  Good: "text-green-700 bg-green-50 border-green-200",
};

const BAND_MESSAGES: Record<string, string> = {
  // Burnout / PSS
  Low: "Your scores suggest you are managing well. Keep up healthy habits.",
  Moderate:
    "Your scores indicate a moderate level. Consider reviewing workload and recovery habits.",
  High: "Your scores are elevated. We strongly recommend speaking with a healthcare professional or using your EAP.",
  // WHO-5
  "Below Average": "Your wellbeing score is below average. Consider speaking to someone you trust.",
  Good: "Your wellbeing is in a good range. Keep nurturing your mental health.",
  // Culture
  "Needs Attention": "This dimension needs significant attention and focused improvement.",
  Developing: "This dimension is developing — there is meaningful room for growth.",
  Healthy: "This dimension is healthy — a good foundation to build on.",
  Thriving: "This dimension is thriving — a real strength for your organisation.",
};

export default function ResultsScreen({ scores, sessionToken, assessmentType, assessmentName }: Props) {
  const [copied, setCopied] = useState(false);

  function copyToken() {
    navigator.clipboard.writeText(sessionToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const total = scores.total;
  const subscales = scores.subscales;
  const dimensions = scores.dimensions;
  const depressionScreen = total?.depression_screen_recommended;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Results</h1>
            <p className="text-gray-500 mt-1">{assessmentName}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-200">
            ✓ Submitted
          </span>
        </div>

        {/* Overall score */}
        {total && (
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreGauge score={total.score} />
            <div>
              <div
                className={`inline-flex items-center px-4 py-1.5 rounded-full border font-semibold text-sm ${
                  BAND_COLORS[total.band] ?? "text-gray-700 bg-gray-50 border-gray-200"
                }`}
              >
                {total.band}
              </div>
              <p className="mt-2 text-sm text-gray-600 max-w-md">
                {BAND_MESSAGES[total.band] ?? ""}
              </p>
              {depressionScreen && (
                <p className="mt-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠ Your WHO-5 score suggests possible depression. Please consult a healthcare
                  professional.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CBI subscales */}
      {subscales && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Subscale Breakdown</h2>
          <div className="space-y-4">
            {Object.entries<any>(subscales).map(([key, val]) => (
              <ScoreBand
                key={key}
                label={key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                score={val.score}
                band={val.band}
                bandColors={BAND_COLORS}
              />
            ))}
          </div>
        </div>
      )}

      {/* Culture dimensions */}
      {dimensions && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Culture Dimensions</h2>
          <div className="space-y-4">
            {(dimensions as any[]).map((dim) => (
              <ScoreBand
                key={dim.key}
                label={dim.label}
                score={dim.score}
                band={dim.band}
                bandColors={BAND_COLORS}
              />
            ))}
          </div>
        </div>
      )}

      {/* Session token / data rights */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-2">Your Data Rights</h2>
        <p className="text-sm text-gray-600 mb-3">
          Save your session token below. You can use it at any time to access or delete your data.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-700 break-all">
            {sessionToken}
          </code>
          <button
            onClick={copyToken}
            className="shrink-0 px-3 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 pb-4">
        This assessment was administered by Sawa. Results are for personal awareness only and do not
        constitute medical advice.
      </p>
    </div>
  );
}
