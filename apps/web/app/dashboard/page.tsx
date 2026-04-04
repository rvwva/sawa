"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DashStats = {
  totalCycles: number;
  activeCycles: number;
  totalRespondents: number;
  avgScore: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("sawa_user");
    const token = localStorage.getItem("sawa_token");
    if (!storedUser || !token) {
      router.push("/login");
      return;
    }
    const u = JSON.parse(storedUser);
    setUser(u);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/dashboard/${u.organisationId}`, { headers }).then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/cycles?organisationId=${u.organisationId}`, { headers }).then((r) => r.json()),
    ])
      .then(([statsData, cyclesData]) => {
        setStats(statsData);
        setCycles(Array.isArray(cyclesData) ? cyclesData : []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  function signOut() {
    localStorage.removeItem("sawa_token");
    localStorage.removeItem("sawa_user");
    router.push("/login");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-bold text-brand-600 text-xl">Sawa · سواء</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">
              {user.firstName} {user.lastName}
            </span>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user.firstName}.</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Cycles" value={stats.totalCycles} />
            <StatCard label="Active Cycles" value={stats.activeCycles} highlight />
            <StatCard label="Total Respondents" value={stats.totalRespondents} />
            <StatCard
              label="Avg Score"
              value={stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
            />
          </div>
        )}

        {/* Cycles */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Assessment Cycles</h2>
            <Link
              href="/dashboard/cycles/new"
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              + New Cycle
            </Link>
          </div>

          {cycles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
              No assessment cycles yet. Create your first one above.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Title</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 hidden sm:table-cell">Respondents</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 hidden lg:table-cell">Closes</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => (
                    <tr key={cycle.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{cycle.title}</td>
                      <td className="px-5 py-3 text-gray-600 hidden md:table-cell">
                        {cycle.assessment?.name}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={cycle.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">
                        {cycle._count?.respondents ?? 0}
                      </td>
                      <td className="px-5 py-3 text-gray-500 hidden lg:table-cell">
                        {new Date(cycle.endsAt).toLocaleDateString("en-SA")}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/dashboard/cycles/${cycle.id}`}
                          className="text-brand-600 hover:text-brand-800 font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight ? "bg-brand-500 border-brand-600 text-white" : "bg-white border-gray-200 text-gray-800"
      }`}
    >
      <p className={`text-sm ${highlight ? "text-brand-100" : "text-gray-500"}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? "text-white" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    DRAFT: "bg-gray-100 text-gray-600",
    CLOSED: "bg-blue-100 text-blue-700",
    ARCHIVED: "bg-gray-100 text-gray-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
