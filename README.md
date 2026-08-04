# AI Mock Interview

A free, real-time AI mock interview app. Paste a job description (and optionally your resume), do a live voice-and-video interview with an AI interviewer that asks tailored questions and natural follow-ups, then get a detailed feedback report and a resume tailored to that job — as a downloadable Word doc.

Everything here runs on free tiers only: no paid APIs, no database, no hosting costs.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Google Gemini API** (free tier) — generates interview questions, drives the live conversation, scores the interview, and tailors the resume
- **Browser Web Speech API** — speech-to-text for your spoken answers, text-to-speech for the AI's voice (built into Chrome/Edge, no extra service)
- **pdf-parse** / **mammoth** — extract text from an uploaded PDF/DOCX resume
- **docx** — generates the tailored resume as a real .docx file
- No database — each interview is a self-contained browser session

## 1. Get a free Gemini API key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with a Google account and click **Create API key**
3. Copy the key

## 2. Configure the project

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your key:

```
GEMINI_API_KEY=your_key_here
```

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
3. In the project's **Environment Variables** settings, add `GEMINI_API_KEY` (same value as your `.env.local`)
4. Deploy — Vercel's free Hobby tier covers this comfortably

## How it works

1. **Setup** (`/`) — enter the role, job description, and optionally upload your resume. Pick and preview the AI interviewer's voice. Gemini generates a tailored set of interview questions.
2. **Interview** (`/interview`) — your camera turns on (for your own reference; nothing is uploaded), the AI speaks each question aloud, you answer out loud, and it automatically continues once you pause — no manual clicking required. It decides in real time whether to ask a natural follow-up or move to the next question. The AI orb, live mic level, and a running conversation transcript all give real-time feedback that it's actually listening.
3. **Results** (`/results`) — Gemini analyzes the full transcript for content quality, STAR method usage, communication, and filler words, and separately rewrites your resume to align with the job description. Download the tailored resume as a Word file.

## Notes & limitations

- **Video is record-only.** The app does not analyze facial expressions, eye contact, or posture — feedback is based entirely on what you said (the transcript). You can optionally download your own recording at the end for your own review; it's never uploaded anywhere.
- **No history.** Nothing is saved between sessions — refreshing or starting a new interview clears everything (it's all in `sessionStorage`, in your browser only).
- **Speech recognition browser support**: full support in Chrome and Edge. Safari/Firefox may not support live speech-to-text; the app automatically falls back to a text box for typing answers.
- **Free tier limits**: Gemini's free tier has generous but real rate limits (requests per minute/day). If you hit a rate limit, wait a minute and try again.

## Troubleshooting

- **"GEMINI_API_KEY is not set"** — make sure `.env.local` exists at the project root with your key, then restart `npm run dev`.
- **"fetch failed" / "Couldn't reach Google's Gemini API"** — this means your machine couldn't reach `generativelanguage.googleapis.com` at all (not an app bug). Check, in order:
  1. You actually have an internet connection right now.
  2. You're not on a VPN, corporate network, or firewall/antivirus that blocks Google's API domains — try temporarily disabling it, or test from a different network (e.g. phone hotspot).
  3. `generativelanguage.googleapis.com` isn't blocked by a hosts-file entry or DNS filter (try `ping generativelanguage.googleapis.com` in a terminal — if it doesn't resolve, it's a DNS/network block, not the app).
  4. Node.js is version 18 or newer (`node -v`) — older versions don't have the built-in `fetch` this SDK relies on.
  
  The app now retries transient network blips automatically a couple of times before showing this error, so if you see it, it's a real, persistent connectivity problem to Google's servers.
- **PDF parsing throws an ENOENT error** — this is a known quirk of the `pdf-parse` package in some bundlers. If it happens, open `app/api/parse-resume/route.ts` and change `await import("pdf-parse")` to `await import("pdf-parse/lib/pdf-parse.js")`.
- **No voice/mic prompt appears** — voice features need Chrome or Edge and a working microphone/camera; grant permission when the browser asks. Other browsers fall back to a text box automatically.
