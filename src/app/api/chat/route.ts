import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedTexts, generateWithRetry } from "@/lib/gemini";

const BASE_RULES = `You are Blackbulk Learning, a study tutor.
Rules:
- Use ONLY the numbered SOURCES provided in the message. Never use outside knowledge.
- If the sources do not contain the answer, say so plainly and suggest what the student could upload or ask instead.
- After every claim taken from a source, add its number in square brackets, like [1] or [2]. Use one number per bracket.
- Never invent page numbers, quotes, or facts.
- Keep answers clear and reasonably short.
- Do not use markdown formatting such as ** or *. Write plain sentences and short paragraphs.`;

const SOCRATIC = `${BASE_RULES}

MODE: Socratic tutor.
- Do not give the full answer immediately.
- Share a hint or the relevant idea from the sources (with citations), then ask ONE short guiding question that helps the student work out the answer.
- If the student says they are stuck, don't know, or asks you to just tell them, then explain the answer fully with citations.`;

const DIRECT = `${BASE_RULES}

MODE: Direct answer.
- Answer the question clearly and completely, with citations.`;

type Match = {
  id: string;
  source_id: string;
  content: string;
  page: number | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { notebookId, question, mode } = await req.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", notebookId)
    .single();
  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 });

  try {
    const [queryVector] = await embedTexts([question], "RETRIEVAL_QUERY");
    const { data: matches, error: matchError } = await supabase.rpc("match_chunks", {
      query_embedding: queryVector,
      match_notebook: notebookId,
      match_count: 6,
    });
    if (matchError) throw new Error(matchError.message);

    const chunks = (matches ?? []) as Match[];
    if (chunks.length === 0) {
      return NextResponse.json({
        answer: "This notebook has no indexed sources yet. Upload a PDF first.",
        citations: [],
      });
    }

    const sourceIds = [...new Set(chunks.map((c) => c.source_id))];
    const { data: sources } = await supabase
      .from("sources")
      .select("id, title")
      .in("id", sourceIds);
    const titleById = new Map((sources ?? []).map((s) => [s.id, s.title]));

    const numbered = chunks.map((c, i) => ({
      n: i + 1,
      chunk_id: c.id,
      source_id: c.source_id,
      source_title: titleById.get(c.source_id) ?? "Source",
      page: c.page,
      content: c.content,
    }));

    const sourceBlock = numbered
      .map((c) => `[${c.n}] (${c.source_title}, page ${c.page ?? "?"})\n${c.content}`)
      .join("\n\n");

    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("notebook_id", notebookId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    const past = (history ?? [])
      .reverse()
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    while (past.length && past[0].role === "model") past.shift();

    const response = await generateWithRetry({
      model: "",
      contents: [
        ...past,
        {
          role: "user",
          parts: [{ text: `SOURCES:\n${sourceBlock}\n\nSTUDENT QUESTION:\n${question}` }],
        },
      ],
      config: { systemInstruction: mode === "direct" ? DIRECT : SOCRATIC },
    });

    const answer = response.text ?? "Sorry, I couldn't generate an answer.";

    const used = new Set<number>();
    for (const m of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
      m[1].split(",").forEach((x) => used.add(parseInt(x.trim(), 10)));
    }
    const citations = numbered.filter((c) => used.has(c.n));

    await supabase.from("messages").insert([
      { notebook_id: notebookId, owner_id: user.id, role: "user", content: question, citations: [] },
      { notebook_id: notebookId, owner_id: user.id, role: "assistant", content: answer, citations },
    ]);

    return NextResponse.json({ answer, citations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}