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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// AFC-relevant currencies + majors. Codes are ISO-4217 (universal - not translated); the friendly
// name is in English (currency names aren't user-content). Order: the community's main currencies first.
const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "XOF", name: "West African CFA franc" },
  { code: "XAF", name: "Central African CFA franc" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];

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
