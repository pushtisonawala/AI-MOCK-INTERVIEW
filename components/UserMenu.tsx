"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";

export default function UserMenu({ email }: { email: string | null }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!email) {
    return (
      <Link href="/login" className="btn-secondary text-sm">
        <LogIn size={15} /> Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard" className="btn-secondary text-sm">
        <LayoutDashboard size={15} /> My Interviews
      </Link>
      <span className="hidden max-w-[140px] truncate text-xs text-slate-500 sm:inline">{email}</span>
      <button onClick={handleSignOut} className="btn-secondary text-sm" title="Sign out">
        <LogOut size={15} />
      </button>
    </div>
  );
}
