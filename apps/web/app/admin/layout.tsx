"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { dir, Lang, useTranslations } from "@/lib/i18n";
import { AdminLangContext } from "./context";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  {
    href: "/admin",
    labelKey: "admin_dashboard" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/admin/organisations",
    labelKey: "admin_clients" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: "/admin/audit",
    labelKey: "admin_audit" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [lang, setLang]         = useState<Lang>("en");
  const [user, setUser]         = useState<any>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const t = useTranslations(lang);

  // ── Auth guard: ADMIN only ─────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("sawa_user");
    const token  = localStorage.getItem("sawa_token");
    if (!stored || !token) { router.push("/login"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "ADMIN") { router.push("/dashboard"); return; }
    setUser(u);
  }, [router]);

  function signOut() {
    localStorage.removeItem("sawa_token");
    localStorage.removeItem("sawa_user");
    router.push("/login");
  }

  // Expose language to children via a data attribute on root
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div dir={dir(lang)} className="min-h-screen bg-gray-50 flex">

      {/* ── Mobile overlay ── */}
      {sideOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          "fixed inset-y-0 z-30 flex flex-col w-60 bg-white border-e border-gray-200 shadow-sm",
          "transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          sideOpen ? "translate-x-0" : dir(lang) === "rtl" ? "translate-x-full" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <Link href="/admin" className="block">
            <span className="font-extrabold text-brand-600 text-lg tracking-tight">Sawa · سواء</span>
            <span className="block text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wider">
              Platform Admin
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, labelKey, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSideOpen(false)}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              ].join(" ")}
            >
              <span className={isActive(href) ? "text-brand-500" : "text-gray-400"}>
                {icon}
              </span>
              {t(labelKey)}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-2">
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
          <button
            onClick={signOut}
            className="w-full text-start text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t("admin_sign_out")}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
          {/* Hamburger */}
          <button
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setSideOpen(true)}
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-sm font-semibold text-gray-700 hidden sm:block">
            {t("admin_title")}
          </h1>

          <div className="flex items-center gap-3 ms-auto">
            <LanguageToggle lang={lang} onChange={setLang} />
            <span className="text-sm text-gray-500 hidden md:block">
              {user.firstName} {user.lastName}
            </span>
          </div>
        </header>

        {/* Page content — lang passed via context */}
        <main className="flex-1 overflow-auto p-6">
          <AdminLangContext.Provider value={lang}>
            {children}
          </AdminLangContext.Provider>
        </main>
      </div>
    </div>
  );
}
