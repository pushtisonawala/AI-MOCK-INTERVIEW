import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StepNav from "@/components/StepNav";
import UserMenu from "@/components/UserMenu";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Mock Interview",
  description:
    "Practice real-time AI-driven mock interviews tailored to any job description, then get feedback and a tailored resume.",
};

async function getUserEmail(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    // Supabase isn't configured yet — the app still works, just without saved history.
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const email = await getUserEmail();

  return (
    <html lang="en">
      <body className={`${inter.className} relative min-h-screen bg-slate-950 text-slate-100`}>
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="animate-float-blob absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div
            className="animate-float-blob absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl"
            style={{ animationDelay: "3s" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(30,41,59,0.4),transparent_60%)]" />
        </div>
        <div className="absolute right-6 top-6 z-10">
          <UserMenu email={email} />
        </div>
        <StepNav />
        {children}
      </body>
    </html>
  );
}
