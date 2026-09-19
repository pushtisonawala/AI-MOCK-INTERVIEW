import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { resumeTailorPrompt } from "@/lib/prompts";
import { computeAtsMatch } from "@/lib/ats";
import { SessionSetup, TailoredResume } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const setup = (await req.json()) as SessionSetup;
    if (!setup || !setup.jobDescription) {
      return NextResponse.json({ error: "setup with jobDescription is required" }, { status: 400 });
    }

    const prompt = resumeTailorPrompt(setup);
    const data = await generateJSON<TailoredResume>(prompt);

    // Replace the LLM's estimated ATS match with a computed one (TF-IDF + embeddings) whenever a
    // resume was provided. If the computation fails we keep the LLM's estimate.
    if (setup.resumeText) {
      try {
        const ats = await computeAtsMatch(setup.jobDescription, setup.resumeText);
        if (ats) data.atsMatch = ats;
      } catch (err) {
        console.warn("tailor-resume: computed ATS match failed, keeping LLM estimate", err);
      }
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("tailor-resume error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
