// Hybrid retriever over the interview knowledge base (RAG "R" step).
//   score = 0.7 × dense cosine (MiniLM embeddings) + 0.3 × lexical TF-IDF cosine
// Dense search catches paraphrases ("led a team" ~ "leadership"); lexical search catches exact
// technical terms ("Kubernetes"). If embeddings are unavailable it degrades to lexical only.
import { KNOWLEDGE_BASE, KbChunk, KbType } from "./knowledge-base";
import { embed, dot, backgroundIdf, type SimilarityMethod } from "../embeddings";
import { tfCosine } from "../nlp";
import type { KbSource } from "../types";

export interface RetrievedChunk extends KbChunk {
  score: number;
}

const DENSE_WEIGHT = 0.7;

const g = globalThis as unknown as { __ami_kb_vecs?: Promise<number[][] | null> };

function chunkText(c: KbChunk): string {
  return `${c.title}. ${c.text} ${c.keyPoints.join(". ")} ${c.tags.join(" ")}`;
}

// Embeds the whole knowledge base once per server process (~100 short texts, a second or two).
function kbVectors(): Promise<number[][] | null> {
  if (!g.__ami_kb_vecs) g.__ami_kb_vecs = embed(KNOWLEDGE_BASE.map(chunkText));
  return g.__ami_kb_vecs;
}

export interface RetrieveOptions {
  k?: number;
  types?: KbType[];
  minScore?: number;
}

export async function retrieve(
  query: string,
  { k = 6, types, minScore = 0.08 }: RetrieveOptions = {}
): Promise<{ chunks: RetrievedChunk[]; method: SimilarityMethod }> {
  const idf = backgroundIdf();
  const [kbVecs, qVec] = await Promise.all([kbVectors(), embed([query])]);
  const dense = kbVecs && qVec ? kbVecs.map((v) => dot(v, qVec[0])) : null;

  const scored: RetrievedChunk[] = KNOWLEDGE_BASE.map((c, i) => {
    const lexical = tfCosine(query, chunkText(c), idf);
    const score = dense ? DENSE_WEIGHT * Math.max(0, dense[i]) + (1 - DENSE_WEIGHT) * lexical : lexical;
    return { ...c, score };
  })
    .filter((c) => (!types || types.includes(c.type)) && c.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return { chunks: scored.slice(0, k), method: dense ? "minilm" : "tfidf-fallback" };
}

export function toSource(c: RetrievedChunk): KbSource {
  return { id: c.id, title: c.title, type: c.type, score: Math.round(c.score * 100) / 100 };
}

// Compact text block for prompts.
export function formatForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c) => `[${c.id}] (${c.type}/${c.domain}) ${c.title} — ${c.text}${c.keyPoints.length ? ` Key points: ${c.keyPoints.join("; ")}.` : ""}`)
    .join("\n");
}
