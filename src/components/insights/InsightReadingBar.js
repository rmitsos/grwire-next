"use client";

import { useEffect, useState } from "react";

export function InsightReadingBar({ title, labels }) {
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(100, Math.max(0, Math.round((window.scrollY / total) * 100))));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard denial
    }
  }

  function handleLinkedIn() {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="reading-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="insight-share-bar" aria-label={title}>
        <button type="button" className="insight-share-btn" onClick={handleLinkedIn}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M3.5 5.8h2v6.7h-2V5.8zm1-3.3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm3.2 3.3h1.9v.9h.03c.27-.5.92-1.05 1.9-1.05 2.03 0 2.4 1.33 2.4 3.07v3.78h-2V9.2c0-.8-.02-1.82-1.11-1.82-1.12 0-1.29.87-1.29 1.76v3.36h-2V5.8z" />
          </svg>
          {labels.shareLinkedIn}
        </button>
        <button type="button" className={`insight-share-btn${copied ? " copied" : ""}`} onClick={handleCopy}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M6.5 9.5l3-3M5 7.5L3.6 8.9a2.5 2.5 0 0 0 3.5 3.5L8.5 11M11 8.5l1.4-1.4a2.5 2.5 0 1 0-3.5-3.5L7.5 5" />
          </svg>
          {copied ? labels.copied : labels.copyLink}
        </button>
      </div>
    </>
  );
}
