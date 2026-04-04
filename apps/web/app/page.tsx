import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sage-50 px-4">
      <div className="max-w-2xl text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="text-5xl font-bold text-brand-600">سواء</span>
          <span className="text-5xl font-bold text-gray-800">Sawa</span>
        </div>

        <p className="text-xl text-gray-600 leading-relaxed">
          Workplace Culture &amp; People Intelligence Platform
          <br />
          <span className="text-base text-gray-500">منصة ثقافة العمل وذكاء الأفراد</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors shadow-md"
          >
            Executive / HR Login
          </Link>
        </div>

        <p className="text-sm text-gray-400 pt-8">
          Employee assessment links are distributed by your HR team.
          <br />
          Built for Saudi Arabia · مصنوع للمملكة العربية السعودية
        </p>
      </div>
    </main>
  );
}
