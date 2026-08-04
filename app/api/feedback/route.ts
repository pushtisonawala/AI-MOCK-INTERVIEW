import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { feedbackPrompt } from "@/lib/prompts";
import { SessionSetup, TranscriptTurn, FeedbackReport } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { setup, transcript } = (await req.json()) as {
      setup: SessionSetup;
      transcript: TranscriptTurn[];
    };

    if (!setup || !transcript || transcript.length === 0) {
      return NextResponse.json({ error: "setup and a non-empty transcript are required" }, { status: 400 });
    }

    const prompt = feedbackPrompt(setup, transcript);
    const data = await generateJSON<FeedbackReport>(prompt);
    return NextResponse.json(data);
  } catch (err) {
    console.error("feedback error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
