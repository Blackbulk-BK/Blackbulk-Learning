import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Analytics = {
  summary: { students: number; attempts: number; avg_pct: number | null };
  students: {
    id: string;
    name: string;
    attempts: number;
    avg_pct: number | null;
    last_attempt: string | null;
  }[];
  pages: { page: number; answered: number; wrong: number }[];
  questions: { question: string; answered: number; wrong: number }[];
};

function scoreColor(pct: number | null) {
  if (pct === null) return "";
  if (pct < 60) return "text-red-400";
  if (pct < 80) return "text-yellow-400";
  return "text-green-400";
}

export default async function ClassAnalyticsPage({
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

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, notebook_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();
  if (!cls) notFound();

  const { data, error } = await supabase.rpc("class_analytics", { cid: id });
  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <Link href="/teacher" className="text-sm underline">
          ← Back to teacher dashboard
        </Link>
        <p className="text-sm text-red-500">
          Could not load analytics: {error?.message ?? "no data"}
        </p>
      </main>
    );
  }
  const a = data as Analytics;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <Link href="/teacher" className="text-sm underline">
          ← Back to teacher dashboard
        </Link>
        <h1 className="text-2xl font-bold">{cls.name}: analytics</h1>
        <p className="text-sm opacity-70">
          Based on quiz attempts on this class&apos;s materials. Chats and flashcards stay private.
        </p>
      </div>

      <section className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-gray-300 p-4">
          <p className="text-2xl font-bold">{a.summary.students}</p>
          <p className="text-xs opacity-70">Students</p>
        </div>
        <div className="rounded-xl border border-gray-300 p-4">
          <p className="text-2xl font-bold">{a.summary.attempts}</p>
          <p className="text-xs opacity-70">Quiz attempts</p>
        </div>
        <div className="rounded-xl border border-gray-300 p-4">
          <p className={`text-2xl font-bold ${scoreColor(a.summary.avg_pct)}`}>
            {a.summary.avg_pct === null ? "-" : `${a.summary.avg_pct}%`}
          </p>
          <p className="text-xs opacity-70">Class average</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Students</h2>
        {a.students.length === 0 && (
          <p className="text-sm opacity-70">No students have joined yet.</p>
        )}
        <ul className="space-y-1 text-sm">
          {a.students.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded border border-gray-300 p-2"
            >
              <span>{s.name}</span>
              {s.attempts === 0 ? (
                <span className="opacity-60">No quizzes yet</span>
              ) : (
                <span className="text-right">
                  <span className={`font-semibold ${scoreColor(s.avg_pct)}`}>{s.avg_pct}%</span>
                  <span className="opacity-60">
                    {" "}
                    · {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                    {s.last_attempt
                      ? ` · last ${new Date(s.last_attempt).toLocaleDateString()}`
                      : ""}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pages students struggle with</h2>
        {a.pages.length === 0 ? (
          <p className="text-sm opacity-70">
            No quiz data yet. This fills in once students take quizzes.
          </p>
        ) : (
          <ul className="space-y-2">
            {a.pages.map((p) => {
              const pct = Math.round((p.wrong / p.answered) * 100);
              return (
                <li key={p.page} className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Page {p.page}</span>
                    <span className="opacity-70">
                      {p.wrong} of {p.answered} answers wrong ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-gray-500/20">
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Most-missed questions</h2>
        {a.questions.length === 0 ? (
          <p className="text-sm opacity-70">No missed questions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {a.questions.map((q, i) => (
              <li key={i} className="rounded border border-gray-300 p-3">
                <p>{q.question}</p>
                <p className="mt-1 text-xs opacity-60">
                  Missed {q.wrong} of {q.answered} times
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/notebook/${cls.notebook_id}`}
        className="block rounded border border-gray-300 p-2 text-center text-sm hover:bg-gray-500/10"
      >
        Open class materials
      </Link>
    </main>
  );
}