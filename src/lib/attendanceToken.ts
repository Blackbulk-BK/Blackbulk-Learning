import crypto from "crypto";

function secret() {
  const s = process.env.ATTENDANCE_SECRET;
  if (!s) throw new Error("ATTENDANCE_SECRET is not set in .env.local");
  return s;
}

const sign = (data: string) =>
  crypto.createHmac("sha256", secret()).update(data).digest("base64url");

// Token format: studentId.expiryMs.signature
export function makeToken(studentId: string, ttlMs = 60_000) {
  const data = `${studentId}.${Date.now() + ttlMs}`;
  return `${data}.${sign(data)}`;
}

export function readToken(token: string): { studentId: string } | { error: string } {
  const parts = String(token).trim().split(".");
  if (parts.length !== 3) return { error: "Not a valid attendance code" };

  const [studentId, expStr, signature] = parts;
  const expected = sign(`${studentId}.${expStr}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { error: "Invalid code" };
  }
  if (Number(expStr) < Date.now()) {
    return { error: "Code expired. Ask the student to show their refreshed code." };
  }
  return { studentId };
}