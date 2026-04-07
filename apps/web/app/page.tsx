import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sage-50 px-4">
      <div className="max-w-xl w-full text-center space-y-8">

        {/* Logo mark */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl font-extrabold text-brand-600 tracking-tight">Mindlign</span>
          <p className="text-base text-gray-500 leading-relaxed">
            Workplace Culture &amp; People Intelligence
            <br />
            <span className="text-sm text-gray-400">منصة ثقافة العمل وذكاء الأفراد</span>
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200 w-24 mx-auto" />

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full sm:w-auto px-10 py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors shadow-md text-sm"
          >
            Executive &amp; HR Sign In
          </Link>
          <p className="text-xs text-gray-400">
            Employee assessment links are sent by your HR team
            <br />
            روابط التقييم ترسلها فرق الموارد البشرية
          </p>
        </div>

      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-gray-300">
        Built for Saudi Arabia · مصنوع للمملكة العربية السعودية
      </p>
    </main>
  );
}
