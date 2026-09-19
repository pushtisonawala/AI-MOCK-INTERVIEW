"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { FeedbackReport, TailoredResume, PlannedQuestion } from "@/lib/types";
import FeedbackReportView from "@/components/FeedbackReportView";
import TailoredResumeView from "@/components/TailoredResumeView";
import { Download, RotateCcw, Sparkles, Save, LogIn, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";

// Picks the planned question that best matches the lowest-scoring feedback category, so
// "retry weakest area" practices something concretely tied to what went wrong.
function findWeakestQuestion(feedback: FeedbackReport, questions: PlannedQuestion[]) {
  if (!feedback.categoryScores?.length || !questions.length) return null;
  const weakest = [...feedback.categoryScores].sort((a, b) => a.score - b.score)[0];
  const norm = (s: string) => s.toLowerCase().trim();
  const match =
    questions.find((q) => norm(q.category) === norm(weakest.category)) ||
    questions.find((q) => norm(q.category).includes(norm(weakest.category)) || norm(weakest.category).includes(norm(q.category))) ||
    questions[0];
  return { question: match, categoryScore: weakest };
}

type SaveStatus = "idle" | "saving" | "saved" | "signin_required" | "error";

export default function ResultsPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const attemptedSaveRef = useRef(false);

  useEffect(() => {
    const setup = sessionStore.getSetup();
    const transcript = sessionStore.getTranscript();
    if (!setup || !transcript || transcript.length === 0) {
      router.push("/");
      return;
    }

    const cachedFeedback = sessionStore.getFeedback();
    const cachedResume = sessionStore.getTailoredResume();
    if (cachedFeedback && cachedResume) {
      setFeedback(cachedFeedback);
      setResume(cachedResume);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [fbRes, resumeRes] = await Promise.all([
          fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ setup, transcript, plannedQuestions: sessionStore.getQuestions() || [] }),
          }),
          fetch("/api/tailor-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(setup),
          }),
        ]);
        const fbData = await fbRes.json();
        const resumeData = await resumeRes.json();
        if (!fbRes.ok) throw new Error(fbData.error || "Failed to generate feedback");
        if (!resumeRes.ok) throw new Error(resumeData.error || "Failed to tailor resume");

        sessionStore.setFeedback(fbData);
        sessionStore.setTailoredResume(resumeData);
        setFeedback(fbData);
        setResume(resumeData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Once feedback + resume are ready, try saving this interview to the user's history.
  // Guarded so a re-render (or a page refresh that finds a previously-saved id) never
  // creates a duplicate row.
  useEffect(() => {
    if (!feedback || !resume || attemptedSaveRef.current) return;

    const existingId = sessionStore.getSavedInterviewId();
    if (existingId) {
      setSaveStatus("saved");
      return;
    }

    attemptedSaveRef.current = true;
    const setup = sessionStore.getSetup();
    const transcript = sessionStore.getTranscript();
    if (!setup || !transcript) return;

    setSaveStatus("saving");
    fetch("/api/save-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setup, transcript, feedback, tailoredResume: resume }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) {
          setSaveStatus("signin_required");
          return;
        }
        if (!res.ok) throw new Error(data.error || "Failed to save");
        sessionStore.setSavedInterviewId(data.id);
        setSaveStatus("saved");
      })
      .catch(() => setSaveStatus("error"));
  }, [feedback, resume]);

  async function downloadResume() {
    if (!resume) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/export-resume-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailoredResume: resume }),
      });
      if (!res.ok) throw new Error("Failed to generate the Word document");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tailored-resume.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  function startOver() {
    sessionStore.clearAll();
    router.push("/");
  }

  function retryWeakestQuestion() {
    if (!feedback) return;
    const questions = sessionStore.getQuestions() || [];
    const weakest = findWeakestQuestion(feedback, questions);
    if (!weakest) return;
    sessionStore.setRetryQuestion({ question: weakest.question, originalScore: weakest.categoryScore.score });
    router.push("/interview/retry");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 animate-pulse-slow items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600">
          <Sparkles size={24} className="text-white" />
        </div>
        <p className="text-lg text-slate-200">Analyzing your interview and tailoring your resume...</p>
        <p className="mt-2 text-sm text-slate-500">This takes a few seconds.</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-rose-400">{error}</p>
        <button onClick={startOver} className="btn-secondary mt-4">
          <RotateCcw size={15} /> Start Over
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your Results</h1>
        <button onClick={startOver} className="btn-secondary text-sm">
          <RotateCcw size={15} /> Start New Interview
        </button>
      </div>

      {saveStatus === "signin_required" && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm">
          <span className="text-indigo-200">Sign in to save this interview and revisit it later.</span>
          <Link href="/login?next=/results" className="btn-secondary shrink-0 text-xs">
            <LogIn size={13} /> Sign in
          </Link>
        </div>
      )}
      {saveStatus === "saving" && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
          <Save size={14} className="animate-pulse" /> Saving to your history...
        </div>
      )}
      {saveStatus === "saved" && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 size={14} /> Saved to your interview history.
        </div>
      )}

      {feedback && (() => {
        const weakest = findWeakestQuestion(feedback, sessionStore.getQuestions() || []);
        return weakest ? (
          <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2 text-amber-200 sm:items-center">
              <Target size={15} className="mt-0.5 shrink-0 sm:mt-0" />
              Weakest area: <strong className="font-semibold">{weakest.categoryScore.category}</strong> ({weakest.categoryScore.score}/100). Want another shot at it?
            </span>
            <button onClick={retryWeakestQuestion} className="btn-secondary shrink-0 text-xs">
              Retry this question →
            </button>
          </div>
        ) : null;
      })()}

      {feedback && <FeedbackReportView report={feedback} />}

      {resume && (
        <div className="card mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tailored Resume</h2>
            <button onClick={downloadResume} disabled={downloading} className="btn-primary text-sm">
              <Download size={15} /> {downloading ? "Preparing..." : "Download as Word (.docx)"}
            </button>
          </div>
          <TailoredResumeView resume={resume} />
        </div>
      )}
    </main>
  );
}
