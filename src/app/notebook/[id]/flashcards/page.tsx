import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlashcardDeck, { type Card } from "@/components/FlashcardDeck";
import GenerateFlashcards from "@/components/GenerateFlashcards";

export default async function FlashcardsPage({
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

  const { data: due } = await supabase
    .from("flashcards")
    .select("id, front, back, page, ease, interval_days, repetitions")
    .eq("notebook_id", id)
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(50);

  const { count: total } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", id);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="space-y-2">
        <Link href={`/notebook/${id}`} className="text-sm underline">
          ← Back to {notebook.title}
        </Link>
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <p className="text-sm opacity-70">
          {total ?? 0} total · {due?.length ?? 0} due now
        </p>
      </div>

      <GenerateFlashcards notebookId={id} />

      <FlashcardDeck key={due?.map((c) => c.id).join(",")} cards={(due ?? []) as Card[]} />
    </main>
  );
}