"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { requestMagicLink, signInWithPassword } from "./actions";

const inputClass = "rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]";
const buttonClass =
  "rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await signInWithPassword(email, password);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.replace("/admin");
    } finally {
      setPending(false);
    }
  }

  async function handleMagicLink() {
    setPending(true);
    setError(null);
    try {
      const result = await requestMagicLink(email);
      setMessage(result.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={pending || email.trim().length === 0}
        className="text-sm text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400"
      >
        Email me a sign-in link instead
      </button>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
    </form>
  );
}
