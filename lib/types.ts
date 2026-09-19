export type Difficulty = "behavioral" | "technical" | "mixed";

// Panel mode personas — a fixed roster of three interviewer voices. "general" is used
// in standard (non-panel) mode where there's only ever one interviewer.
export type Persona = "general" | "technical" | "behavioral" | "hiring_manager";

export const PANEL_PERSONAS: { id: Exclude<Persona, "general">; label: string }[] = [
  { id: "technical", label: "Technical Interviewer" },
  { id: "behavioral", label: "Behavioral / HR Interviewer" },
  { id: "hiring_manager", label: "Hiring Manager" },
];

export interface SessionSetup {
  role: string;
  company?: string;
  jobDescription: string;
  resumeText?: string;
  difficulty: Difficulty;
  numQuestions: number;
  voiceName?: string;
  // Panel interview mode: multiple AI personas take turns asking questions, each with
  // its own voice. When absent/"standard", behaves exactly as before (one interviewer).
  interviewMode?: "standard" | "panel";
  panelVoiceNames?: Partial<Record<Exclude<Persona, "general">, string>>;
  // Timed/pressure mode: each question is capped at secondsPerQuestion, auto-submitting
  // the candidate's answer (partial or not) when the timer runs out.
  timedMode?: boolean;
  secondsPerQuestion?: number;
}

export interface PlannedQuestion {
  id: string;
  category: string;
  text: string;
  // Which panel persona should ask this question. Always "general" outside panel mode.
  persona?: Persona;
  // Explainability: why the model chose this question, and the JD/resume evidence it
  // was grounded in. Optional so sessions saved before this feature still load.
  rationale?: string;
  evidence?: string[];
  // RAG: knowledge-base chunks that influenced this question (validated against what was retrieved).
  sources?: KbSource[];
}

// A chunk of the interview knowledge base that was retrieved (RAG) and shown to the model.
export interface KbSource {
  id: string;
  title: string;
  type: string; // "question" | "rubric" | "company_style"
  score?: number; // hybrid retrieval score, 0..1
}

export interface TranscriptTurn {
  role: "ai" | "user";
  text: string;
  persona?: Persona;
  // Explainability: why the interviewer said this (e.g. why a follow-up was chosen).
  reasoning?: string;
  sources?: KbSource[]; // RAG sources behind the planned question this turn belongs to
}

export interface CategoryScore {
  category: string;
  score: number;
  note: string;
}

// Per-question breakdown: what was asked, the evidence from the candidate's answer, why
// it got its score, and what a strong answer would look like for THIS candidate.
// Numbers measured by code (embeddings + classical NLP), shown next to the LLM's judgement.
export interface AnswerMetrics {
  wordCount: number;
  relevance: number; // 0-100, semantic similarity between the question and the answer
  jdAlignment: number; // 0-100, semantic similarity between the answer and the job description
  modelAnswerSimilarity?: number; // 0-100, similarity between the answer and the model answer
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  hasMetric: boolean; // the answer contains a number / measurable result
  fillerCount: number;
  // Grounding check: is the quote the LLM attributed to the candidate really in their answer?
  evidenceVerified?: boolean;
}

export interface QuestionReview {
  question: string;
  category: string;
  score: number; // 0-100
  answerEvidence: string; // short quote/paraphrase from the candidate's actual answer
  whyThisScore: string; // the reasoning chain behind the score
  missing: string[]; // specific things a strong answer would have included
  idealAnswer: string; // a model answer, built only from the candidate's real background
  answerTips: string; // the framework/structure to use for this question type
  metrics?: AnswerMetrics; // attached server-side, not written by the LLM
  references?: KbSource[]; // RAG: reference guidance retrieved for this question
}

export interface NlpMetrics {
  totalWords: number;
  answerCount: number;
  avgWordsPerAnswer: number;
  fillerCount: number;
  fillerPer100Words: number;
  hedgeCount: number;
  topFillers: { word: string; count: number }[];
  lexicalDiversity: number; // MATTR, 0-1
  starCoverage: { situation: number; task: number; action: number; result: number; answersWithMetric: number };
  jdKeywords: { score: number; matched: string[]; missing: string[] }; // JD keywords used across the answers
  avgRelevance: number; // 0-100
  avgJdAlignment: number; // 0-100
  // A transparent heuristic composite of the measured signals. NOT the grade — shown next to it.
  compositeScore: number;
  similarityMethod: "minilm" | "tfidf-fallback";
}

export interface FeedbackReport {
  overallScore: number;
  // Explainability: how the overall score was reached from the evidence.
  scoreRationale?: string;
  questionReviews?: QuestionReview[];
  nlpMetrics?: NlpMetrics; // attached server-side
  summary: string;
  strengths: string[];
  weaknesses: string[];
  starMethodFeedback: string;
  communicationFeedback: string;
  fillerWordsNote: string;
  categoryScores: CategoryScore[];
  actionItems: string[];
}

export interface ResumeContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
}

export interface ResumeEntry {
  subheading: string;
  bullets: string[];
}

export interface ResumeSection {
  heading: string;
  // A section is either "multi-entry" (Experience, Education, Projects — each item has
  // its own subheading + bullets) or "flat" (Skills, Certifications — just a bullet list).
  // Exactly one of these should be populated per section.
  entries?: ResumeEntry[];
  bullets?: string[];
}

export interface AtsMatch {
  score: number; // 0-100, overall keyword/skill match between resume and job description
  matchedKeywords: string[];
  missingKeywords: string[]; // present in the JD but not reflected in the resume
  method?: string; // how it was computed, e.g. "tf-idf + MiniLM semantic match"
  semanticMatches?: string[]; // keywords matched by meaning rather than exact wording
}

export interface TailoredResume {
  contact: ResumeContact;
  summary: string;
  sections: ResumeSection[];
  keywordsAligned: string[];
  rawText: string;
  atsMatch?: AtsMatch;
}

export interface InterviewTurnResponse {
  type: "followup" | "next" | "end";
  aiText: string;
  nextIndex: number;
  // Explainability: one sentence on why the interviewer chose this move.
  reasoning?: string;
}

// Shape of a row in the Supabase "interviews" table (see supabase/schema.sql).
export interface SavedInterview {
  id: string;
  user_id: string;
  role: string;
  company: string | null;
  difficulty: Difficulty;
  setup: SessionSetup;
  transcript: TranscriptTurn[];
  feedback: FeedbackReport | null;
  tailored_resume: TailoredResume | null;
  overall_score: number | null;
  share_token: string | null;
  is_public: boolean;
  created_at: string;
}

// Result of re-practicing a single weak question outside a full interview.
export interface RetryFeedback {
  score: number; // 0-100
  comment: string; // short, specific feedback on this one answer
  improvedTip: string;
  whyThisScore?: string; // reasoning behind the score
  idealAnswer?: string; // model answer for this question
}
