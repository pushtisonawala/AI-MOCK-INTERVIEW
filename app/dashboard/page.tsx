import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SavedInterview } from "@/lib/types";
import { ArrowRight, CalendarDays, Sparkles, TrendingUp, Trophy, Gauge } from "lucide-react";
import ScoreTrendChart from "@/components/ScoreTrendChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data } = await supabase
    .from("interviews")
    .select("id, role, company, difficulty, overall_score, created_at")
    .order("created_at", { ascending: false });

  const interviews = (data || []) as Pick<
    SavedInterview,
    "id" | "role" | "company" | "difficulty" | "overall_score" | "created_at"
  >[];

  const scored = interviews.filter((iv) => typeof iv.overall_score === "number") as (Pick<
    SavedInterview,
    "id" | "role" | "company" | "difficulty" | "overall_score" | "created_at"
  > & { overall_score: number })[];

  // Chart wants oldest → newest, left to right.
  const chronological = [...scored].reverse();
  const trendPoints = chronological.map((iv) => ({
    score: iv.overall_score,
    label: `${iv.role}${iv.company ? ` @ ${iv.company}` : ""} — ${new Date(iv.created_at).toLocaleDateString()}`,
  }));

  // Readiness score: weighted average favoring your most recent interviews, so it moves
  // as you improve instead of being dragged down by interviews from a long time ago.
  const recentWindow = scored.slice(0, 5); // already newest-first
  const readinessScore =
    recentWindow.length > 0
      ? Math.round(
          recentWindow.reduce((sum, iv, i) => sum + iv.overall_score * (recentWindow.length - i), 0) /
            recentWindow.reduce((sum, _iv, i) => sum + (recentWindow.length - i), 0)
        )
      : null;

  const bestScore = scored.length > 0 ? Math.max(...scored.map((iv) => iv.overall_score)) : null;
  const latestScore = scored.length > 0 ? scored[0].overall_score : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">My Interviews</h1>
        <p className="mt-1 text-sm text-slate-400">Every past session, saved to your account.</p>
      </div>

      {scored.length > 0 && (
        <div className="card mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="section-label">
              <TrendingUp size={16} className="text-indigo-400" />
              Progress
            </div>
            <div className="flex gap-5 text-sm">
              <div className="flex items-center gap-2">
                <Gauge size={15} className="text-indigo-400" />
                <span className="text-slate-400">Readiness</span>
                <span className="font-semibold text-slate-100">{readinessScore}</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy size={15} className="text-amber-400" />
                <span className="text-slate-400">Best</span>
                <span className="font-semibold text-slate-100">{bestScore}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Latest</span>
                <span className="font-semibold text-slate-100">{latestScore}</span>
              </div>
            </div>
          </div>
          <ScoreTrendChart points={trendPoints} />
          <p className="mt-2 text-xs text-slate-500">
            Readiness is a weighted average of your last {Math.min(5, scored.length)} interview
            {scored.length === 1 ? "" : "s"}, weighted toward the most recent.
          </p>
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600">
            <Sparkles size={22} className="text-white" />
          </div>
          <p className="text-slate-300">No interviews yet.</p>
          <Link href="/" className="btn-primary mt-2">
            Start your first interview →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => (
            <Link
              key={iv.id}
              href={`/dashboard/${iv.id}`}
              className="card flex items-center justify-between transition hover:border-indigo-500/40"
            >
              <div>
                <p className="font-medium text-slate-100">
                  {iv.role}
                  {iv.company ? ` @ ${iv.company}` : ""}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={12} /> {new Date(iv.created_at).toLocaleDateString()}
                  </span>
                  <span className="capitalize">{iv.difficulty}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {typeof iv.overall_score === "number" && (
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                      iv.overall_score >= 80
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : iv.overall_score >= 60
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {iv.overall_score}
                  </span>
                )}
                <ArrowRight size={16} className="text-slate-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
