import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SessionSetup, TranscriptTurn, FeedbackReport, TailoredResume } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { setup, transcript, feedback, tailoredResume } = (await req.json()) as {
      setup: SessionSetup;
      transcript: TranscriptTurn[];
      feedback: FeedbackReport;
      tailoredResume: TailoredResume | null;
    };

    if (!setup || !transcript || !feedback) {
      return NextResponse.json({ error: "setup, transcript, and feedback are required" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Not an error — the caller (results page) treats this as "sign in to save".
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("interviews")
      .insert({
        user_id: user.id,
        role: setup.role,
        company: setup.company || null,
        difficulty: setup.difficulty,
        setup,
        transcript,
        feedback,
        tailored_resume: tailoredResume,
        overall_score: feedback.overallScore ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("save-interview error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
