import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/gemini";
import { chunkPages } from "@/lib/chunk";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { sourceId } = await req.json();

  // Row-level security guarantees this only finds the user's own source
  const { data: source } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!source?.storage_path) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  await supabase.from("sources").update({ status: "processing" }).eq("id", sourceId);

  try {
    const { data: file, error: dlError } = await supabase.storage
      .from("sources")
      .download(source.storage_path);
    if (dlError || !file) throw new Error("Could not download the file");

    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text: pages } = await extractText(pdf, { mergePages: false });

    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new Error("No text found. This may be a scanned PDF.");
    }

    // Embed and save in batches of 50
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50);
      const vectors = await embedTexts(batch.map((c) => c.content));

      const rows = batch.map((c, j) => ({
        source_id: source.id,
        notebook_id: source.notebook_id,
        owner_id: user.id,
        content: c.content,
        page: c.page,
        char_start: c.char_start,
        char_end: c.char_end,
        embedding: vectors[j],
      }));

      const { error } = await supabase.from("chunks").insert(rows);
      if (error) throw new Error(error.message);
    }

    await supabase.from("sources").update({ status: "ready" }).eq("id", sourceId);
    return NextResponse.json({ ok: true, chunks: chunks.length });
  } catch (err) {
    await supabase.from("sources").update({ status: "failed" }).eq("id", sourceId);
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}