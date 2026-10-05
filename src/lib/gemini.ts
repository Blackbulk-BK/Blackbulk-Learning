import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Models are tried in this order. Every model has its own free quota,
// so when one is used up or overloaded the next one takes over.
// Override with GEMINI_MODELS=name1,name2,name3 in .env.local (no "models/" prefix).
const DEFAULT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

function modelList() {
  const fromEnv = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "")
    .split(",")
    .map((m) => m.trim().replace(/^models\//, ""))
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
}

export const MODEL = modelList()[0];

const MAX_TOTAL_MS = 90_000; // stop trying after about 90 seconds
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

// model name -> time (ms) until we try it again
const cooldown = new Map<string, number>();

type GenParams = Parameters<typeof ai.models.generateContent>[0];

function classify(msg: string) {
  if (/NOT_FOUND|404/.test(msg)) return "missing" as const;
  if (/PerDay/i.test(msg)) return "daily" as const;
  if (/429|RESOURCE_EXHAUSTED/.test(msg)) return "limit" as const;
  if (/503|UNAVAILABLE|500|INTERNAL|DEADLINE/.test(msg)) return "busy" as const;
  return "other" as const;
}

function retryAfterMs(msg: string) {
  const m = msg.match(/retry in ([\d.]+)s/i) || msg.match(/retryDelay"?:\s*"(\d+)s"/i);
  return m ? Math.ceil(parseFloat(m[1])) * 1000 + 1000 : 30_000;
}

export async function generateWithRetry(params: GenParams) {
  const models = modelList();
  const started = Date.now();
  const kinds: string[] = [];

  while (Date.now() - started < MAX_TOTAL_MS) {
    const now = Date.now();
    const ready = models.filter((m) => (cooldown.get(m) ?? 0) <= now);

    if (ready.length === 0) {
      // Everything is cooling down: wait for the soonest one, if it is soon enough
      const soonest = Math.min(...models.map((m) => cooldown.get(m) ?? 0));
      const wait = Math.max(soonest - now, 1000);
      if (Date.now() - started + wait > MAX_TOTAL_MS) break;
      console.warn(`[gemini] all models cooling down, waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }

    for (const model of ready) {
      try {
        const result = await ai.models.generateContent({ ...params, model });
        console.log(`[gemini] ok with ${model}`);
        return result;
      } catch (err) {
        const msg = errMsg(err);
        const kind = classify(msg);
        kinds.push(kind);
        console.warn(`[gemini] ${model} failed (${kind}): ${msg.slice(0, 160).replace(/\s+/g, " ")}`);

        if (kind === "missing") cooldown.set(model, Date.now() + 6 * 3600_000);
        else if (kind === "daily") cooldown.set(model, Date.now() + 3600_000);
        else if (kind === "limit") cooldown.set(model, Date.now() + retryAfterMs(msg));
        else if (kind === "busy") cooldown.set(model, Date.now() + 8_000);
        else throw err; // a real error (bad request etc.): retrying will not help
      }
    }
  }

  const allDaily = kinds.length > 0 && kinds.every((k) => k === "daily" || k === "missing");
  throw new Error(
    allDaily
      ? "Every Gemini model is out of its daily free quota. Try again tomorrow, or enable billing on your Google key."
      : "Gemini is overloaded or rate-limited right now. Wait a minute and try again."
  );
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: texts,
        config: { outputDimensionality: 768, taskType },
      });
      return res.embeddings!.map((e) => e.values!);
    } catch (err) {
      const msg = errMsg(err);
      const kind = classify(msg);
      if ((kind !== "limit" && kind !== "busy") || attempt === 3) throw err;
      await sleep(Math.min(retryAfterMs(msg), 20_000));
    }
  }
  throw new Error("Embedding failed");
}