"use client";

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
// Returns an error string (to toast + block on) or null when the prizes are fine. Skipped for drafts
// by the caller (a draft can be saved half-finished).
export function validatePrizeDistribution(
  distribution: Record<string, unknown> | null | undefined,
  cashValue: unknown,
  currency = "USD",
): string | null {
  if (!hasCashValue(cashValue)) {
    return "Prize pool cash value is required.";
  }
  const cash = parsePrizeAmount(cashValue);
  const total = sumPrizeDistribution(distribution);
  const diff = total - cash;
  if (Math.abs(diff) < 0.005) return null;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return diff > 0
    ? `Prize distribution is OVER the cash value by ${fmt(diff)} ${currency}. Reduce it to ${fmt(cash)} ${currency}.`
    : `Prize distribution is UNDER the cash value by ${fmt(-diff)} ${currency}. Add ${fmt(-diff)} ${currency} more to reach ${fmt(cash)} ${currency}.`;
}

interface Props {
  distribution?: Record<string, unknown> | null;
  cashValue?: unknown;
  currency?: string;
}

export function PrizeDistributionSummary({ distribution, cashValue, currency = "USD" }: Props) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const ccy = currency || "USD";

  if (!hasCashValue(cashValue)) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
        Set the prize pool cash value above so the distribution can be checked against it.
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
          Distributed <b>{fmt(total)} {ccy}</b> of <b>{fmt(cash)} {ccy}</b>
        </span>
        <span className="font-semibold">
          {balanced
            ? "Matches the cash value"
            : over
              ? `Over by ${fmt(diff)} ${ccy}`
              : `Under by ${fmt(-diff)} ${ccy}`}
        </span>
      </div>
    </div>
  );
}
