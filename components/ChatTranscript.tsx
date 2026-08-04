import { TranscriptTurn } from "@/lib/types";
import { Bot, User } from "lucide-react";

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
        <Bubble key={i} role={t.role} text={t.text} />
      ))}
      {interim && <Bubble role="user" text={interim} pending />}
    </div>
  );
}

function Bubble({ role, text, pending }: { role: "ai" | "user"; text: string; pending?: boolean }) {
  const isAi = role === "ai";
  return (
    <div className={`flex items-start gap-2 ${isAi ? "justify-start" : "flex-row-reverse justify-start"}`}>
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isAi ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-700 text-slate-300"
        }`}
      >
        {isAi ? <Bot size={13} /> : <User size={13} />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAi ? "rounded-tl-sm bg-slate-800/80 text-slate-100" : "rounded-tr-sm bg-indigo-600 text-white"
        } ${pending ? "opacity-60" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}
