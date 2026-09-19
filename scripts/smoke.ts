// Offline smoke test for the non-LLM pipeline (NLP metrics, RAG retrieval, embeddings, ATS).
// Run: npm run smoke
import { extractKeywords, detectStar, analyzeFillers } from "../lib/nlp";
import { backgroundIdf } from "../lib/embeddings";
import { retrieve } from "../lib/rag/retriever";
import { prepareFeedbackContext, finalizeFeedback } from "../lib/analysis";
import { computeAtsMatch } from "../lib/ats";
import type { FeedbackReport, SessionSetup, TranscriptTurn } from "../lib/types";

const JD = `We are hiring a Backend Engineer. You will design REST APIs in Node.js and TypeScript, work with PostgreSQL
and Redis caching, deploy with Docker on AWS, and write automated tests. Experience with microservices, CI/CD and
Kubernetes is a plus. Strong communication and teamwork required.`;
const RESUME = `Pushti Sonawala
Projects
Built an AI mock interview app using Next.js, TypeScript and Supabase (Postgres).
Developed REST endpoints and authentication for a campus placement portal in Node.js.
Containerised services with Docker and set up GitHub Actions pipelines.
Skills: JavaScript, TypeScript, SQL, Git`;

const setup: SessionSetup = { role: "Backend Engineer", jobDescription: JD, resumeText: RESUME, difficulty: "mixed", numQuestions: 3 };
const transcript: TranscriptTurn[] = [
  { role: "ai", text: "Tell me about a time you had to debug a tricky production issue." },
  { role: "user", text: "So basically, at my internship last summer our API was timing out. I was responsible for finding the cause. I added logging, found a missing database index in PostgreSQL, and created it. As a result latency dropped by 60 percent." },
  { role: "ai", text: "How would you design a REST API for a to-do app?" },
  { role: "user", text: "Um, I think maybe you use, like, endpoints? I guess it's sort of standard." },
];

(async () => {
  console.log("KEYWORDS:", extractKeywords(JD, backgroundIdf(), 12));
  console.log("STAR(good answer):", detectStar(transcript[1].text));
  console.log("FILLERS(weak answer):", analyzeFillers(transcript[3].text));

  const t0 = Date.now();
  const r = await retrieve("Backend Engineer REST API PostgreSQL Redis Docker AWS", { k: 4 });
  console.log(`RETRIEVE [${r.method}, ${Date.now() - t0} ms]:`, r.chunks.map((c) => `${c.id} ${c.score.toFixed(2)} ${c.title.slice(0, 50)}`));

  const ats = await computeAtsMatch(JD, RESUME);
  console.log("ATS:", ats);

  const ctx = await prepareFeedbackContext(setup, transcript, [
    { id: "q1", category: "behavioral", text: transcript[0].text },
    { id: "q2", category: "technical", text: transcript[2].text },
  ]);
  console.log("METRICS:", JSON.stringify(ctx.metrics, null, 1));

  const fake: FeedbackReport = {
    overallScore: 70, summary: "", strengths: [], weaknesses: [], starMethodFeedback: "", communicationFeedback: "",
    fillerWordsNote: "", categoryScores: [], actionItems: [], scoreRationale: "x",
    questionReviews: [
      { question: transcript[0].text, category: "behavioral", score: 80, answerEvidence: "our API was timing out, I added logging and found a missing database index", whyThisScore: "", missing: [], idealAnswer: "At my internship our API timed out, so I added logging, found a missing index in PostgreSQL and cut latency by 60 percent.", answerTips: "" },
      { question: transcript[2].text, category: "technical", score: 30, answerEvidence: "I designed a GraphQL federation gateway with Kafka", whyThisScore: "", missing: [], idealAnswer: "I would model resources like /todos with GET, POST, PUT and DELETE, use status codes, pagination and auth.", answerTips: "" },
    ],
  };
  const out = await finalizeFeedback(fake, ctx, setup);
  console.log("REVIEW METRICS:", JSON.stringify(out.questionReviews!.map((q) => ({ q: q.question.slice(0, 30), ...q.metrics, refs: q.references?.map((x) => x.id) })), null, 1));
})();
