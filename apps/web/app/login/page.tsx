"use client";
import { API_BASE } from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Lang = "en" | "ar";

const copy = {
  en: {
    tagline:     "Executive & HR Dashboard",
    emailLabel:  "Email address",
    passLabel:   "Password",
    submit:      "Sign in",
    submitting:  "Signing in…",
    emailPh:     "you@company.com",
    passPh:      "••••••••",
    errNetwork:  "Network error — please try again.",
    errInvalid:  "Incorrect email or password.",
    errFallback: "Sign-in failed — please try again.",
  },
  ar: {
    tagline:     "لوحة تحكم المديرين والموارد البشرية",
    emailLabel:  "البريد الإلكتروني",
    passLabel:   "كلمة المرور",
    submit:      "تسجيل الدخول",
    submitting:  "جارٍ الدخول…",
    emailPh:     "you@company.com",
    passPh:      "••••••••",
    errNetwork:  "خطأ في الشبكة — يُرجى المحاولة مرة أخرى.",
    errInvalid:  "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    errFallback: "فشل تسجيل الدخول — يُرجى المحاولة مرة أخرى.",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang]         = useState<Lang>("en");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const t   = copy[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const status = res.status;
        if (status === 401 || status === 403) {
          setError(t.errInvalid);
        } else {
          setError(data.error ?? t.errFallback);
        }
        return;
      }

      const { accessToken, user } = await res.json();
      localStorage.setItem("mindlign_token", accessToken);
      localStorage.setItem("mindlign_user", JSON.stringify(user));

      router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch {
      setError(t.errNetwork);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={dir}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sage-50 px-4"
    >
      <div className="w-full max-w-md">

        {/* Logo + lang toggle */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="group">
            <span className="text-2xl font-extrabold text-brand-600 tracking-tight group-hover:text-brand-700 transition-colors">
              Mindlign
            </span>
            <p className="text-xs text-gray-400 mt-0.5">{t.tagline}</p>
          </Link>
          <button
            type="button"
            onClick={() => setLang((l) => l === "en" ? "ar" : "en")}
            className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-brand-50"
          >
            {lang === "en" ? "عربي" : "English"}
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all text-sm"
                placeholder={t.emailPh}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.passLabel}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all text-sm"
                placeholder={t.passPh}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              )}
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
