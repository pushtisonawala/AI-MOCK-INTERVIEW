import { SessionSetup, PlannedQuestion, TranscriptTurn } from "./types";

export function questionsPrompt(setup: SessionSetup): string {
  return `You are an expert interviewer preparing a mock interview.

Job title: ${setup.role}
${setup.company ? `Company: ${setup.company}` : ""}
Interview focus: ${setup.difficulty}
Number of questions to generate: ${setup.numQuestions}

Job description:
"""
${setup.jobDescription}
"""

${setup.resumeText ? `Candidate resume:\n"""\n${setup.resumeText}\n"""\n` : ""}

Generate a list of exactly ${setup.numQuestions} interview questions tailored specifically to this job description${
    setup.resumeText ? " and the candidate's background" : ""
  }.
Mix question categories appropriately for a "${setup.difficulty}" interview:
- "behavioral" = mostly behavioral/situational (STAR-style) questions
- "technical" = mostly role-specific technical/skills questions
- "mixed" = a balanced mix of both, plus one opening icebreaker and one closing question

Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
{
  "questions": [
    { "id": string, "category": string, "text": string }
  ]
}`;
}

export function interviewTurnPrompt(
  setup: SessionSetup,
  plannedQuestions: PlannedQuestion[],
  currentIndex: number,
  transcript: TranscriptTurn[]
): string {
  const upcoming = plannedQuestions.slice(currentIndex);
  const history = transcript
    .map((t) => `${t.role === "ai" ? "Interviewer" : "Candidate"}: ${t.text}`)
    .join("\n");

  return `You are an AI interviewer conducting a live, natural, real-time mock interview for the role of "${setup.role}"${
    setup.company ? ` at ${setup.company}` : ""
  }.

Job description:
"""
${setup.jobDescription}
"""

Planned question queue (ask these in order; you may ask ONE short natural follow-up before moving on if the candidate's last answer was vague or worth probing deeper):
${upcoming.map((q, i) => `${i === 0 ? "-> NEXT PLANNED: " : "-  "}[${q.category}] ${q.text}`).join("\n")}

Conversation so far:
${history || "(interview just started, nothing said yet)"}

Decide the single best next thing for the interviewer to say. Rules:
- If the candidate's most recent answer is thin, vague, or begs an obvious follow-up, and you have not already asked a follow-up on this same planned question, ask ONE concise, natural follow-up (type: "followup"). At most one follow-up per planned question.
- Otherwise, move on to the NEXT PLANNED question, phrased naturally and conversationally, not robotically (type: "next"). Set nextIndex to that question's 0-based index in the FULL planned list (the list above starts at index ${currentIndex}).
- If there are no more planned questions left, warmly wrap up the interview (type: "end"); nextIndex should equal ${plannedQuestions.length}.
- Sound like a warm, professional human interviewer. Keep aiText under 40 words.

Return ONLY valid JSON, no markdown, no commentary:
{
  "type": "followup" | "next" | "end",
  "aiText": string,
  "nextIndex": number
}`;
}

export function feedbackPrompt(setup: SessionSetup, transcript: TranscriptTurn[]): string {
  const history = transcript
    .map((t, i) => `${t.role === "ai" ? "Interviewer" : "Candidate"} [turn ${i + 1}]: ${t.text}`)
    .join("\n");

  const candidateWordCount = transcript
    .filter((t) => t.role === "user")
    .reduce((sum, t) => sum + t.text.trim().split(/\s+/).filter(Boolean).length, 0);

  return `You are a blunt, expert interview coach grading ONE specific candidate's ONE specific mock interview for the role of "${setup.role}"${
    setup.company ? ` at ${setup.company}` : ""
  }. Your job is to be genuinely useful, which means being SPECIFIC to what THIS candidate actually said — never generic, template-sounding feedback that could apply to anyone.

Job description:
"""
${setup.jobDescription}
"""

Full transcript (numbered so you can reference specific turns):
"""
${history || "(the candidate gave no answers)"}
"""

The candidate spoke approximately ${candidateWordCount} words in total across all their answers.

HARD RULES — follow these exactly:
1. Every strength and weakness MUST reference or closely paraphrase something the candidate actually said (quote a short phrase or describe the specific moment/turn number). Do not write generic advice like "be more confident" or "use the STAR method" without tying it to a specific answer in this transcript.
2. Scores must genuinely reflect what happened, not cluster in a safe 65-80 range out of habit:
   - If answers were short, vague, generic, or largely dodged the question, score in the 20-50 range and say so directly.
   - If answers were thin but on-topic, 50-70.
   - Only score 80+ if answers were genuinely detailed, specific, and well-structured (e.g. real examples, metrics, clear STAR structure).
   - If the candidate barely answered anything (very low word count, one-word answers, or ended the interview almost immediately), the overall score should be low (well under 40) and the feedback should state plainly that there wasn't enough substance to evaluate well — do not inflate this to be encouraging.
3. Vary your language and structure based on what actually happened — do not reuse boilerplate phrasing across different candidates or interviews.
4. categoryScores should be based on the actual question categories that came up in this transcript (e.g. if it was mostly behavioral questions, focus there), not a fixed generic list.

Evaluate: relevance/quality of content against the job description, use of the STAR method for behavioral answers, clarity and structure of communication, confidence, conciseness, and likely filler-word usage (infer from phrasing/repetition/hedging in the transcript, since this is text).

Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
{
  "overallScore": number (0-100, must reflect the rules above),
  "summary": string (2-3 sentences, direct and specific to this candidate, referencing at least one concrete moment from the transcript),
  "strengths": string[] (3-5 items, each grounded in a specific thing they said — quote or paraphrase it),
  "weaknesses": string[] (3-5 items, each grounded in a specific thing they said or failed to say),
  "starMethodFeedback": string (reference specific answers that did/didn't use STAR structure),
  "communicationFeedback": string,
  "fillerWordsNote": string,
  "categoryScores": [ { "category": string, "score": number (0-100), "note": string (reference the specific question/answer) } ],
  "actionItems": string[] (3-5 concrete things to practice, tied to gaps actually observed in this transcript)
}`;
}

export function resumeTailorPrompt(setup: SessionSetup): string {
  return `You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist.

TASK: Tailor the candidate's resume to the target job description below, while:
1. Staying 100% truthful — never invent employers, job titles, degrees, dates, or accomplishments. Only rephrase, reprioritize, and surface relevant keywords/skills that are already implied by their real, provided background.
2. Preserving the SAME overall structure as the candidate's original resume: the same section order, the same section names (only lightly clean up a heading if it's genuinely unclear — otherwise keep it as-is), and the same individual entries (same companies, job titles, degrees, dates) within each section, in the same order they appear in the original. Do not add or drop entries.
3. Formatting for maximum ATS compatibility:
   - Plain, linear, single-column structure — no tables, columns, text boxes, images, or icons
   - Standard, conventional section headings
   - Simple bullet points, no decorative bullet characters or emoji
   - Consistent, parseable date formats (reuse whatever format the original used)
   - All content lives in the main body (nothing in headers/footers, which many ATS parsers skip)

Job description:
"""
${setup.jobDescription}
"""

Candidate's original resume:
"""
${
  setup.resumeText ||
  "(no resume provided — build a clean ATS-friendly resume skeleton aligned to this job description: a Professional Summary, a Skills section listing relevant keywords drawn from the job description, and placeholder Experience/Education sections labeled clearly as placeholders for the candidate to fill in with their real history. Leave every contact field empty rather than inventing information.)"
}
"""

Extract the candidate's contact header exactly as it appears in the original resume text — name, email, phone, location, and any links (LinkedIn, GitHub, portfolio, etc.). Copy these verbatim; leave a field empty/omit it if it wasn't present rather than fabricating it.

For each section in the resume, decide whether it is:
- a "multi-entry" section (e.g. Experience, Education, Projects) — each item gets its own "subheading" (e.g. "Software Engineer, Acme Corp — Jan 2022 to Present" or "B.S. Computer Science, XYZ University — 2021") followed by that entry's "bullets"; populate the section's "entries" array and omit "bullets" entirely for that section, OR
- a "flat" section (e.g. Skills, Certifications, Summary-style lists) — just a "bullets" array with no subheadings; populate "bullets" and omit "entries" entirely for that section.

Within Experience/Projects bullets specifically: rewrite the phrasing to emphasize accomplishments and terminology that genuinely match the job description (mirroring its keywords where they truthfully apply to what the candidate actually did) — do not change what actually happened.

Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
{
  "contact": { "name": string, "email": string, "phone": string, "location": string, "links": string[] },
  "summary": string (a tailored 2-3 sentence professional summary, ATS-keyword-rich but natural to read),
  "sections": [
    {
      "heading": string,
      "entries": [ { "subheading": string, "bullets": string[] } ],
      "bullets": string[]
    }
  ],
  "keywordsAligned": string[] (key JD keywords/skills now reflected in the resume),
  "rawText": string (the complete tailored resume as clean plain text, ready to read top to bottom exactly as a plain-text ATS-friendly resume would look, including the contact header)
}

Remember: for every section object, populate ONLY "entries" (multi-entry section) OR ONLY "bullets" (flat section) — never both, never neither.`;
}
