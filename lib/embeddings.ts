// Sentence embeddings with a pre-trained transformer (all-MiniLM-L6-v2, 384 dimensions),
// run locally in Node through Transformers.js (ONNX runtime). Free — no API key, no network
// calls after the first model download (~25 MB, cached on disk).
//
// If the model can't be loaded (offline first run, unsupported host, serverless size limits)
// every caller transparently falls back to lexical TF-IDF similarity, and the result says
// which method was used — the app never breaks because of embeddings.
import path from "path";
import { buildIdf, tfCosine, type IdfMap } from "./nlp";
import { KNOWLEDGE_BASE } from "./rag/knowledge-base";

export type SimilarityMethod = "minilm" | "tfidf-fallback";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const MAX_CHARS = 1500; // the model truncates long inputs anyway; keep batches cheap

// Module-level singletons (stored on globalThis so Next.js dev hot-reload doesn't reload the model).
const g = globalThis as unknown as {
  __ami_extractor?: Promise<any | null>;
  __ami_idf?: IdfMap;
  __ami_cache?: Map<string, number[]>;
};

export function backgroundIdf(): IdfMap {
  if (!g.__ami_idf) g.__ami_idf = buildIdf(KNOWLEDGE_BASE.map((c) => `${c.title} ${c.text} ${c.keyPoints.join(" ")} ${c.tags.join(" ")}`));
  return g.__ami_idf;
}

function getExtractor(): Promise<any | null> {
  if (!g.__ami_extractor) {
    g.__ami_extractor = (async () => {
      try {
        const { pipeline, env } = await import("@xenova/transformers");
        env.cacheDir =
          process.env.TRANSFORMERS_CACHE_DIR || (process.env.VERCEL ? "/tmp/hf-cache" : path.join(process.cwd(), ".model-cache"));
        return await pipeline("feature-extraction", MODEL_ID);
      } catch (err) {
        console.warn("[embeddings] MiniLM unavailable, falling back to TF-IDF similarity:", (err as Error).message);
        return null;
      }
    })();
  }
  return g.__ami_extractor;
}

// Embeds texts (L2-normalised, so cosine similarity = dot product). Returns null when the
// model is unavailable. Results are cached per text.
export async function embed(texts: string[]): Promise<number[][] | null> {
  const extractor = await getExtractor();
  if (!extractor) return null;

  const cache = (g.__ami_cache ||= new Map());
  const clipped = texts.map((t) => t.slice(0, MAX_CHARS));
  const todo = [...new Set(clipped.filter((t) => !cache.has(t)))];

  if (todo.length > 0) {
    try {
      const out = await extractor(todo, { pooling: "mean", normalize: true });
      const dim = out.dims[1] as number;
      const data = out.data as Float32Array;
      todo.forEach((t, i) => cache.set(t, Array.from(data.slice(i * dim, (i + 1) * dim))));
    } catch (err) {
      console.warn("[embeddings] embedding failed, falling back:", (err as Error).message);
      return null;
    }
  }
  return clipped.map((t) => cache.get(t)!);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Similarity (roughly 0..1) for each [a, b] pair. Dense cosine when embeddings are
// available, lexical TF-IDF cosine otherwise.
export async function pairSimilarities(pairs: [string, string][]): Promise<{ scores: number[]; method: SimilarityMethod }> {
  if (pairs.length === 0) return { scores: [], method: "minilm" };
  const vecs = await embed(pairs.flatMap(([a, b]) => [a, b]));
  if (vecs) {
    return { scores: pairs.map((_, i) => Math.max(0, dot(vecs[2 * i], vecs[2 * i + 1]))), method: "minilm" };
  }
  const idf = backgroundIdf();
  return { scores: pairs.map(([a, b]) => tfCosine(a, b, idf)), method: "tfidf-fallback" };
}
