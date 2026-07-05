"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { WaitlistForm } from "./WaitlistForm";

interface ProCtaProps {
  slug: string;
  label?: string;
}

export function ProCta({ slug, label = "Pro 版に興味ある？" }: ProCtaProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return <WaitlistForm slug={slug} />;
  }

  function handleClick() {
    track("cta_click", slug, { cta: "pro_interest" });
    setExpanded(true);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500"
    >
      {label}
    </button>
  );
}
