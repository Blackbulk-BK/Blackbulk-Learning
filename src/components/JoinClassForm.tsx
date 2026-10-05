"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinClassForm() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMessage("");

    const { error } = await supabase.rpc("join_class", { code: code.trim() });

    setBusy(false);
    if (error) return setMessage(error.message);
    setCode("");
    setMessage("Joined!");
    router.refresh();
  }

  return (
    <form onSubmit={join} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Class code (6 characters)"
          maxLength={6}
          className="flex-1 rounded border border-gray-300 bg-transparent p-2 uppercase tracking-widest"
        />
        <button
          disabled={busy}
          className="rounded border border-gray-300 px-4 disabled:opacity-50"
        >
          {busy ? "Joining..." : "Join class"}
        </button>
      </div>
      {message && <p className="text-sm">{message}</p>}
    </form>
  );
}