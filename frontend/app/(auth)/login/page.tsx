"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogIn } from "lucide-react";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const token = mode === "login" ? await api.login(email, password) : await api.register(email, password);
      setToken(token.access_token);
      router.push("/datasets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-field px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-clay" />
          <div>
            <h1 className="text-xl font-semibold text-ink">Sign in</h1>
            <p className="text-sm text-moss">Access datasets and annotation tools.</p>
          </div>
        </div>
        <label className="mb-3 block text-sm font-medium text-ink">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-line px-3 py-2"
            type="email"
            required
          />
        </label>
        <label className="mb-4 block text-sm font-medium text-ink">
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-line px-3 py-2"
            type="password"
            required
          />
        </label>
        {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        <div className="mb-4 grid grid-cols-2 rounded border border-line p-1">
          <button type="button" onClick={() => setMode("login")} className={`rounded py-2 text-sm ${mode === "login" ? "bg-ink text-white" : "text-moss"}`}>
            Login
          </button>
          <button type="button" onClick={() => setMode("register")} className={`rounded py-2 text-sm ${mode === "register" ? "bg-ink text-white" : "text-moss"}`}>
            Register
          </button>
        </div>
        <button className="flex w-full items-center justify-center gap-2 rounded bg-clay px-4 py-2 font-medium text-white">
          <LogIn className="h-4 w-4" />
          Continue
        </button>
      </form>
    </main>
  );
}

