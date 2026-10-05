import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateGroupForm, JoinGroupForm } from "@/components/GroupForms";

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groups } = await supabase
    .from("study_groups")
    .select("id, name, owner_id")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold">Study groups</h1>
        <p className="text-sm opacity-70">
          Share your notebooks with friends. Members can read and study from them, but can&apos;t
          change them.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Join with a code</h2>
        <JoinGroupForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Start a group</h2>
        <CreateGroupForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My groups</h2>
        <ul className="space-y-2">
          {(groups ?? []).length === 0 && (
            <li className="text-sm opacity-70">You&apos;re not in any groups yet.</li>
          )}
          {(groups ?? []).map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between rounded border border-gray-300 p-3 hover:bg-gray-500/10"
              >
                <span>{g.name}</span>
                {g.owner_id === user.id && <span className="text-xs opacity-60">Owner</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}