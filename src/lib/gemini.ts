import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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