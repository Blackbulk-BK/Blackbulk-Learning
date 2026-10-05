import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedTexts, generateWithRetry, MODEL } from "@/lib/gemini";

type Q = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  page: number | null;
};

type Match = { id: string; content: string; page: number | null };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { quizId, answers } = await req.json();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, notebook_id, questions")
    .eq("id", quizId)
    .single();
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const questions = quiz.questions as Q[];
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return NextResponse.json({ error: "Answer every question first" }, { status: 400 });
  }

  const results = questions.map((q, i) => ({
    question: q.question,
    options: q.options,
    chosen: answers[i] as number,
    correct: q.correct,
    isCorrect: answers[i] === q.correct,
    explanation: q.explanation,
    page: q.page,
  }));
  const score = results.filter((r) => r.isCorrect).length;
  const missed = results.filter((r) => !r.isCorrect);

  // Mini-lesson on the missed concepts (if this fails, the quiz result is still returned)
  let miniLesson: string | null = null;
  if (missed.length > 0) {
    try {
      const vectors = await embedTexts(
        missed.map((m) => m.question),
        "RETRIEVAL_QUERY"
      );

      const seen = new Map<string, Match>();
      for (const v of vectors) {
        const { data } = await supabase.rpc("match_chunks", {
          query_embedding: v,
          match_notebook: quiz.notebook_id,
          match_count: 3,
        });
        ((data ?? []) as Match[]).forEach((c) => seen.set(c.id, c));
      }
      const passages = [...seen.values()]
        .map((c) => `(page ${c.page ?? "?"}) ${c.content}`)
        .join("\n\n");

      const missedText = missed
        .map(
          (m, i) =>
            `${i + 1}. ${m.question}\nStudent answered: ${m.options[m.chosen]}\nCorrect answer: ${m.options[m.correct]}`
        )
        .join("\n\n");

      const prompt = `A student just took a quiz and got these questions wrong:

${missedText}

Write a short mini-lesson (about 200 to 300 words) that teaches the concepts behind these questions, so the student understands why the correct answers are right.
Rules:
- Use ONLY the SOURCES below. Never add outside knowledge.
- Plain text only, no markdown symbols such as ** or *.
- Write short paragraphs, one per concept, starting each with the concept name and a colon.
- Mention page numbers like (p. 12) when using a source.
- End with one practice question for the student to think about.

SOURCES:
${passages}`;

      const response = await generateWithRetry({ model: MODEL, contents: prompt });
      miniLesson = response.text ?? null;
    } catch {
      miniLesson = null;
    }
  }

  await supabase.from("quiz_attempts").insert({
    quiz_id: quiz.id,
    notebook_id: quiz.notebook_id,
    owner_id: user.id,
    score,
    total: questions.length,
    answers,
    missed: missed.map((m) => m.question),
    mini_lesson: miniLesson,
  });

  return NextResponse.json({ score, total: questions.length, results, miniLesson });
}