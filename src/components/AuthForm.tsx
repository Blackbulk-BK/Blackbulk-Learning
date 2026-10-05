"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) return setMessage(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-300 p-6">
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "Log in" : "Create account"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 bg-transparent p-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 bg-transparent p-2"
        />
        <button
          disabled={loading}
          className="w-full rounded bg-black p-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <button
        onClick={handleGoogle}
        className="w-full rounded border border-gray-300 p-2"
      >
        Sign in with Google
      </button>

      {message && <p className="text-sm text-red-500">{message}</p>}

      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-sm underline"
      >
        {mode === "login"
          ? "No account? Sign up"
          : "Already have an account? Log in"}
      </button>
    </div>
  );
}