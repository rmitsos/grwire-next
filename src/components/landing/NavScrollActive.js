"use client";

import { useEffect, useRef } from "react";

// On a phone the section tabs scroll sideways. After the page loads, bring the current tab into
// view so the bold tab is never off-screen. Renders nothing; it only looks at its own <nav>.
export function NavScrollActive() {
  const marker = useRef(null);
  useEffect(() => {
    const nav = marker.current?.parentElement;
    const current = nav?.querySelector('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2);
  }, []);
  return <span ref={marker} hidden />;
}
