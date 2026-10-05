"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ShareNotebook({
  notebookId,
  groups,
}: {
  notebookId: string;
  groups: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function share() {
    if (!groupId) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("share_notebook", {
      p_group: groupId,
      p_notebook: notebookId,
    });
    setBusy(false);
    setMessage(error ? error.message : "Shared! Group members can now open it (read-only).");
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm opacity-70">
        Want to study with friends?{" "}
        <Link href="/groups" className="underline">
          Create or join a study group
        </Link>{" "}
        to share this notebook.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-gray-300 p-3">
      <p className="text-sm font-semibold">Share with a study group</p>
      <div className="flex gap-2">
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="flex-1 rounded border border-gray-300 bg-transparent p-1 text-sm"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id} className="text-black">
              {g.name}
            </option>
          ))}
        </select>
        <button
          onClick={share}
          disabled={busy}
          className="rounded border border-gray-300 px-3 text-sm disabled:opacity-50"
        >
          {busy ? "Sharing..." : "Share"}
        </button>
      </div>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}