"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { findVoiceByName, resolveVoiceName } from "@/lib/voice";
import { PlannedQuestion, SessionSetup, RetryFeedback } from "@/lib/types";
import AIOrb from "@/components/AIOrb";
import MicLevel from "@/components/MicLevel";
import { ArrowLeft, Send, Repeat, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

type Phase = "loading" | "asking" | "listening" | "grading" | "result" | "error";

const SILENCE_MS = 1800;

function toOrbPhase(phase: Phase): "loading" | "asking" | "listening" | "thinking" | "done" | "error" {
  if (phase === "grading") return "thinking";
  if (phase === "result") return "done";
  return phase;
}

export default function RetryQuestionPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<SessionSetup | null>(null);
  const [question, setQuestion] = useState<PlannedQuestion | null>(null);
  const [originalScore, setOriginalScore] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [interimText, setInterimText] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RetryFeedback | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const recognitionRef = useRef<any>(null);
  const listeningActiveRef = useRef(false);
  const finalTranscriptRef = useRef<string>("");
  const lastSpeechAtRef = useRef<number>(Date.now());
  const startedRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    const s = sessionStore.getSetup();
    const q = sessionStore.getRetryQuestion();
    const score = sessionStore.getRetryOriginalScore();
    if (!s || !q) {
      router.push("/results");
      return;
    }
    setSetup(s);
    setQuestion(q);
    setOriginalScore(score ?? 0);
  }, [router]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Mic for the live level meter only — no video/recording in retry mode, this is just
  // quick focused practice.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setMicStream(stream);
      })
      .catch(() => {
        /* mic optional for the level meter; speech recognition works independently */
      });
    return () => {
      cancelled = true;
      setMicStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
          resolve();
          return;
        }
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 1;
          utter.pitch = 1;
          const voices = window.speechSynthesis.getVoices();
          const voiceName = setup ? resolveVoiceName(setup, question?.persona) : undefined;
          const match = findVoiceByName(voices, voiceName);
          if (match) utter.voice = match;
          utter.onend = () => resolve();
          utter.onerror = () => resolve();
          window.speechSynthesis.speak(utter);
        } catch {
          resolve();
        }
      });
    },
    [setup, question]
  );

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    listeningActiveRef.current = true;
    try {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscriptRef.current += res[0].transcript + " ";
          } else {
            interim += res[0].transcript;
          }
        }
        lastSpeechAtRef.current = Date.now();
        setInterimText(interim);
      };
      recognition.onerror = () => {};
      recognition.onend = () => {
        if (listeningActiveRef.current) {
          setTimeout(() => {
            if (listeningActiveRef.current) startListening();
          }, 150);
        }
      };
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      /* noop */
    }
  }

  function stopListening() {
    listeningActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
  }

  const askQuestion = useCallback(async () => {
    if (!question) return;
    setPhase("asking");
    await speak(question.text);
    setInterimText("");
    finalTranscriptRef.current = "";
    lastSpeechAtRef.current = Date.now();
    autoSubmittedRef.current = false;
    setManualAnswer("");
    setResult(null);
    setPhase("listening");
    startListening();
  }, [question, speak]);

  useEffect(() => {
    if (setup && question && !startedRef.current) {
      startedRef.current = true;
      askQuestion();
    }
  }, [setup, question, askQuestion]);

  async function submitAnswer() {
    if (isSubmittingRef.current || !setup || !question) return;
    isSubmittingRef.current = true;
    stopListening();

    const answer = (speechSupported ? finalTranscriptRef.current + " " + interimText : manualAnswer).trim();
    setInterimText("");

    if (!answer) {
      isSubmittingRef.current = false;
      setPhase("listening");
      return;
    }

    setPhase("grading");
    setError(null);
    try {
      const res = await fetch("/api/retry-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup, question, answer, previousScore: originalScore }),
      });
      const data = (await res.json()) as RetryFeedback & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Something went wrong");
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  useEffect(() => {
    submitRef.current = submitAnswer;
  });

  useEffect(() => {
    if (phase !== "listening" || !speechSupported) return;
    const interval = setInterval(() => {
      if (autoSubmittedRef.current) return;
      const hasSpeech = finalTranscriptRef.current.trim().length > 0;
      const silentFor = Date.now() - lastSpeechAtRef.current;
      if (hasSpeech && silentFor > SILENCE_MS) {
        autoSubmittedRef.current = true;
        submitRef.current();
      }
    }, 400);
    return () => clearInterval(interval);
  }, [phase, speechSupported]);

  function tryAgain() {
    startedRef.current = false;
    askQuestion();
  }

  function finish() {
    stopListening();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
    sessionStore.clearRetry();
    router.push("/results");
  }

  if (!setup || !question) return null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/results" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft size={15} /> Back to Results
      </Link>

      <div className="mb-6">
        <p className="section-label">
          <Repeat size={16} className="text-indigo-400" />
          Retry: {question.category}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Focused practice on your weakest area. Previous score on similar questions: {originalScore}/100.
        </p>
      </div>

      <div className="card flex flex-col items-center gap-4 py-8">
        <AIOrb phase={toOrbPhase(phase)} />
        <p className="max-w-md text-center text-lg text-slate-100">{question.text}</p>
        {phase === "listening" && <MicLevel stream={micStream} active={true} />}
      </div>

      <div className="card mt-4">
        {phase === "asking" && <p className="text-center text-sm text-slate-500">Interviewer is speaking...</p>}
        {phase === "grading" && <p className="text-center text-sm text-slate-500">Grading your answer...</p>}

        {phase === "listening" && speechSupported && (
          <div className="space-y-3">
            {interimText && <p className="text-sm italic text-slate-400">{interimText}</p>}
            <button onClick={submitAnswer} className="btn-primary w-full">
              <Send size={15} /> Done answering
            </button>
          </div>
        )}

        {phase === "listening" && !speechSupported && (
          <div className="space-y-3">
            <textarea
              className="input-field min-h-[90px]"
              value={manualAnswer}
              onChange={(e) => setManualAnswer(e.target.value)}
              placeholder="Type your answer here..."
            />
            <button onClick={submitAnswer} className="btn-primary w-full">
              <Send size={15} /> Submit Answer
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-rose-400">{error}</p>
            <button onClick={tryAgain} className="btn-primary">
              Try Again
            </button>
          </div>
        )}

        {phase === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-bold text-slate-100">{result.score}</span>
              <span className="text-sm text-slate-500">/ 100</span>
              <ScoreDelta from={originalScore} to={result.score} />
            </div>
            <p className="text-sm text-slate-300">{result.comment}</p>
            {result.whyThisScore && (
              <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-400">
                <span className="font-semibold text-slate-300">Why this score: </span>
                {result.whyThisScore}
              </p>
            )}
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
              Tip: {result.improvedTip}
            </div>
            {result.idealAnswer && (
              <details className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none font-semibold text-emerald-300">Show a model answer</summary>
                <p className="mt-2 leading-relaxed text-emerald-100/90">{result.idealAnswer}</p>
              </details>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={tryAgain} className="btn-secondary">
                <Repeat size={15} /> Try Again
              </button>
              <button onClick={finish} className="btn-primary">
                Back to Results
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ScoreDelta({ from, to }: { from: number; to: number }) {
  const diff = to - from;
  if (Math.abs(diff) < 3) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Minus size={13} /> about the same
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <TrendingUp size={13} /> +{diff} vs. before
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-rose-400">
      <TrendingDown size={13} /> {diff} vs. before
    </span>
  );
}
