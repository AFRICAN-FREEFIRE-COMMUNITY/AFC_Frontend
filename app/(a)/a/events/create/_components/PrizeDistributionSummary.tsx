"use client";

import { useTranslations } from "next-intl";

// ── PrizeDistributionSummary (owner 2026-07-02) ──────────────────────────────
// Live check that the prize DISTRIBUTION adds up to the (now compulsory) prize-pool CASH VALUE.
// The user asked: "prize distribution should be based off the total prize pool cash value... if your
// total distribution is more or less it should tell you, and by how much." This renders that: the
// distributed total vs the cash value + how far OVER / UNDER it is, in the chosen currency.
//
// Pure + prop-driven so BOTH surfaces reuse it:
//   • create wizard  -> Step5PrizePool.tsx (passes form.watch values)
//   • edit prize tab -> PrizeRulesTab.tsx  (passes form.watch values)
// The submit guards (validatePrizeDistribution below) live in each page's save handler.
// ─────────────────────────────────────────────────────────────────────────────

// Parse a distribution/cash entry to a number. Entries can be plain ("300000") or decorated
// ("$300,000", "300000 Diamonds"); we keep digits + a single decimal point so the math still works.
export function parsePrizeAmount(v: unknown): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const cleaned = String(v ?? "").replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function sumPrizeDistribution(dist?: Record<string, unknown> | null): number {
  if (!dist) return 0;
  return Object.values(dist).reduce((s: number, v) => s + parsePrizeAmount(v), 0);
}

export function hasCashValue(cashValue: unknown): boolean {
  return (
    cashValue !== undefined &&
    cashValue !== null &&
    String(cashValue).trim() !== ""
  );
}

// Shared validation used by the create + edit save handlers so the rule is enforced identically.
// Skipped for drafts by the caller (a draft can be saved half-finished).
//
// i18n NOTE: this is a PURE function (NOT a React component) called from the admin + organizer
// create pages' submit handlers, so it cannot use useTranslations() here. Instead of returning an
// English sentence, it returns a translation DESCRIPTOR: `{ code, values }` where `code` is an
// evCreatePage namespace key (prizeValidate.*) and `values` are its ICU params. Each caller then
// localizes at the toast site with the `evCreatePage` translator it already holds:
//   const err = validatePrizeDistribution(...); if (err) toast.error(t(err.code, err.values));
// Callers: app/(a)/a/events/create/page.tsx (handleFinalSubmit) and
// app/(organizer)/organizer/events/create/page.tsx (handleCreateClick). Returns null when the
// prizes are fine (nothing to toast). Keys live in messages/{en,fr,pt}/evCreatePage.json.
export type PrizeDistributionError = {
  code: string;
  values?: Record<string, string>;
};

export function validatePrizeDistribution(
  distribution: Record<string, unknown> | null | undefined,
  cashValue: unknown,
  currency = "USD",
): PrizeDistributionError | null {
  if (!hasCashValue(cashValue)) {
    return { code: "prizeValidate.required" };
  }
  const cash = parsePrizeAmount(cashValue);
  const total = sumPrizeDistribution(distribution);
  const diff = total - cash;
  if (Math.abs(diff) < 0.005) return null;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  // OVER: distributed total exceeds the cash value; UNDER: it falls short. `amount` is the gap,
  // `target` is the cash value the distribution must land on, `currency` labels both.
  return diff > 0
    ? { code: "prizeValidate.over", values: { amount: fmt(diff), currency, target: fmt(cash) } }
    : { code: "prizeValidate.under", values: { amount: fmt(-diff), currency, target: fmt(cash) } };
}

interface Props {
  distribution?: Record<string, unknown> | null;
  cashValue?: unknown;
  currency?: string;
}

export function PrizeDistributionSummary({ distribution, cashValue, currency = "USD" }: Props) {
  // evSteps.prizeSummary namespace (shared create wizard + edit prize tab).
  const t = useTranslations("evSteps");
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const ccy = currency || "USD";

  if (!hasCashValue(cashValue)) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
        {t("prizeSummary.setCashValue")}
      </div>
    );
  }

  const cash = parsePrizeAmount(cashValue);
  const total = sumPrizeDistribution(distribution);
  const diff = total - cash;
  const balanced = Math.abs(diff) < 0.005;
  const over = diff > 0;

  const tone = balanced
    ? "border-primary/40 bg-primary/10 text-primary"
    : over
      ? "border-red-500/40 bg-red-500/10 text-red-500"
      : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span>
          {/* Rich text keeps the two amounts bold inside the translated sentence. */}
          {t.rich("prizeSummary.distributed", {
            total: fmt(total),
            cash: fmt(cash),
            ccy,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </span>
        <span className="font-semibold">
          {balanced
            ? t("prizeSummary.matches")
            : over
              ? t("prizeSummary.over", { diff: fmt(diff), ccy })
              : t("prizeSummary.under", { diff: fmt(-diff), ccy })}
        </span>
      </div>
    </div>
  );
}
