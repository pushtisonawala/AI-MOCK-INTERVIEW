"use client";

import { Persona, SessionSetup } from "./types";

// Helpers for picking a good browser TTS voice for the AI interviewer.
// Free/browser-native (Web Speech API) — no paid TTS service involved.

// In panel mode each persona can have its own assigned voice; outside panel mode (or if
// a persona has no assigned voice yet) fall back to the single interviewer voice.
export function resolveVoiceName(setup: SessionSetup, persona?: Persona): string | undefined {
  if (setup.interviewMode === "panel" && persona && persona !== "general") {
    return setup.panelVoiceNames?.[persona] || setup.voiceName;
  }
  return setup.voiceName;
}

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

// Picks up to n distinct-sounding voices for panel mode, so the three interviewer
// personas don't all sound identical by default. Falls back to repeating voices if the
// browser doesn't offer enough distinct ones.
export function topVoices(voices: SpeechSynthesisVoice[], n: number): SpeechSynthesisVoice[] {
  const pool = englishVoices(voices);
  if (pool.length === 0) return [];

  const scored = pool
    .map((v) => {
      const name = v.name.toLowerCase();
      let score = 0;
      QUALITY_HINTS.forEach((h) => {
        if (name.includes(h)) score += 2;
      });
      if (v.lang === "en-US") score += 1;
      if (!v.localService) score += 1;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked: SpeechSynthesisVoice[] = [];
  for (const { v } of scored) {
    if (picked.length >= n) break;
    if (!picked.some((p) => p.name === v.name)) picked.push(v);
  }
  while (picked.length < n && scored.length > 0) {
    picked.push(scored[picked.length % scored.length].v);
  }
  return picked.slice(0, n);
}
