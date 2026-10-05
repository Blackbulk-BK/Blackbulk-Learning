export type Grade = "again" | "hard" | "good" | "easy";

type State = { ease: number; interval_days: number; repetitions: number };

const QUALITY = { again: 1, hard: 3, good: 4, easy: 5 } as const;

// Simplified SM-2 spaced repetition.
// "again" brings the card back in 10 minutes; other grades push it further out.
export function schedule(card: State, grade: Grade) {
  const q = QUALITY[grade];
  let { ease, interval_days, repetitions } = card;
  let due: Date;

  if (grade === "again") {
    repetitions = 0;
    interval_days = 0;
    due = new Date(Date.now() + 10 * 60 * 1000);
  } else {
    repetitions += 1;
    if (repetitions === 1) interval_days = 1;
    else if (repetitions === 2) interval_days = 6;
    else interval_days = Math.max(1, Math.round(interval_days * ease));

    if (grade === "hard") interval_days = Math.max(1, Math.round(interval_days * 0.8));
    if (grade === "easy") interval_days = Math.max(1, Math.round(interval_days * 1.3));

    due = new Date(Date.now() + interval_days * 86400000);
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  return {
    ease: Math.round(ease * 100) / 100,
    interval_days,
    repetitions,
    due_at: due.toISOString(),
  };
}

export function intervalLabel(card: State, grade: Grade) {
  if (grade === "again") return "10 min";
  const days = schedule(card, grade).interval_days;
  return `${days}d`;
}