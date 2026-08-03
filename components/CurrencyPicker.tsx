"use client";

/**
 * CurrencyPicker.tsx - <CurrencyPicker/>
 * ──────────────────────────────────────
 * Lets the user choose the currency money is DISPLAYED in (multi-currency, owner 2026-06-30).
 * Reads/writes CurrencyContext (setCurrency persists to localStorage + the user's profile via
 * /auth/set-currency/). Independent of the RHF profile form - it applies immediately on change.
 *
 * `label` is passed in already-translated by the caller (so this stays i18n-agnostic + reusable).
 * Used on the profile edit page beside the language selector.
 */

import { useCurrency } from "@/contexts/CurrencyContext";
import { AFC_CURRENCIES } from "@/lib/currencies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// The currency menu now comes from lib/currencies.ts, the ONE place any currency list is defined
// (owner backlog item 28, 2026-08-03). This picker used to carry its own 13-code array, which had
// drifted away from the prize-pool and broadcast lists. Codes are ISO-4217 (universal, not
// translated); the friendly name is English because currency names are not user content.
const CURRENCIES = AFC_CURRENCIES;

export function CurrencyPicker({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className={className}>
      <label className="text-sm font-medium">{label}</label>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.code} ({c.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
