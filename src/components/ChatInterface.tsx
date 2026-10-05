"use client";

import { useEffect, useRef, useState } from "react";

export type Citation = {
  n: number;
  chunk_id: string;
  source_id: string;
  source_title: string;
  page: number | null;
  content: string;
};

export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
};

export default function ChatInterface({
  notebookId,
  initialMessages,
}: {
  notebookId: string;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"socratic" | "direct">("socratic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Citation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setError("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: question, citations: [] },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, question, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chat failed");

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: json.answer,
          citations: json.citations ?? [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Turns [1] or [1, 2] in the text into clickable badges
  function renderContent(msg: Msg) {
    const parts = msg.content.split(/(\[\d+(?:\s*,\s*\d+)*\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
      if (!m) return <span key={i}>{part}</span>;

      return (
        <span key={i}>
          {m[1].split(",").map((numStr) => {
            const n = parseInt(numStr.trim(), 10);
            const cite = msg.citations.find((c) => c.n === n);
            if (!cite) return <span key={n}>[{n}]</span>;
            return (
              <button
                key={n}
                onClick={() => setOpen(cite)}
                className="mx-0.5 rounded bg-blue-500/20 px-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/40"
              >
                {cite.page ? `p. ${cite.page}` : `[${n}]`}
              </button>
            );
          })}
        </span>
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ask your sources</h2>
        <div className="flex overflow-hidden rounded border border-gray-300 text-sm">
          <button
            onClick={() => setMode("socratic")}
            className={`px-3 py-1 ${mode === "socratic" ? "bg-gray-500/30 font-semibold" : ""}`}
          >
            Socratic
          </button>
          <button
            onClick={() => setMode("direct")}
            className={`px-3 py-1 ${mode === "direct" ? "bg-gray-500/30 font-semibold" : ""}`}
          >
            Just answer
          </button>
        </div>
      </div>

      <div className="h-96 space-y-3 overflow-y-auto rounded-xl border border-gray-300 p-4">
        {messages.length === 0 && (
          <p className="text-sm opacity-60">
            Ask a question about your uploaded sources to get started.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg p-3 text-sm ${
              m.role === "user"
                ? "ml-auto bg-gray-500/20"
                : "border border-gray-300"
            }`}
          >
            {m.role === "assistant" ? renderContent(m) : m.content}
          </div>
        ))}
        {loading && <p className="text-sm opacity-60">Thinking...</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 rounded border border-gray-300 bg-transparent p-2"
        />
        <button
          disabled={loading}
          className="rounded bg-black px-4 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Send
        </button>
      </form>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-gray-400 bg-neutral-900 p-5 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{open.source_title}</p>
                <p className="text-sm opacity-70">
                  {open.page ? `Page ${open.page}` : "Page unknown"}
                </p>
              </div>
              <button onClick={() => setOpen(null)} className="text-xl leading-none">
                ×
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{open.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}