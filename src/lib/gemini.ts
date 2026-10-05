import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const MODEL = "gemini-3.8-flash";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries when Gemini is overloaded (503) or rate-limited (429)
export async function generateWithRetry(
  params: Parameters<typeof ai.models.generateContent>[0]
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const busy = /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED/.test(msg);
      if (!busy || attempt === 2) throw err;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error("Gemini is busy. Please try again.");
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
    config: { outputDimensionality: 768, taskType },
  });
  return res.embeddings!.map((e) => e.values!);
}