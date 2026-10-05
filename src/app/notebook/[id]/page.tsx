import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FileUploader from "@/components/FileUploader";
import ChatInterface, { type Msg } from "@/components/ChatInterface";

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
    .select("id, title")
    .eq("id", id)
    .single();
  if (!notebook) notFound();

  const { data: sources } = await supabase
    .from("sources")
    .select("id, title, status")
    .eq("notebook_id", id)
    .order("created_at", { ascending: false });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, citations")
    .eq("notebook_id", id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold">{notebook.title}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sources</h2>
        <FileUploader notebookId={id} />
        <ul className="space-y-1 text-sm">
          {sources?.map((s) => (
            <li key={s.id} className="flex justify-between rounded border border-gray-300 p-2">
              <span>{s.title}</span>
              <span className="opacity-70">{s.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <ChatInterface notebookId={id} initialMessages={(messages ?? []) as Msg[]} />
      </section>
    </main>
  );
}