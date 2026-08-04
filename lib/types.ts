export type Difficulty = "behavioral" | "technical" | "mixed";

export interface SessionSetup {
  role: string;
  company?: string;
  jobDescription: string;
  resumeText?: string;
  difficulty: Difficulty;
  numQuestions: number;
  voiceName?: string;
}

export interface PlannedQuestion {
  id: string;
  category: string;
  text: string;
}

export interface TranscriptTurn {
  role: "ai" | "user";
  text: string;
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

export interface TailoredResume {
  contact: ResumeContact;
  summary: string;
  sections: ResumeSection[];
  keywordsAligned: string[];
  rawText: string;
}

export interface InterviewTurnResponse {
  type: "followup" | "next" | "end";
  aiText: string;
  nextIndex: number;
}
