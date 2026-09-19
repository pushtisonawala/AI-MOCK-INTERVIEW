"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { findVoiceByName, resolveVoiceName } from "@/lib/voice";
import { KbSource, PlannedQuestion, SessionSetup, TranscriptTurn, InterviewTurnResponse, Persona, PANEL_PERSONAS } from "@/lib/types";
import AIOrb from "@/components/AIOrb";
import MicLevel from "@/components/MicLevel";
import ChatTranscript from "@/components/ChatTranscript";
import { PhoneOff, Send, Timer } from "lucide-react";

type Phase = "loading" | "asking" | "listening" | "thinking" | "done" | "error";

const SILENCE_MS = 1800;

function personaLabel(persona?: Persona) {
  if (!persona || persona === "general") return null;
  return PANEL_PERSONAS.find((p) => p.id === persona)?.label || null;
}

export default function InterviewPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<SessionSetup | null>(null);
  const [questions, setQuestions] = useState<PlannedQuestion[]>([]);
  const [plannedIndex, setPlannedIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [interimText, setInterimText] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [currentPersona, setCurrentPersona] = useState<Persona | undefined>(undefined);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const listeningActiveRef = useRef(false);
  const finalTranscriptRef = useRef<string>("");
  const lastSpeechAtRef = useRef<number>(Date.now());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const startedRef = useRef(false);
  const submitAnswerRef = useRef<() => void>(() => {});
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const autoSubmittedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const pendingTranscriptRef = useRef<TranscriptTurn[] | null>(null);

  function appendTranscript(turn: TranscriptTurn) {
    const next = [...transcriptRef.current, turn];
    transcriptRef.current = next;
    setTranscript(next);
  }

  // Load session data set up on the home page
  useEffect(() => {
    const s = sessionStore.getSetup();
    const q = sessionStore.getQuestions();
    if (!s || !q || q.length === 0) {
      router.push("/");
      return;
    }
    setSetup(s);
    setQuestions(q);
  }, [router]);

  // Camera + recorder (record-only, for the candidate's own review — never uploaded anywhere)
  useEffect(() => {
    let cancelled = false;
    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        try {
          const recorder = new MediaRecorder(stream);
          chunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          recorder.start();
          recorderRef.current = recorder;
        } catch {
          // MediaRecorder unsupported in this browser — recording just won't be offered
        }
      } catch {
        setCamError("Couldn't access your camera/microphone. You can still complete the interview.");
      }
    }
    initMedia();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Auto-scroll the transcript panel as new turns come in
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, interimText]);

  const speak = useCallback(
    (text: string, persona?: Persona): Promise<void> => {
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
          const voiceName = setup ? resolveVoiceName(setup, persona) : undefined;
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
    [setup]
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
      recognition.onerror = () => {
        // benign errors (no-speech, aborted, network blips) — onend below handles recovery
      };
      recognition.onend = () => {
        if (listeningActiveRef.current) {
          // The browser sometimes ends recognition on its own after a pause even in
          // continuous mode — restart it transparently so the conversation keeps flowing.
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

  const askQuestion = useCallback(
    async (text: string, persona?: Persona, reasoning?: string, sources?: KbSource[]) => {
      setPhase("asking");
      setCurrentPersona(persona);
      appendTranscript({ role: "ai", text, persona, reasoning, sources });
      await speak(text, persona);
      setInterimText("");
      finalTranscriptRef.current = "";
      lastSpeechAtRef.current = Date.now();
      autoSubmittedRef.current = false;
      setManualAnswer("");
      setRemainingSeconds(setup?.timedMode ? setup.secondsPerQuestion ?? 120 : null);
      setPhase("listening");
      startListening();
    },
    [speak, setup]
  );

  // Kick off the interview once setup + questions are loaded
  useEffect(() => {
    if (setup && questions.length > 0 && !startedRef.current) {
      startedRef.current = true;
      askQuestion(questions[0].text, questions[0].persona, questions[0].rationale, questions[0].sources);
    }
  }, [setup, questions, askQuestion]);

  function finishInterview() {
    setPhase("done");
    sessionStore.setTranscript(transcriptRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordingUrl(URL.createObjectURL(blob));
      };
      try {
        recorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
  }

  // Sends the current transcript to the AI and handles the response. Kept separate from
  // submitAnswer() so a failed request can be retried without re-capturing speech or
  // risking duplicate answers being appended.
  async function requestNextTurn(currentTranscript: TranscriptTurn[]) {
    if (!setup || questions.length === 0) {
      setError("Your interview session data was lost — please restart the interview.");
      setPhase("error");
      return;
    }

    pendingTranscriptRef.current = currentTranscript;
    setPhase("thinking");
    setError(null);

    try {
      const res = await fetch("/api/interview-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup,
          plannedQuestions: questions,
          currentIndex: plannedIndex,
          transcript: currentTranscript,
        }),
      });
      const data = (await res.json()) as InterviewTurnResponse & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Something went wrong");

      pendingTranscriptRef.current = null;

      if (data.type === "end") {
        const closingPersona: Persona | undefined = setup.interviewMode === "panel" ? "hiring_manager" : undefined;
        setCurrentPersona(closingPersona);
        appendTranscript({ role: "ai", text: data.aiText, persona: closingPersona, reasoning: data.reasoning });
        await speak(data.aiText, closingPersona);
        finishInterview();
        return;
      }

      // "next" moves to a new planned question (persona comes from that question);
      // "followup" stays on the current planned question and its persona.
      const persona = data.type === "next" ? questions[data.nextIndex]?.persona : questions[plannedIndex]?.persona;

      setPlannedIndex(data.nextIndex);
      askQuestion(data.aiText, persona, data.reasoning, questions[data.type === "next" ? data.nextIndex : plannedIndex]?.sources);
    } catch (err) {
      // Surface the error and stop — no silent auto-retry loop. The candidate (or the
      // Retry button) decides what happens next, so we never hammer the API repeatedly.
      setError((err as Error).message);
      setPhase("error");
    }
  }

  function retryLastTurn() {
    if (!pendingTranscriptRef.current) return;
    requestNextTurn(pendingTranscriptRef.current);
  }

  function submitAnswer() {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    stopListening();

    const answer = (speechSupported ? finalTranscriptRef.current + " " + interimText : manualAnswer).trim();
    if (!answer) {
      isSubmittingRef.current = false;
      return;
    }

    appendTranscript({ role: "user", text: answer });
    setInterimText("");
    requestNextTurn(transcriptRef.current).finally(() => {
      isSubmittingRef.current = false;
    });
  }

  // Always keep a ref to the latest submitAnswer so timers/intervals never call a stale closure
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  });

  // Silence-based auto-submit: once the candidate pauses for a beat, move the conversation along.
  // autoSubmittedRef guarantees this can fire at most once per listening window, even if the
  // interval ticks again before React has flushed the phase change away from "listening".
  useEffect(() => {
    if (phase !== "listening" || !speechSupported) return;
    const interval = setInterval(() => {
      if (autoSubmittedRef.current) return;
      const hasSpeech = finalTranscriptRef.current.trim().length > 0;
      const silentFor = Date.now() - lastSpeechAtRef.current;
      if (hasSpeech && silentFor > SILENCE_MS) {
        autoSubmittedRef.current = true;
        submitAnswerRef.current();
      }
    }, 400);
    return () => clearInterval(interval);
  }, [phase, speechSupported]);

  // Timed mode: count down while listening and force a submit (whatever's been said so
  // far) once time runs out. Shares autoSubmittedRef with the silence-based auto-submit
  // so the two mechanisms can never both fire for the same answer.
  useEffect(() => {
    if (phase !== "listening" || !setup?.timedMode || remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submitAnswerRef.current();
      }
      return;
    }
    const timeout = setTimeout(() => setRemainingSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [phase, setup?.timedMode, remainingSeconds]);

  function endEarly() {
    stopListening();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
    finishInterview();
  }

  function goToResults() {
    sessionStore.setTranscript(transcriptRef.current);
    router.push("/results");
  }

  if (!setup) return null;

  const progress = Math.min(plannedIndex, questions.length);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {setup.role}
            {setup.company ? ` @ ${setup.company}` : ""}
          </h1>
          <p className="text-sm text-slate-400">
            Question {Math.min(progress + 1, questions.length)} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase === "listening" && setup.timedMode && remainingSeconds !== null && (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                remainingSeconds <= 10
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-slate-700 bg-slate-900/60 text-slate-300"
              }`}
            >
              <Timer size={14} />
              {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
            </span>
          )}
          {phase !== "done" && (
            <button onClick={endEarly} className="btn-secondary text-sm">
              <PhoneOff size={15} /> End interview
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="card flex flex-col items-center justify-center gap-4 py-8">
            {personaLabel(currentPersona) && (
              <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-indigo-300">
                {personaLabel(currentPersona)}
              </span>
            )}
            <AIOrb phase={phase} />
          </div>
          <div className="card overflow-hidden p-0">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-black object-cover" />
            {camError && <p className="p-3 text-xs text-amber-400">{camError}</p>}
            {phase === "listening" && (
              <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3">
                <span className="text-xs text-slate-500">Your mic</span>
                <MicLevel stream={streamRef.current} active={phase === "listening"} />
              </div>
            )}
          </div>
        </div>

        <div className="card flex flex-col md:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">Conversation</span>
            {phase === "listening" && speechSupported && (
              <span className="text-xs text-slate-500">Pause a moment when you&apos;re done — I&apos;ll continue automatically</span>
            )}
          </div>

          <div className="max-h-[360px] min-h-[220px] flex-1 overflow-y-auto pr-1">
            <ChatTranscript turns={transcript} interim={phase === "listening" ? interimText : ""} />
            <div ref={transcriptEndRef} />
          </div>

          <div className="mt-4 border-t border-slate-800/80 pt-4">
            {phase === "listening" && speechSupported && (
              <button onClick={submitAnswer} className="btn-primary w-full">
                <Send size={15} /> Done answering
              </button>
            )}

            {phase === "listening" && !speechSupported && (
              <div className="space-y-3">
                <textarea
                  className="input-field min-h-[90px]"
                  value={manualAnswer}
                  onChange={(e) => setManualAnswer(e.target.value)}
                  placeholder="Your browser doesn't support speech recognition — type your answer here (try Chrome or Edge for voice)."
                />
                <button onClick={submitAnswer} className="btn-primary w-full">
                  <Send size={15} /> Submit Answer
                </button>
              </div>
            )}

            {phase === "asking" && <p className="text-center text-sm text-slate-500">Interviewer is speaking...</p>}
            {phase === "thinking" && <p className="text-center text-sm text-slate-500">Thinking...</p>}

            {phase === "error" && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-rose-400">{error}</p>
                <div className="flex justify-center gap-3">
                  <button onClick={retryLastTurn} className="btn-primary">
                    Retry
                  </button>
                  <button onClick={endEarly} className="btn-secondary">
                    End Interview
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {phase === "done" && (
        <div className="card mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-300">Nice work! Ready to see your feedback and tailored resume?</p>
          <div className="flex gap-3">
            {recordingUrl && (
              <a href={recordingUrl} download="mock-interview-recording.webm" className="btn-secondary">
                Download recording
              </a>
            )}
            <button onClick={goToResults} className="btn-primary">
              View Feedback & Resume →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
