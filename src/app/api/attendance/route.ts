import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readToken } from "@/lib/attendanceToken";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { sessionId, token } = await req.json();
  if (!sessionId || !token) {
    return NextResponse.json({ error: "Missing session or code" }, { status: 400 });
  }

  let parsed: { studentId: string } | { error: string };
  try {
    parsed = readToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The database function checks that you teach this session and the student is in the class
  const { data, error } = await supabase.rpc("record_attendance", {
    p_session: sessionId,
    p_student: parsed.studentId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data);
}