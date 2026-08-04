"use client";

import { SessionSetup, PlannedQuestion, TranscriptTurn, FeedbackReport, TailoredResume } from "./types";

const KEYS = {
  setup: "ami_setup",
  questions: "ami_questions",
  transcript: "ami_transcript",
  feedback: "ami_feedback",
  resume: "ami_tailored_resume",
} as const;

function set<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

function get<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const sessionStore = {
  setSetup: (v: SessionSetup) => set(KEYS.setup, v),
  getSetup: () => get<SessionSetup>(KEYS.setup),

  setQuestions: (v: PlannedQuestion[]) => set(KEYS.questions, v),
  getQuestions: () => get<PlannedQuestion[]>(KEYS.questions),

  setTranscript: (v: TranscriptTurn[]) => set(KEYS.transcript, v),
  getTranscript: () => get<TranscriptTurn[]>(KEYS.transcript),

  setFeedback: (v: FeedbackReport) => set(KEYS.feedback, v),
  getFeedback: () => get<FeedbackReport>(KEYS.feedback),

  setTailoredResume: (v: TailoredResume) => set(KEYS.resume, v),
  getTailoredResume: () => get<TailoredResume>(KEYS.resume),

  clearAll: () => {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
  },
};
