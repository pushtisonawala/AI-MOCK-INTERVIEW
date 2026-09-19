import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { feedbackPrompt } from "@/lib/prompts";
import { prepareFeedbackContext, finalizeFeedback } from "@/lib/analysis";
import { SessionSetup, TranscriptTurn, FeedbackReport, PlannedQuestion } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { setup, transcript, plannedQuestions } = (await req.json()) as {
      setup: SessionSetup;
      transcript: TranscriptTurn[];
      plannedQuestions?: PlannedQuestion[];
    };

    if (!setup || !transcript || transcript.length === 0) {
      return NextResponse.json({ error: "setup and a non-empty transcript are required" }, { status: 400 });
    }

    // 1. Measure the transcript (NLP + embeddings) and retrieve reference guidance (RAG).
    const ctx = await prepareFeedbackContext(setup, transcript, plannedQuestions || []);

    // 2. Ask the LLM to grade, with those measurements and references in the prompt.
    const prompt = feedbackPrompt(setup, transcript, plannedQuestions || [], {
      metricsBlock: ctx.metricsBlock,
      referenceBlock: ctx.referenceBlock,
    });
    let data = await generateJSON<FeedbackReport>(prompt);
    // The model occasionally returns a non-array here; the UI treats a missing list as
    // "no per-question review" rather than crashing.
    data.questionReviews = Array.isArray(data.questionReviews) ? data.questionReviews : [];

    // 3. Attach measured metrics + sources, verify cited quotes, apply the score sanity guard.
    data = await finalizeFeedback(data, ctx, setup);
    return NextResponse.json(data);
  } catch (err) {
    console.error("feedback error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
