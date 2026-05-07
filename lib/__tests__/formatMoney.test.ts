import { describe, it, expect } from "vitest";
import { formatMoney } from "../utils";

const fxBase = { id: "fx1", captured_at: "2026-05-07T00:00:00Z", ngn_per_usd: 1500, source: "test" };

describe("formatMoney", () => {
  it("renders 91 kobo as 0.00 coins · ₦0.91 · $0.00", () => {
    const out = formatMoney(91, fxBase);
    expect(out.coins).toBe("0.00");
    expect(out.naira).toBe("₦0.91");
    expect(out.usd).toBe("$0.00");
  });

  it("renders 10050 kobo as 0.20 coins · ₦100.50 · $0.07", () => {
    const out = formatMoney(10_050, fxBase);
    expect(out.coins).toBe("0.20");
    expect(out.naira).toBe("₦100.50");
    expect(out.usd).toBe("$0.07");
  });

  it("renders 50000 kobo as 1.00 coins · ₦500.00 · $0.33", () => {
    const out = formatMoney(50_000, fxBase);
    expect(out.coins).toBe("1.00");
    expect(out.naira).toBe("₦500.00");
    expect(out.usd).toBe("$0.33");
  });

  it("renders 95000000 kobo as 1,900.00 coins · ₦950,000.00 · $633.33", () => {
    const out = formatMoney(95_000_000, fxBase);
    expect(out.coins).toBe("1,900.00");
    expect(out.naira).toBe("₦950,000.00");
    expect(out.usd).toBe("$633.33");
  });

  it("handles zero", () => {
    const out = formatMoney(0, fxBase);
    expect(out.coins).toBe("0.00");
    expect(out.naira).toBe("₦0.00");
    expect(out.usd).toBe("$0.00");
  });

  it("handles negative (debit) amounts", () => {
    const out = formatMoney(-50_000, fxBase);
    expect(out.coins).toBe("-1.00");
    expect(out.naira).toBe("-₦500.00");
    expect(out.usd).toBe("-$0.33");
  });

  it("returns em-dash triple for NaN amount", () => {
    const out = formatMoney(Number.NaN, fxBase);
    expect(out).toEqual({ coins: "—", naira: "—", usd: "—" });
  });

  it("returns em-dash triple for Infinity amount", () => {
    const out = formatMoney(Number.POSITIVE_INFINITY, fxBase);
    expect(out).toEqual({ coins: "—", naira: "—", usd: "—" });
  });

  it("returns em-dash triple for zero fx_rate", () => {
    const fxZero = { ...fxBase, ngn_per_usd: 0 };
    const out = formatMoney(50_000, fxZero);
    expect(out).toEqual({ coins: "—", naira: "—", usd: "—" });
  });

  it("returns em-dash triple for negative fx_rate", () => {
    const fxNeg = { ...fxBase, ngn_per_usd: -10 };
    const out = formatMoney(50_000, fxNeg);
    expect(out).toEqual({ coins: "—", naira: "—", usd: "—" });
  });
});
