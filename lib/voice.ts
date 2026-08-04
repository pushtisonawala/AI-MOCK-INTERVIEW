"use client";

// Helpers for picking a good browser TTS voice for the AI interviewer.
// Free/browser-native (Web Speech API) — no paid TTS service involved.

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const onChange = () => {
      resolve(synth.getVoices());
      synth.removeEventListener("voiceschanged", onChange);
    };
    synth.addEventListener("voiceschanged", onChange);
    // Fallback in case the event never fires on this browser
    setTimeout(() => resolve(synth.getVoices()), 1200);
  });
}

export function englishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return en.length > 0 ? en : voices;
}

const QUALITY_HINTS = ["natural", "online", "neural", "premium", "google"];

export function bestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const pool = englishVoices(voices);
  if (pool.length === 0) return null;

  const scored = pool.map((v) => {
    const name = v.name.toLowerCase();
    let score = 0;
    QUALITY_HINTS.forEach((h) => {
      if (name.includes(h)) score += 2;
    });
    if (v.lang === "en-US") score += 1;
    if (!v.localService) score += 1;
    return { v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

export function findVoiceByName(voices: SpeechSynthesisVoice[], name?: string): SpeechSynthesisVoice | null {
  if (!name) return null;
  return voices.find((v) => v.name === name) || null;
}
