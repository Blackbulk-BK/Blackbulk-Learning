import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuizRunner, { type Attempt, type PublicQuiz } from "@/components/QuizRunner";

export default async function QuizPage({
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

  const { data: latest } = await supabase
    .from("quizzes")
    .select("id, title, questions")
    .eq("notebook_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Strip the answers before sending the quiz to the browser
  const initialQuiz: PublicQuiz | null = latest
    ? {
        id: latest.id,
        title: latest.title,
        questions: (latest.questions as { question: string; options: string[] }[]).map((q) => ({
          question: q.question,
          options: q.options,
        })),
      }
    : null;

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, total, created_at")
    .eq("notebook_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="space-y-2">
        <Link href={`/notebook/${id}`} className="text-sm underline">
          ← Back to {notebook.title}
        </Link>
        <h1 className="text-2xl font-bold">Quizzes</h1>
      </div>

      <QuizRunner
        notebookId={id}
        initialQuiz={initialQuiz}
        attempts={(attempts ?? []) as Attempt[]}
      />
    </main>
  );
}