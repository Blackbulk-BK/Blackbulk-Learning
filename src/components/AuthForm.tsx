"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendly(message: string) {
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Wrong email or password.";
  }
  return message;
}

export default function AuthForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setNotice("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setMessage(friendly(error.message));
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) return setMessage(friendly(error.message));

    // With email confirmation on, there is no session until the link is clicked
    if (!data.session) {
      setNotice(
        "Almost there! Check your email and click the confirmation link. If you already have an account, log in instead."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMessage(error.message);
  }

  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-300 p-6">
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "Log in" : "Create account"}
      </h1>

      <button
        onClick={handleGoogle}
        type="button"
        className="w-full rounded border border-gray-300 p-2 hover:bg-gray-500/10"
      >
        Continue with Google
      </button>

      <p className="text-center text-xs opacity-60">or use your email</p>

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

      {message && <p className="text-sm text-red-500">{message}</p>}
      {notice && <p className="text-sm text-green-500">{notice}</p>}

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setMessage("");
          setNotice("");
        }}
        className="text-sm underline"
      >
        {mode === "login"
          ? "No account? Sign up"
          : "Already have an account? Log in"}
      </button>
    </div>
  );
}