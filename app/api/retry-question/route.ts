import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { retryQuestionPrompt } from "@/lib/prompts";
import { SessionSetup, PlannedQuestion, RetryFeedback } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { setup, question, answer, previousScore } = (await req.json()) as {
      setup: SessionSetup;
      question: PlannedQuestion;
      answer: string;
      previousScore: number;
    };

    if (!setup || !question || typeof answer !== "string") {
      return NextResponse.json({ error: "setup, question, and answer are required" }, { status: 400 });
    }

    const prompt = retryQuestionPrompt(setup, question, answer, previousScore ?? 50);
    const data = await generateJSON<RetryFeedback>(prompt);
    return NextResponse.json(data);
  } catch (err) {
    console.error("retry-question error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
