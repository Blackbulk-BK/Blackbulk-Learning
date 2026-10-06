// Runs in the browser. Indexes a source in small steps so no single request is long.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    // the server did not return JSON (for example a timeout page)
  }
  return { res, json };
}

export async function indexSource(
  sourceId: string,
  onProgress: (done: number, total: number, message: string) => void
) {
  onProgress(0, 0, "Reading the PDF...");
  const prep = await post("/api/ingest/prepare", { sourceId });
  if (!prep.res.ok) {
    throw new Error(String(prep.json.error ?? "Could not read the file (it may be too large)"));
  }

  const total = Number(prep.json.total ?? 0);
  let remaining = Number(prep.json.remaining ?? 0);
  onProgress(total - remaining, total, "Indexing...");

  let failures = 0;
  while (remaining > 0) {
    const { res, json } = await post("/api/ingest/embed", { sourceId });

    if (res.status === 429) {
      const wait = Number(json.retryAfter ?? 30);
      failures++;
      if (failures > 20) throw new Error("Gemini keeps asking us to slow down. Try again later.");
      for (let s = wait; s > 0; s--) {
        onProgress(total - remaining, total, `Waiting for Gemini (${s}s)...`);
        await sleep(1000);
      }
      continue;
    }

    if (!res.ok) {
      failures++;
      if (failures > 3) throw new Error(String(json.error ?? "Indexing failed"));
      await sleep(3000);
      continue;
    }

    failures = 0;
    remaining = Number(json.remaining ?? 0);
    onProgress(total - remaining, total, remaining > 0 ? "Indexing..." : "Done");

    const pause = Number(json.pauseMs ?? 0);
    if (remaining > 0 && pause > 0) await sleep(pause);
  }

  return total;
}