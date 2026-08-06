import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SavedInterview } from "@/lib/types";
import FeedbackReportView from "@/components/FeedbackReportView";
import TailoredResumeView from "@/components/TailoredResumeView";
import ShareButton from "@/components/ShareButton";
import { ArrowLeft, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SavedInterviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/dashboard/${params.id}`);
  }

  const { data } = await supabase.from("interviews").select("*").eq("id", params.id).single();

  if (!data) {
    notFound();
  }

  const interview = data as SavedInterview;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft size={15} /> Back to My Interviews
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {interview.role}
            {interview.company ? ` @ ${interview.company}` : ""}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarDays size={13} /> {new Date(interview.created_at).toLocaleString()}
            <span className="capitalize">· {interview.difficulty}</span>
          </p>
        </div>
        <ShareButton interviewId={interview.id} initialIsPublic={interview.is_public} initialShareToken={interview.share_token} />
      </div>

      {interview.feedback && <FeedbackReportView report={interview.feedback} />}

      {interview.tailored_resume && (
        <div className="card mt-8">
          <h2 className="mb-4 text-lg font-semibold">Tailored Resume</h2>
          <TailoredResumeView resume={interview.tailored_resume} />
        </div>
      )}
    </main>
  );
}
