import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SavedInterview } from "@/lib/types";
import FeedbackReportView from "@/components/FeedbackReportView";
import TailoredResumeView from "@/components/TailoredResumeView";
import { CalendarDays, Sparkles, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SharedInterviewPage({ params }: { params: { token: string } }) {
  const supabase = createClient();

  const { data } = await supabase
    .from("interviews")
    .select("*")
    .eq("share_token", params.token)
    .eq("is_public", true)
    .single();

  if (!data) {
    notFound();
  }

  const interview = data as SavedInterview;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100">AI Mock Interview</span>
        </Link>
        <span className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-400">
          <Eye size={12} /> Shared read-only view
        </span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {interview.role}
          {interview.company ? ` @ ${interview.company}` : ""}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <CalendarDays size={13} /> {new Date(interview.created_at).toLocaleString()}
          <span className="capitalize">· {interview.difficulty}</span>
        </p>
      </div>

      {interview.feedback && <FeedbackReportView report={interview.feedback} />}

      {interview.tailored_resume && (
        <div className="card mt-8">
          <h2 className="mb-4 text-lg font-semibold">Tailored Resume</h2>
          <TailoredResumeView resume={interview.tailored_resume} />
        </div>
      )}

      <div className="card mt-8 flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-slate-300">Want feedback like this on your own interview prep?</p>
        <Link href="/" className="btn-primary">
          Try AI Mock Interview — it&apos;s free →
        </Link>
      </div>
    </main>
  );
}
