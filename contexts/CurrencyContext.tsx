"use client";

/**
 * CurrencyContext.tsx
 * ───────────────────
 * Multi-currency display layer (owner 2026-06-30): the platform stores money in USD/NGN and shows
 * each user their own currency. This context loads the live FX rates + the viewer's resolved display
 * currency from the backend (GET /auth/fx-rates/), caches them, and lets the user pick a currency.
 *
 * Exposes: { rates, currency, setCurrency, ready, chargeMarkup }.
 *   - rates: Record<code, number> (units per 1 USD; USD === 1) — consumed by lib/money.ts.
 *   - currency: the user's active DISPLAY currency (their pick -> country-derived -> USD).
 *   - setCurrency(code): switch the display currency; persists to localStorage AND, if signed in,
 *     to the user's profile (edit-profile preferred_currency) so it follows them across devices.
 *   - chargeMarkup: the FX buffer applied to CHARGES (display uses the raw rate) — informational.
 *
 * Used by: components/Money.tsx (<Money/>) + the profile currency picker. Mounted in app/layout.tsx
 * inside AuthProvider. Talks to backend afc_auth.views.fx_rates + edit_profile.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";
import type { FxRates } from "@/lib/money";

interface CurrencyContextValue {
  rates: FxRates;
  currency: string;
  setCurrency: (code: string) => void;
  ready: boolean;
  chargeMarkup: number;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  rates: { USD: 1 },
  currency: "USD",
  setCurrency: () => {},
  ready: false,
  chargeMarkup: 0,
});

const LS_RATES = "afc_fx_rates";
const LS_CURRENCY = "afc_display_currency";
const TTL_MS = 60 * 60 * 1000; // 1h: rates barely move intraday; the backend refreshes ~daily.

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<FxRates>({ USD: 1 });
  const [currency, setCurrencyState] = useState<string>("USD");
  const [chargeMarkup, setChargeMarkup] = useState(0);
  const [ready, setReady] = useState(false);

  // Hydrate instantly from the last cached rates/currency so money never flashes USD on reload.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_RATES);
      if (cached) {
        const { rates: r, ts } = JSON.parse(cached);
        if (r && Date.now() - ts < TTL_MS) {
          setRates(r);
          setReady(true);
        }
      }
      const savedCcy = localStorage.getItem(LS_CURRENCY);
      if (savedCcy) setCurrencyState(savedCcy);
    } catch {
      /* localStorage unavailable -> just fetch fresh below */
    }
  }, []);

  // Fetch fresh rates + the viewer's resolved currency. Auth optional (the cookie, if present, lets
  // the backend return the user's own currency). Never throws -> money still renders on failure.
  useEffect(() => {
    let cancelled = false;
    const token = Cookies.get("auth_token");
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/fx-rates/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then(({ data }) => {
        if (cancelled) return;
        const parsed: FxRates = {};
        for (const [k, v] of Object.entries(data.rates || {})) parsed[k] = Number(v);
        parsed.USD = 1;
        setRates(parsed);
        setChargeMarkup(Number(data.charge_markup) || 0);
        try {
          localStorage.setItem(LS_RATES, JSON.stringify({ rates: parsed, ts: Date.now() }));
        } catch {
          /* ignore */
        }
        // Only adopt the backend-resolved currency if the user hasn't explicitly picked one.
        const saved = (() => {
          try {
            return localStorage.getItem(LS_CURRENCY);
          } catch {
            return null;
          }
        })();
        if (!saved && data.currency) {
          setCurrencyState(data.currency);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true); // degrade: show stored/USD rather than blocking
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback((code: string) => {
    const c = (code || "USD").toUpperCase();
    setCurrencyState(c);
    try {
      localStorage.setItem(LS_CURRENCY, c);
    } catch {
      /* ignore */
    }
    // Persist to the profile so it follows the user across devices (best-effort; ignore if signed
    // out). Dedicated endpoint — NOT edit-profile, which would wipe other profile fields on a
    // partial save (the UID-wipe lesson).
    const token = Cookies.get("auth_token");
    if (token) {
      axios
        .post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/set-currency/`,
          { currency: c },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .catch(() => {
          /* non-fatal: the local pick still applies */
        });
    }
  }, []);

  return (
    <CurrencyContext.Provider value={{ rates, currency, setCurrency, ready, chargeMarkup }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
