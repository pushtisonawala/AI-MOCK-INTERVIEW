import { FeedbackReport } from "@/lib/types";
import CircularScore from "./CircularScore";
import { CheckCircle2, AlertTriangle, Star, MessageSquare, Volume1, ListChecks } from "lucide-react";

export default function FeedbackReportView({ report }: { report: FeedbackReport }) {
  return (
    <div className="space-y-6">
      <div className="card flex flex-col items-center gap-5 sm:flex-row">
        <CircularScore score={report.overallScore} />
        <p className="text-center text-slate-300 sm:text-left">{report.summary}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-400">
            <CheckCircle2 size={17} /> Strengths
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-rose-400">
            <AlertTriangle size={17} /> Areas to improve
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            {report.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="card">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
            <Star size={16} className="text-amber-400" /> STAR method
          </h3>
          <p className="text-sm text-slate-400">{report.starMethodFeedback}</p>
        </div>
        <div className="card">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
            <MessageSquare size={16} className="text-indigo-400" /> Communication
          </h3>
          <p className="text-sm text-slate-400">{report.communicationFeedback}</p>
        </div>
        <div className="card">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
            <Volume1 size={16} className="text-fuchsia-400" /> Filler words
          </h3>
          <p className="text-sm text-slate-400">{report.fillerWordsNote}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold text-slate-200">Category scores</h3>
        <div className="space-y-3">
          {report.categoryScores.map((c, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-300">{c.category}</span>
                <span className="text-slate-400">{c.score}/100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{c.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-200">
          <ListChecks size={17} className="text-emerald-400" /> Action items before your real interview
        </h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {report.actionItems.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-400">✓</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
