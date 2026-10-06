"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { indexSource } from "@/lib/indexSource";

type Src = { id: string; title: string; status: string; storage_path: string | null };

export default function SourceList({
  sources,
  isOwner,
}: {
  sources: Src[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; message: string } | null>(null);
  const [error, setError] = useState("");

  async function resume(id: string) {
    setBusyId(id);
    setError("");
    setProgress(null);
    try {
      await indexSource(id, (done, total, message) => setProgress({ done, total, message }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setBusyId(null);
      setProgress(null);
      router.refresh();
    }
  }

  async function remove(s: Src) {
    if (!confirm(`Remove "${s.title}"? Its indexed content will be deleted too.`)) return;
    if (s.storage_path) await supabase.storage.from("sources").remove([s.storage_path]);
    const { error } = await supabase.from("sources").delete().eq("id", s.id);
    if (error) setError(error.message);
    router.refresh();
  }

  if (sources.length === 0) {
    return <p className="text-sm opacity-70">No materials uploaded yet.</p>;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-sm">
        {sources.map((s) => {
          const needsWork = s.status !== "ready";
          const working = busyId === s.id;
          const pct =
            working && progress && progress.total > 0
              ? Math.round((progress.done / progress.total) * 100)
              : 0;
          return (
            <li key={s.id} className="space-y-1 rounded border border-gray-300 p-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{s.title}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="opacity-70">{s.status}</span>
                  {isOwner && needsWork && !working && (
                    <button
                      onClick={() => resume(s.id)}
                      disabled={busyId !== null}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs disabled:opacity-50"
                    >
                      Resume indexing
                    </button>
                  )}
                  {isOwner && !working && (
                    <button
                      onClick={() => remove(s)}
                      disabled={busyId !== null}
                      className="text-xs text-red-400 underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </span>
              </div>
              {working && progress && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded bg-gray-500/20">
                    <div className="h-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs opacity-60">
                    {progress.message}
                    {progress.total > 0 ? ` ${progress.done} of ${progress.total}` : ""}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}