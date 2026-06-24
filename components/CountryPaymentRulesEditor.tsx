"use client";

/**
 * CountryPaymentRulesEditor.tsx
 * ============================================================================
 * PER-COUNTRY payment rules editor for a PAID event (owner 2026-06-24). A small CONTROLLED
 * component: the parent owns the rules value + passes value/onChange, so the same editor drops into
 * every event form (admin create Step1EventDetails, admin edit BasicInfoTab, organizer create +
 * organizer edit pages) without caring about that form's state library.
 *
 * What it edits: the event's `country_payment_rules` JSON, the SAME shape the backend stores +
 * validates (Event.country_payment_rules / _parse_country_payment_rules in
 * afc_tournament_and_scrims/views.py):
 *     { default_pays: boolean,                         // unlisted countries: pay the base fee, or free?
 *       countries: { "<Country>": { pays, amount?, currency? } } }
 * `amount`/`currency` are OPTIONAL overrides; absent -> the event's base fee/currency. A row with
 * pays=false makes that country FREE to register.
 *
 * On change it emits the rules object, or `null` when there is nothing meaningful to store (no rows
 * AND default_pays=true) so a paid event with no per-country config is sent as "everyone pays base"
 * (the backend treats null identically). Country names come from the shared `countries` constant and
 * match Team.country / User.country (human-readable names) so the backend lookup resolves.
 *
 * CONSUMED BY: the four event create/edit forms above. The resolved fee a registrant actually pays is
 * computed server-side by resolve_registration_fee() at register/payment time; this is only the
 * authoring surface. Operator-facing copy is English to match the adjacent Entry Fee / Currency
 * fields (event-config forms are not part of the user-facing i18n surface).
 */

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/ui/info-tip";
import { countries } from "@/constants";
import { REGISTRATION_FEE_CURRENCIES } from "@/app/(a)/a/events/create/_components/types";

export type CountryPaymentRule = {
  pays: boolean;
  amount?: string;
  currency?: string;
};
export type CountryPaymentRules = {
  default_pays: boolean;
  countries: Record<string, CountryPaymentRule>;
};

type Props = {
  /** Current rules (null/undefined => no per-country config: everyone pays the base fee). */
  value: CountryPaymentRules | null | undefined;
  onChange: (next: CountryPaymentRules | null) => void;
  /** Event base currency (default for a row that has no currency override). */
  baseCurrency?: string;
  /** Event base fee, shown as the placeholder on a row with no amount override. */
  baseFee?: string | number | null;
};

// Normalize any incoming value into a concrete editable object (so the UI always has rows to map).
function normalize(value: Props["value"]): CountryPaymentRules {
  return {
    default_pays: value?.default_pays ?? true,
    countries: value?.countries ?? {},
  };
}

// Emit null when the rules carry no real config (no rows AND unlisted-countries still pay base),
// matching the backend's "null == everyone pays base" so we never persist an empty object.
function emit(next: CountryPaymentRules): CountryPaymentRules | null {
  const hasRows = Object.keys(next.countries).length > 0;
  if (!hasRows && next.default_pays) return null;
  return next;
}

export default function CountryPaymentRulesEditor({
  value,
  onChange,
  baseCurrency = "USD",
  baseFee,
}: Props) {
  const rules = normalize(value);
  const rows = Object.entries(rules.countries);

  // Countries still available to add (not already configured), kept sorted for a stable picker.
  const available = useMemo(
    () => countries.filter((c) => !(c in rules.countries)),
    [rules.countries],
  );

  const setDefaultPays = (pays: boolean) =>
    onChange(emit({ ...rules, default_pays: pays }));

  const addCountry = (name: string) => {
    if (!name || name in rules.countries) return;
    // New rows default to "pays the base fee" (no amount/currency override) - the common case.
    onChange(
      emit({
        ...rules,
        countries: { ...rules.countries, [name]: { pays: true } },
      }),
    );
  };

  const removeCountry = (name: string) => {
    const nextCountries = { ...rules.countries };
    delete nextCountries[name];
    onChange(emit({ ...rules, countries: nextCountries }));
  };

  const updateRow = (name: string, patch: Partial<CountryPaymentRule>) => {
    const current = rules.countries[name] ?? { pays: true };
    const merged: CountryPaymentRule = { ...current, ...patch };
    // Dropping the amount/currency override (empty) keeps the row using the base fee.
    if (patch.amount === "") delete merged.amount;
    if (patch.currency === "") delete merged.currency;
    onChange(
      emit({
        ...rules,
        countries: { ...rules.countries, [name]: merged },
      }),
    );
  };

  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div>
        <Label className="text-sm font-medium">
          Per-country payment
          <InfoTip
            text="Optional. Set, per country, whether teams or players from that country pay the entry fee or join for free, and optionally charge a different amount. A squad uses its team country; a solo player uses their own country. This does not change the private-event invite link, which is still required regardless of country."
            className="ml-1"
          />
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave empty to charge every country the base entry fee.
        </p>
      </div>

      {/* Default rule for any country not listed below. */}
      <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div className="text-sm">
          <p className="font-medium">Countries not listed below</p>
          <p className="text-xs text-muted-foreground">
            {rules.default_pays
              ? "Pay the base entry fee."
              : "Join for free (no entry fee)."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Free</span>
          <Switch
            checked={rules.default_pays}
            onCheckedChange={(checked) => setDefaultPays(checked)}
          />
          <span className="text-xs text-muted-foreground">Pay</span>
        </div>
      </div>

      {/* Per-country rows. */}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(([name, rule]) => (
            <div
              key={name}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-3"
            >
              <span className="min-w-[8rem] flex-1 text-sm font-medium">
                {name}
              </span>

              {/* Free vs Pay for this country. */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Free</span>
                <Switch
                  checked={rule.pays}
                  onCheckedChange={(checked) =>
                    updateRow(name, { pays: checked })
                  }
                />
                <span className="text-xs text-muted-foreground">Pay</span>
              </div>

              {/* Optional amount + currency override, only when this country pays. */}
              {rule.pays && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28"
                    placeholder={
                      baseFee !== undefined && baseFee !== null && baseFee !== ""
                        ? `Base ${baseFee}`
                        : "Base fee"
                    }
                    value={rule.amount ?? ""}
                    onChange={(e) =>
                      updateRow(name, { amount: e.target.value })
                    }
                  />
                  <Select
                    value={rule.currency ?? baseCurrency}
                    onValueChange={(val) => updateRow(name, { currency: val })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTRATION_FEE_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeCountry(name)}
                aria-label={`Remove ${name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add-a-country picker. Selecting a country immediately appends a row. */}
      <div className="flex items-center gap-2">
        <Select value="" onValueChange={(val) => addCountry(val)}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Add a country..." />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Plus className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
