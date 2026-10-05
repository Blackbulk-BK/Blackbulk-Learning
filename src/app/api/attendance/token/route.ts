import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeToken } from "@/lib/attendanceToken";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    return NextResponse.json(
      { token: makeToken(user.id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}