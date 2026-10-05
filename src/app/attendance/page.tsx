import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudentQR from "@/components/StudentQR";
import AttendanceTeacher, { type ClassInfo } from "@/components/AttendanceTeacher";

export default async function AttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isTeacher = profile?.role === "teacher";

  if (isTeacher) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    const ids = (classes ?? []).map((c) => c.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: members } = await supabase
        .from("class_members")
        .select("class_id")
        .in("class_id", ids);
      (members ?? []).forEach((m) => counts.set(m.class_id, (counts.get(m.class_id) ?? 0) + 1));
    }

    const list: ClassInfo[] = (classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      students: counts.get(c.id) ?? 0,
    }));

    return (
      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <div className="space-y-2">
          <Link href="/dashboard" className="text-sm underline">
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm opacity-70">
            Start a session, then scan each student&apos;s QR code with the camera.
          </p>
        </div>
        <AttendanceTeacher classes={list} />
      </main>
    );
  }

  const { data: history } = await supabase
    .from("attendance_records")
    .select("scanned_at, attendance_sessions(title)")
    .eq("student_id", user.id)
    .order("scanned_at", { ascending: false })
    .limit(10);

  type Row = { scanned_at: string; attendance_sessions: { title: string } | null };
  const rows = (history ?? []) as unknown as Row[];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold">My attendance code</h1>
      </div>

      <StudentQR />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recent check-ins</h2>
        <ul className="space-y-1 text-sm">
          {rows.length === 0 && <li className="opacity-70">No check-ins yet.</li>}
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between rounded border border-gray-300 p-2">
              <span>{r.attendance_sessions?.title ?? "Session"}</span>
              <span className="opacity-60">{new Date(r.scanned_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}