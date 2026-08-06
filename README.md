# AI Mock Interview

A free, real-time AI mock interview app. Paste a job description (and optionally your resume), do a live voice-and-video interview with an AI interviewer that asks tailored questions and natural follow-ups, then get a detailed feedback report and a resume tailored to that job — as a downloadable Word doc.

Everything here runs on free tiers only: no paid APIs, no database, no hosting costs.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **AI provider — switchable, both free**: [Groq](https://console.groq.com) (default — higher free-tier rate limits, fast) or [Google Gemini](https://aistudio.google.com/app/apikey). Generates interview questions, drives the live conversation, scores the interview, and tailors the resume.
- **Browser Web Speech API** — speech-to-text for your spoken answers, text-to-speech for the AI's voice (built into Chrome/Edge, no extra service)
- **pdf-parse** / **mammoth** — extract text from an uploaded PDF/DOCX resume
- **docx** — generates the tailored resume as a real .docx file
- No database — each interview is a self-contained browser session

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

## 2. Configure the project

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your key. To use Groq (default), just fill in:

```
AI_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

To use Gemini instead, set `AI_PROVIDER=gemini` and fill in `GEMINI_API_KEY` instead — no code changes needed either way.

## 3. Install & run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Use Chrome or Edge** — they're the browsers with full Web Speech API (voice) support. Other browsers will still work but fall back to typed answers instead of voice.

## 4. Deploy to Vercel (free)

1. Push this project to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. In the project's **Environment Variables** settings, add the same variables from your `.env.local` (`AI_PROVIDER` plus `GROQ_API_KEY` or `GEMINI_API_KEY`)
4. Deploy — Vercel's free Hobby tier covers this comfortably

## How it works

1. **Setup** (`/`) — enter the role, job description, and optionally upload your resume. Pick and preview the AI interviewer's voice. The AI generates a tailored set of interview questions.
2. **Interview** (`/interview`) — your camera turns on (for your own reference; nothing is uploaded), the AI speaks each question aloud, you answer out loud, and it automatically continues once you pause — no manual clicking required. It decides in real time whether to ask a natural follow-up or move to the next question. The AI orb, live mic level, and a running conversation transcript all give real-time feedback that it's actually listening.
3. **Results** (`/results`) — the AI analyzes the full transcript for content quality, STAR method usage, communication, and filler words, and separately rewrites your resume to align with the job description. Download the tailored resume as a Word file.

## Notes & limitations

- **Video is record-only.** The app does not analyze facial expressions, eye contact, or posture — feedback is based entirely on what you said (the transcript). You can optionally download your own recording at the end for your own review; it's never uploaded anywhere.
- **No history.** Nothing is saved between sessions — refreshing or starting a new interview clears everything (it's all in `sessionStorage`, in your browser only).
- **Speech recognition browser support**: full support in Chrome and Edge. Safari/Firefox may not support live speech-to-text; the app automatically falls back to a text box for typing answers.
- **Free tier limits**: both providers are genuinely free but rate-limited. Roughly: Groq ≈ 30 requests/min; Gemini (`gemini-2.5-flash`) ≈ 10 requests/min, 250/day. A full interview makes a handful of requests (questions, each turn, feedback, resume) so Groq's headroom is noticeably more comfortable for back-to-back testing. If you hit a rate limit, wait a minute and try again, or switch providers in `.env.local`.

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
