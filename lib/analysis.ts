// Glue between the LLM-based feedback and the measured (non-LLM) signals:
//   1. BEFORE the LLM call: measure the transcript (classical NLP + embeddings) and retrieve
//      reference guidance for each question (RAG). Both are injected into the prompt as facts.
//   2. AFTER the LLM call: attach measured metrics + sources to each question review, verify the
//      quotes the LLM cited, and apply a deterministic sanity guard to the overall score.
import {
  analyzeFillers,
  detectStar,
  extractKeywords,
  keywordCoverage,
  lexicalDiversity,
  tokenOverlap,
  wordCount,
} from "./nlp";
import { backgroundIdf, pairSimilarities, type SimilarityMethod } from "./embeddings";
import { retrieve, toSource, formatForPrompt, type RetrievedChunk } from "./rag/retriever";
import type {
  AnswerMetrics,
  FeedbackReport,
  KbSource,
  NlpMetrics,
  PlannedQuestion,
  QuestionReview,
  SessionSetup,
  TranscriptTurn,
} from "./types";

export interface Exchange {
  question: string;
  answer: string;
}

export interface FeedbackContext {
  exchanges: Exchange[];
  metrics: NlpMetrics;
  metricsBlock: string; // measured facts for the prompt
  referenceBlock: string; // retrieved guidance for the prompt
  refsByQuestion: { question: string; sources: KbSource[] }[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Raw cosine values from MiniLM sit low (related ≈ 0.3–0.6, unrelated ≈ 0.0–0.15), so map
// 0.10 → 0 and 0.50 → 100 to get a readable percentage. Heuristic, not calibrated.
export function scaleSimilarity(cos: number): number {
  return Math.round(clamp01((cos - 0.1) / 0.4) * 100);
}

// Pairs every candidate answer with the interviewer turn that immediately preceded it.
export function buildExchanges(transcript: TranscriptTurn[]): Exchange[] {
  const out: Exchange[] = [];
  let lastQuestion = "";
  for (const t of transcript) {
    if (t.role === "ai") lastQuestion = t.text;
    else out.push({ question: lastQuestion, answer: t.text });
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function measureTranscript(setup: SessionSetup, exchanges: Exchange[]): Promise<NlpMetrics> {
  const answers = exchanges.map((e) => e.answer);
  const combined = answers.join(" ");
  const totalWords = wordCount(combined);
  const fillers = analyzeFillers(combined);
  const stars = answers.map(detectStar);

  const idf = backgroundIdf();
  const jdKeywords = keywordCoverage(extractKeywords(setup.jobDescription, idf, 15), combined);

  const { scores, method } = await pairSimilarities(
    exchanges.flatMap((e): [string, string][] => [
      [e.question, e.answer],
      [e.answer, setup.jobDescription],
    ])
  );
  const relevance = exchanges.map((_, i) => scaleSimilarity(scores[2 * i]));
  const jdAlign = exchanges.map((_, i) => scaleSimilarity(scores[2 * i + 1]));

  const count = (k: "situation" | "task" | "action" | "result") => stars.filter((s) => s[k]).length;
  const avgWords = answers.length ? Math.round(totalWords / answers.length) : 0;

  const starAvg = avg(stars.map((s) => s.componentsFound / 4)) * 100;
  const lengthScore = clamp01(avgWords / 80) * 100;
  const composite = Math.round(0.35 * avg(relevance) + 0.25 * starAvg + 0.2 * jdKeywords.score + 0.2 * lengthScore);

  return {
    totalWords,
    answerCount: answers.length,
    avgWordsPerAnswer: avgWords,
    fillerCount: fillers.fillerCount,
    fillerPer100Words: totalWords ? Math.round((fillers.fillerCount / totalWords) * 1000) / 10 : 0,
    hedgeCount: fillers.hedgeCount,
    topFillers: fillers.topFillers,
    lexicalDiversity: Math.round(lexicalDiversity(combined) * 100) / 100,
    starCoverage: {
      situation: count("situation"),
      task: count("task"),
      action: count("action"),
      result: count("result"),
      answersWithMetric: stars.filter((s) => s.hasMetric).length,
    },
    jdKeywords: { score: jdKeywords.score, matched: jdKeywords.matched, missing: jdKeywords.missing },
    avgRelevance: Math.round(avg(relevance)),
    avgJdAlignment: Math.round(avg(jdAlign)),
    compositeScore: answers.length ? composite : 0,
    similarityMethod: method,
  };
}

function metricsToPrompt(m: NlpMetrics): string {
  const n = m.answerCount;
  return [
    `- Answers given: ${n}; total words: ${m.totalWords}; average ${m.avgWordsPerAnswer} words per answer.`,
    `- Filler words: ${m.fillerCount} (${m.fillerPer100Words} per 100 words)${
      m.topFillers.length ? `, mostly ${m.topFillers.map((f) => `"${f.word}" ×${f.count}`).join(", ")}` : ""
    }. Hedging phrases ("I think", "maybe", …): ${m.hedgeCount}. (Speech recognition often drops "um/uh", so true filler use may be higher.)`,
    `- STAR components detected across ${n} answers — Situation: ${m.starCoverage.situation}, Task: ${m.starCoverage.task}, Action: ${m.starCoverage.action}, Result: ${m.starCoverage.result}; answers containing a number/metric: ${m.starCoverage.answersWithMetric}.`,
    `- Job-description keywords the candidate actually used aloud: ${m.jdKeywords.score}% (used: ${m.jdKeywords.matched.slice(0, 8).join(", ") || "none"}; never mentioned: ${m.jdKeywords.missing.slice(0, 8).join(", ") || "none"}).`,
    `- Semantic relevance of answers to the questions asked (embedding similarity, 0-100): ${m.avgRelevance}. Alignment with the job description: ${m.avgJdAlignment}.`,
    `- Vocabulary diversity (MATTR, 0-1): ${m.lexicalDiversity}.`,
  ].join("\n");
}

export async function prepareFeedbackContext(
  setup: SessionSetup,
  transcript: TranscriptTurn[],
  plannedQuestions: PlannedQuestion[]
): Promise<FeedbackContext> {
  const exchanges = buildExchanges(transcript);
  const metrics = await measureTranscript(setup, exchanges);

  // RAG: reference guidance per planned question + general rubric / company-style guidance.
  const perQuestion = await Promise.all(
    plannedQuestions.map(async (q) => {
      const { chunks } = await retrieve(q.text, { k: 2, types: ["question", "rubric"], minScore: 0.12 });
      return { question: q.text, chunks };
    })
  );
  const general = await retrieve(`${setup.role} ${setup.company || ""} ${setup.jobDescription.slice(0, 600)}`, {
    k: 3,
    types: ["rubric", "company_style"],
    minScore: 0.1,
  });

  const seen = new Set<string>();
  const uniq = (cs: RetrievedChunk[]) => cs.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const referenceBlock = [
    general.chunks.length ? `General guidance:\n${formatForPrompt(uniq(general.chunks))}` : "",
    ...perQuestion
      .filter((p) => p.chunks.length)
      .map((p) => `For the question "${p.question}":\n${formatForPrompt(p.chunks)}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    exchanges,
    metrics,
    metricsBlock: metricsToPrompt(metrics),
    referenceBlock,
    refsByQuestion: perQuestion.map((p) => ({ question: p.question, sources: p.chunks.map(toSource) })),
  };
}

// ---------------------------------------------------------------- post-LLM enrichment

export async function finalizeFeedback(report: FeedbackReport, ctx: FeedbackContext, setup: SessionSetup): Promise<FeedbackReport> {
  const reviews: QuestionReview[] = Array.isArray(report.questionReviews) ? report.questionReviews : [];
  const { exchanges } = ctx;

  if (reviews.length > 0 && exchanges.length > 0) {
    // 1. Match each LLM review to the exchange it is about (embedding similarity of the question text).
    const matchPairs: [string, string][] = reviews.flatMap((r) => exchanges.map((e): [string, string] => [r.question, e.question]));
    const match = await pairSimilarities(matchPairs);
    const matched = reviews.map((_, ri) => {
      let best = 0;
      for (let ei = 1; ei < exchanges.length; ei++) {
        if (match.scores[ri * exchanges.length + ei] > match.scores[ri * exchanges.length + best]) best = ei;
      }
      return exchanges[best];
    });

    // 2. Measure each matched answer against the question, the JD and the model answer.
    const simPairs = reviews.flatMap((r, i): [string, string][] => [
      [matched[i].answer, r.question],
      [matched[i].answer, setup.jobDescription],
      [matched[i].answer, r.idealAnswer || ""],
    ]);
    const sims = await pairSimilarities(simPairs);
    const allAnswers = exchanges.map((e) => e.answer).join(" ");

    reviews.forEach((r, i) => {
      const answer = matched[i].answer;
      const star = detectStar(answer);
      const noAnswer = /^\(?\s*no answer/i.test(r.answerEvidence || "");
      const metrics: AnswerMetrics = {
        wordCount: wordCount(answer),
        relevance: scaleSimilarity(sims.scores[3 * i]),
        jdAlignment: scaleSimilarity(sims.scores[3 * i + 1]),
        modelAnswerSimilarity: r.idealAnswer ? scaleSimilarity(sims.scores[3 * i + 2]) : undefined,
        star: { situation: star.situation, task: star.task, action: star.action, result: star.result },
        hasMetric: star.hasMetric,
        fillerCount: analyzeFillers(answer).fillerCount,
        evidenceVerified: noAnswer
          ? true
          : tokenOverlap(r.answerEvidence || "", answer) >= 0.5 || tokenOverlap(r.answerEvidence || "", allAnswers) >= 0.6,
      };
      r.metrics = metrics;

      // 3. Attach the RAG sources for the planned question this review corresponds to.
      const ref = ctx.refsByQuestion.find((q) => q.question.trim().toLowerCase() === r.question.trim().toLowerCase());
      if (ref) r.references = ref.sources;
    });
  }

  report.questionReviews = reviews;
  report.nlpMetrics = ctx.metrics;

  // Deterministic sanity guard: nobody who spoke fewer than 30 words earns a decent score,
  // whatever the LLM says.
  if (ctx.metrics.totalWords < 30 && report.overallScore > 35) {
    report.overallScore = 35;
    report.scoreRationale = `${report.scoreRationale || ""} (Score capped at 35: only ${ctx.metrics.totalWords} words were spoken, too little to evaluate.)`.trim();
  }
  return report;
}

export type { SimilarityMethod };
