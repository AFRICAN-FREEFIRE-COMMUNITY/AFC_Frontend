"use client";

// useAddressTab: a tab that can be opened from the page address (inbox #159, owner 2026-10-05:
// "EVEN PAGES AND SUB PAGES SHOULD BE CLICKABLE").
//
// The help bot (AFC-B afcbot/bot.py, WEB_SITE_PAGES in the web prompt) links the sub-pages it
// names, and a tab with no address of its own cannot be linked: "/rankings" always opened on
// Rankings, so "the Tiers tab" was text the reader had to go and find. This hook opens a tab
// from ?<param>=<value>, the same way /profile?tab= and /player-markets?tab= already work, and only
// for a value the page actually has, so a stale or mistyped link quietly opens the default tab.
//
// Used by: app/(user)/rankings/page.tsx (?tab=tiers, ?subject=players) and
// app/(user)/tournaments/page.tsx (?tab=scrims, ?tab=organizers). The caller must sit inside a
// <Suspense> boundary, because useSearchParams() would otherwise opt the whole route out of
// static rendering at build time.
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function useAddressTab<T extends string>(
  param: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const searchParams = useSearchParams();
  const asked = searchParams.get(param);
  const valid = (allowed as readonly string[]).includes(asked ?? "") ? (asked as T) : null;
  // First render: straight onto the asked tab, no flash of the default one.
  const [tab, setTab] = useState<T>(() => valid ?? fallback);
  // A link followed while already on this page (the help panel is open on every page) changes
  // the address without remounting anything, so the asked tab is applied again whenever the
  // address asks for a different one. Done during render, React's pattern for state that follows
  // a changing input, so there is no extra paint on the old tab. Between links the tab belongs to
  // the viewer's clicks.
  const [seen, setSeen] = useState(valid);
  if (valid !== seen) {
    setSeen(valid);
    if (valid) setTab(valid);
  }
  return [tab, setTab];
}
