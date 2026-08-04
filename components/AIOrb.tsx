"use client";

import { Bot } from "lucide-react";

type OrbPhase = "loading" | "asking" | "listening" | "thinking" | "done" | "error";

const CONFIG: Record<OrbPhase, { label: string; glow: string; ring: string; pulse: string }> = {
  loading: { label: "Setting up", glow: "bg-slate-600", ring: "border-slate-700", pulse: "" },
  asking: { label: "Speaking", glow: "bg-indigo-500", ring: "border-indigo-400", pulse: "animate-pulse-fast" },
  listening: { label: "Listening", glow: "bg-emerald-500", ring: "border-emerald-400", pulse: "animate-pulse-slow" },
  thinking: { label: "Thinking", glow: "bg-amber-500", ring: "border-amber-400", pulse: "animate-pulse-slow" },
  done: { label: "Wrapped up", glow: "bg-slate-500", ring: "border-slate-600", pulse: "" },
  error: { label: "Something went wrong", glow: "bg-rose-500", ring: "border-rose-400", pulse: "" },
};

export default function AIOrb({ phase }: { phase: OrbPhase }) {
  const c = CONFIG[phase];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className={`absolute inset-0 rounded-full opacity-50 blur-2xl ${c.glow} ${c.pulse}`} />
        <div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full border-2 bg-slate-950/90 backdrop-blur transition-transform duration-300 ${c.ring} ${
            phase === "asking" ? "scale-105" : "scale-100"
          }`}
        >
          <Bot size={36} className="text-slate-100" />
        </div>
      </div>
      <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {c.label}
      </span>
    </div>
  );
}
