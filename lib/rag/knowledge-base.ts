// Curated interview knowledge base used for Retrieval-Augmented Generation (RAG).
// The data lives in lib/rag/kb/*.ts, one file per area; this file just assembles it.
//
// Chunk types:
//   question       — a representative interview question, what it assesses, and the key points a
//                    correct, strong answer contains (used to ground question generation and grading)
//   rubric         — general answer-quality guidance (STAR, technical answer structure, etc.)
//   company_style  — widely-known interview styles of well-known companies / company types
//
// IDs are stable per domain (e.g. DSA-04), so adding entries to one domain never renumbers another.
// Run `npm run kb:check` after editing to validate the structure and measure retrieval quality.
import { behavioralHr } from "./kb/behavioral-hr";
import { csFundamentals } from "./kb/cs-fundamentals";
import { webBackend } from "./kb/web-backend";
import { systemsCloud } from "./kb/systems-cloud";
import { dataAi } from "./kb/data-ai";
import { business } from "./kb/business";

export type KbType = "question" | "rubric" | "company_style";

export interface KbChunk {
  id: string;
  type: KbType;
  domain: string;
  title: string; // the question, or the topic name
  text: string; // what it assesses
  keyPoints: string[]; // concrete facts / elements a strong answer contains
  tags: string[];
}

export const KNOWLEDGE_BASE: KbChunk[] = [
  ...behavioralHr,
  ...csFundamentals,
  ...webBackend,
  ...systemsCloud,
  ...dataAi,
  ...business,
];
