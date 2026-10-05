import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateClassForm from "@/components/CreateClassForm";

export default async function TeacherPage() {
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

  if (profile?.role !== "teacher") {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-bold">Teachers only</h1>
        <p className="text-sm opacity-70">
          This page is for teacher accounts. Ask an admin to change your role.
        </p>
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, join_code, notebook_id")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const classIds = (classes ?? []).map((c) => c.id);

  let members: { class_id: string; student_id: string }[] = [];
  let profiles: { id: string; email: string | null; full_name: string | null }[] = [];

  if (classIds.length > 0) {
    const { data } = await supabase
      .from("class_members")
      .select("class_id, student_id")
      .in("class_id", classIds);
    members = data ?? [];

    const studentIds = [...new Set(members.map((m) => m.student_id))];
    if (studentIds.length > 0) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", studentIds);
      profiles = p ?? [];
    }
  }

  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "Student";
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold">Teacher dashboard</h1>
        <p className="text-sm opacity-70">
          Create a class, upload your materials, and share the join code with students.
        </p>
      </div>

      <CreateClassForm />

      {(classes ?? []).length === 0 && (
        <p className="opacity-70">No classes yet. Create your first one above.</p>
      )}

      {(classes ?? []).map((c) => {
        const students = members.filter((m) => m.class_id === c.id);
        return (
          <section key={c.id} className="space-y-3 rounded-xl border border-gray-300 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="text-sm opacity-70">
                  {students.length} student{students.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase opacity-60">Join code</p>
                <p className="font-mono text-2xl font-bold tracking-widest">{c.join_code}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/notebook/${c.notebook_id}`}
                className="rounded border border-gray-300 p-2 text-center text-sm hover:bg-gray-500/10"
              >
                Class materials
              </Link>
              <Link
                href={`/teacher/class/${c.id}`}
                className="rounded border border-blue-400/60 bg-blue-500/10 p-2 text-center text-sm hover:bg-blue-500/20"
              >
                View analytics
              </Link>
            </div>

            {students.length > 0 && (
              <ul className="space-y-1 text-sm">
                {students.map((s) => (
                  <li key={s.student_id} className="rounded border border-gray-300 p-2">
                    {nameOf(s.student_id)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}