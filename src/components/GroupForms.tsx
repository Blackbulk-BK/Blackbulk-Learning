"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateGroupForm() {
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
    const { data, error } = await supabase.rpc("create_group", { group_name: name.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/groups/${data}`);
  }

  return (
    <form onSubmit={create} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New group name (e.g. Philosophy study buddies)"
          className="flex-1 rounded border border-gray-300 bg-transparent p-2"
        />
        <button
          disabled={busy}
          className="rounded bg-black px-4 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? "Creating..." : "Create group"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

export function JoinGroupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("join_group", { p_code: code.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/groups/${data}`);
  }

  return (
    <form onSubmit={join} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Group code (6 characters)"
          maxLength={6}
          className="flex-1 rounded border border-gray-300 bg-transparent p-2 uppercase tracking-widest"
        />
        <button
          disabled={busy}
          className="rounded border border-gray-300 px-4 disabled:opacity-50"
        >
          {busy ? "Joining..." : "Join group"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}