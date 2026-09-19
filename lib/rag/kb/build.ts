import type { KbChunk, KbType } from "../knowledge-base";

// Compact authoring format for a knowledge-base entry:
//   [title/question, what it assesses, key points (separated by " | "), tags (space separated)]
// Key points are the concrete, checkable facts a strong answer should contain — the grader
// uses them to judge accuracy, so keep them correct and specific.
export type Entry = [string, string, string, string];

export function buildDomain(domain: string, prefix: string, type: KbType, entries: Entry[]): KbChunk[] {
  return entries.map(([title, text, keyPoints, tags], i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    type,
    domain,
    title,
    text,
    keyPoints: keyPoints.split(" | ").map((k) => k.trim()).filter(Boolean),
    tags: tags.split(" ").filter(Boolean),
  }));
}
