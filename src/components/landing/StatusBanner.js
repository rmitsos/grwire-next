"use client";

import { useSearchParams } from "next/navigation";
import { getLandingCopy } from "@/landing/copy";

// Reads ?status= on the client so the page around it can stay static/ISR. Render inside a
// <Suspense> boundary (required by useSearchParams in a static render).
export function StatusBanner({ lang }) {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  if (!status) return null;

  const message = getLandingCopy(lang).statusMessages[status];
  if (!message) return null;

  return <p className={`status-banner ${message.tone}`}>{message.text}</p>;
}
