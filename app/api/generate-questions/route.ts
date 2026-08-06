import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { questionsPrompt } from "@/lib/prompts";
import { SessionSetup, PlannedQuestion, Persona } from "@/lib/types";

export const runtime = "nodejs";

const VALID_PERSONAS: Persona[] = ["technical", "behavioral", "hiring_manager"];

// Simple category-based fallback in case the model omits/invalidates a persona in panel
// mode, so the app never ends up with an unassigned interviewer.
function fallbackPersona(category: string, index: number, total: number): Persona {
  if (index === 0 || index === total - 1) return "hiring_manager";
  const c = category.toLowerCase();
  if (c.includes("technical") || c.includes("skill") || c.includes("system") || c.includes("problem")) return "technical";
  return "behavioral";
}

export async function POST(req: NextRequest) {
  try {
    const setup = (await req.json()) as SessionSetup;
    if (!setup.role || !setup.jobDescription) {
      return NextResponse.json({ error: "role and jobDescription are required" }, { status: 400 });
    }

    const isPanel = setup.interviewMode === "panel";
    const prompt = questionsPrompt(setup);
    const data = await generateJSON<{ questions: { id?: string; category?: string; text: string; persona?: string }[] }>(
      prompt
    );

    const raw = data.questions || [];
    const questions: PlannedQuestion[] = raw.map((q, i) => ({
      id: q.id || `q${i + 1}`,
      category: q.category || "general",
      text: q.text,
      persona: isPanel
        ? VALID_PERSONAS.includes(q.persona as Persona)
          ? (q.persona as Persona)
          : fallbackPersona(q.category || "general", i, raw.length)
        : "general",
    }));

    if (questions.length === 0) {
      return NextResponse.json({ error: "The AI didn't return any questions. Try again." }, { status: 502 });
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("generate-questions error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
