"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PublicQuestion = { question: string; options: string[] };
export type PublicQuiz = { id: string; title: string; questions: PublicQuestion[] };
export type Attempt = { id: string; score: number; total: number; created_at: string };

type Result = {
  score: number;
  total: number;
  miniLesson: string | null;
  results: {
    question: string;
    options: string[];
    chosen: number;
    correct: number;
    isCorrect: boolean;
    explanation: string;
    page: number | null;
  }[];
};

export default function QuizRunner({
  notebookId,
  initialQuiz,
  attempts,
}: {
  notebookId: string;
  initialQuiz: PublicQuiz | null;
  attempts: Attempt[];
}) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<PublicQuiz | null>(initialQuiz);
  const [answers, setAnswers] = useState<(number | null)[]>(
    initialQuiz ? initialQuiz.questions.map(() => null) : []
  );
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setQuiz(json.quiz);
      setAnswers(json.quiz.questions.map(() => null));
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submit failed");
      setResult(json);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    if (!quiz) return;
    setAnswers(quiz.questions.map(() => null));
    setResult(null);
  }

  const allAnswered = answers.length > 0 && answers.every((a) => a !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-400 p-4">
        <label className="text-sm">Questions:</label>
        <select
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value))}
          className="rounded border border-gray-300 bg-transparent p-1"
        >
          {[5, 10].map((n) => (
            <option key={n} value={n} className="text-black">
              {n}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded bg-black px-4 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy && !result ? "Working..." : quiz ? "New quiz" : "Generate quiz"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!quiz && (
        <p className="text-sm opacity-70">
          No quiz yet. Generate one from your sources to test yourself.
        </p>
      )}

      {quiz && !result && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{quiz.title}</h2>
          {quiz.questions.map((q, qi) => (
            <div key={qi} className="space-y-2 rounded-xl border border-gray-300 p-4">
              <p className="font-medium">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() =>
                      setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))
                    }
                    className={`block w-full rounded border p-2 text-left text-sm ${
                      answers[qi] === oi
                        ? "border-blue-400 bg-blue-500/20"
                        : "border-gray-300 hover:bg-gray-500/10"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submit}
            disabled={!allAnswered || busy}
            className="w-full rounded bg-black p-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {busy ? "Checking your answers..." : "Submit answers"}
          </button>
        </div>
      )}

      {quiz && result && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-300 p-5 text-center">
            <p className="text-3xl font-bold">
              {result.score} / {result.total}
            </p>
            <p className="text-sm opacity-70">
              {result.score === result.total
                ? "Perfect score!"
                : "Review the answers below, then read your mini-lesson."}
            </p>
          </div>

          {result.results.map((r, i) => (
            <div
              key={i}
              className={`space-y-2 rounded-xl border p-4 ${
                r.isCorrect ? "border-green-500/60" : "border-red-500/60"
              }`}
            >
              <p className="font-medium">
                {i + 1}. {r.question}
              </p>
              <p className="text-sm">
                Your answer: {r.options[r.chosen]}{" "}
                <span className={r.isCorrect ? "text-green-500" : "text-red-500"}>
                  {r.isCorrect ? "(correct)" : "(wrong)"}
                </span>
              </p>
              {!r.isCorrect && (
                <p className="text-sm">Correct answer: {r.options[r.correct]}</p>
              )}
              {r.explanation && (
                <p className="text-sm opacity-80">
                  {r.explanation}
                  {r.page ? ` (p. ${r.page})` : ""}
                </p>
              )}
            </div>
          ))}

          {result.miniLesson && (
            <div className="space-y-2 rounded-xl border border-blue-400/60 bg-blue-500/10 p-5">
              <h3 className="font-semibold">Mini-lesson: your weak spots</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {result.miniLesson}
              </p>
            </div>
          )}
          {result.score < result.total && !result.miniLesson && (
            <p className="text-sm opacity-70">
              The mini-lesson could not be generated this time. Try retaking the quiz later.
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={retake} className="flex-1 rounded border border-gray-300 p-2">
              Retake this quiz
            </button>
            <button
              onClick={generate}
              disabled={busy}
              className="flex-1 rounded bg-black p-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              New quiz
            </button>
          </div>
        </div>
      )}

      {attempts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Recent attempts</h3>
          <ul className="space-y-1 text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex justify-between rounded border border-gray-300 p-2">
                <span>{new Date(a.created_at).toLocaleString()}</span>
                <span className="opacity-70">
                  {a.score} / {a.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}