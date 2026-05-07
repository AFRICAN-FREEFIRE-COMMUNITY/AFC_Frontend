"use client";

import { useEffect, useState, type ReactNode } from "react";

import { env } from "@/lib/env";
import { WalletProvider } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUser, CURRENT_USER_KEY } from "@/lib/mock-wager/handlers/auth";
import { subscribe } from "@/lib/mock-wager/pubsub";

/**
 * UserAreaShell — client wrapper for the (user) layout.
 *
 * - Resolves the current "wallet user_id" used by the WalletProvider:
 *     * MOCK=1 → reads from the mock-wager localStorage / IndexedDB,
 *       defaulting to "player_1" so the demo always has a balance to render.
 *     * MOCK=0 → reads `useAuth().user.user_id` (real backend) and stringifies.
 * - Listens to `user:switched` so DevPanel-driven user changes propagate.
 *
 * The layout uses this so it can stay a server component; only the client-side
 * provider tree lives here.
 */
export function UserAreaShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mockUserId, setMockUserId] = useState<string | null>(null);

  // Resolve mock user (MOCK=1 only)
  useEffect(() => {
    if (!env.NEXT_PUBLIC_WAGER_MOCK) return;
    let cancelled = false;
    (async () => {
      try {
        // Direct localStorage read first to avoid waiting for the DB roundtrip.
        if (typeof window !== "undefined") {
          const ls = window.localStorage;
          const raw = ls?.getItem?.(CURRENT_USER_KEY);
          if (raw && !cancelled) setMockUserId(raw);
        }
        const cur = await getCurrentUser();
        if (cancelled) return;
        // Default to player_1 in mock mode if nobody is logged in yet.
        setMockUserId(cur?.id ?? "player_1");
      } catch {
        if (!cancelled) setMockUserId("player_1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // React to DevPanel user switches
  useEffect(() => {
    if (!env.NEXT_PUBLIC_WAGER_MOCK) return;
    const off = subscribe("user:switched", (msg) => {
      if (msg.type !== "user:switched") return;
      setMockUserId(msg.user_id);
    });
    return off;
  }, []);

  // Pick the userId the wallet should track. Mock mode uses the mock id; real
  // mode uses the AuthContext user_id (stringified).
  const userId: string | null = env.NEXT_PUBLIC_WAGER_MOCK
    ? mockUserId
    : user?.user_id != null
      ? String(user.user_id)
      : null;

  return <WalletProvider userId={userId}>{children}</WalletProvider>;
}

export default UserAreaShell;
