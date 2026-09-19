// Computed ATS keyword match (replaces the LLM's guess with a measurement):
//   1. Extract the job description's top keywords with TF-IDF (lib/nlp.ts).
//   2. Exact match: keyword stems found in the ORIGINAL resume text.
//   3. Semantic match: keywords not found verbatim are compared with each resume line using
//      MiniLM embeddings — catches synonyms ("built REST endpoints" ≈ "API development").
// The tailored rewrite is never used for scoring, so rewriting can't inflate the number.
import { extractKeywords, keywordCoverage } from "./nlp";
import { backgroundIdf, embed, dot } from "./embeddings";
import type { AtsMatch } from "./types";

const SEMANTIC_THRESHOLD = 0.5;

export async function computeAtsMatch(jobDescription: string, resumeText: string): Promise<AtsMatch | null> {
  const keywords = extractKeywords(jobDescription, backgroundIdf(), 20);
  if (keywords.length === 0 || !resumeText.trim()) return null;

  const exact = keywordCoverage(keywords, resumeText);
  let semantic: string[] = [];
  let method = "TF-IDF keyword extraction + exact stem match";

  if (exact.missing.length > 0) {
    const lines = resumeText
      .split(/\n+|(?<=[.;])\s+/)
      .map((l) => l.trim())
      .filter((l) => l.split(/\s+/).length >= 3)
      .slice(0, 150);
    const vecs = lines.length ? await embed([...exact.missing, ...lines]) : null;
    if (vecs) {
      const kwVecs = vecs.slice(0, exact.missing.length);
      const lineVecs = vecs.slice(exact.missing.length);
      semantic = exact.missing.filter((_, i) => lineVecs.some((lv) => dot(kwVecs[i], lv) >= SEMANTIC_THRESHOLD));
      method = "TF-IDF keyword extraction + exact stem match + MiniLM semantic match";
    }
  }

  const matched = [...exact.matched, ...semantic];
  return {
    score: Math.round((matched.length / keywords.length) * 100),
    matchedKeywords: matched,
    missingKeywords: exact.missing.filter((k) => !semantic.includes(k)),
    semanticMatches: semantic,
    method,
  };
}
