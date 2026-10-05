"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateFlashcards({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setMessage(`Created ${json.created} new cards.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-400 p-4">
      <label className="text-sm">Cards to create:</label>
      <select
        value={count}
        onChange={(e) => setCount(parseInt(e.target.value))}
        className="rounded border border-gray-300 bg-transparent p-1"
      >
        {[5, 10, 15, 20].map((n) => (
          <option key={n} value={n} className="text-black">
            {n}
          </option>
        ))}
      </select>
      <button
        onClick={generate}
        disabled={busy}
        className="rounded bg-black px-4 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {busy ? "Generating..." : "Generate flashcards"}
      </button>
      {message && <p className="w-full text-sm">{message}</p>}
    </div>
  );
}