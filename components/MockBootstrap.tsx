"use client";

import { useEffect } from "react";
import { env } from "@/lib/env";
import { runSeed } from "@/lib/mock-wager/seed";
import * as walletHandlers from "@/lib/mock-wager/handlers/wallet";
import * as marketHandlers from "@/lib/mock-wager/handlers/markets";
import * as wagerHandlers from "@/lib/mock-wager/handlers/wagers";
import * as adminHandlers from "@/lib/mock-wager/handlers/admin";
import * as kycHandlers from "@/lib/mock-wager/handlers/kyc";
import * as authHandlers from "@/lib/mock-wager/handlers/auth";
import * as clock from "@/lib/mock-wager/clock";
import * as store from "@/lib/mock-wager/store";

/**
 * MockBootstrap — invisible client component that seeds the IndexedDB mock
 * layer once on first mount when NEXT_PUBLIC_WAGER_MOCK is enabled.
 *
 * Mounted high in the (user) layout so every page benefits from the seed
 * being available before any handler reads from it. Renders null and never
 * throws — if the seed fails (e.g. older browser without IndexedDB), it logs
 * a warning and the rest of the app continues to function.
 *
 * Also exposes the mock handlers on `window.__afcMock` so e2e tests can
 * drive state directly without relying on Next.js's runtime module loader
 * (which doesn't honor `@/...` aliases inside `page.evaluate()`).
 */
export function MockBootstrap() {
  useEffect(() => {
    if (!env.NEXT_PUBLIC_WAGER_MOCK) return;
    const seedPromise = runSeed().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[MockBootstrap] runSeed failed:", err);
    });
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__afcMock = {
        wallet: walletHandlers,
        markets: marketHandlers,
        wagers: wagerHandlers,
        admin: adminHandlers,
        kyc: kycHandlers,
        auth: authHandlers,
        clock,
        store,
        // E2E hook: tests can `await window.__afcMock.seedReady` before
        // calling handlers that depend on seeded data.
        seedReady: seedPromise,
      };
    }
  }, []);

  return null;
}

export default MockBootstrap;
