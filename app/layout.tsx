import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StepNav from "@/components/StepNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Mock Interview",
  description:
    "Practice real-time AI-driven mock interviews tailored to any job description, then get feedback and a tailored resume.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <StepNav />
        {children}
      </body>
    </html>
  );
}
