import { FeedbackReport, NlpMetrics, AnswerMetrics } from "@/lib/types";
import CircularScore from "./CircularScore";
import { CheckCircle2, AlertTriangle, Star, MessageSquare, Volume1, ListChecks, Brain, MessageCircleQuestion, Ruler, BookOpen, ShieldCheck, ShieldAlert } from "lucide-react";

export default function FeedbackReportView({ report }: { report: FeedbackReport }) {
  return (
    <div className="space-y-6">
      <div className="card flex flex-col items-center gap-5 sm:flex-row">
        <CircularScore score={report.overallScore} />
        <p className="text-center text-slate-300 sm:text-left">{report.summary}</p>
      </div>

      {report.scoreRationale && (
        <div className="card">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
            <Brain size={16} className="text-indigo-400" /> How this score was reached
          </h3>
          <p className="text-sm leading-relaxed text-slate-400">{report.scoreRationale}</p>
        </div>
      )}

      {report.nlpMetrics && report.nlpMetrics.answerCount > 0 && <MeasuredSignals m={report.nlpMetrics} llmScore={report.overallScore} />}

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

      {report.questionReviews && report.questionReviews.length > 0 && (
        <div className="card">
          <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-200">
            <MessageCircleQuestion size={17} className="text-indigo-400" /> Question-by-question review
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Open a question to see the evidence behind its score and a model answer built from your own background.
          </p>
          <div className="space-y-3">
            {report.questionReviews.map((q, i) => (
              <details key={i} className="group rounded-xl border border-slate-800 bg-slate-900/40 open:bg-slate-900/70">
                <summary className="flex cursor-pointer select-none items-start justify-between gap-3 px-4 py-3 text-sm text-slate-200">
                  <span>
                    <span className="mr-2 text-xs uppercase tracking-wide text-indigo-400">{q.category}</span>
                    {q.question}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-300">{q.score}/100</span>
                </summary>
                <div className="space-y-3 border-t border-slate-800 px-4 py-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What you said</p>
                    <p className="mt-1 italic text-slate-400">{q.answerEvidence}</p>
                    {q.metrics?.evidenceVerified !== undefined && (
                      <p className={`mt-1 flex items-center gap-1 text-[11px] ${q.metrics.evidenceVerified ? "text-emerald-500" : "text-amber-500"}`}>
                        {q.metrics.evidenceVerified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        {q.metrics.evidenceVerified
                          ? "Quote verified against your transcript"
                          : "Couldn't verify this quote in your transcript — treat this reasoning with caution"}
                      </p>
                    )}
                  </div>
                  {q.metrics && <AnswerMetricsRow m={q.metrics} />}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this score</p>
                    <p className="mt-1 text-slate-300">{q.whyThisScore}</p>
                  </div>
                  {q.missing?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What was missing</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300">
                        {q.missing.map((m, j) => (
                          <li key={j}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Model answer</p>
                    <p className="mt-1 leading-relaxed text-emerald-100/90">{q.idealAnswer}</p>
                    {q.answerTips && <p className="mt-2 text-xs text-emerald-300/80">Structure: {q.answerTips}</p>}
                  </div>
                  {q.references && q.references.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <BookOpen size={12} /> Reference guidance retrieved:
                      {q.references.map((r) => (
                        <span key={r.id} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400" title={r.title}>
                          {r.id} · {r.title.length > 40 ? r.title.slice(0, 40) + "…" : r.title}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

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

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2" title={hint}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function MeasuredSignals({ m, llmScore }: { m: NlpMetrics; llmScore: number }) {
  const star = m.starCoverage;
  return (
    <div className="card">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-200">
        <Ruler size={16} className="text-cyan-400" /> Measured by code, not by the AI
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Classical NLP + sentence embeddings ({m.similarityMethod === "minilm" ? "MiniLM transformer" : "TF-IDF fallback"}) computed on your transcript.
        The AI grader received these numbers as facts.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Words spoken" value={m.totalWords} hint={`${m.avgWordsPerAnswer} words per answer on average`} />
        <Stat label="Filler words" value={`${m.fillerPer100Words}/100`} hint={`${m.fillerCount} fillers, ${m.hedgeCount} hedges. Speech recognition often drops "um"/"uh", so this is a lower bound.`} />
        <Stat label="Relevance" value={`${m.avgRelevance}`} hint="Embedding similarity between each question and your answer (0-100)" />
        <Stat label="JD alignment" value={`${m.avgJdAlignment}`} hint="Embedding similarity between your answers and the job description (0-100)" />
        <Stat label="JD keywords used" value={`${m.jdKeywords.score}%`} hint={`Used: ${m.jdKeywords.matched.join(", ") || "none"}`} />
        <Stat label="Answers with numbers" value={`${star.answersWithMetric}/${m.answerCount}`} hint="Answers containing a measurable result" />
        <Stat label="Vocabulary (MATTR)" value={m.lexicalDiversity} hint="Moving-average type-token ratio, 0-1" />
        <Stat label="Measured composite" value={`${m.compositeScore}`} hint="Transparent heuristic of relevance, STAR coverage, keywords and answer length" />
      </div>
      <div className="mt-4 text-xs text-slate-400">
        <p className="mb-1.5 font-medium text-slate-300">STAR components detected across {m.answerCount} answers</p>
        <div className="flex flex-wrap gap-2">
          {(["situation", "task", "action", "result"] as const).map((k) => (
            <span key={k} className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 capitalize">
              {k}: <strong className="text-slate-200">{star[k]}</strong>/{m.answerCount}
            </span>
          ))}
        </div>
        {m.topFillers.length > 0 && (
          <p className="mt-3">
            Most common fillers: {m.topFillers.map((f) => `"${f.word}" ×${f.count}`).join(", ")}
          </p>
        )}
        {m.jdKeywords.missing.length > 0 && (
          <p className="mt-1">Job keywords you never said aloud: {m.jdKeywords.missing.slice(0, 8).join(", ")}</p>
        )}
        <p className="mt-3 text-[11px] text-slate-600">
          AI grade: {llmScore} · measured composite: {m.compositeScore}. A large gap between them is worth a closer look at the
          per-question reasoning below.
        </p>
      </div>
    </div>
  );
}

function AnswerMetricsRow({ m }: { m: AnswerMetrics }) {
  const chips: { label: string; good?: boolean }[] = [
    { label: `${m.wordCount} words` },
    { label: `relevance ${m.relevance}`, good: m.relevance >= 50 },
    { label: `JD alignment ${m.jdAlignment}`, good: m.jdAlignment >= 40 },
    ...(m.modelAnswerSimilarity !== undefined ? [{ label: `similarity to model answer ${m.modelAnswerSimilarity}`, good: m.modelAnswerSimilarity >= 60 }] : []),
    { label: `STAR: ${(["situation", "task", "action", "result"] as const).filter((k) => m.star[k]).map((k) => k[0].toUpperCase()).join("") || "none"}`, good: Object.values(m.star).filter(Boolean).length >= 3 },
    { label: m.hasMetric ? "has a number" : "no numbers", good: m.hasMetric },
    { label: `${m.fillerCount} fillers`, good: m.fillerCount === 0 },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className={`rounded-full px-2.5 py-0.5 text-[11px] ${
            c.good === undefined ? "bg-slate-800 text-slate-400" : c.good ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
