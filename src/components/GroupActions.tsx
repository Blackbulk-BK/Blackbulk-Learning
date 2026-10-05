"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LeaveOrDelete({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState("");

  async function run() {
    const ok = confirm(
      isOwner
        ? "Delete this group for everyone? Shared notebooks will stop being shared (the notebooks themselves are kept)."
        : "Leave this group? You will lose access to its shared notebooks."
    );
    if (!ok) return;

    let message = "";
    if (isOwner) {
      const { error } = await supabase.from("study_groups").delete().eq("id", groupId);
      if (error) message = error.message;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user!.id);
      if (error) message = error.message;
    }

    if (message) return setError(message);
    router.push("/groups");
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        onClick={run}
        className="rounded border border-red-500/60 px-3 py-1 text-sm text-red-400 hover:bg-red-500/10"
      >
        {isOwner ? "Delete group" : "Leave group"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

export function UnshareButton({
  groupId,
  notebookId,
}: {
  groupId: string;
  notebookId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function unshare() {
    await supabase
      .from("group_notebooks")
      .delete()
      .eq("group_id", groupId)
      .eq("notebook_id", notebookId);
    router.refresh();
  }

  return (
    <button onClick={unshare} className="text-xs text-red-400 underline">
      Stop sharing
    </button>
  );
}