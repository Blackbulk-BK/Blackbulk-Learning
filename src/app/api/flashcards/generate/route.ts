import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithRetry, MODEL } from "@/lib/gemini";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { notebookId, count } = await req.json();
  const n = Math.min(Math.max(parseInt(count) || 10, 1), 20);

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

    // Spread the sample across the whole material (about 24 passages)
    const step = Math.max(1, Math.floor(chunks.length / 24));
    const sample = chunks.filter((_, i) => i % step === 0).slice(0, 24);
    const sourceBlock = sample
      .map((c) => `(page ${c.page ?? "?"}) ${c.content}`)
      .join("\n\n");

    // Avoid repeating cards that already exist
    const { data: existing } = await supabase
      .from("flashcards")
      .select("front")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false })
      .limit(60);
    const existingList = (existing ?? []).map((c) => `- ${c.front}`).join("\n");

    const prompt = `Create ${n} study flashcards from the SOURCES below.
Rules:
- Use ONLY the sources. Never add outside knowledge.
- Each card tests one idea. The front is a clear question or term. The back is a short answer of 1 to 3 sentences.
- Cover different parts of the material.
- Include the page number the answer came from.
- Plain text only, no markdown symbols.
${existingList ? `- Do NOT repeat these existing cards:\n${existingList}\n` : ""}
Return ONLY a JSON array, with no other text, in this shape:
[{"front": "...", "back": "...", "page": 12}]

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

    const rows = parsed
      .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
      .slice(0, n)
      .map((c) => ({
        notebook_id: notebookId,
        owner_id: user.id,
        front: c.front.trim(),
        back: c.back.trim(),
        page: Number.isInteger(c.page) ? c.page : null,
      }));

    if (rows.length === 0) throw new Error("No cards were generated. Please try again.");

    const { error } = await supabase.from("flashcards").insert(rows);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, created: rows.length });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Generation failed";
    const message = /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED/.test(raw)
      ? "The AI is busy right now. Please try again in a moment."
      : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}