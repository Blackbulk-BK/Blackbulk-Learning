import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { chunkPages } from "@/lib/chunk";

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
  if (!source || source.owner_id !== user.id) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  if (!source.storage_path) {
    return NextResponse.json(
      { error: "This file never finished uploading. Remove it and upload again." },
      { status: 400 }
    );
  }

  async function counts() {
    const { count: total } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId);
    const { count: remaining } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .is("embedding", null);
    return { total: total ?? 0, remaining: remaining ?? 0 };
  }

  try {
    let c = await counts();

    // Only read and split the PDF if that has not been done yet (this makes resuming cheap)
    if (c.total === 0) {
      await supabase.from("sources").update({ status: "processing" }).eq("id", sourceId);

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

      for (let i = 0; i < chunks.length; i += 100) {
        const rows = chunks.slice(i, i + 100).map((ch) => ({
          source_id: source.id,
          notebook_id: source.notebook_id,
          owner_id: user.id,
          content: ch.content,
          page: ch.page,
          char_start: ch.char_start,
          char_end: ch.char_end,
        }));
        const { error } = await supabase.from("chunks").insert(rows);
        if (error) throw new Error(error.message);
      }
      c = await counts();
    }

    await supabase
      .from("sources")
      .update({ status: c.remaining === 0 ? "ready" : "processing" })
      .eq("id", sourceId);

    return NextResponse.json(c);
  } catch (err) {
    await supabase.from("sources").update({ status: "failed" }).eq("id", sourceId);
    const message = err instanceof Error ? err.message : "Could not read the file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}