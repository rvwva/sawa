"use client";
import type { Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  organisationName: string;
};

export default function ResultsScreen({ lang, organisationName }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-16 space-y-6">

      {/* Check circle */}
      <div className="w-20 h-20 rounded-full bg-brand-50 border-2 border-brand-200 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-brand-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "ar" ? "شكراً لك" : "Thank you"}
        </h1>
        <p className="text-gray-600 text-base leading-relaxed max-w-sm">
          {lang === "ar"
            ? "تم تسجيل إجابتك بنجاح. نقدّر وقتك ومشاركتك."
            : "Your response has been recorded. We appreciate your time and participation."}
        </p>
      </div>

      {/* Organisation attribution */}
      {organisationName && (
        <p className="text-sm text-gray-400">
          {lang === "ar" ? `نيابةً عن ${organisationName}` : `On behalf of ${organisationName}`}
        </p>
      )}

      {/* Mindlign branding */}
      <div className="pt-4 border-t border-gray-100 w-full max-w-xs">
        <p className="text-xs text-gray-400">
          {lang === "ar"
            ? "مدعوم بواسطة Mindlign · منصة صحة المؤسسات"
            : "Powered by Mindlign · Workplace Wellbeing Platform"}
        </p>
      </div>

    </div>
  );
}
