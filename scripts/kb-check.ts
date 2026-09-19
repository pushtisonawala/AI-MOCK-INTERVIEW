// Validates the knowledge base and measures retrieval quality.
// Run: npm run kb:check
//   1. Structure: unique ids, non-empty fields, enough key points, duplicate titles.
//   2. Retrieval self-test: query each entry using ONLY its tags (no title text) and check whether
//      the entry comes back in the top 5 (recall@5) — a rough measure of how findable entries are.
import { KNOWLEDGE_BASE } from "../lib/rag/knowledge-base";
import { retrieve } from "../lib/rag/retriever";

(async () => {
  const problems: string[] = [];
  const ids = new Set<string>();
  const titles = new Map<string, string>();
  const perDomain = new Map<string, number>();

  for (const c of KNOWLEDGE_BASE) {
    if (ids.has(c.id)) problems.push(`duplicate id ${c.id}`);
    ids.add(c.id);
    const t = c.title.toLowerCase().trim();
    if (titles.has(t)) problems.push(`duplicate title: ${c.id} and ${titles.get(t)}`);
    titles.set(t, c.id);
    if (!c.title || !c.text) problems.push(`${c.id}: empty title/text`);
    if (c.keyPoints.length < 2) problems.push(`${c.id}: fewer than 2 key points`);
    if (c.tags.length < 2) problems.push(`${c.id}: fewer than 2 tags`);
    perDomain.set(c.domain, (perDomain.get(c.domain) || 0) + 1);
  }

  console.log(`Entries: ${KNOWLEDGE_BASE.length}  |  key points: ${KNOWLEDGE_BASE.reduce((s, c) => s + c.keyPoints.length, 0)}`);
  console.log([...perDomain.entries()].map(([d, n]) => `${d}=${n}`).join("  "));
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "\nStructure: OK");

  let hit1 = 0;
  let hit5 = 0;
  const misses: string[] = [];
  const t0 = Date.now();
  for (const c of KNOWLEDGE_BASE) {
    if (c.type !== "question") continue;
    const { chunks } = await retrieve(c.tags.join(" "), { k: 5, minScore: 0 });
    const rank = chunks.findIndex((x) => x.id === c.id);
    if (rank === 0) hit1++;
    if (rank >= 0) hit5++;
    else misses.push(`${c.id} "${c.title.slice(0, 55)}"  (tags: ${c.tags.slice(0, 4).join(" ")})`);
  }
  const n = KNOWLEDGE_BASE.filter((c) => c.type === "question").length;
  console.log(`\nRetrieval self-test (query = tags only) over ${n} question entries [${Date.now() - t0} ms]`);
  console.log(`recall@1 = ${((hit1 / n) * 100).toFixed(1)}%   recall@5 = ${((hit5 / n) * 100).toFixed(1)}%`);
  if (misses.length) console.log(`Not in top 5 (${misses.length}):\n- ${misses.slice(0, 15).join("\n- ")}`);
  process.exit(problems.length ? 1 : 0);
})();
