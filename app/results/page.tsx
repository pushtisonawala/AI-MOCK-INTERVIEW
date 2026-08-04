"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { FeedbackReport, TailoredResume } from "@/lib/types";
import FeedbackReportView from "@/components/FeedbackReportView";
import { Download, RotateCcw, Sparkles } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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
            body: JSON.stringify({ setup, transcript }),
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your Results</h1>
        <button onClick={startOver} className="btn-secondary text-sm">
          <RotateCcw size={15} /> Start New Interview
        </button>
      </div>

      {feedback && <FeedbackReportView report={feedback} />}

      {resume && (
        <div className="card mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tailored Resume</h2>
            <button onClick={downloadResume} disabled={downloading} className="btn-primary text-sm">
              <Download size={15} /> {downloading ? "Preparing..." : "Download as Word (.docx)"}
            </button>
          </div>
          {resume.contact && (resume.contact.name || resume.contact.email || resume.contact.phone) && (
            <div className="mb-4 border-b border-slate-800/80 pb-4">
              {resume.contact.name && <p className="text-base font-semibold text-slate-100">{resume.contact.name}</p>}
              <p className="mt-1 text-xs text-slate-500">
                {[resume.contact.email, resume.contact.phone, resume.contact.location, ...(resume.contact.links || [])]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
          )}

          <p className="mb-4 text-sm italic text-slate-400">{resume.summary}</p>

          {resume.sections.map((s, i) => (
            <div key={i} className="mb-4">
              <h3 className="mb-2 font-medium text-slate-200">{s.heading}</h3>
              {s.entries && s.entries.length > 0 ? (
                <div className="space-y-3">
                  {s.entries.map((entry, ei) => (
                    <div key={ei}>
                      <p className="text-sm font-medium text-slate-300">{entry.subheading}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-400">
                        {entry.bullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {(s.bullets || []).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {resume.keywordsAligned?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {resume.keywordsAligned.map((k, i) => (
                <span key={i} className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
