// Single entry point every API route calls through. Which underlying provider actually
// runs is controlled by the AI_PROVIDER env var — both are free, no paid API required.
//   AI_PROVIDER=groq   (default) — higher free-tier rate limits, fast (console.groq.com)
//   AI_PROVIDER=gemini            — Google's free tier (aistudio.google.com/app/apikey)
import * as gemini from "./gemini";
import * as groq from "./groq";

function activeProvider(): "gemini" | "groq" {
  const p = (process.env.AI_PROVIDER || "groq").trim().toLowerCase();
  return p === "gemini" ? "gemini" : "groq";
}

export async function generateJSON<T>(prompt: string, temperature?: number): Promise<T> {
  const provider = activeProvider() === "gemini" ? gemini : groq;
  return provider.generateJSON<T>(prompt, temperature);
}

export async function generateText(prompt: string, temperature?: number): Promise<string> {
  const provider = activeProvider() === "gemini" ? gemini : groq;
  return provider.generateText(prompt, temperature);
}
