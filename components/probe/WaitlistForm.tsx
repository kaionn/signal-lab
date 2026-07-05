"use client";

import { useState } from "react";
import { track } from "@/lib/track";

interface WaitlistFormProps {
  slug: string;
  ctaLabel?: string;
  successMessage?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm({
  slug,
  ctaLabel = "待機リストに登録する",
  successMessage = "登録したわ。公開したら知らせるわね。",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    track("cta_click", slug, { cta: "waitlist" });

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, slug }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setErrorMessage("時間をおいて再試行して");
        } else if (response.status === 503) {
          setErrorMessage("準備中よ");
        } else {
          setErrorMessage("登録に失敗したわ");
        }
        setStatus("error");
        return;
      }

      track("signup", slug);
      setStatus("success");
    } catch {
      setErrorMessage("登録に失敗したわ");
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="text-sm text-zinc-300">{successMessage}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        disabled={status === "submitting"}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="shrink-0 rounded-md bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "submitting" ? "送信中…" : ctaLabel}
      </button>
      {status === "error" ? <p className="text-sm text-red-400 sm:basis-full">{errorMessage}</p> : null}
    </form>
  );
}
