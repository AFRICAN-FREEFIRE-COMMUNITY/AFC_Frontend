"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getBalance, WalletNotFound } from "@/lib/mock-wager/handlers/wallet";
import { subscribe } from "@/lib/mock-wager/pubsub";
import type { Balance } from "@/lib/mock-wager/types";

interface WalletContextValue {
  balance: Balance | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
  /**
   * The user_id to track. If null/undefined, the context returns a null balance
   * (for unauthenticated views).
   */
  userId: string | null | undefined;
}

export function WalletProvider({ children, userId }: WalletProviderProps) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBalance(null);
      setLoading(false);
      return;
    }
    if (inFlight.current) return inFlight.current;
    const p = (async () => {
      setError(null);
      try {
        const b = await getBalance(userId);
        setBalance(b);
      } catch (e: unknown) {
        if (e instanceof WalletNotFound) {
          setBalance(null);
        } else {
          setError((e as Error).message ?? "Failed to load balance");
        }
      } finally {
        setLoading(false);
      }
    })();
    inFlight.current = p;
    try {
      await p;
    } finally {
      inFlight.current = null;
    }
  }, [userId]);

  // Initial load + when userId changes
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Subscribe to wallet events for this user
  useEffect(() => {
    if (!userId) return;

    const onCredited = subscribe("wallet:credited", (msg) => {
      if (msg.type !== "wallet:credited") return;
      if (msg.user_id === userId) refresh();
    });
    const onDebited = subscribe("wallet:debited", (msg) => {
      if (msg.type !== "wallet:debited") return;
      if (msg.user_id === userId) refresh();
    });

    return () => {
      onCredited();
      onDebited();
    };
  }, [userId, refresh]);

  return (
    <WalletContext.Provider value={{ balance, loading, error, refresh }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside a WalletProvider");
  }
  return ctx;
}
