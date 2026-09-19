import { TranscriptTurn, PANEL_PERSONAS } from "@/lib/types";
import { Bot, User } from "lucide-react";

function personaLabel(persona?: string) {
  if (!persona || persona === "general") return null;
  return PANEL_PERSONAS.find((p) => p.id === persona)?.label || null;
}

export default function ChatTranscript({
  turns,
  interim,
}: {
  turns: TranscriptTurn[];
  interim?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {turns.map((t, i) => (
        <Bubble key={i} role={t.role} text={t.text} persona={t.persona} reasoning={t.reasoning} sources={t.sources} />
      ))}
      {interim && <Bubble role="user" text={interim} pending />}
    </div>
  );
}

function Bubble({
  role,
  text,
  pending,
  persona,
  reasoning,
  sources,
}: {
  role: "ai" | "user";
  text: string;
  pending?: boolean;
  persona?: string;
  reasoning?: string;
  sources?: { id: string; title: string }[];
}) {
  const isAi = role === "ai";
  const label = isAi ? personaLabel(persona) : null;
  return (
    <div className={`flex items-start gap-2 ${isAi ? "justify-start" : "flex-row-reverse justify-start"}`}>
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isAi ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-700 text-slate-300"
        }`}
      >
        {isAi ? <Bot size={13} /> : <User size={13} />}
      </div>
      <div className="max-w-[80%]">
        {label && <p className="mb-0.5 pl-1 text-[10px] font-medium uppercase tracking-wide text-indigo-400">{label}</p>}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isAi ? "rounded-tl-sm bg-slate-800/80 text-slate-100" : "rounded-tr-sm bg-indigo-600 text-white"
          } ${pending ? "opacity-60" : ""}`}
        >
          {text}
        </div>
        {isAi && (reasoning || (sources && sources.length > 0)) && (
          <details className="group mt-1 pl-1 text-xs text-slate-500">
            <summary className="cursor-pointer select-none list-none text-indigo-400/80 hover:text-indigo-300">
              Why this question?
            </summary>
            <p className="mt-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 leading-relaxed text-slate-400">
              {reasoning}
              {sources && sources.length > 0 && (
                <span className="mt-1.5 block text-[11px] text-slate-500">
                  Inspired by knowledge-base entries:{" "}
                  {sources.map((src) => `${src.id} “${src.title.length > 48 ? src.title.slice(0, 48) + "…" : src.title}”`).join(" · ")}
                </span>
              )}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
