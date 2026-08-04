import { GoogleGenerativeAI, GenerateContentRequest } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/app/apikey and add it to .env.local (see .env.example)."
    );
  }
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}

function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

function isTransientNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("eai_again") ||
    m.includes("socket hang up")
  );
}

function translateGeminiError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);

  if (isTransientNetworkError(message)) {
    return new Error(
      "Couldn't reach Google's Gemini API. This is almost always a local network issue — no internet connection, a VPN/firewall/antivirus blocking generativelanguage.googleapis.com, or a DNS problem. Check your connection and try again."
    );
  }
  if (message.includes("API key not valid") || message.includes("API_KEY_INVALID")) {
    return new Error("Your Gemini API key looks invalid. Double-check GEMINI_API_KEY in .env.local.");
  }
  if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
    return new Error("Gemini's free-tier rate limit was hit. Wait a minute and try again.");
  }
  return err instanceof Error ? err : new Error(message);
}

// A handful of retries with backoff for genuinely transient network blips only —
// this is a bounded, server-side retry (max 3 attempts), not an unbounded loop.
async function callModel(request: GenerateContentRequest) {
  const model = getClient().getGenerativeModel({ model: MODEL_NAME });
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!isTransientNetworkError(message) || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw translateGeminiError(lastErr);
}

export async function generateJSON<T>(prompt: string, temperature = 0.6): Promise<T> {
  const result = await callModel({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  });
  const raw = result.response.text();
  try {
    return JSON.parse(extractJsonText(raw)) as T;
  } catch (err) {
    throw new Error(
      `The AI returned a response that couldn't be parsed. Try again in a moment. (${(err as Error).message})`
    );
  }
}

export async function generateText(prompt: string, temperature = 0.7): Promise<string> {
  const result = await callModel({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature },
  });
  return result.response.text().trim();
}
