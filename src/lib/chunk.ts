export type Chunk = {
  content: string;
  page: number;
  char_start: number;
  char_end: number;
};

// Splits each page into ~1000-character pieces with a small overlap.
// char_start/char_end are positions inside that page's whitespace-normalized text.
export function chunkPages(pages: string[], size = 1000, overlap = 150): Chunk[] {
  const out: Chunk[] = [];

  pages.forEach((raw, idx) => {
    const text = raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + size, text.length);

      // Prefer to end at a sentence boundary
      if (end < text.length) {
        const cut = text.lastIndexOf(". ", end);
        if (cut > start + size * 0.5) end = cut + 1;
      }

      const content = text.slice(start, end).trim();
      if (content.length > 20) {
        out.push({ content, page: idx + 1, char_start: start, char_end: end });
      }

      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });

  return out;
}