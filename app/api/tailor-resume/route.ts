import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { resumeTailorPrompt } from "@/lib/prompts";
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
    return NextResponse.json(data);
  } catch (err) {
    console.error("tailor-resume error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
