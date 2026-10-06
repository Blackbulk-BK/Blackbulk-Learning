import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FileUploader from "@/components/FileUploader";
import SourceList from "@/components/SourceList";
import ChatInterface, { type Msg } from "@/components/ChatInterface";
import ShareNotebook from "@/components/ShareNotebook";

export default async function NotebookPage({
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

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id, title, owner_id")
    .eq("id", id)
    .single();
  if (!notebook) notFound();

  const isOwner = notebook.owner_id === user.id;

  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("notebook_id", id)
    .maybeSingle();

  let groups: { id: string; name: string }[] = [];
  if (isOwner && !cls) {
    const { data } = await supabase.from("study_groups").select("id, name");
    groups = data ?? [];
  }

  const { data: sources } = await supabase
    .from("sources")
    .select("id, title, status, storage_path")
    .eq("notebook_id", id)
    .order("created_at", { ascending: false });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, citations")
    .eq("notebook_id", id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const { count: dueCount } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", id)
    .eq("owner_id", user.id)
    .lte("due_at", new Date().toISOString());

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold">{notebook.title}</h1>
        {!isOwner && cls && (
          <p className="text-sm opacity-70">Class materials shared by your teacher.</p>
        )}
        {!isOwner && !cls && (
          <p className="text-sm opacity-70">
            Shared with you through a study group. You can study from it but not change it.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sources</h2>
        {isOwner && <FileUploader notebookId={id} />}
        <SourceList sources={sources ?? []} isOwner={isOwner} />
        {isOwner && !cls && <ShareNotebook notebookId={id} groups={groups} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The Forge</h2>
        <Link
          href={`/notebook/${id}/flashcards`}
          className="flex items-center justify-between rounded border border-gray-300 p-3 hover:bg-gray-500/10"
        >
          <span>Flashcards</span>
          <span className="text-sm opacity-70">{dueCount ?? 0} due</span>
        </Link>
        <Link
          href={`/notebook/${id}/quiz`}
          className="flex items-center justify-between rounded border border-gray-300 p-3 hover:bg-gray-500/10"
        >
          <span>Quizzes</span>
          <span className="text-sm opacity-70">Test yourself</span>
        </Link>
      </section>

      <section>
        <ChatInterface notebookId={id} initialMessages={(messages ?? []) as Msg[]} />
      </section>
    </main>
  );
}