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
}

export interface TranscriptTurn {
  role: "ai" | "user";
  text: string;
  persona?: Persona;
}

export interface CategoryScore {
  category: string;
  score: number;
  note: string;
}

export interface FeedbackReport {
  overallScore: number;
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
}
