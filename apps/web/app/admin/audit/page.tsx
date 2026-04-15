"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { useAdminLang } from "../context";
import { useTranslations } from "@/lib/i18n";

type LogEntry = {
  id:         string;
  action:     string;
  entityType: string | null;
  entityId:   string | null;
  ipAddress:  string | null;
  createdAt:  string;
  user:       { email: string; firstName: string; lastName: string } | null;
};

const ACTION_COLOR: Record<string, string> = {
  CYCLE_ACTIVATED:    "bg-green-50 text-green-700",
  CYCLE_CLOSED:       "bg-blue-50 text-blue-700",
  CYCLE_CREATED:      "bg-brand-50 text-brand-700",
  USER_CREATED:       "bg-purple-50 text-purple-700",
  USER_DELETED:       "bg-red-50 text-red-600",
  RESPONSE_SUBMITTED: "bg-sage-50 text-sage-700",
  DATA_EXPORT:        "bg-amber-50 text-amber-700",
  DATA_DELETED:       "bg-red-50 text-red-500",
  LOGIN_SUCCESS:      "bg-gray-50 text-gray-600",
  LOGIN_FAILED:       "bg-orange-50 text-orange-600",
  REPORT_GENERATED:   "bg-indigo-50 text-indigo-600",
};

function actionLabel(action: string): string {
  return action.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export default function AuditPage() {
  const lang = useAdminLang();
  const t    = useTranslations(lang);

  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  const LIMIT = 50;

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("mindlign_token");
    fetch(`${API_BASE}/admin/audit-log?page=${page}&limit=${LIMIT}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error("error"); return r.json(); })
      .then((d) => { setLogs(d.logs ?? []); setTotal(d.total ?? 0); })
      .catch(() => { setLogs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("admin_audit")}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {total.toLocaleString()} {lang === "ar" ? "سجل" : "total entries"}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
          </div>
        ) : logs.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">
            {lang === "ar" ? "لا توجد سجلات بعد." : "No audit logs yet."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-start px-5 py-3 font-medium text-gray-500">
                      {lang === "ar" ? "الإجراء" : "Action"}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500 hidden md:table-cell">
                      {lang === "ar" ? "المستخدم" : "User"}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">
                      {lang === "ar" ? "الكيان" : "Entity"}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">IP</th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500">
                      {lang === "ar" ? "الوقت" : "Time"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ACTION_COLOR[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {log.user ? (
                          <div>
                            <p className="font-medium text-gray-700">{log.user.firstName} {log.user.lastName}</p>
                            <p className="text-xs text-gray-400">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">
                            {lang === "ar" ? "مجهول" : "Anonymous"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400 hidden lg:table-cell">
                        {log.entityType ? `${log.entityType}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400 font-mono hidden lg:table-cell">
                        {log.ipAddress ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA", {
                          timeZone: "Asia/Riyadh", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>
                <span className="text-sm text-gray-400">
                  {lang === "ar" ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  {lang === "ar" ? "التالي" : "Next"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
