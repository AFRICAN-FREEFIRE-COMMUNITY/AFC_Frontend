"use client";

import { useEffect } from "react";
import { env } from "@/lib/env";
import { runSeed } from "@/lib/mock-wager/seed";

/**
 * MockBootstrap — invisible client component that seeds the IndexedDB mock
 * layer once on first mount when NEXT_PUBLIC_WAGER_MOCK is enabled.
 *
 * Mounted high in the (user) layout so every page benefits from the seed
 * being available before any handler reads from it. Renders null and never
 * throws — if the seed fails (e.g. older browser without IndexedDB), it logs
 * a warning and the rest of the app continues to function.
 */
export function MockBootstrap() {
  useEffect(() => {
    if (!env.NEXT_PUBLIC_WAGER_MOCK) return;
    runSeed().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[MockBootstrap] runSeed failed:", err);
    });
  }, []);

  return null;
}

export default MockBootstrap;
