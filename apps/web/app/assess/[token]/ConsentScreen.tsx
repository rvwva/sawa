"use client";
import { useState } from "react";

type Props = {
  cycleInfo: {
    title: string;
    assessment: { name: string; nameAr: string; description: string; itemCount: number };
    organisation: { name: string };
  };
  onAccept: () => void;
};

export default function ConsentScreen({ cycleInfo, onAccept }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{cycleInfo.assessment.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{cycleInfo.assessment.nameAr}</p>
          <p className="mt-3 text-gray-700">{cycleInfo.assessment.description}</p>
          <p className="mt-2 text-sm text-brand-600 font-medium">
            {cycleInfo.assessment.itemCount} questions · Takes approximately{" "}
            {Math.ceil(cycleInfo.assessment.itemCount * 0.5)} minutes
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-blue-900">Before you begin — Informed Consent</h2>
          <ul className="text-sm text-blue-800 space-y-2 list-none">
            <li>
              <span className="font-medium">🔒 Anonymous:</span> Your responses are completely
              anonymous. They cannot be linked back to you individually.
            </li>
            <li>
              <span className="font-medium">📊 How data is used:</span> Results are aggregated and
              shared with {cycleInfo.organisation.name} only as group statistics. Individual results
              are never shared with your employer.
            </li>
            <li>
              <span className="font-medium">🗄 Data retention:</span> Your data will be securely
              stored for up to 5 years, then automatically deleted in accordance with applicable data
              protection law.
            </li>
            <li>
              <span className="font-medium">✋ Your rights:</span> You have the right to access or
              delete your data at any time using the session token you receive after submission.
            </li>
            <li>
              <span className="font-medium">🚪 Voluntary:</span> Participation is entirely
              voluntary. You may exit at any time without consequence.
            </li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <strong>Important note for WHO-5 & burnout assessments:</strong> If your results suggest
          elevated stress or low wellbeing, we encourage you to speak with a healthcare professional
          or your organisation's Employee Assistance Programme (EAP).
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
          />
          <span className="text-sm text-gray-700">
            I have read and understood the information above. I consent to my anonymous responses
            being collected, stored, and used as described. I understand that my participation is
            voluntary and I can withdraw at any time.
          </span>
        </label>

        <button
          onClick={onAccept}
          disabled={!checked}
          className="mt-6 w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          I Agree — Start Assessment
        </button>
      </div>
    </div>
  );
}
