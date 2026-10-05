import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewNotebookForm from "@/components/NewNotebookForm";
import JoinClassForm from "@/components/JoinClassForm";

type Membership = {
  classes: { id: string; name: string; notebook_id: string } | null;
};

export default async function DashboardPage() {
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

  // Class notebooks owned by this user (teachers) are managed from the teacher page
  const { data: taught } = await supabase
    .from("classes")
    .select("notebook_id")
    .eq("teacher_id", user.id);
  const classNotebookIds = new Set((taught ?? []).map((c) => c.notebook_id));

  const { data: ownNotebooks } = await supabase
    .from("notebooks")
    .select("id, title, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  const notebooks = (ownNotebooks ?? []).filter((n) => !classNotebookIds.has(n.id));

  const { data: memberships } = await supabase
    .from("class_members")
    .select("classes(id, name, notebook_id)")
    .eq("student_id", user.id);
  const myClasses = ((memberships ?? []) as unknown as Membership[])
    .map((m) => m.classes)
    .filter((c): c is NonNullable<Membership["classes"]> => c !== null);

  const isTeacher = profile?.role === "teacher";

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm opacity-70">
            {user.email} · {profile?.role ?? "unknown"}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            const supabase = await createClient();
            await supabase.auth.signOut();
            redirect("/login");
          }}
        >
          <button className="rounded border border-gray-300 px-3 py-1">Sign out</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-2"><Link href="/groups" className="rounded border border-gray-300 p-3 text-center hover:bg-gray-500/10">Study groups</Link><Link href="/attendance" className="rounded border border-gray-300 p-3 text-center hover:bg-gray-500/10">Attendance</Link></div>

      {isTeacher && (
        <Link
          href="/teacher"
          className="block rounded border border-blue-400/60 bg-blue-500/10 p-3 text-center hover:bg-blue-500/20"
        >
          Open teacher dashboard (classes and materials)
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My classes</h2>
        <JoinClassForm />
        <ul className="space-y-2">
          {myClasses.length === 0 && (
            <li className="text-sm opacity-70">
              You haven&apos;t joined a class yet. Enter the code from your teacher above.
            </li>
          )}
          {myClasses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/notebook/${c.notebook_id}`}
                className="block rounded border border-gray-300 p-3 hover:bg-gray-500/10"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My notebooks</h2>
        <NewNotebookForm />
        <ul className="space-y-2">
          {notebooks.length === 0 && (
            <li className="text-sm opacity-70">No notebooks yet. Create your first one above.</li>
          )}
          {notebooks.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notebook/${n.id}`}
                className="block rounded border border-gray-300 p-3 hover:bg-gray-500/10"
              >
                {n.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}