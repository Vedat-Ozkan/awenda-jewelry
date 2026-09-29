"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { inputClass, primaryButton } from "@/components/admin/ui";
import { requestMagicLink, signInWithPassword } from "./actions";

const labelClass = "block text-sm font-medium text-ink";

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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className={labelClass}>
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
      <label className={labelClass}>
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
      <button type="submit" disabled={pending} className={`${primaryButton} mt-1 h-12 w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={pending || email.trim().length === 0}
        className="inline-flex h-11 items-center justify-center rounded-full text-sm font-medium text-accent underline underline-offset-4 disabled:opacity-50"
      >
        Email me a sign-in link instead
      </button>
      {message && <p className="text-center text-sm text-muted">{message}</p>}
    </form>
  );
}
