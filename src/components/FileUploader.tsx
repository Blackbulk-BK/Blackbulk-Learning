"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FileUploader({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      return setStatus("Only PDF files for now.");
    }

    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setStatus("Creating record...");
      const { data: source, error: srcError } = await supabase
        .from("sources")
        .insert({
          notebook_id: notebookId,
          owner_id: user!.id,
          title: file.name,
          kind: "pdf",
        })
        .select()
        .single();
      if (srcError) throw new Error(srcError.message);

      setStatus("Uploading...");
      const path = `${user!.id}/${notebookId}/${source.id}.pdf`;
      const { error: upError } = await supabase.storage
        .from("sources")
        .upload(path, file, { contentType: "application/pdf" });
      if (upError) throw new Error(upError.message);

      await supabase.from("sources").update({ storage_path: path }).eq("id", source.id);

      setStatus("Reading and indexing (this can take a bit)...");
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ingest failed");

      setStatus(`Done: ${json.chunks} chunks indexed.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-gray-400 p-4">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        disabled={busy}
      />
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}