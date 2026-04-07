"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminLang } from "../context";
import { useTranslations } from "@/lib/i18n";

type OrgRow = {
  id:                 string;
  name:               string;
  nameAr:             string | null;
  industry:           string | null;
  sizeRange:          string | null;
  cycleFrequencyDays: number | null;
  createdAt:          string;
  _count:             { users: number; cycles: number };
  cycles:             Array<{
    id:     string;
    title:  string;
    status: string;
    endsAt: string;
    _count: { respondents: number };
  }>;
};

function freqLabel(days: number | null, lang: string, t: (k: any) => string): string {
  if (days == null || days === 0) return t("freq_adhoc");
  if (days <= 7)  return t("freq_weekly");
  if (days <= 31) return t("freq_monthly");
  return t("freq_quarterly");
}

function freqColor(days: number | null): string {
  if (days == null || days === 0) return "bg-gray-100 text-gray-500";
  if (days <= 7)  return "bg-purple-50 text-purple-700";
  if (days <= 31) return "bg-blue-50 text-blue-700";
  return "bg-sage-50 text-sage-700";
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE:   "bg-green-400",
  DRAFT:    "bg-gray-300",
  CLOSED:   "bg-blue-400",
  ARCHIVED: "bg-gray-200",
};

export default function OrganisationsPage() {
  const lang = useAdminLang();
  const t    = useTranslations(lang);
  const [orgs, setOrgs]       = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mindlign_token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/organisations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setOrgs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orgs.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      (o.nameAr ?? "").includes(q) ||
      (o.industry ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("admin_clients_title")}</h1>
        <Link
          href="/admin/organisations/new"
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
        >
          + {t("admin_new_client")}
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <input
          type="search"
          placeholder={lang === "ar" ? "بحث عن عميل…" : "Search clients…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-14 text-center">
          <p className="text-gray-400 text-sm">{t("admin_no_clients")}</p>
          <Link
            href="/admin/organisations/new"
            className="inline-block mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            + {t("admin_new_client")}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-start px-5 py-3 font-medium text-gray-500">{t("admin_col_client")}</th>
                  <th className="text-start px-5 py-3 font-medium text-gray-500 hidden md:table-cell">{t("admin_col_industry")}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">{t("admin_col_users")}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">{t("admin_col_cycles")}</th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">{t("admin_col_participation")}</th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">{t("admin_col_frequency")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((org) => {
                  const latest    = org.cycles[0] ?? null;
                  const respCount = latest?._count.respondents ?? 0;

                  return (
                    <tr key={org.id} className="hover:bg-gray-50 transition-colors group">
                      {/* Client name */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                          {org.name}
                        </p>
                        {org.nameAr && (
                          <p className="text-xs text-gray-400 mt-0.5" dir="rtl">{org.nameAr}</p>
                        )}
                        {org.sizeRange && (
                          <p className="text-xs text-gray-400">{org.sizeRange} employees</p>
                        )}
                      </td>

                      {/* Industry */}
                      <td className="px-5 py-4 text-gray-500 hidden md:table-cell">
                        {org.industry ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* Users */}
                      <td className="px-4 py-4 text-center hidden sm:table-cell">
                        <span className="text-gray-700 font-medium">{org._count.users}</span>
                      </td>

                      {/* Cycles */}
                      <td className="px-4 py-4 text-center hidden sm:table-cell">
                        <span className="text-gray-700 font-medium">{org._count.cycles}</span>
                      </td>

                      {/* Latest cycle participation */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {latest ? (
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[latest.status] ?? "bg-gray-200"}`} />
                            <div>
                              <p className="text-xs text-gray-600 truncate max-w-[120px]" title={latest.title}>
                                {latest.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                {respCount} {t("admin_respondents_label")}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Frequency */}
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${freqColor(org.cycleFrequencyDays)}`}>
                          {freqLabel(org.cycleFrequencyDays, lang, t)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 text-end">
                        <Link
                          href={`/admin/organisations/${org.id}`}
                          className="text-brand-600 hover:text-brand-800 font-medium text-sm"
                        >
                          {t("admin_view")} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
