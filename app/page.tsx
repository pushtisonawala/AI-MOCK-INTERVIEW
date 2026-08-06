"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { Difficulty, SessionSetup, Persona, PANEL_PERSONAS } from "@/lib/types";
import { loadVoices, englishVoices, bestVoice, topVoices } from "@/lib/voice";
import { Briefcase, Building2, FileText, Mic2, Sparkles, UploadCloud, Volume2, Users, Timer } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [numQuestions, setNumQuestions] = useState(6);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");

  const [interviewMode, setInterviewMode] = useState<"standard" | "panel">("standard");
  const [panelVoiceNames, setPanelVoiceNames] = useState<Partial<Record<Exclude<Persona, "general">, string>>>({});

  const [timedMode, setTimedMode] = useState(false);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(120);

  useEffect(() => {
    loadVoices().then((v) => {
      const en = englishVoices(v);
      setVoices(en);
      const best = bestVoice(v);
      if (best) setVoiceName(best.name);

      const top3 = topVoices(v, 3);
      if (top3.length > 0) {
        setPanelVoiceNames({
          technical: top3[0]?.name,
          behavioral: top3[1]?.name || top3[0]?.name,
          hiring_manager: top3[2]?.name || top3[0]?.name,
        });
      }
    });
  }, []);

  function previewVoice() {
    if (!("speechSynthesis" in window)) return;
    const v = voices.find((x) => x.name === voiceName);
    const utter = new SpeechSynthesisUtterance(
      "Hi, thanks for joining today. I'll be conducting your mock interview — let's get started."
    );
    if (v) utter.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  async function handleResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setResumeFile(file);
    setResumeText(null);
    setError(null);
    if (!file) return;

    try {
      setStatus("Reading your resume...");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to read resume");
      setResumeText(data.text);
      setStatus(null);
    } catch (err) {
      setError((err as Error).message);
      setStatus(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!role.trim() || !jobDescription.trim()) {
      setError("Please fill in the target role and job description.");
      return;
    }

    setLoading(true);
    try {
      setStatus("Generating tailored interview questions...");
      const setup: SessionSetup = {
        role: role.trim(),
        company: company.trim() || undefined,
        jobDescription: jobDescription.trim(),
        resumeText: resumeText || undefined,
        difficulty,
        numQuestions,
        voiceName: voiceName || undefined,
        interviewMode,
        panelVoiceNames: interviewMode === "panel" ? panelVoiceNames : undefined,
        timedMode,
        secondsPerQuestion: timedMode ? secondsPerQuestion : undefined,
      };

      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate questions");

      // Wipe any previous interview's data first — otherwise the results page can find
      // stale cached feedback/resume from a prior run (sessionStorage isn't scoped per
      // interview) and show the same numbers again instead of generating fresh ones.
      sessionStore.clearAll();
      sessionStore.setSetup(setup);
      sessionStore.setQuestions(data.questions);
      sessionStore.setTranscript([]);
      router.push("/interview");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg shadow-indigo-950/50">
          <Sparkles size={26} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">AI Mock Interview</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Paste a job description, optionally upload your resume, and practice a live voice interview with an
          AI interviewer. You&apos;ll get feedback and a tailored resume at the end.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-5">
          <div className="section-label">
            <Briefcase size={16} className="text-indigo-400" />
            Role details
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Target role *</label>
              <input
                className="input-field"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Frontend Engineer"
                required
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                <Building2 size={14} className="text-slate-500" /> Company (optional)
              </label>
              <input
                className="input-field"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Job description *</label>
            <textarea
              className="input-field min-h-[150px]"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              required
            />
          </div>
        </div>

        <div className="card space-y-5">
          <div className="section-label">
            <Sparkles size={16} className="text-indigo-400" />
            Interview settings
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Interview focus</label>
              <select
                className="input-field"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="mixed">Mixed (behavioral + technical)</option>
                <option value="behavioral">Behavioral only</option>
                <option value="technical">Technical only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Number of questions</label>
              <select
                className="input-field"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
              >
                {[4, 5, 6, 7, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Interview format</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setInterviewMode("standard")}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                  interviewMode === "standard"
                    ? "border-indigo-500/60 bg-indigo-500/10 text-slate-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="font-medium">Standard</span>
                <p className="mt-0.5 text-xs text-slate-500">One interviewer, one voice.</p>
              </button>
              <button
                type="button"
                onClick={() => setInterviewMode("panel")}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                  interviewMode === "panel"
                    ? "border-indigo-500/60 bg-indigo-500/10 text-slate-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Users size={14} /> Panel
                </span>
                <p className="mt-0.5 text-xs text-slate-500">Technical, HR, and hiring manager, each with their own voice.</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Timer size={16} className="text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">Timed mode</p>
                <p className="text-xs text-slate-500">Practice under a per-question time limit, like a real timed round.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {timedMode && (
                <select
                  className="input-field w-auto py-1.5 text-sm"
                  value={secondsPerQuestion}
                  onChange={(e) => setSecondsPerQuestion(Number(e.target.value))}
                >
                  {[60, 90, 120, 180, 300].map((s) => (
                    <option key={s} value={s}>
                      {s < 60 ? `${s}s` : `${s / 60} min`}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={timedMode}
                onClick={() => setTimedMode((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${timedMode ? "bg-indigo-500" : "bg-slate-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    timedMode ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="section-label">
            <Mic2 size={16} className="text-indigo-400" />
            AI interviewer voice{interviewMode === "panel" ? "s" : ""}
          </div>
          {voices.length > 0 ? (
            interviewMode === "standard" ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <select className="input-field" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={previewVoice} className="btn-secondary shrink-0">
                  <Volume2 size={16} /> Preview
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {PANEL_PERSONAS.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="w-full shrink-0 text-sm text-slate-400 sm:w-44">{p.label}</span>
                    <select
                      className="input-field"
                      value={panelVoiceNames[p.id] || ""}
                      onChange={(e) => setPanelVoiceNames((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    >
                      {voices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-slate-500">
              Loading available voices... (your browser will speak the interview questions aloud)
            </p>
          )}
        </div>

        <div className="card space-y-3">
          <div className="section-label">
            <FileText size={16} className="text-indigo-400" />
            Resume (optional)
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-center transition hover:border-indigo-500/60 hover:bg-slate-900/70">
            <UploadCloud size={22} className="text-slate-500" />
            <span className="text-sm text-slate-400">PDF, DOCX, or TXT — click to upload</span>
            <input type="file" accept=".pdf,.docx,.txt" onChange={handleResumeChange} className="hidden" />
          </label>
          {resumeFile && resumeText && (
            <p className="text-xs text-emerald-400">✓ {resumeFile.name} parsed successfully</p>
          )}
        </div>

        {status && <p className="text-sm text-indigo-300">{status}</p>}
        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
          {loading ? "Setting up your interview..." : "Start Interview →"}
        </button>
      </form>
    </main>
  );
}
