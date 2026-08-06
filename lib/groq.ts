import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;
const MODEL_NAME = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

let client: Groq | null = null;

function getClient(): Groq {
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys and add it to .env.local (see .env.example)."
    );
  }
  if (!client) client = new Groq({ apiKey });
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
    m.includes("socket hang up") ||
    m.includes("timeout")
  );
}

function translateGroqError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);

  if (isTransientNetworkError(message)) {
    return new Error(
      "Couldn't reach Groq's API. This is almost always a local network issue — no internet connection, a VPN/firewall/antivirus blocking api.groq.com, or a DNS problem. Check your connection and try again."
    );
  }
  if (message.toLowerCase().includes("invalid api key") || message.includes("401")) {
    return new Error("Your Groq API key looks invalid. Double-check GROQ_API_KEY in .env.local.");
  }
  if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
    return new Error("Groq's free-tier rate limit was hit. Wait a minute and try again.");
  }
  return err instanceof Error ? err : new Error(message);
}

type ChatMessage = { role: "system" | "user"; content: string };

// A handful of retries with backoff for genuinely transient network blips only —
// this is a bounded, server-side retry (max 3 attempts), not an unbounded loop.
async function callModel(messages: ChatMessage[], temperature: number, jsonMode: boolean) {
  const client = getClient();
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.chat.completions.create({
        model: MODEL_NAME,
        messages,
        temperature,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      });
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!isTransientNetworkError(message) || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw translateGroqError(lastErr);
}

export async function generateJSON<T>(prompt: string, temperature = 0.6): Promise<T> {
  const completion = await callModel(
    [
      {
        role: "system",
        content: "You always respond with a single valid JSON object and nothing else — no markdown, no commentary.",
      },
      { role: "user", content: prompt },
    ],
    temperature,
    true
  );
  const raw = completion.choices[0]?.message?.content || "";
  try {
    return JSON.parse(extractJsonText(raw)) as T;
  } catch (err) {
    throw new Error(
      `The AI returned a response that couldn't be parsed. Try again in a moment. (${(err as Error).message})`
    );
  }
}

export async function generateText(prompt: string, temperature = 0.7): Promise<string> {
  const completion = await callModel([{ role: "user", content: prompt }], temperature, false);
  return (completion.choices[0]?.message?.content || "").trim();
}
