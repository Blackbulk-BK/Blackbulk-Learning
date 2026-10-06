"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { indexSource } from "@/lib/indexSource";

export default function FileUploader({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      return setStatus("Only PDF files for now.");
    }

    setBusy(true);
    setProgress(null);
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
      router.refresh();

      setStatus("Uploading...");
      const path = `${user!.id}/${notebookId}/${source.id}.pdf`;
      const { error: upError } = await supabase.storage
        .from("sources")
        .upload(path, file, { contentType: "application/pdf" });
      if (upError) throw new Error(upError.message);

      await supabase.from("sources").update({ storage_path: path }).eq("id", source.id);

      await indexSource(source.id, (done, total, message) => {
        setStatus(message);
        if (total > 0) setProgress({ done, total });
      });

      setStatus("Done! Your PDF is ready to use.");
    } catch (err) {
      setStatus(
        (err instanceof Error ? err.message : "Something went wrong") +
          " You can resume from the sources list below."
      );
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-gray-400 p-4">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        disabled={busy}
      />
      {status && <p className="text-sm">{status}</p>}
      {progress && busy && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-gray-500/20">
            <div className="h-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs opacity-60">
            {progress.done} of {progress.total} sections indexed. Keep this tab open.
          </p>
        </div>
      )}
    </div>
  );
}