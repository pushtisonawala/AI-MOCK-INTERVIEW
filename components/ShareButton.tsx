"use client";

import { useState } from "react";
import { Share2, Copy, Check, X } from "lucide-react";

export default function ShareButton({
  interviewId,
  initialIsPublic,
  initialShareToken,
}: {
  interviewId: string;
  initialIsPublic: boolean;
  initialShareToken: string | null;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/share/${shareToken}` : "";

  async function toggleShare(enable: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/share-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: interviewId, enable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update sharing");
      setIsPublic(data.isPublic);
      setShareToken(data.shareToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the URL is still visible to copy manually */
    }
  }

  if (!isPublic) {
    return (
      <button onClick={() => toggleShare(true)} disabled={loading} className="btn-secondary text-sm">
        <Share2 size={14} /> {loading ? "Creating link..." : "Share"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
        <span className="max-w-[220px] truncate sm:max-w-[320px]">{shareUrl}</span>
        <button onClick={copyLink} className="shrink-0 text-slate-300 hover:text-white" title="Copy link">
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </div>
      <button
        onClick={() => toggleShare(false)}
        disabled={loading}
        className="shrink-0 text-slate-500 hover:text-rose-400"
        title="Stop sharing"
      >
        <X size={15} />
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
