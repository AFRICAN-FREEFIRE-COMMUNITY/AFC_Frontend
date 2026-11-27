"use client";

/**
 * CurrencyContext.tsx
 * ───────────────────
 * Multi-currency display layer (owner 2026-06-30): the platform stores money in USD/NGN and shows
 * each user their own currency. This context loads the live FX rates + the viewer's resolved display
 * currency from the backend (GET /auth/fx-rates/), caches them, and lets the user pick a currency.
 *
 * Exposes: { rates, currency, setCurrency, ready, chargeMarkup }.
 *   - rates: Record<code, number> (units per 1 USD; USD === 1) - consumed by lib/money.ts.
 *   - currency: the user's active DISPLAY currency (their pick -> country-derived -> USD).
 *   - setCurrency(code): switch the display currency; persists to localStorage AND, if signed in,
 *     to the user's profile (edit-profile preferred_currency) so it follows them across devices.
 *   - chargeMarkup: the FX buffer applied to CHARGES (display uses the raw rate) - informational.
 *
 * CBN rates (owner 2026-11-27, AFC inbox #649: "CBN where it can"): the endpoint also answers
 * `sources` (per currency: "cbn" or "provider", plus the CBN rate date) and `credit` (the line the
 * CBN's terms require wherever one of its rates is shown). Older cached answers lack both, so they
 * default to {} and "". `cbnNoteFor(...)` tells Money / CurrencyPicker / Footer whether a CBN rate
 * is involved and its date, so the source is named wherever it is used.
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

// Where one currency's rate came from (mirrors afc_auth.views.fx_rates "sources").
export interface FxSource {
  source: "cbn" | "provider";
  date: string | null; // CBN rate date, "YYYY-MM-DD"; null for provider rows
}
export type FxSources = Record<string, FxSource>;

interface CurrencyContextValue {
  rates: FxRates;
  sources: FxSources;
  credit: string;
  /**
   * Is a CBN rate involved when converting between these currencies (USD never is)? Returns the
   * later of the CBN dates involved, or null when no CBN rate is used. With no arguments, answers
   * for every loaded CBN rate (the footer's "is any CBN rate on this site" question).
   */
  cbnNoteFor: (...codes: string[]) => { date: string } | null;
  currency: string;
  setCurrency: (code: string) => void;
  ready: boolean;
  chargeMarkup: number;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  rates: { USD: 1 },
  sources: {},
  credit: "",
  cbnNoteFor: () => null,
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
  const [sources, setSources] = useState<FxSources>({});
  const [credit, setCredit] = useState("");
  const [chargeMarkup, setChargeMarkup] = useState(0);
  const [ready, setReady] = useState(false);

  // Hydrate instantly from the last cached rates/currency so money never flashes USD on reload.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_RATES);
      if (cached) {
        const { rates: r, sources: s, credit: c, ts } = JSON.parse(cached);
        if (r && Date.now() - ts < TTL_MS) {
          setRates(r);
          setSources(s && typeof s === "object" ? s : {}); // older cache entries have no sources
          setCredit(typeof c === "string" ? c : "");
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
        const src: FxSources = data.sources && typeof data.sources === "object" ? data.sources : {};
        const cr: string = typeof data.credit === "string" ? data.credit : "";
        setSources(src);
        setCredit(cr);
        try {
          localStorage.setItem(
            LS_RATES,
            JSON.stringify({ rates: parsed, sources: src, credit: cr, ts: Date.now() }),
          );
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
    // out). Dedicated endpoint - NOT edit-profile, which would wipe other profile fields on a
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

  const cbnNoteFor = useCallback(
    (...codes: string[]) => {
      const pool = codes.length ? codes.map((c) => (c || "").toUpperCase()) : Object.keys(sources);
      let latest: string | null = null;
      for (const c of pool) {
        const s = sources[c];
        if (s && s.source === "cbn" && s.date && (!latest || s.date > latest)) latest = s.date;
      }
      return latest ? { date: latest } : null;
    },
    [sources],
  );

  return (
    <CurrencyContext.Provider
      value={{ rates, sources, credit, cbnNoteFor, currency, setCurrency, ready, chargeMarkup }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
