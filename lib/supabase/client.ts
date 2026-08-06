"use client";

import { createBrowserClient } from "@supabase/ssr";

// Used from Client Components (browser). Safe to call anywhere on the client —
// NEXT_PUBLIC_* vars are meant to be exposed to the browser.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.example)."
    );
  }

  return createBrowserClient(url, anonKey);
}
