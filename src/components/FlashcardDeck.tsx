"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { schedule, intervalLabel, type Grade } from "@/lib/srs";

export type Card = {
  id: string;
  front: string;
  back: string;
  page: number | null;
  ease: number;
  interval_days: number;
  repetitions: number;
};

const BUTTONS: { grade: Grade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

export default function FlashcardDeck({ cards }: { cards: Card[] }) {
  const supabase = createClient();
  const [queue, setQueue] = useState<Card[]>(cards);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState("");

  const card = queue[0];

  async function grade(g: Grade) {
    if (!card) return;
    const next = schedule(card, g);

    const { error } = await supabase
      .from("flashcards")
      .update({
        ease: next.ease,
        interval_days: next.interval_days,
        repetitions: next.repetitions,
        due_at: next.due_at,
        last_reviewed: new Date().toISOString(),
      })
      .eq("id", card.id);
    if (error) return setError(error.message);

    setError("");
    setReviewed((r) => r + 1);
    setFlipped(false);
    setQueue((q) => {
      const [first, ...rest] = q;
      // "Again" cards come back later in this same session
      return g === "again"
        ? [
            ...rest,
            {
              ...first,
              ease: next.ease,
              interval_days: next.interval_days,
              repetitions: next.repetitions,
            },
          ]
        : rest;
    });
  }

  if (!card) {
    return (
      <div className="rounded-xl border border-gray-300 p-8 text-center">
        <p className="text-lg font-semibold">
          {reviewed > 0 ? "All done for now!" : "No cards due right now."}
        </p>
        <p className="text-sm opacity-70">
          {reviewed > 0
            ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. Come back later for the next ones.`
            : "Generate more cards above, or come back when some are due."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        {queue.length} left in this session · {reviewed} reviewed
      </p>

      <div
        onClick={() => setFlipped(true)}
        className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-gray-300 p-6 text-center"
      >
        <p className="text-xs uppercase tracking-wide opacity-60">
          {flipped ? "Answer" : "Question"}
        </p>
        <p className="text-lg">{flipped ? card.back : card.front}</p>
        {flipped && card.page && (
          <p className="text-xs opacity-60">Source: page {card.page}</p>
        )}
        {!flipped && <p className="text-xs opacity-50">Click to reveal the answer</p>}
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {BUTTONS.map((b) => (
            <button
              key={b.grade}
              onClick={() => grade(b.grade)}
              className="rounded border border-gray-300 p-2 text-sm hover:bg-gray-500/20"
            >
              <span className="block font-semibold">{b.label}</span>
              <span className="block text-xs opacity-60">{intervalLabel(card, b.grade)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setFlipped(true)}
          className="w-full rounded bg-black p-2 text-white dark:bg-white dark:text-black"
        >
          Show answer
        </button>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}