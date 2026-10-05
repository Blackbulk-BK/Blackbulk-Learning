import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewNotebookForm from "@/components/NewNotebookForm";

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

  const { data: notebooks } = await supabase
    .from("notebooks")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
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
          <button className="rounded border border-gray-300 px-3 py-1">
            Sign out
          </button>
        </form>
      </div>

      <NewNotebookForm />

      <ul className="space-y-2">
        {notebooks?.length === 0 && (
          <li className="opacity-70">No notebooks yet. Create your first one above.</li>
        )}
        {notebooks?.map((n) => (
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
    </main>
  );
}