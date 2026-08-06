import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { questionsPrompt } from "@/lib/prompts";
import { SessionSetup, PlannedQuestion } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const setup = (await req.json()) as SessionSetup;
    if (!setup.role || !setup.jobDescription) {
      return NextResponse.json({ error: "role and jobDescription are required" }, { status: 400 });
    }

    const prompt = questionsPrompt(setup);
    const data = await generateJSON<{ questions: PlannedQuestion[] }>(prompt);

    const questions = (data.questions || []).map((q, i) => ({
      id: q.id || `q${i + 1}`,
      category: q.category || "general",
      text: q.text,
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
