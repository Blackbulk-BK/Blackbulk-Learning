import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithRetry, MODEL } from "@/lib/gemini";

type Q = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  page: number | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { notebookId, count } = await req.json();
  const n = Math.min(Math.max(parseInt(count) || 5, 3), 10);

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", notebookId)
    .single();
  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 });

  try {
    const { data: chunks } = await supabase
      .from("chunks")
      .select("content, page")
      .eq("notebook_id", notebookId)
      .order("source_id")
      .order("page")
      .limit(400);

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: "No indexed sources yet. Upload a PDF first." },
        { status: 400 }
      );
    }

    // Sample across the material, with a random start so each quiz differs
    const step = Math.max(1, Math.floor(chunks.length / 20));
    const offset = Math.floor(Math.random() * step);
    const sample = chunks.filter((_, i) => i % step === offset).slice(0, 20);
    const sourceBlock = sample
      .map((c) => `(page ${c.page ?? "?"}) ${c.content}`)
      .join("\n\n");

    const prompt = `Create ${n} multiple-choice quiz questions from the SOURCES below.
Rules:
- Use ONLY the sources. Never add outside knowledge.
- Each question has exactly 4 options. Only one is correct. Wrong options must be believable but clearly wrong according to the sources.
- Test understanding of different ideas, not trivia.
- "correct" is the index (0 to 3) of the right option.
- "explanation" is 1 or 2 sentences on why the answer is right.
- "page" is the page number the answer came from.
- Plain text only, no markdown symbols.

Return ONLY a JSON array, with no other text, in this shape:
[{"question": "...", "options": ["...", "...", "...", "..."], "correct": 0, "explanation": "...", "page": 12}]

SOURCES:
${sourceBlock}`;

    const response = await generateWithRetry({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const raw = (response.text ?? "").replace(/```json|```/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("The AI returned an unreadable result. Please try again.");
    }
    if (!Array.isArray(parsed)) throw new Error("Unexpected AI response. Please try again.");

    const questions: Q[] = [];
    for (const item of parsed) {
      const ok =
        item &&
        typeof item.question === "string" &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        item.options.every((o: unknown) => typeof o === "string") &&
        Number.isInteger(item.correct) &&
        item.correct >= 0 &&
        item.correct <= 3;
      if (!ok) continue;

      // Shuffle options so the right answer isn't always in the same spot
      const correctText = item.options[item.correct];
      const options = shuffle<string>(item.options);
      questions.push({
        question: item.question.trim(),
        options,
        correct: options.indexOf(correctText),
        explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
        page: Number.isInteger(item.page) ? item.page : null,
      });
    }
    if (questions.length === 0) throw new Error("No questions were generated. Please try again.");

    const title = `Quiz ${new Date().toISOString().slice(0, 10)}`;
    const { data: quiz, error } = await supabase
      .from("quizzes")
      .insert({ notebook_id: notebookId, owner_id: user.id, title, questions })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Send questions WITHOUT the answers
    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title,
        questions: questions.map((q) => ({ question: q.question, options: q.options })),
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Generation failed";
    const message = /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED/.test(raw)
      ? "The AI is busy right now. Please try again in a moment."
      : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}