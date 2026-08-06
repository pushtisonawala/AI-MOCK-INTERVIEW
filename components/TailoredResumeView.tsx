import { TailoredResume } from "@/lib/types";

export default function TailoredResumeView({ resume }: { resume: TailoredResume }) {
  return (
    <>
      {resume.atsMatch && <AtsMeter atsMatch={resume.atsMatch} />}

      {resume.contact && (resume.contact.name || resume.contact.email || resume.contact.phone) && (
        <div className="mb-4 border-b border-slate-800/80 pb-4">
          {resume.contact.name && <p className="text-base font-semibold text-slate-100">{resume.contact.name}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {[resume.contact.email, resume.contact.phone, resume.contact.location, ...(resume.contact.links || [])]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        </div>
      )}

      <p className="mb-4 text-sm italic text-slate-400">{resume.summary}</p>

      {resume.sections.map((s, i) => (
        <div key={i} className="mb-4">
          <h3 className="mb-2 font-medium text-slate-200">{s.heading}</h3>
          {s.entries && s.entries.length > 0 ? (
            <div className="space-y-3">
              {s.entries.map((entry, ei) => (
                <div key={ei}>
                  <p className="text-sm font-medium text-slate-300">{entry.subheading}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-400">
                    {entry.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
              {(s.bullets || []).map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {resume.keywordsAligned?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {resume.keywordsAligned.map((k, i) => (
            <span key={i} className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
              {k}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function AtsMeter({ atsMatch }: { atsMatch: NonNullable<TailoredResume["atsMatch"]> }) {
  const score = Math.max(0, Math.min(100, atsMatch.score));
  const color = score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";
  const textColor = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">ATS keyword match</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        How much of the job description&apos;s key skills and keywords your original resume already covers.
      </p>

      {(atsMatch.matchedKeywords?.length > 0 || atsMatch.missingKeywords?.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {atsMatch.matchedKeywords?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-emerald-400">Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {atsMatch.matchedKeywords.map((k, i) => (
                  <span key={i} className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
          {atsMatch.missingKeywords?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-rose-400">Gaps to address</p>
              <div className="flex flex-wrap gap-1.5">
                {atsMatch.missingKeywords.map((k, i) => (
                  <span key={i} className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs text-rose-300">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
