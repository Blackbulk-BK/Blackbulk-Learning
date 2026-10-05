import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeaveOrDelete, UnshareButton } from "@/components/GroupActions";

type Overview = {
  group: { id: string; name: string; join_code: string; owner_id: string };
  members: { id: string; name: string }[];
  notebooks: { id: string; title: string; owner_id: string; shared_by_name: string }[];
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("group_overview", { gid: id });
  if (error || !data) notFound();
  const g = data as Overview;
  const isOwner = g.group.owner_id === user.id;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <Link href="/groups" className="text-sm underline">
          ← Back to study groups
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{g.group.name}</h1>
          <div className="text-right">
            <p className="text-xs uppercase opacity-60">Join code</p>
            <p className="font-mono text-2xl font-bold tracking-widest">{g.group.join_code}</p>
          </div>
        </div>
        <p className="text-sm opacity-70">Share the code with friends so they can join.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Shared notebooks</h2>
        <ul className="space-y-2">
          {g.notebooks.length === 0 && (
            <li className="text-sm opacity-70">
              Nothing shared yet. Open one of your notebooks and use{" "}
              <span className="font-semibold">Share with a study group</span>.
            </li>
          )}
          {g.notebooks.map((n) => (
            <li
              key={n.id}
              className="flex items-center justify-between gap-3 rounded border border-gray-300 p-3"
            >
              <Link href={`/notebook/${n.id}`} className="flex-1 hover:underline">
                <span className="block">{n.title}</span>
                <span className="block text-xs opacity-60">
                  Shared by {n.owner_id === user.id ? "you" : n.shared_by_name}
                </span>
              </Link>
              {(n.owner_id === user.id || isOwner) && (
                <UnshareButton groupId={g.group.id} notebookId={n.id} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members ({g.members.length})</h2>
        <ul className="space-y-1 text-sm">
          {g.members.map((m) => (
            <li key={m.id} className="flex justify-between rounded border border-gray-300 p-2">
              <span>{m.name}</span>
              {m.id === g.group.owner_id && <span className="opacity-60">Owner</span>}
            </li>
          ))}
        </ul>
      </section>

      <LeaveOrDelete groupId={g.group.id} isOwner={isOwner} />
    </main>
  );
}