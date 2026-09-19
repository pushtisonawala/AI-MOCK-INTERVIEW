// Classical, deterministic NLP — no LLM involved. Everything here is *measured* from the text
// so the feedback report can show hard numbers next to the LLM's judgement:
//   • tokenisation / light stemming        • filler-word and hedge detection
//   • lexical diversity (MATTR)            • rule-based STAR component detector
//   • TF-IDF keyword extraction            • keyword coverage (stem matching)
//   • bag-of-words cosine similarity (used as the fallback when embeddings are unavailable)

const STOPWORDS = new Set(
  (
    "a an the and or but if then else for to of in on at by with from as is are was were be been being am do does did " +
    "have has had having i me my we our you your he she it its they them their this that these those there here " +
    "not no yes so than too very can could should would will shall may might must about into over under up down out " +
    "off again further once also just more most other some such only own same both each few any all what which who " +
    "whom whose when where why how because while during before after above below between through per via etc"
  ).split(" ")
);

// Words that show up in nearly every job description and say nothing about the role.
const JD_GENERIC = new Set(
  (
    "experience experienced team teams ability abilities able work working works strong skills skill years year role " +
    "position responsibilities responsibility requirements requirement required preferred candidate candidates looking " +
    "join company opportunity including include includes knowledge understanding excellent good great plus ideal " +
    "environment related relevant degree bachelor master equivalent minimum least demonstrated proven passion " +
    "passionate seeking must nice have need needs use using used across new well related etc will help support"
  ).split(" ")
);

// A small curated vocabulary of technical / professional terms. Terms in this set get a
// weight boost in keyword extraction, so "python" outranks "fast-paced".
const TECH_VOCAB = new Set(
  (
    "python java javascript typescript c++ c# go golang rust kotlin swift ruby php scala sql nosql mysql postgresql postgres " +
    "mongodb redis cassandra dynamodb firebase supabase react angular vue nextjs next.js nodejs node.js express django flask " +
    "fastapi spring html css tailwind sass redux graphql rest restful api apis microservices docker kubernetes terraform ansible " +
    "jenkins git github gitlab cicd ci cd aws azure gcp cloud linux bash agile scrum kanban jira tdd testing jest pytest selenium " +
    "machine learning deep tensorflow pytorch keras sklearn scikit-learn pandas numpy nlp llm rag embeddings transformers " +
    "spark hadoop kafka airflow etl tableau powerbi excel statistics analytics visualization dashboard oauth jwt security " +
    "encryption networking tcp http websocket websockets caching scalability distributed architecture algorithms " +
    "data-structures oop leadership stakeholder roadmap kpi okr seo marketing crm salesforce figma ux ui accessibility " +
    "communication collaboration mentoring"
  ).split(" ")
);

// Multi-word terms worth keeping as a single keyword. Bigrams outside this list are ignored,
// because adjacent words in a skills list ("Docker PostgreSQL") are not real phrases.
const KNOWN_PHRASES = new Set(
  (
    "machine learning|deep learning|data science|data structures|data analysis|data engineering|rest api|rest apis|" +
    "version control|unit testing|system design|natural language|computer vision|project management|product management|" +
    "cloud computing|software development|web development|open source|problem solving|user experience|" +
    "continuous integration|continuous deployment|test automation|big data|neural networks"
  ).split("|")
);

export function tokenize(text: string): string[] {
  // Keep "CI/CD" and "I/O"-style compounds as one token instead of splitting on the slash.
  const normalised = text.toLowerCase().replace(/\bci\s*\/\s*cd\b/g, "cicd");
  return (normalised.match(/[a-z0-9][a-z0-9+#.\-]*[a-z0-9+#]|[a-z0-9]/g) || []).map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""));
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) || []).length;
}

// Very small suffix-stripping stemmer: enough to match "deploying"/"deployed"/"deploys".
export function stem(token: string): string {
  let t = token;
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
  else if (t.length > 4 && t.endsWith("es")) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return t;
}

function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t) && t.length > 1);
}

// ---------------------------------------------------------------- fillers & hedges

// Single-token disfluencies plus discourse fillers. Note: Chrome's speech recogniser often
// strips "um"/"uh" before we ever see them, so measured filler counts are a *lower bound*.
const FILLER_PATTERNS: [string, RegExp][] = [
  ["um / uh / er", /\b(?:um+|uh+|er+m?|hmm+|ah+)\b/g],
  ["you know", /\byou know\b/g],
  ["i mean", /\bi mean\b/g],
  ["basically", /\bbasically\b/g],
  ["actually", /\bactually\b/g],
  ["literally", /\bliterally\b/g],
  ["honestly", /\bhonestly\b/g],
  ["like (filler)", /(?:,|\b(?:was|is|it's|so|and|but)) like,?(?= )/g],
  ["sort of / kind of", /\b(?:sort|kind) of\b/g],
  ["so yeah", /\bso yeah\b|\band stuff\b|\bor something\b/g],
];

const HEDGE_PATTERNS: RegExp[] = [
  /\bi think\b/g,
  /\bi guess\b/g,
  /\bi believe\b/g,
  /\bmaybe\b/g,
  /\bprobably\b/g,
  /\bperhaps\b/g,
  /\bnot sure\b/g,
  /\bi don'?t know\b/g,
  /\bsomehow\b/g,
];

function countMatches(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, re.flags)) || []).length;
}

export interface FillerReport {
  fillerCount: number;
  hedgeCount: number;
  topFillers: { word: string; count: number }[];
}

export function analyzeFillers(text: string): FillerReport {
  const lower = text.toLowerCase();
  const found = FILLER_PATTERNS.map(([word, re]) => ({ word, count: countMatches(lower, re) })).filter((f) => f.count > 0);
  const hedgeCount = HEDGE_PATTERNS.reduce((s, re) => s + countMatches(lower, re), 0);
  return {
    fillerCount: found.reduce((s, f) => s + f.count, 0),
    hedgeCount,
    topFillers: found.sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

// ---------------------------------------------------------------- lexical diversity

// Moving-Average Type-Token Ratio: unique words / window size, averaged over sliding windows.
// Unlike plain TTR it is not distorted by answer length. 0..1, higher = richer vocabulary.
export function lexicalDiversity(text: string, window = 50): number {
  const toks = tokenize(text);
  if (toks.length === 0) return 0;
  if (toks.length <= window) return new Set(toks).size / toks.length;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + window <= toks.length; i += 5) {
    sum += new Set(toks.slice(i, i + window)).size / window;
    n++;
  }
  return sum / n;
}

// ---------------------------------------------------------------- STAR detection

export interface StarDetection {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
  hasMetric: boolean;
  componentsFound: number; // 0-4
}

const STAR_CUES = {
  situation: [
    /\b(?:when|while|during|last (?:year|semester|summer)|at my|in my|in (?:my )?(?:previous|last|current)|previously|at (?:the )?(?:time|company|university|college|internship))\b/,
    /\b(?:our team|the team|the project|a project|an internship|the company|my (?:team|manager|company|internship|project))\b/,
    /\b(?:was working|were working|we were|there was|the situation|the context|faced with)\b/,
  ],
  task: [
    /\b(?:i was (?:responsible|tasked|assigned|asked)|my (?:role|task|goal|job|responsibility)|the goal|the objective|i needed to|i had to|we needed to|we had to|aimed to|the challenge)\b/,
  ],
  action: [
    /\bi (?:[a-z]{3,}ed|built|led|wrote|made|ran|took|chose|began|found|set up|drove|gave|got|taught|spoke|thought)\b/,
  ],
  result: [
    /\b(?:as a result|resulted in|the result|the outcome|ended up|in the end|which (?:led|improved|reduced|increased)|improved|increased|reduced|decreased|saved|achieved|delivered|boosted|cut|grew|launched|shipped|won|learned|impact)\b/,
  ],
};

const METRIC_RE = /\b\d+(?:\.\d+)?\s?(?:%|percent|x|times|hours?|days?|weeks?|months?|users?|customers?|ms|seconds?|k|million|thousand)\b|\b\d{2,}\b/;

export function detectStar(text: string): StarDetection {
  const t = text.toLowerCase();
  const has = (res: RegExp[]) => res.some((r) => r.test(t));
  const situation = has(STAR_CUES.situation);
  const task = has(STAR_CUES.task);
  const action = has(STAR_CUES.action);
  const result = has(STAR_CUES.result);
  return {
    situation,
    task,
    action,
    result,
    hasMetric: METRIC_RE.test(t),
    componentsFound: [situation, task, action, result].filter(Boolean).length,
  };
}

// ---------------------------------------------------------------- TF-IDF & keywords

export type IdfMap = Map<string, number>;

// Smoothed inverse document frequency over a background corpus. We use the interview
// knowledge base as the corpus, so words that appear in every document get low weight.
export function buildIdf(docs: string[]): IdfMap {
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const t of new Set(contentTokens(d).map(stem))) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = docs.length;
  const idf: IdfMap = new Map();
  df.forEach((c, t) => idf.set(t, Math.log((n + 1) / (c + 1)) + 1));
  return idf;
}

function idfOf(idf: IdfMap, stemmed: string): number {
  // Unseen terms are rare in the background corpus → highest weight.
  return idf.get(stemmed) ?? Math.log(idf.size > 0 ? 200 : 2) + 1;
}

// Top-N keywords/skills from a job description: unigrams + bigrams scored by TF × IDF,
// boosted when they are known technical/professional terms.
export function extractKeywords(text: string, idf: IdfMap, topN = 20): string[] {
  const toks = tokenize(text);
  const scores = new Map<string, number>();
  const add = (phrase: string, stems: string[], boost: number) => {
    const w = stems.reduce((s, st) => s + idfOf(idf, st), 0) / stems.length;
    scores.set(phrase, (scores.get(phrase) || 0) + w * boost);
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (STOPWORDS.has(t) || JD_GENERIC.has(t) || /^\d+$/.test(t) || t.length < 2) continue;
    add(t, [stem(t)], TECH_VOCAB.has(t) ? 2.2 : 1);

    const n = toks[i + 1];
    if (n && !STOPWORDS.has(n) && !JD_GENERIC.has(n) && !/^\d+$/.test(n) && n.length > 1) {
      const techBigram = KNOWN_PHRASES.has(`${t} ${n}`);
      if (techBigram) add(`${t} ${n}`, [stem(t), stem(n)], 1.6);
    }
  }

  // Drop terms that occur once and are not technical — they are usually incidental words.
  const counts = new Map<string, number>();
  for (const t of toks) counts.set(t, (counts.get(t) || 0) + 1);

  const ranked = [...scores.entries()]
    .filter(([p]) => {
      const parts = p.split(" ");
      return parts.some((w) => TECH_VOCAB.has(w)) || (counts.get(parts[0]) || 0) >= 2;
    })
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);

  const out: string[] = [];
  for (const p of ranked) {
    if (out.length >= topN) break;
    // Skip a unigram already covered by a chosen bigram (e.g. "machine" when "machine learning" chosen).
    if (!p.includes(" ") && out.some((o) => o.split(" ").includes(p))) continue;
    out.push(p);
  }
  return out;
}

// Does the text contain every word of the keyword (by stem)? Order-independent.
export function textHasKeyword(textStems: Set<string>, keyword: string): boolean {
  return keyword
    .split(" ")
    .every((w) => textStems.has(stem(w)));
}

export function stemSet(text: string): Set<string> {
  return new Set(tokenize(text).map(stem));
}

export interface KeywordCoverage {
  score: number; // 0-100
  matched: string[];
  missing: string[];
}

export function keywordCoverage(keywords: string[], text: string): KeywordCoverage {
  const stems = stemSet(text);
  const matched = keywords.filter((k) => textHasKeyword(stems, k));
  const missing = keywords.filter((k) => !matched.includes(k));
  return {
    score: keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0,
    matched,
    missing,
  };
}

// ---------------------------------------------------------------- lexical similarity

function tfVector(text: string, idf?: IdfMap): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of contentTokens(text).map(stem)) v.set(t, (v.get(t) || 0) + 1);
  if (idf) v.forEach((c, t) => v.set(t, c * idfOf(idf, t)));
  return v;
}

// Cosine similarity of TF(-IDF) bag-of-words vectors. Used on its own when the embedding
// model is unavailable, and blended with dense similarity during retrieval (hybrid search).
export function tfCosine(a: string, b: string, idf?: IdfMap): number {
  const va = tfVector(a, idf);
  const vb = tfVector(b, idf);
  let dot = 0;
  va.forEach((w, t) => {
    const o = vb.get(t);
    if (o) dot += w * o;
  });
  let na = 0;
  let nb = 0;
  va.forEach((w) => (na += w * w));
  vb.forEach((w) => (nb += w * w));
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Fraction of the tokens in `evidence` that also appear in `source` (by stem).
// Used to verify that a quote the LLM attributes to the candidate is really in the transcript.
export function tokenOverlap(evidence: string, source: string): number {
  const ev = contentTokens(evidence).map(stem);
  if (ev.length === 0) return 0;
  const src = stemSet(source);
  return ev.filter((t) => src.has(t)).length / ev.length;
}
