"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewNotebookForm() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("notebooks")
      .insert({ title: title.trim(), owner_id: user!.id })
      .select("id")
      .single();

    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/notebook/${data.id}`);
  }

  return (
    <form onSubmit={create} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New notebook title"
        className="flex-1 rounded border border-gray-300 bg-transparent p-2"
      />
      <button
        disabled={busy}
        className="rounded bg-black px-4 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {busy ? "Creating..." : "Create"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}