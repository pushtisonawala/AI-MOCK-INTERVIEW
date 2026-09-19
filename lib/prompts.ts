import { SessionSetup, PlannedQuestion, TranscriptTurn } from "./types";

export interface FeedbackPromptContext {
  metricsBlock?: string; // measured NLP signals (computed by code)
  referenceBlock?: string; // RAG-retrieved reference guidance
}

export function retryQuestionPrompt(setup: SessionSetup, question: PlannedQuestion, answer: string, previousScore: number): string {
  return `You are a blunt, expert interview coach. The candidate is re-practicing ONE specific interview question after scoring low on similar questions in a previous mock interview for the role of "${setup.role}"${
    setup.company ? ` at ${setup.company}` : ""
  }. Grade ONLY this single answer, on its own merits.

Job description:
"""
${setup.jobDescription}
"""

Question category: ${question.category}
Question asked: "${question.text}"

Candidate's previous attempt at a similar question scored ${previousScore}/100.

Candidate's new answer:
"""
${answer || "(no answer given)"}
"""

Grade this answer honestly on relevance, structure (STAR method if behavioral), specificity, and clarity. Do not go easy on it just because it's a retry — if it's still vague or thin, score it accordingly (well under 50). If it's genuinely detailed and well-structured, score 80+.

Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
{
  "score": number (0-100, honest grade of THIS answer alone),
  "comment": string (2-3 sentences, specific to what they just said, direct and constructive),
  "whyThisScore": string (2-3 sentences of reasoning: which parts of the answer earned points, which cost points, and what evidence in the answer supports that),
  "improvedTip": string (one concrete, specific thing to adjust next time),
  "idealAnswer": string (a strong 90-150 word spoken-style answer to this question, first person, built ONLY from facts in the resume/job description above — where a real detail such as a metric is unknown, write it as a bracketed placeholder like [your metric] instead of inventing it)
}`;
}

export function questionsPrompt(setup: SessionSetup, referenceBlock = ""): string {
  const isPanel = setup.interviewMode === "panel";

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
${
  referenceBlock
    ? `Reference material retrieved from our interview knowledge base (representative questions with the key points a correct answer contains, answer guidance, and known company interview styles). Use it as inspiration for style and depth, and to keep the questions realistic — do NOT copy questions verbatim; adapt them to this job description and candidate:\n"""\n${referenceBlock}\n"""\n`
    : ""
}
Generate a list of exactly ${setup.numQuestions} interview questions tailored specifically to this job description${
    setup.resumeText ? " and the candidate's background" : ""
  }.
Mix question categories appropriately for a "${setup.difficulty}" interview:
- "behavioral" = mostly behavioral/situational (STAR-style) questions
- "technical" = mostly role-specific technical/skills questions
- "mixed" = a balanced mix of both, plus one opening icebreaker and one closing question
${
  setup.company
    ? `\nThe candidate is interviewing at "${setup.company}" specifically. If you have genuine knowledge of how this company or organizations like it typically run interviews (e.g. a company known for leadership-principle-style behavioral questions, a consulting firm that uses case interviews, a startup that focuses on practical/hands-on problem solving), let that authentically shape the style and substance of these questions. If you don't have specific knowledge of this company's interview style, just write strong, realistic questions for the role and industry — do not fabricate or guess at specific company practices you're not confident about.\n`
    : ""
}
${
  isPanel
    ? `\nThis is a PANEL interview with three interviewers, each asking questions in their lane. For every question, also assign a "persona" field, exactly one of:
- "technical" — a technical/skills-focused interviewer; assign role-specific technical or problem-solving questions here
- "behavioral" — an HR/behavioral interviewer; assign STAR-style behavioral and situational questions here
- "hiring_manager" — the hiring manager; assign the opening icebreaker, culture/motivation questions, and the closing question here
Distribute questions reasonably across all three personas rather than clustering them all on one.\n`
    : ""
}
Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
{
  "questions": [
    { "id": string, "category": string, "text": string${isPanel ? ', "persona": "technical" | "behavioral" | "hiring_manager"' : ""}, "rationale": string, "evidence": string[]${referenceBlock ? ', "sources": string[]' : ""} }
  ]
}

For every question also explain your reasoning, so the candidate can see WHY it was asked:
- "rationale": one or two sentences — what the interviewer is trying to learn and why it matters for this role.
- "evidence": 1-3 short items naming the exact job-description requirement${
    setup.resumeText ? " and/or resume item" : ""
  } that triggered the question, quoted or closely paraphrased (e.g. "JD: 'experience with REST APIs'"${
    setup.resumeText ? `, "Resume: internship at Acme building a payments service"` : ""
  }). Only cite things that really appear in the text above — never invent evidence.${
    referenceBlock
      ? `\n- "sources": the ids (e.g. "DSA-04") of the reference-material entries that genuinely influenced this question; use [] if it was written from the job description alone. Only use ids that appear in the reference material above.`
      : ""
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
  const isPanel = setup.interviewMode === "panel";
  const currentPersona = plannedQuestions[currentIndex]?.persona;

  return `You are an AI interviewer conducting a live, natural, real-time mock interview for the role of "${setup.role}"${
    setup.company ? ` at ${setup.company}` : ""
  }.

Job description:
"""
${setup.jobDescription}
"""
${
  isPanel
    ? `\nThis is a PANEL interview — three interviewers (technical, behavioral/HR, hiring manager) are taking turns. The current question belongs to the "${currentPersona || "general"}" interviewer, so match that persona's voice: technical = direct and skills-focused, behavioral = warm and probing for real examples, hiring_manager = big-picture and motivation-focused. When asking a follow-up, stay in the SAME persona as the current question.\n`
    : ""
}
Planned question queue (ask these in order; you may ask ONE short natural follow-up before moving on if the candidate's last answer was vague or worth probing deeper):
${upcoming.map((q, i) => `${i === 0 ? "-> NEXT PLANNED: " : "-  "}[${q.category}${q.persona ? `/${q.persona}` : ""}] ${q.text}`).join("\n")}

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
  "nextIndex": number,
  "reasoning": string (ONE sentence explaining why you chose this move — e.g. what was vague or missing in the candidate's last answer that led to a follow-up, or why the answer was sufficient to move on)
}`;
}

export function feedbackPrompt(
  setup: SessionSetup,
  transcript: TranscriptTurn[],
  plannedQuestions: PlannedQuestion[] = [],
  ctx: FeedbackPromptContext = {}
): string {
  const history = transcript
    .map((t, i) => `${t.role === "ai" ? "Interviewer" : "Candidate"} [turn ${i + 1}]: ${t.text}`)
    .join("\n");

  const candidateWordCount = transcript
    .filter((t) => t.role === "user")
    .reduce((sum, t) => sum + t.text.trim().split(/\s+/).filter(Boolean).length, 0);

  const askedList = plannedQuestions.length
    ? plannedQuestions.map((q, i) => `${i + 1}. [${q.category}] ${q.text}`).join("\n")
    : "(not provided — derive the questions from the interviewer turns in the transcript)";

  return `You are a blunt, expert interview coach grading ONE specific candidate's ONE specific mock interview for the role of "${setup.role}"${
    setup.company ? ` at ${setup.company}` : ""
  }. Your job is to be genuinely useful, which means being SPECIFIC to what THIS candidate actually said — never generic, template-sounding feedback that could apply to anyone.

Job description:
"""
${setup.jobDescription}
"""

${setup.resumeText ? `Candidate resume (the ONLY source of facts you may use when writing model answers):\n"""\n${setup.resumeText}\n"""\n` : "No resume was provided, so model answers must use bracketed placeholders for personal details."}

Planned questions for this interview:
${askedList}

Full transcript (numbered so you can reference specific turns):
"""
${history || "(the candidate gave no answers)"}
"""

The candidate spoke approximately ${candidateWordCount} words in total across all their answers.
${
  ctx.metricsBlock
    ? `\nMEASURED SIGNALS — computed by code (NLP + embeddings), not by you. Treat them as facts and make your feedback consistent with them; if your reading of a transcript disagrees with a number, say why:\n${ctx.metricsBlock}\n`
    : ""
}${
  ctx.referenceBlock
    ? `\nREFERENCE GUIDANCE retrieved from our interview knowledge base (the key points a correct, strong answer to similar questions contains, plus general scoring guidance). Use the key points to judge the TECHNICAL ACCURACY and completeness of the candidate's answer — if they state something that contradicts a key point, say so explicitly:\n"""\n${ctx.referenceBlock}\n"""\n`
    : ""
}
HARD RULES — follow these exactly:
1. Every strength and weakness MUST reference or closely paraphrase something the candidate actually said (quote a short phrase or describe the specific moment/turn number). Do not write generic advice like "be more confident" or "use the STAR method" without tying it to a specific answer in this transcript.
2. Scores must genuinely reflect what happened, not cluster in a safe 65-80 range out of habit:
   - If answers were short, vague, generic, or largely dodged the question, score in the 20-50 range and say so directly.
   - If answers were thin but on-topic, 50-70.
   - Only score 80+ if answers were genuinely detailed, specific, and well-structured (e.g. real examples, metrics, clear STAR structure).
   - If the candidate barely answered anything (very low word count, one-word answers, or ended the interview almost immediately), the overall score should be low (well under 40) and the feedback should state plainly that there wasn't enough substance to evaluate well — do not inflate this to be encouraging.
3. Vary your language and structure based on what actually happened — do not reuse boilerplate phrasing across different candidates or interviews.
4. categoryScores should be based on the actual question categories that came up in this transcript (e.g. if it was mostly behavioral questions, focus there), not a fixed generic list.
5. EXPLAIN YOUR REASONING. Every score must be traceable: "scoreRationale" must show how the overall score follows from the per-question evidence (name the strongest and weakest answers and how they pulled the score up or down). Each entry in "questionReviews" must contain "answerEvidence" (a short quote or close paraphrase of what the candidate actually said, or "(no answer)") and "whyThisScore" reasoning that points at that evidence and at the job description.
6. MODEL ANSWERS. For each planned question that was actually asked in the transcript, write an "idealAnswer": a strong, natural, first-person answer of 90-150 words that this candidate could genuinely give. Build it ONLY from facts in the resume and their own transcript answers; reuse their real projects/skills, structured properly (STAR for behavioral, approach-then-tradeoffs for technical). NEVER invent employers, numbers, or achievements — where a real detail is missing, use a bracketed placeholder such as [your metric]. Do not copy the interviewer's wording; write it as the candidate would say it aloud.

Evaluate: relevance/quality of content against the job description, use of the STAR method for behavioral answers, clarity and structure of communication, confidence, conciseness, and likely filler-word usage (infer from phrasing/repetition/hedging in the transcript, since this is text).

Return ONLY valid JSON matching this exact shape, no markdown, no commentary:
{
  "overallScore": number (0-100, must reflect the rules above),
  "scoreRationale": string (3-4 sentences showing how the overall score was reached from the per-question evidence),
  "summary": string (2-3 sentences, direct and specific to this candidate, referencing at least one concrete moment from the transcript),
  "strengths": string[] (3-5 items, each grounded in a specific thing they said — quote or paraphrase it),
  "weaknesses": string[] (3-5 items, each grounded in a specific thing they said or failed to say),
  "starMethodFeedback": string (reference specific answers that did/didn't use STAR structure),
  "communicationFeedback": string,
  "fillerWordsNote": string (must cite the measured filler and hedging counts above),
  "categoryScores": [ { "category": string, "score": number (0-100), "note": string (reference the specific question/answer) } ],
  "actionItems": string[] (3-5 concrete things to practice, tied to gaps actually observed in this transcript),
  "questionReviews": [
    {
      "question": string (the planned question text),
      "category": string,
      "score": number (0-100, for this answer alone),
      "answerEvidence": string (short quote/paraphrase of the candidate's actual answer),
      "whyThisScore": string (2-3 sentences of reasoning tied to the evidence and the job description),
      "missing": string[] (1-3 specific things a strong answer would have included),
      "idealAnswer": string (90-150 word model answer per rule 6),
      "answerTips": string (one sentence: the framework/structure best suited to this question type)
    }
  ]
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

Also compute an ATS keyword-match assessment: extract the 15-25 most important skills/keywords/qualifications from the job description (tools, technologies, certifications, domain terms, soft-skill phrases the JD explicitly emphasizes), then check which of those genuinely appear (verbatim or as a clear synonym) in the CANDIDATE'S ORIGINAL resume text provided above — not in the tailored rewrite, since rewriting can't invent real experience. Report the honest overlap.

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
  "rawText": string (the complete tailored resume as clean plain text, ready to read top to bottom exactly as a plain-text ATS-friendly resume would look, including the contact header),
  "atsMatch": {
    "score": number (0-100, honest % of the important JD keywords that the ORIGINAL resume genuinely covers — do not inflate this; a partial or missing background should score low),
    "matchedKeywords": string[] (JD keywords the candidate's real background already covers),
    "missingKeywords": string[] (important JD keywords/skills the candidate's resume does not show — real gaps worth addressing, not padding)
  }
}

Remember: for every section object, populate ONLY "entries" (multi-entry section) OR ONLY "bullets" (flat section) — never both, never neither.`;
}
