# AI Mock Interview — Complete Project Guide & Presentation Script

Read Part 1–6 to *understand* the project. Read Part 7 to *present* it. Read Part 8 to survive the Q&A.

---

# PART 1 — The project in 60 seconds

**Problem.** Interview prep is expensive (coaches), unrealistic (reading question lists), or gives no feedback (practising alone). Generic tools also ignore *your* resume and *this* job.

**Solution.** A web app where you paste a job description (and optionally upload your resume), then hold a **live voice interview** with an AI interviewer. The AI asks questions tailored to the JD and your resume, decides in real time whether to ask a **follow-up** or move on, and at the end gives you:

1. A scored **feedback report** (content, STAR method, communication, filler words).
2. **Explainability** — *why* each question was asked, *why* each score was given, backed by quotes from what you actually said.
3. A **model answer** for every question, built only from your real background.
4. A **resume tailored to the job** (downloadable .docx) plus an **ATS keyword-match** meter.
5. A **history dashboard** with a score trend and "readiness score".

**It is a hybrid AI system, not just an LLM call.** Three layers work together:
1. **RAG** — a curated interview knowledge base is searched with sentence embeddings, and the retrieved material is given to the LLM.
2. **Classical NLP + a deep-learning embedding model (MiniLM transformer)** — measure the transcript with real numbers (filler rate, STAR coverage, keyword coverage, semantic relevance).
3. **An LLM (Llama 3.3 70B)** — generates questions, conducts the conversation, writes feedback and model answers, with the retrieved references and the measured numbers in its prompt.

**Everything runs on free tiers** (Groq/Gemini LLM, MiniLM run locally, Supabase, browser speech APIs, Vercel).

---

# PART 2 — Architecture

```
                         ┌───────────────────────────── BROWSER (Chrome/Edge) ─────────────────────────────┐
                         │  React pages (Next.js App Router, TypeScript, Tailwind)                          │
                         │  • Web Speech API  → speech-to-text (your voice → text)                          │
                         │  • SpeechSynthesis → text-to-speech (AI's voice)                                 │
                         │  • getUserMedia + MediaRecorder → camera preview / optional local recording      │
                         │  • sessionStorage  → holds setup, questions, transcript, feedback during a run   │
                         └───────────────┬─────────────────────────────────────────────────────────────────┘
                                         │ fetch() JSON
                                         ▼
      ┌──────────────────────── NEXT.JS SERVER (API Route Handlers, Node runtime) ────────────────────────┐
      │ /api/parse-resume       PDF/DOCX/TXT → text          (pdf-parse, mammoth)                          │
      │ /api/generate-questions JD + resume → questions + rationale + evidence                             │
      │ /api/interview-turn     transcript → follow-up | next | end  (+ reasoning)                         │
      │ /api/feedback           transcript → scores, rationale, per-question review, model answers         │
      │ /api/tailor-resume      resume + JD → tailored resume JSON + ATS match                             │
      │ /api/retry-question     re-grade one answer (+ why + model answer)                                 │
      │ /api/export-resume-docx tailored JSON → .docx file      (docx library)                             │
      │ /api/save-interview  /api/share-interview               (Supabase, per-user)                       │
      │                                                                                                    │
      │   ├─ lib/rag/retriever.ts  hybrid search (MiniLM dense 0.7 + TF-IDF lexical 0.3) over the KB       │
      │   ├─ lib/nlp.ts            fillers, hedges, STAR detector, TF-IDF keywords, MATTR                  │
      │   ├─ lib/embeddings.ts     all-MiniLM-L6-v2 via Transformers.js (local ONNX) + TF-IDF fallback     │
      │   ├─ lib/analysis.ts       measure transcript → prompt → verify LLM output → score guard           │
      │   └─ lib/ats.ts            computed ATS match (TF-IDF + exact stem + semantic)                     │
      │ middleware.ts → refreshes Supabase session cookie, redirects signed-out users to /login            │
      └───────────────┬───────────────────────────────────────────────┬────────────────────────────────────┘
                      │ lib/ai.ts (provider switch)                    │ @supabase/ssr
                      ▼                                                ▼
        ┌─────────────────────────────┐                  ┌─────────────────────────────────┐
        │ Groq (Llama 3.3 70B) DEFAULT │                  │ Supabase: Auth + Postgres       │
        │ or Google Gemini 2.5 Flash   │                  │ table `interviews` + Row-Level  │
        └─────────────────────────────┘                  │ Security                        │
                                                         └─────────────────────────────────┘
```

**Key idea:** the browser handles *voice*, the server handles *AI + database*, and the API keys never leave the server.

---

# PART 3 — Tech stack: what, why, and the alternative

| Layer | We used | Why | Alternative you can mention |
|---|---|---|---|
| Framework | **Next.js 14 (App Router)** | Frontend pages *and* backend API routes in one project; server components for saved-interview pages; easy Vercel deploy | React + separate Express server (two deployments) |
| Language | **TypeScript** | Shared types (`lib/types.ts`) between client and server catch shape mismatches — vital when an LLM returns JSON | Plain JavaScript |
| Styling | **Tailwind CSS** | Fast, consistent UI without writing CSS files | Material UI, plain CSS |
| LLM (default) | **Groq — `llama-3.3-70b-versatile`** | Free tier with high rate limits, very low latency (crucial for a *live* conversation), supports JSON mode | OpenAI GPT-4o (paid) |
| LLM (alt) | **Google Gemini 2.5 Flash** | Also free; switchable with one env var `AI_PROVIDER` | — |
| Embeddings (DL) | **all-MiniLM-L6-v2** (sentence-transformers) via **@xenova/transformers** | A real pre-trained transformer, 384-dim vectors, runs locally in Node (ONNX) — free, no API key, ~25 MB | OpenAI/Gemini embedding APIs, pgvector |
| Vector search | In-memory cosine over the knowledge base (hybrid with TF-IDF) | ~100 chunks — a database would be over-engineering; the interface is swappable for Supabase pgvector when the KB grows | Pinecone, pgvector, FAISS |
| Speech-to-text | **Browser Web Speech API** | Free, no server, real-time interim results | Whisper API, Deepgram (paid / more setup) |
| Text-to-speech | **Browser SpeechSynthesis** | Free, multiple voices → used for panel personas | ElevenLabs (paid, more natural) |
| Auth + DB | **Supabase** (Postgres + Auth) | Free tier, email + Google login, Row-Level Security so users only see their own data | Firebase, own Postgres + JWT |
| Resume parsing | **pdf-parse**, **mammoth** | Extract text from PDF / DOCX | OCR for scanned PDFs |
| Resume export | **docx** | Generates a real, ATS-friendly Word file server-side | PDF generation |
| Hosting | **Vercel** | Free, zero-config for Next.js | Render, Railway |

**Why an abstraction layer for the LLM (`lib/ai.ts`)?** Every route calls `generateJSON()`; only that file knows whether Groq or Gemini runs. Switching providers = change one env var, no code edits. It also protects against a provider's free-tier limits changing (this actually happened with Gemini in Dec 2025, which is why Groq is the default).

---

# PART 4 — Methodology (the "how we made an LLM behave")

An LLM is not a magic box; the *engineering* is in how we constrain it. These are the techniques used — know each one.

### 4.1 Prompt engineering with structured output
Every AI feature is a **prompt template** in `lib/prompts.ts` that (a) gives context (role, JD, resume, transcript), (b) gives rules, and (c) demands a **strict JSON shape**. We also turn on the provider's **JSON mode** (`response_format: json_object` in Groq, `responseMimeType: application/json` in Gemini) and a system message "respond only with valid JSON". The server parses it with `JSON.parse` (after stripping accidental ``` fences) and returns it typed.

### 4.2 Grounding (anti-hallucination)
- Feedback rule: *every strength/weakness must quote or paraphrase something the candidate actually said*, with turn numbers. This prevents generic "be more confident" feedback.
- Resume tailoring rule: *never invent employers, titles, degrees, dates or accomplishments* — only re-phrase and re-prioritise.
- Model answers: built **only from facts in the resume/transcript**; unknown facts become placeholders like `[your metric]` instead of made-up numbers.
- Company-aware questions: the model is told to use company knowledge **only if confident**, otherwise write realistic role-level questions.

### 4.3 Scoring rubric with anti-inflation rules
LLMs tend to give everyone 70–80. The feedback prompt sets explicit bands: vague/short → 20–50, thin but on-topic → 50–70, 80+ only for detailed, structured answers with real examples; near-empty interviews must score under 40. We also pass the **word count** of the candidate's speech as a hard signal.

### 4.4 Explainability (new feature — "why did the AI decide that?")
This is the answer to "how do we trust the LLM?". We ask the model to **show its work**, and we render it in the UI:

| Where | Field | What the user sees |
|---|---|---|
| Question generation | `rationale`, `evidence[]` | Which JD requirement / resume item triggered each question and what the interviewer is trying to learn |
| Live interview | `reasoning` on each AI turn | A collapsible **"Why this question?"** under each interviewer bubble (e.g. "answer lacked a measurable result, so I probed for one") |
| Feedback | `scoreRationale` | "How this score was reached" — links the overall score to strongest/weakest answers |
| Feedback | `questionReviews[]` | Per question: what you said (quote), **why this score**, what was missing |
| Retry | `whyThisScore` | Reasoning for the re-graded answer |

Important honesty point for the viva: this is a **model-generated justification tied to cited evidence**, not a peek inside the neural network. We make it *verifiable* by forcing it to quote the transcript, so a human can check the quote against what was really said.

### 4.5 Model answers ("what a good answer looks like")
`questionReviews[].idealAnswer` gives a 90–150 word, first-person, spoken-style answer per question, structured with **STAR** (Situation, Task, Action, Result) for behavioural questions and *approach → trade-offs* for technical ones, plus an `answerTips` line naming the framework. Built from the candidate's own resume so it is realistic for *them*, not a textbook answer.

### 4.6 Conversation control (the real-time follow-up engine)
Questions are **planned up front** (one LLM call), but the *conversation* is dynamic. After each answer, `/api/interview-turn` sends the planned queue + transcript so far and the model returns one of:
- `followup` — if the answer was vague (max **one** follow-up per planned question, enforced in the prompt),
- `next` — move to the next planned question (`nextIndex` keeps state in sync),
- `end` — wrap up when the queue is empty.
The response is capped at 40 words so it sounds like speech.

### 4.7 Panel mode = persona prompting
Three personas (technical, behavioural/HR, hiring manager). Each planned question is tagged with a persona; the turn prompt tells the model to speak in that persona's style; the browser assigns each persona a **different TTS voice**. A category-based fallback assigns a persona if the model omits one.

### 4.8 ATS keyword match (now computed, not guessed)
`lib/ats.ts` no longer trusts the LLM's number. It (1) extracts the job description's top keywords with **TF-IDF** (weighted against a technical vocabulary and the knowledge base as background corpus), (2) checks which appear in the **original** resume via stemmed exact matching, and (3) for the missing ones, compares the keyword with every resume line using **MiniLM embeddings** (threshold 0.5) to catch synonyms. The LLM's estimate is only a fallback if the computation fails. The tailored rewrite is never used for scoring, so rewriting can't inflate the score.

### 4.9 Reliability engineering
- Bounded retries (max 3, with backoff) **only** for transient network errors — never an infinite loop.
- Friendly translation of raw errors (invalid key, 429 rate limit, network blocked).
- Interview page has an explicit **Retry** button after a failed turn instead of silent hammering; `pendingTranscriptRef` lets retry re-send without duplicating the answer.
- Server normalises model output (e.g. `questionReviews` forced to an array; invalid persona → fallback).

### 4.10 RAG — Retrieval-Augmented Generation
**Problem:** an LLM alone relies on whatever it memorised; "company-aware questions" were really just model memory.
**Solution:** the knowledge base (`lib/rag/knowledge-base.ts`, data in `lib/rag/kb/*.ts`) has **320 hand-curated entries with ~1,400 key points** across 20 areas: behavioural, HR, leadership, DSA, operating systems, networking, databases, OOP/design, engineering practices, frontend, backend, security, system design, DevOps/cloud, data science/ML, data analytics, product management, marketing/sales, plus rubric chunks (STAR, scoring anchors, how to answer coding/system-design questions) and company-style chunks (Amazon, Google, Microsoft, Meta, Apple, consulting, startups, …). Each entry has the question, what it assesses, and **key points** — the concrete facts a correct answer must contain (e.g. the four Coffman deadlock conditions). Key points let the grader judge **technical accuracy**, not just style. IDs are stable per domain (`DSA-04`, `BE-08`), so adding entries never renumbers other domains.
**Pipeline:**
1. **Index** — each chunk is embedded once per server process with MiniLM (a fraction of a second per chunk, cached in memory).
2. **Retrieve** — `retrieve(query)` embeds the query (role + company + job description) and scores every chunk with a **hybrid score = 0.7 × dense cosine + 0.3 × TF-IDF lexical cosine**. Dense search finds paraphrases; lexical search catches exact terms like "Kubernetes".
3. **Augment** — top chunks are injected into the prompt ("Reference material retrieved from our knowledge base…").
4. **Generate** — the model returns `sources` (KB ids) per question. The server **rejects any id that wasn't actually retrieved**, so sources can't be hallucinated.
5. **Show** — the UI displays "Inspired by BE-08 …" under a question and "Reference guidance retrieved" per reviewed answer.
The same retriever also fetches, per planned question, the reference guidance for **grading** — so scoring is compared with what a strong answer should cover.

### 4.11 Classical NLP — measured, not guessed (`lib/nlp.ts`)
Deterministic, no LLM. Computed on the candidate's transcript:
- **Filler & hedge detection** — regex lexicon ("um/uh", "you know", "basically", filler "like", "sort of"; hedges "I think", "maybe"). Reported per 100 words. Honest caveat: Chrome's speech recogniser often removes "um/uh", so this is a lower bound.
- **STAR component detector** — rule-based cue lexicons for Situation, Task, Action ("I" + past-tense verb), Result (outcome words), plus a **number/metric detector**.
- **Lexical diversity (MATTR)** — moving-average type-token ratio; unlike plain TTR it isn't distorted by answer length.
- **TF-IDF keyword extraction** — smoothed IDF over the knowledge base as background corpus; unigrams + a curated list of known bigrams; technical terms boosted; generic JD words filtered.
- **Keyword coverage** — light stemmer (deploying/deployed → deploy) so "Dockerised" style variations still match.

### 4.12 Deep learning: sentence embeddings for semantic similarity (`lib/embeddings.ts`)
`all-MiniLM-L6-v2` is a pre-trained transformer (6 layers) that maps a sentence to a 384-number vector; similar meanings → nearby vectors; similarity = cosine (vectors are L2-normalised so it is just a dot product). We use it for:
- **Answer relevance** — question ↔ answer.
- **JD alignment** — answer ↔ job description.
- **Model-answer similarity** — the candidate's answer ↔ the ideal answer.
- **RAG retrieval** and **ATS semantic matching**.
Raw MiniLM cosines are low (related ≈ 0.3–0.6, unrelated ≈ 0.0–0.15), so `scaleSimilarity()` maps 0.10→0 and 0.50→100 for readability. This mapping is a heuristic, not a calibrated probability — say so if asked.
**Fallback:** if the model can't load (offline first run, serverless limits) everything degrades to TF-IDF cosine and the report states which method ran (`similarityMethod`). We did **not** train a model ourselves — we use a pre-trained one; we had no labelled interview dataset.

### 4.13 Hybrid scoring & verification (`lib/analysis.ts`)
- **Before the LLM:** the measured numbers and the retrieved references are placed in the feedback prompt as facts ("MEASURED SIGNALS", "REFERENCE GUIDANCE"); the model must stay consistent with them.
- **After the LLM:** (a) each review is matched to the right answer by embedding similarity and gets measured metrics attached; (b) **quote verification** — the quote the LLM attributed to the candidate is checked against the real transcript by token overlap; unverified quotes are flagged in the UI ("treat with caution"); (c) a **deterministic sanity guard** — fewer than 30 spoken words caps the score at 35 whatever the LLM says; (d) a transparent **measured composite** (0.35 relevance + 0.25 STAR coverage + 0.20 keyword coverage + 0.20 answer length) is shown next to the AI grade so a big gap is visible.
This turns "trust the LLM" into "the LLM's claims are checked by code".

---

# PART 5 — Codebase walkthrough

```
AI-MOCK-INTERVIEW/
├── middleware.ts                 Auth gate + session refresh on every request
├── app/
│   ├── layout.tsx, globals.css   Shell, theme, reusable button/card classes
│   ├── page.tsx                  SETUP page: role, JD, resume upload, mode, voices → generate questions
│   ├── interview/page.tsx        LIVE interview: camera, STT/TTS, silence auto-submit, timer, turn loop
│   ├── interview/retry/page.tsx  Re-practice the weakest question, before/after score
│   ├── results/page.tsx          Runs feedback + resume tailoring in parallel, auto-saves, download .docx
│   ├── dashboard/page.tsx        History list, trend chart, readiness score
│   ├── dashboard/[id]/page.tsx   Full replay of one saved interview (server component)
│   ├── share/[token]/page.tsx    Public read-only view via share link
│   ├── login/page.tsx            Email/password + Google sign-in
│   ├── auth/callback/route.ts    Exchanges OAuth/email code for a session
│   └── api/…                     Route handlers (see architecture diagram)
├── lib/
│   ├── types.ts                  ALL shared TypeScript interfaces (the "contract")
│   ├── prompts.ts                ALL prompt templates (the "brain")
│   ├── ai.ts                     Provider switch (groq | gemini)
│   ├── groq.ts / gemini.ts       SDK calls, JSON parsing, retries, error translation
│   ├── nlp.ts                    Classical NLP: fillers, STAR, TF-IDF, MATTR, stemming, similarity
│   ├── embeddings.ts             MiniLM sentence embeddings + TF-IDF fallback + pair similarity
│   ├── rag/knowledge-base.ts     320-entry curated interview knowledge base (lib/rag/kb/*.ts)
│   ├── rag/retriever.ts          Hybrid dense+lexical retrieval, prompt formatting
│   ├── analysis.ts               Measure → prompt → verify → guard (feedback hybrid pipeline)
│   ├── ats.ts                    Computed ATS keyword match
│   ├── session-store.ts          Typed wrapper over sessionStorage
│   ├── voice.ts                  Picks best/distinct TTS voices
│   └── supabase/{client,server}.ts  Browser / server Supabase clients
├── scripts/kb-check.ts           Validates the KB and measures retrieval recall  (npm run kb:check)
├── scripts/smoke.ts              Offline test of NLP + RAG + embeddings + ATS   (npm run smoke)
├── components/                   FeedbackReportView (incl. question review + measured signals), ChatTranscript,
│                                 TailoredResumeView, ScoreTrendChart, CircularScore, AIOrb, MicLevel …
└── supabase/schema.sql           `interviews` table + indexes + Row-Level Security policies
```

### The 6 files to know best
1. **`lib/prompts.ts`** — where the AI's behaviour is defined. `questionsPrompt`, `interviewTurnPrompt`, `feedbackPrompt`, `resumeTailorPrompt`, `retryQuestionPrompt`.
2. **`lib/types.ts`** — the data contract: `SessionSetup`, `PlannedQuestion`, `TranscriptTurn`, `FeedbackReport`, `QuestionReview`, `TailoredResume`, `SavedInterview`.
3. **`app/interview/page.tsx`** — the state machine. Phases: `loading → asking → listening → thinking → (asking …) → done`. Uses refs (not state) for things that must not cause re-renders or stale closures (recogniser, timers, `autoSubmittedRef` guarantees only one auto-submit per answer).
4. **`lib/groq.ts`** — how a prompt becomes a typed object.
5. **`middleware.ts`** — security gate.
6. **`supabase/schema.sql`** — data model + RLS.

### Data flow of one full session
1. **Setup** → `POST /api/parse-resume` (file → text) → `POST /api/generate-questions` (**RAG retrieval** → LLM; returns `PlannedQuestion[]` with rationale/evidence) → saved in `sessionStorage`.
2. **Interview** → AI speaks Q1 (TTS) → mic listens (STT) → 1.8 s of silence (or "Done" click, or timer end in timed mode) → answer appended to transcript → `POST /api/interview-turn` → follow-up/next/end → repeat.
3. **Results** → `POST /api/feedback` (measure → RAG → LLM → verify → guard) **and** `POST /api/tailor-resume` (LLM + computed ATS) run in parallel (`Promise.all`) → cached in `sessionStorage` → `POST /api/save-interview` (once, guarded by a ref + stored id so refresh can't duplicate).
4. **Dashboard** → reads `interviews` rows (RLS restricts to your own).
5. **Share** → `POST /api/share-interview` sets `is_public=true` and a random 128-bit token (`randomBytes(16).toString("hex")`); `/share/[token]` reads it without login.

### Database
Single table `interviews`: `id, user_id, role, company, difficulty, setup(jsonb), transcript(jsonb), feedback(jsonb), tailored_resume(jsonb), overall_score, share_token(unique), is_public, created_at`.
- **JSONB** stores the whole AI report without needing a rigid schema — new fields (like the explainability ones) needed **no migration**, and old rows still render because the new fields are optional in the UI.
- **Row-Level Security**: users can select/insert/update/delete only rows where `auth.uid() = user_id`; an extra policy lets *anyone* read rows where `is_public = true`.

### Security summary
API keys only in server env vars; sign-in enforced in middleware; RLS enforced by the database itself (not just app code); share links use unguessable tokens and can be turned off; camera video never leaves the browser.

---

# PART 6 — Features cheat-sheet

| Feature | How it works (one line) |
|---|---|
| Voice interview | Web Speech API STT + SpeechSynthesis TTS; silence detection (1.8 s) auto-submits |
| Tailored questions | JD + resume in prompt; JSON list of questions |
| Live follow-ups | Turn prompt returns followup/next/end; max 1 follow-up per question |
| Panel mode | 3 personas, 3 voices, persona-tagged questions |
| Timed mode | Countdown; auto-submits partial answer at 0; shares a guard ref with silence auto-submit |
| RAG | Hybrid (MiniLM + TF-IDF) retrieval over a 320-entry knowledge base; sources shown in UI, ids validated |
| Measured NLP signals | Filler rate, STAR coverage, keyword coverage, MATTR, semantic relevance — computed by code, shown next to the AI grade |
| Quote verification | LLM's cited quote checked against the transcript; unverified flagged |
| Explainability | Rationale/evidence per question, reasoning per turn, scoreRationale + per-question `whyThisScore` |
| Model answers | `idealAnswer` per question from resume-only facts, STAR structure |
| Feedback report | Overall + category scores, STAR, communication, filler words, action items |
| Resume tailoring | Same structure, JD keywords surfaced, no invented facts; export to .docx |
| ATS meter | TF-IDF keywords vs *original* resume: exact stem match + MiniLM semantic match (computed) |
| Retry weak question | Finds lowest category → matching question → re-grade → before/after delta |
| Dashboard | Trend chart + readiness = weighted avg of last 5 (weights 5,4,3,2,1 newest→oldest) |
| Share link | Public read-only view via token |

---

# PART 7 — PRESENTATION SCRIPT (≈10–12 minutes)

*Speak in your own words; the bold lines are the ones to land. Bracketed text = what to do on screen.*

### Slide 1 — Title (20 s)
"Good morning. We built **AI Mock Interview** — a free, real-time voice interview coach that tailors every question to your job description and resume, and **explains why** it scored you the way it did."

### Slide 2 — Problem (40 s)
"Students and job seekers face three problems: coaches are expensive, question lists are static, and practising alone gives no feedback. Even AI chatbots give generic answers and never tell you *why* they judged you a certain way — so you can't trust or learn from them."

### Slide 3 — Our solution (40 s)
"Our app runs a full interview loop: setup, live voice interview with adaptive follow-ups, and a detailed report. Three things make it different: it's **personalised** to the JD and your resume, it's **explainable** — every question and score comes with reasoning and evidence — and it gives you **model answers** so you learn what good looks like. And it's entirely free-tier."

### Slide 4 — Architecture (1 min) [show diagram from Part 2]
"The browser handles voice — speech-to-text and text-to-speech use the built-in Web Speech API, so no paid service. The Next.js server exposes API routes; before and after each LLM call they run our RAG retrieval and NLP analysis. The LLM is — Llama 3.3 70B on Groq, or Gemini, switchable with one environment variable. Embeddings run locally with MiniLM. Supabase gives us authentication and a Postgres database. **API keys stay on the server; the browser never sees them.**"

### Slide 5 — Tech stack & why (1 min) [table from Part 3]
"Next.js gives frontend and backend in one codebase. TypeScript is important because LLMs return JSON, and shared types catch mismatches. We chose Groq because a live conversation needs low latency and it has generous free limits. Supabase gives us Row-Level Security, so data isolation is enforced by the database itself."

### Slide 6a — "Is it just an LLM?" (1.5 min) — say this before the methodology
"No — it's a hybrid system with three layers. **Layer 1, RAG:** we built a curated interview knowledge base and search it with sentence embeddings, so questions and grading are grounded in reference material, not just model memory. **Layer 2, NLP and deep learning:** a pre-trained MiniLM transformer turns text into vectors so we can *measure* semantic relevance, and classical NLP measures filler rate, STAR coverage and keyword coverage with TF-IDF. **Layer 3, the LLM:** it writes the questions, follow-ups, feedback and model answers — but it receives the retrieved references and our measured numbers as facts, and afterwards **code verifies its output**: quotes are checked against the transcript, invented sources are rejected, and a sanity guard caps the score of a near-empty interview."

### Slide 6 — Methodology (2 min) — the most important slide
"An LLM is unreliable by default, so our work was constraining it — five techniques:
1. **Structured prompting**: each feature is a prompt template that demands a strict JSON schema, with the provider's JSON mode on.
2. **Grounding**: every strength or weakness must quote what the candidate actually said; resume tailoring may never invent facts; model answers use placeholders instead of made-up numbers.
3. **Rubric with anti-inflation rules**: LLMs love giving 75. We define score bands and pass the candidate's word count, so a near-empty interview scores under 40.
4. **Dynamic conversation control**: questions are planned up front, but after each answer the model decides *follow-up, next, or end*, with at most one follow-up per question.
5. **Explainability**: we make the model show its work — a rationale and JD/resume evidence for each question, reasoning for each follow-up, and a reasoned, quote-backed justification for every score."

### Slide 7 — Live demo (3 min)
1. [Setup page] Paste a JD, upload a resume, choose Panel mode. "Notice it's generating questions."
2. [Interview] Answer one question out loud, deliberately vaguely. "Watch — it asks a follow-up. Click **'Why this question?'** — it tells us the answer lacked a measurable result."
3. [Results] Show overall score → **'Measured by code, not by the AI'** panel ("these numbers are computed by NLP and embeddings, not by the LLM") → **'How this score was reached'** → open one question: "here's the quote of what I said, why it scored 45, what was missing, and a **model answer built from my own resume**."
4. Show a "Quote verified" badge and the retrieved reference chips on a question. Show the ATS meter ("computed, not estimated") and download the .docx. Show dashboard trend chart.
*(Backup: keep screenshots or a saved interview open at /dashboard in case the mic or network fails.)*

### Slide 8 — Reliability & security (45 s)
"Bounded retries only for network blips, friendly error messages, an explicit retry button so we never hammer the API. Auth enforced in middleware, Row-Level Security in the database, unguessable share tokens, and the camera feed never leaves the browser."

### Slide 9 — Limitations & future work (45 s)
"Honestly: scoring is LLM-judged so it isn't a ground-truth measurement; voice needs Chrome/Edge; free tiers are rate-limited; video isn't analysed — feedback is from words only. Future work: body-language analysis, better neural TTS, evaluation against human-rated interviews, and streaming responses to cut latency."

### Slide 10 — Conclusion (20 s)
"We built a personalised, explainable, free AI interview coach. It doesn't just say *how you did* — it shows *why*, and *what good looks like*. Thank you — happy to take questions."

---

# PART 8 — Viva / interview Q&A (know these)

**Q1. Which LLM do you use and why?**
Llama 3.3 70B Versatile on Groq by default — free tier, fast inference (needed for a live conversation), JSON mode. Gemini 2.5 Flash is a switchable alternative via `AI_PROVIDER`.

**Q2. Did you train or fine-tune a model?**
No. We use two pre-trained models — Llama 3.3 70B (via API) for generation and MiniLM (run locally) for embeddings — and control behaviour with prompt engineering, RAG and measured signals. Fine-tuning needs labelled interview data and compute, which we didn't have; we say this openly and list "collect human-rated interviews and fine-tune/calibrate" as future work.

**Q3. How do you make the LLM return usable data?**
Prompt demands an exact JSON shape + provider JSON mode + system message + a parser that strips code fences + server-side normalisation (arrays, valid persona). Typed with TypeScript interfaces.

**Q4. How do you prevent hallucination?**
Layers: (1) RAG gives the model reference material; (2) prompt rules — quote the transcript, use only resume facts, placeholders for unknowns; (3) **code checks the output** — quotes are verified against the transcript by token overlap and flagged if not found, source ids the model cites are rejected unless they were really retrieved, the ATS score is computed not generated, and a guard caps the score of near-empty interviews. It is still not perfect, which is why we show evidence a human can verify.

**Q5. What is "explainability" in your project, and is it real?**
The model outputs its reasoning (rationale, evidence, per-turn reasoning, score rationale, per-question "why") which the UI displays. It's a *post-hoc, evidence-cited justification*, not internal model introspection. We make it checkable by requiring quotes from the transcript.

**Q6. How is the score computed? Is it reliable?**
The LLM grades against a rubric with defined bands; the overall score is justified from per-question evidence. It's a *consistent coaching signal*, not a validated psychometric score. Temperature 0.6 gives some variance. Future work: calibrate against human graders.

**Q7. How does the AI decide follow-up vs next question?**
`interviewTurnPrompt` gives it the remaining question queue and transcript; rules say follow up once if the last answer is thin/vague, else advance. It returns `type` and `nextIndex`, and the client updates its pointer.

**Q8. How does voice work without a paid API?**
Chrome/Edge's built-in Web Speech API: `SpeechRecognition` for STT (continuous + interim results) and `speechSynthesis` for TTS. Runs in the browser. Silence > 1.8 s auto-submits.

**Q9. Why store state in sessionStorage?**
The interview is a multi-page flow (setup → interview → results). sessionStorage survives navigation and refresh within the tab, needs no login, and is cleared when the tab closes. Only after results are generated is the session persisted to Supabase.

**Q10. How do you keep users' data private?**
Supabase Row-Level Security: `auth.uid() = user_id` on all operations, enforced inside Postgres. Public access only when the owner sets `is_public` and shares the token.

**Q11. How does the share link stay safe?**
128-bit random token (`crypto.randomBytes(16)`), read-only, owner can disable it; RLS policy exposes only rows with `is_public = true`.

**Q12. What if the LLM API is down or rate-limited?**
Up to 3 retries with backoff for network errors, translated error messages for 401/429, an explicit Retry button in the interview, and a one-env-var switch to the other provider.

**Q13. Why Next.js instead of React + Express?**
One codebase and deployment for UI + API, built-in routing, server components for the saved-interview pages, and the API key stays server-side.

**Q14. Why JSONB in Postgres?**
The AI report shape evolves. JSONB stores it flexibly — we added explainability fields with zero migration, and old rows still display because the fields are optional.

**Q15. How does the resume tailoring avoid lying?**
Prompt forbids inventing employers/titles/dates/accomplishments and requires the same section structure and entries. It only rephrases and surfaces real keywords. ATS score is measured on the original resume.

**Q16. What is ATS and why does it matter?**
Applicant Tracking Systems parse and keyword-filter resumes before humans see them. We produce a plain, single-column, standard-heading resume and show which JD keywords you match or miss.

**Q17. What's the STAR method?**
Situation, Task, Action, Result — a structure for behavioural answers. Our feedback evaluates it and the model answers follow it.

**Q18. How do the panel personas work?**
Each question is tagged with a persona at generation time; the turn prompt tells the model to speak in that persona's style; the browser maps each persona to a different TTS voice.

**Q19. What was the hardest technical problem?** *(pick the one you personally handled)*
Good candidates: (a) preventing double-submits from race conditions between silence auto-submit, timer and button — solved with `autoSubmittedRef`/`isSubmittingRef` refs and a ref to the latest `submitAnswer` to avoid stale closures; (b) making LLM scoring honest instead of clustering at 75 — solved with rubric bands and word-count signals; (c) speech recognition ending on its own — solved by auto-restarting in `onend`.

**Q20. Limitations?**
LLM scores aren't ground truth; Web Speech API is Chrome/Edge-centric and its accuracy varies by accent/noise; no body-language analysis; free-tier rate limits; model answers must be reviewed by the user since they're AI-generated.

**Q21. Future work?**
Evaluate against human-rated interviews, add video/tone analysis, neural TTS, streaming responses, retrieval of real company interview data, spaced-repetition practice for weak categories.

**Q22. Why not one big prompt that does everything?**
Different tasks need different constraints and latency. Turn decisions must be fast (small prompt, 40-word output); feedback can be slow and long. Separate prompts are also easier to test and tune. Feedback + resume run in parallel to cut waiting time.

**Q23. How is the readiness score calculated?**
Weighted average of the last 5 scored interviews with weights 5,4,3,2,1 from newest to oldest, so it tracks improvement.

**Q24. Is the video analysed or uploaded?**
No. It's shown locally for self-review and optionally downloaded as a `.webm` by the user. Feedback is based only on the transcript.

**Q25. How would you test it?**
Manual end-to-end runs, plus unit tests for pure logic (`findWeakestQuestion`, readiness formula, JSON extraction) and a fixed set of sample transcripts (empty, vague, strong) to verify the rubric scores land in the expected bands.

**Q26. Is this just a wrapper around an LLM? Where is the RAG / NLP / DL?**
No. RAG: a 320-entry interview knowledge base with ~1,400 key points retrieved with hybrid dense+lexical search and injected into prompts. DL: the pre-trained MiniLM transformer produces sentence embeddings used for retrieval, answer relevance, model-answer similarity and semantic ATS matching. NLP: tokenisation, stemming, TF-IDF keyword extraction, filler/hedge detection, a rule-based STAR detector and MATTR. The LLM is one component, and its output is verified by code.

**Q34. How accurate is your knowledge base and how do you know?**
Honestly: it is hand-written from standard, well-established interview material, and each entry lists concrete key points so it can be checked. `npm run kb:check` validates structure (unique ids, ≥2 key points, no duplicate titles) and runs a retrieval self-test — querying each entry with only its tags — which gives recall@1 ≈ 97.6% and recall@5 = 100% over 291 question entries. That measures *findability*, not factual correctness; correctness is verified by review. To improve it: have a peer or mentor review the technical entries, cite sources per entry, and grow it over time. Because key points are shown to the grader, an error in the KB would propagate — so treat it as a maintained data source.

**Q27. What is RAG and why did you use it?**
Retrieval-Augmented Generation: retrieve relevant documents first, give them to the LLM with the question. It reduces hallucination, lets us add knowledge without retraining, and makes answers traceable — we show the sources used.

**Q28. What are embeddings and how does cosine similarity work?**
An embedding model maps text to a vector where similar meaning means nearby direction. Cosine similarity = the cosine of the angle between two vectors (dot product when normalised); 1 means same direction, ~0 unrelated. We use 384-dimensional MiniLM vectors.

**Q29. Why hybrid search (dense + lexical)?**
Dense embeddings capture meaning but can blur exact terms; TF-IDF captures exact keywords but misses paraphrases. Blending 0.7 dense + 0.3 lexical gets both. If embeddings fail, lexical alone still works.

**Q30. What is TF-IDF?**
Term Frequency × Inverse Document Frequency: a word scores high if it is frequent in this document but rare across the corpus. We compute IDF over our knowledge base, so "Kubernetes" outranks "team" when extracting job-description keywords.

**Q31. How do you know the similarity scores are meaningful?**
Honestly: they are relative signals. We scale raw cosines to 0–100 with a fixed mapping (0.10→0, 0.50→100) that is a heuristic, not calibrated. In tests a relevant answer scored ~33–72 and an off-topic one ~10. The next step is validating against human ratings.

**Q32. Why run MiniLM locally instead of an embeddings API?**
Free, no key, no rate limit, private (transcripts don't leave the server), and it's small (~25 MB). The trade-off: a first-request model load (~5 s) and it needs a Node host (fine on a normal server; on serverless we fall back to TF-IDF automatically).

**Q33. How does the "measured composite" relate to the AI score?**
It is a transparent heuristic (0.35 relevance + 0.25 STAR coverage + 0.20 keyword coverage + 0.20 answer length) shown next to the AI grade. It is not the grade. A big gap flags a case to inspect, and it gives us a second, non-LLM baseline for evaluation.

---

# PART 9 — Glossary

- **LLM** — Large Language Model (Llama, Gemini, GPT).
- **Prompt engineering** — designing instructions/context so a model behaves reliably.
- **JSON mode** — provider setting forcing valid JSON output.
- **Grounding** — tying model output to provided facts/evidence.
- **Hallucination** — model stating invented facts confidently.
- **STAR** — Situation, Task, Action, Result.
- **ATS** — Applicant Tracking System.
- **STT / TTS** — Speech-to-text / text-to-speech.
- **RLS** — Row-Level Security (database-enforced per-row access rules).
- **JWT / session cookie** — how Supabase remembers you're logged in; middleware refreshes it.
- **App Router / Route Handler** — Next.js file-based pages and API endpoints.
- **Server vs client component** — server components render on the server (used for saved-interview pages); `"use client"` components run in the browser (interview, results).
- **RAG** — Retrieval-Augmented Generation: fetch relevant documents and give them to the LLM.
- **Embedding** — a vector representation of text where meaning ≈ direction.
- **Cosine similarity** — angle-based similarity between two vectors.
- **MiniLM** — a small pre-trained sentence-transformer (all-MiniLM-L6-v2, 384 dims).
- **TF-IDF** — term frequency × inverse document frequency; weights distinctive words.
- **MATTR** — moving-average type-token ratio; vocabulary diversity independent of length.
- **Hybrid search** — combining dense (embedding) and lexical (keyword) scores.
- **Persona prompting** — instructing the model to adopt a specific role/voice.
- **Explainability (XAI)** — making an AI's decisions understandable to users.
