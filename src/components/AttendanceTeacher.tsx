"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import QRScanner from "@/components/QRScanner";

export type ClassInfo = { id: string; name: string; students: number };
type Session = { id: string; title: string; created_at: string };
type Rec = { student_id: string; scanned_at: string; name: string };

type RawRec = {
  student_id: string;
  scanned_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default function AttendanceTeacher({ classes }: { classes: ClassInfo[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<Rec[]>([]);
  const [title, setTitle] = useState("");
  const [scanning, setScanning] = useState(true);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const lastRef = useRef({ text: "", time: 0 });

  const loadSessions = useCallback(
    async (cid: string) => {
      if (!cid) return;
      const { data } = await supabase
        .from("attendance_sessions")
        .select("id, title, created_at")
        .eq("class_id", cid)
        .order("created_at", { ascending: false })
        .limit(8);
      setSessions((data ?? []) as Session[]);
    },
    [supabase]
  );

  const loadRecords = useCallback(
    async (sid: string) => {
      const { data } = await supabase
        .from("attendance_records")
        .select("student_id, scanned_at, profiles(full_name, email)")
        .eq("session_id", sid)
        .order("scanned_at", { ascending: false });
      const rows = (data ?? []) as unknown as RawRec[];
      setRecords(
        rows.map((r) => ({
          student_id: r.student_id,
          scanned_at: r.scanned_at,
          name: r.profiles?.full_name || r.profiles?.email || "Student",
        }))
      );
    },
    [supabase]
  );

  useEffect(() => {
    setSession(null);
    setRecords([]);
    setFeedback(null);
    loadSessions(classId);
  }, [classId, loadSessions]);

  async function startSession(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        class_id: classId,
        teacher_id: user!.id,
        title: title.trim() || `Session ${new Date().toLocaleDateString()}`,
      })
      .select("id, title, created_at")
      .single();
    if (error) return setError(error.message);
    setTitle("");
    setSession(data as Session);
    setRecords([]);
    setFeedback(null);
    setScanning(true);
    loadSessions(classId);
  }

  async function openSession(s: Session) {
    setSession(s);
    setFeedback(null);
    setScanning(true);
    await loadRecords(s.id);
  }

  const handleScan = useCallback(
    async (text: string) => {
      if (!session) return;
      const now = Date.now();
      if (busyRef.current) return;
      if (lastRef.current.text === text && now - lastRef.current.time < 4000) return;
      lastRef.current = { text, time: now };
      busyRef.current = true;

      try {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, token: text }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scan failed");
        setFeedback({
          ok: true,
          msg: json.already
            ? `${json.name} was already marked present`
            : `${json.name} marked present`,
        });
        await loadRecords(session.id);
      } catch (err) {
        setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Scan failed" });
      } finally {
        busyRef.current = false;
      }
    },
    [session, loadRecords]
  );

  async function removeRecord(studentId: string) {
    if (!session) return;
    await supabase
      .from("attendance_records")
      .delete()
      .eq("session_id", session.id)
      .eq("student_id", studentId);
    loadRecords(session.id);
  }

  if (classes.length === 0) {
    return (
      <p className="text-sm opacity-70">
        You have no classes yet.{" "}
        <Link href="/teacher" className="underline">
          Create one on the teacher dashboard
        </Link>
        .
      </p>
    );
  }

  const current = classes.find((c) => c.id === classId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm opacity-70">Class</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full rounded border border-gray-300 bg-transparent p-2"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id} className="text-black">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!session && (
        <>
          <form onSubmit={startSession} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session name (e.g. Monday 8:00)"
              className="flex-1 rounded border border-gray-300 bg-transparent p-2"
            />
            <button className="rounded bg-black px-4 text-white dark:bg-white dark:text-black">
              Start session
            </button>
          </form>
          {error && <p className="text-sm text-red-500">{error}</p>}

          {sessions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Recent sessions</h2>
              <ul className="space-y-1 text-sm">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => openSession(s)}
                      className="flex w-full justify-between rounded border border-gray-300 p-2 text-left hover:bg-gray-500/10"
                    >
                      <span>{s.title}</span>
                      <span className="opacity-60">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {session && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{session.title}</h2>
              <p className="text-sm opacity-70">
                {records.length} of {current?.students ?? 0} present
              </p>
            </div>
            <button
              onClick={() => {
                setSession(null);
                setFeedback(null);
                loadSessions(classId);
              }}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              Close session
            </button>
          </div>

          <button
            onClick={() => setScanning((v) => !v)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          >
            {scanning ? "Pause scanner" : "Resume scanner"}
          </button>

          {scanning && <QRScanner active={scanning} onScan={handleScan} />}

          {feedback && (
            <p
              className={`rounded border p-2 text-sm ${
                feedback.ok
                  ? "border-green-500/60 text-green-400"
                  : "border-red-500/60 text-red-400"
              }`}
            >
              {feedback.msg}
            </p>
          )}

          <ul className="space-y-1 text-sm">
            {records.length === 0 && (
              <li className="opacity-70">No one scanned yet. Ask students to show their QR code.</li>
            )}
            {records.map((r) => (
              <li
                key={r.student_id}
                className="flex items-center justify-between rounded border border-gray-300 p-2"
              >
                <span>{r.name}</span>
                <span className="flex items-center gap-3">
                  <span className="opacity-60">
                    {new Date(r.scanned_at).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => removeRecord(r.student_id)}
                    className="text-xs text-red-400 underline"
                  >
                    Undo
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}