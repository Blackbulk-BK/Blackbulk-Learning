"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateClassForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");

    const { error } = await supabase.rpc("create_class", { class_name: name.trim() });

    setBusy(false);
    if (error) return setError(error.message);
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={create} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New class name (e.g. Intro to Philosophy)"
          className="flex-1 rounded border border-gray-300 bg-transparent p-2"
        />
        <button
          disabled={busy}
          className="rounded bg-black px-4 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? "Creating..." : "Create class"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}