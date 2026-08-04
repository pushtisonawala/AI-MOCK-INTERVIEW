export default function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const color =
    score >= 80
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : score >= 60
      ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
      : "text-rose-400 border-rose-500/40 bg-rose-500/10";

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border px-6 py-4 ${color}`}>
      <span className="text-3xl font-bold">{score}</span>
      {label && <span className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</span>}
    </div>
  );
}
