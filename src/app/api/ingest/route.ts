import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/gemini";
import { chunkPages } from "@/lib/chunk";

const BATCH_SIZE = 40; // free tier allows 100 embedding requests per minute
const PAUSE_MS = 30000; // wait between batches to stay under the limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries when Gemini answers 429, waiting as long as it asks
async function embedWithRetry(texts: string[]) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await embedTexts(texts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const limited = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      if (!limited) throw err;
      const m = msg.match(/retry in ([\d.]+)s/i);
      const wait = m ? Math.ceil(parseFloat(m[1])) * 1000 + 2000 : 45000;
      await sleep(wait);
    }
  }
  throw new Error(
    "Gemini is rate-limiting this key. Wait a few minutes and try again."
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { sourceId } = await req.json();

  const { data: source } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!source?.storage_path) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  await supabase.from("sources").update({ status: "processing" }).eq("id", sourceId);
  // Start clean in case an earlier attempt left partial chunks
  await supabase.from("chunks").delete().eq("source_id", sourceId);

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

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      if (i > 0) await sleep(PAUSE_MS);

      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await embedWithRetry(batch.map((c) => c.content));

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
    await supabase.from("chunks").delete().eq("source_id", sourceId);
    await supabase.from("sources").update({ status: "failed" }).eq("id", sourceId);
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}