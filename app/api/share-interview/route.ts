import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { id, enable } = (await req.json()) as { id: string; enable: boolean };
    if (!id || typeof enable !== "boolean") {
      return NextResponse.json({ error: "id and enable are required" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    // Fetch the existing row (scoped to this user by RLS) so we can reuse an existing
    // share token instead of invalidating a link the owner may have already shared.
    const { data: existing, error: fetchError } = await supabase
      .from("interviews")
      .select("id, share_token, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const shareToken = existing.share_token || randomBytes(16).toString("hex");

    const { error: updateError } = await supabase
      .from("interviews")
      .update({ is_public: enable, share_token: shareToken })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ shareToken, isPublic: enable });
  } catch (err) {
    console.error("share-interview error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
