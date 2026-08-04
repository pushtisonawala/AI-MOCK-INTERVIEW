import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { interviewTurnPrompt } from "@/lib/prompts";
import { SessionSetup, PlannedQuestion, TranscriptTurn, InterviewTurnResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      setup: SessionSetup;
      plannedQuestions: PlannedQuestion[];
      currentIndex: number;
      transcript: TranscriptTurn[];
    };
    const { setup, plannedQuestions, currentIndex, transcript } = body;

    if (!setup || !plannedQuestions || typeof currentIndex !== "number") {
      console.error("interview-turn validation failed", {
        hasSetup: !!setup,
        hasPlannedQuestions: !!plannedQuestions,
        plannedQuestionsIsArray: Array.isArray(plannedQuestions),
        currentIndexType: typeof currentIndex,
      });
      return NextResponse.json({ error: "Missing setup, plannedQuestions, or currentIndex" }, { status: 400 });
    }

    if (currentIndex >= plannedQuestions.length) {
      const resp: InterviewTurnResponse = {
        type: "end",
        aiText: "That covers everything I wanted to ask. Thanks so much for your time today — great job!",
        nextIndex: plannedQuestions.length,
      };
      return NextResponse.json(resp);
    }

    const prompt = interviewTurnPrompt(setup, plannedQuestions, currentIndex, transcript || []);
    const data = await generateJSON<InterviewTurnResponse>(prompt);
    return NextResponse.json(data);
  } catch (err) {
    console.error("interview-turn error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
