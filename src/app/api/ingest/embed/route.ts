import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ai } from "@/lib/gemini";

const BATCH = parseInt(process.env.INGEST_BATCH || "20");
const PAUSE_MS = parseInt(process.env.INGEST_PAUSE_MS || "14000");

function retryAfterSeconds(msg: string) {
  const m = msg.match(/retry in ([\d.]+)s/i) || msg.match(/retryDelay"?:\s*"(\d+)s"/i);
  const s = m ? Math.ceil(parseFloat(m[1])) + 2 : 30;
  return Math.min(Math.max(s, 5), 60);
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
    .select("id, owner_id")
    .eq("id", sourceId)
    .single();
  if (!source || source.owner_id !== user.id) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const { data: pending } = await supabase
    .from("chunks")
    .select("id, content")
    .eq("source_id", sourceId)
    .is("embedding", null)
    .order("page")
    .order("char_start")
    .limit(BATCH);

  if (!pending || pending.length === 0) {
    await supabase.from("sources").update({ status: "ready" }).eq("id", sourceId);
    return NextResponse.json({ remaining: 0, pauseMs: 0 });
  }

  try {
    const res = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: pending.map((c) => c.content),
      config: { outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT" },
    });
    const vectors = (res.embeddings ?? []).map((e) => e.values!);
    if (vectors.length !== pending.length) throw new Error("Embedding result was incomplete");

    await Promise.all(
      pending.map(async (c, i) => {
        const { error } = await supabase
          .from("chunks")
          .update({ embedding: vectors[i] })
          .eq("id", c.id);
        if (error) throw new Error(error.message);
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/.test(msg)) {
      // Not a failure: the browser waits and tries again from the same place
      return NextResponse.json(
        { error: "Gemini asked us to slow down", retryAfter: retryAfterSeconds(msg) },
        { status: 429 }
      );
    }
    await supabase.from("sources").update({ status: "failed" }).eq("id", sourceId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { count } = await supabase
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .is("embedding", null);
  const remaining = count ?? 0;

  if (remaining === 0) {
    await supabase.from("sources").update({ status: "ready" }).eq("id", sourceId);
  }
  return NextResponse.json({ remaining, pauseMs: remaining > 0 ? PAUSE_MS : 0 });
}