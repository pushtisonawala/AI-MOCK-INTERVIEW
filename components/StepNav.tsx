"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
  { path: "/", label: "Setup" },
  { path: "/interview", label: "Interview" },
  { path: "/results", label: "Results" },
];

export default function StepNav() {
  const pathname = usePathname();
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.path === pathname)
  );

  return (
    <div className="mx-auto flex max-w-4xl items-center justify-center gap-1.5 px-6 pt-8 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s.path} className="flex items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-indigo-500 text-white shadow-[0_0_0_4px_rgba(99,102,241,0.2)]"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {done ? <Check size={13} /> : i + 1}
              </div>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  active ? "text-slate-100" : done ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 sm:w-12 ${done ? "bg-emerald-500/60" : "bg-slate-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
