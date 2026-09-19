# AI Mock Interview

A free, real-time AI mock interview app. Sign in, paste a job description (and optionally your resume), do a live voice-and-video interview with an AI interviewer that asks tailored questions and natural follow-ups, then get a detailed feedback report and a resume tailored to that job — as a downloadable Word doc. Every session is automatically saved to your own interview history dashboard.

Everything here runs on free tiers only: no paid AI APIs, a free database, no hosting costs.

## Standout features

- **Progress dashboard** (`/dashboard`) — a score trend chart across all your saved interviews plus a "readiness score" (a weighted average favoring your most recent sessions).
- **ATS keyword-match meter** — on the results page, see what % of the job description's key skills your original resume already covers, with matched and missing keywords called out.
- **Retry the weak question** — after your results, jump straight into re-practicing just the question from your lowest-scoring category, with an instant before/after score comparison.
- **Panel interview mode** — instead of one interviewer, practice against a technical interviewer, an HR/behavioral interviewer, and a hiring manager, each with a distinct voice and question style.
- **Company-aware questions** — if you name a company, the AI leans on whatever it knows about that company's or industry's typical interview style (e.g. leadership-principle-style behavioral questions, case-style prompts) when it's confident, without inventing anything it isn't sure about.
- **Timed mode** — put a countdown on each question for realistic time-pressure practice.
- **Shareable results link** — generate a read-only link to a saved interview's feedback and tailored resume, so a mentor or friend can review it without an account.

## How the AI works (RAG + NLP + LLM)

This is a hybrid system, not just an LLM call:
- **RAG** — a curated 320-entry interview knowledge base with ~1,400 key points (`lib/rag/kb/`) is searched with hybrid dense (MiniLM embeddings) + TF-IDF retrieval; retrieved chunks are injected into the question-generation and grading prompts, and shown as sources in the UI.
- **Classical NLP** (`lib/nlp.ts`) — filler/hedge detection, rule-based STAR detection, TF-IDF keyword extraction, lexical diversity. Measured numbers are given to the LLM as facts and displayed next to its grade.
- **Sentence embeddings** (`lib/embeddings.ts`) — `all-MiniLM-L6-v2` via Transformers.js runs locally (free, ~25 MB download on first use, cached in `.model-cache/`). If it can't load, everything falls back to TF-IDF similarity.
- **Explainability & verification** (`lib/analysis.ts`) — per-question "why" reasoning, quotes checked against the transcript, invented sources rejected, deterministic score sanity guard.
- **Computed ATS match** (`lib/ats.ts`) — TF-IDF keywords vs the original resume, with semantic matching for synonyms.

Run `npm run smoke` to exercise the non-LLM pipeline offline, and `npm run kb:check` to validate the knowledge base and measure retrieval recall. See `docs/PROJECT_GUIDE.md` for the full explanation and presentation script.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **AI provider — switchable, both free**: [Groq](https://console.groq.com) (default — higher free-tier rate limits, fast) or [Google Gemini](https://aistudio.google.com/app/apikey). Generates interview questions, drives the live conversation, scores the interview, and tailors the resume.
- **Browser Web Speech API** — speech-to-text for your spoken answers, text-to-speech for the AI's voice (built into Chrome/Edge, no extra service)
- **Supabase** (free tier) — accounts (email/password + Google sign-in) and a Postgres database for saved interview history. Sign-in is required to use the app (see setup step 2 below); if Supabase env vars aren't configured at all, that requirement is skipped so the app stays usable while you're setting it up.
- **pdf-parse** / **mammoth** — extract text from an uploaded PDF/DOCX resume
- **docx** — generates the tailored resume as a real .docx file

## 1. Get a free API key

The app defaults to **Groq** because its free tier has meaningfully higher rate limits than Gemini's (Google cut Gemini's free quotas 50-80% in Dec 2025). You can switch providers anytime via one env var — see below.

**Groq (default):**
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign in and click **Create API Key**
3. Copy the key

**Gemini (optional alternative):**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with a Google account and click **Create API key**
3. Copy the key

## 2. Set up accounts (Supabase) — required

Sign-in is required before anyone can use the app — visiting any page redirects to `/login` until you sign in. This section sets that up. (If you skip it entirely — no Supabase env vars at all — the app falls back to being fully open with no accounts, purely so it's still usable while you're mid-setup.)

1. Create a free project at [supabase.com](https://supabase.com) (no credit card required).
2. In your project, go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the `interviews` table with row-level security (each user can only ever see their own rows, except rows they've explicitly made public via the Share button). The script is safe to re-run any time — e.g. if you set this up before the share-link feature existed, just re-run it once to add the new `share_token`/`is_public` columns.
3. Go to **Project Settings → API** and copy the **Project URL** and **anon public** key — you'll need these for `.env.local` below.
4. For Google sign-in: go to **Authentication → Providers → Google** in Supabase, and follow the linked instructions to create a free Google OAuth client at [console.cloud.google.com](https://console.cloud.google.com) (OAuth consent screen + credentials). Paste the resulting Client ID/Secret into Supabase, and add the callback URL Supabase shows you to your Google OAuth client's **Authorized redirect URIs**.
5. Email/password sign-in works out of the box with no extra setup (Supabase emails a confirmation link by default — you can turn that off in **Authentication → Providers → Email** for easier local testing).

## 3. Configure the project

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your keys. To use Groq (default):

```
AI_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

To use Gemini instead, set `AI_PROVIDER=gemini` and fill in `GEMINI_API_KEY` instead — no code changes needed either way.

If you set up Supabase, also fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 4. Install & run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Use Chrome or Edge** — they're the browsers with full Web Speech API (voice) support. Other browsers will still work but fall back to typed answers instead of voice.

## 5. Deploy to Vercel (free)

1. Push this project to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. In the project's **Environment Variables** settings, add the same variables from your `.env.local` (`AI_PROVIDER` plus `GROQ_API_KEY`/`GEMINI_API_KEY`, and the two `NEXT_PUBLIC_SUPABASE_*` vars if using accounts)
4. If using Google sign-in, add your deployed URL's `/auth/callback` route to both Supabase's redirect settings and your Google OAuth client's Authorized redirect URIs
5. Deploy — Vercel's free Hobby tier covers this comfortably

## How it works

1. **Setup** (`/`) — enter the role, job description, and optionally upload your resume. Choose a standard (one interviewer) or panel (three interviewers) format, optionally turn on timed mode, and pick/preview the AI interviewer voice(s). The AI generates a tailored set of interview questions.
2. **Interview** (`/interview`) — your camera turns on (for your own reference; nothing is uploaded), the AI speaks each question aloud, you answer out loud, and it automatically continues once you pause — no manual clicking required. It decides in real time whether to ask a natural follow-up or move to the next question. In panel mode, each question is asked by the relevant persona (technical/behavioral/hiring manager) in that persona's own voice, labeled in the transcript. In timed mode, a countdown auto-submits your answer when time's up.
3. **Results** (`/results`) — the AI analyzes the full transcript for content quality, STAR method usage, communication, and filler words, and separately rewrites your resume to align with the job description, including an ATS keyword-match meter. Download the tailored resume as a Word file, or jump into focused retry practice on your weakest-scoring question. The session is automatically saved to your history.
4. **My Interviews** (`/dashboard`) — a score trend chart and readiness score across all your sessions, plus every past interview linking to a full replay of its feedback and tailored resume, with an option to generate a shareable read-only link.

## Notes & limitations

- **Sign-in is required.** Every page except `/login`, the OAuth callback, and shared read-only links (`/share/...`) redirects you to sign in first. This is enforced in `middleware.ts`. If Supabase env vars aren't configured at all, that check is skipped and the app is fully open instead (so a fresh clone stays usable before you've finished setup).
- **Video is record-only.** The app does not analyze facial expressions, eye contact, or posture — feedback is based entirely on what you said (the transcript). You can optionally download your own recording at the end for your own review; it's never uploaded anywhere or saved to the database.
- **Speech recognition browser support**: full support in Chrome and Edge. Safari/Firefox may not support live speech-to-text; the app automatically falls back to a text box for typing answers.
- **Free tier limits**: both AI providers are genuinely free but rate-limited. Roughly: Groq ≈ 30 requests/min; Gemini (`gemini-2.5-flash`) ≈ 10 requests/min, 250/day. A full interview makes a handful of requests (questions, each turn, feedback, resume) so Groq's headroom is noticeably more comfortable for back-to-back testing. If you hit a rate limit, wait a minute and try again, or switch providers in `.env.local`. Supabase's free tier (500MB database, 50,000 monthly active users) is far beyond what a personal project needs.

## Troubleshooting

- **"GROQ_API_KEY is not set"** — make sure `.env.local` exists at the project root with `AI_PROVIDER=groq` and a real `GROQ_API_KEY`, then restart `npm run dev`.
- **"GEMINI_API_KEY is not set"** — same as above, but you've set `AI_PROVIDER=gemini` and need `GEMINI_API_KEY` filled in instead.
- **"Couldn't reach Groq's API" / "Couldn't reach Google's Gemini API"** — this means your machine couldn't reach the provider's servers at all (`api.groq.com` or `generativelanguage.googleapis.com`) — not an app bug. Check, in order:
  1. You actually have an internet connection right now.
  2. You're not on a VPN, corporate network, or firewall/antivirus that blocks these API domains — try temporarily disabling it, or test from a different network (e.g. phone hotspot).
  3. The domain isn't blocked by a hosts-file entry or DNS filter (try `ping api.groq.com` or `ping generativelanguage.googleapis.com` in a terminal, matching whichever provider you're using — if it doesn't resolve, it's a DNS/network block, not the app).
  4. Node.js is version 18 or newer (`node -v`) — older versions don't have the built-in `fetch` these SDKs rely on.
  
  The app retries transient network blips automatically a couple of times before showing this error, so if you see it, it's a real, persistent connectivity problem to that provider's servers.
- **PDF parsing throws an ENOENT error** — this is a known quirk of the `pdf-parse` package in some bundlers. If it happens, open `app/api/parse-resume/route.ts` and change `await import("pdf-parse")` to `await import("pdf-parse/lib/pdf-parse.js")`.
- **No voice/mic prompt appears** — voice features need Chrome or Edge and a working microphone/camera; grant permission when the browser asks. Other browsers fall back to a text box automatically.
- **"Sign in" button doesn't do anything / results never save** — check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local` and you restarted `npm run dev` after adding them (Next only reads env vars at server start).
- **Google sign-in redirects to an error page** — almost always a mismatched redirect URI. The URL Supabase uses (shown on the Google provider settings page in Supabase, something like `https://<project-ref>.supabase.co/auth/v1/callback`) must be added exactly to your Google OAuth client's **Authorized redirect URIs**.
- **Signed up but can't sign in** — Supabase requires email confirmation by default; check your inbox for the confirmation link, or turn off "Confirm email" in Supabase's Email provider settings for local testing.
- **Every page redirects you straight back to `/login`, even right after signing in** — you're not signed in, or your session expired; sign in again. If it keeps happening, double-check `middleware.ts` is present at the project root (not inside `app/`) — it's what keeps your session alive and enforces sign-in on every request.
- **A `/share/...` link 404s** — either sharing was turned off after the link was generated, or you're on a Supabase project where `supabase/schema.sql` hasn't been re-run since the `share_token`/`is_public` columns and the public-read policy were added. Re-run it (it's idempotent, safe to run again).
- **Panel mode voices sound the same** — your browser/OS may not expose 3+ distinct English voices; the app reuses the best one it has when that happens. You can still manually pick different voices per persona in the setup page if more are available.
