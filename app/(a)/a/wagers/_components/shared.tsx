"use client";

// ── Admin · wagers, shared pieces ────────────────────────────────────────────────────────────
// The small things every wager CMS page needs: who the viewer is (three gates, mirroring
// afc_wager.views_admin MARKET_ROLES / FINANCE_ROLES / HEAD_ROLES), the refusal toast that
// translates a `{message, code}` answer, the status badges (filled variants only, per the
// no-hairline rule), a pager for the `{results, total_count, has_more}` pages, and the
// datetime-local helpers for lock_at / open_at.
//
// CONNECTS TO: app/(a)/a/wagers/* and app/(a)/a/winnings/* (every page), lib/api/wagersAdmin.ts
// (the shapes), messages/{en,fr,pt}/wagersAdmin.json (every string).

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/http";
import { refusalOf, type MarketStatus, type WagerStatus } from "@/lib/api/wagers";

/** Which of the three CMS gates the viewer passes. head_admin and super_admin pass all three. */
export function useWagerRoles() {
  const { user } = useAuth();
  const normalize = (r: string) => r.toLowerCase().replace(/\s+/g, "_");
  const roles = [
    ...(Array.isArray(user?.roles) ? user!.roles.map(normalize) : []),
    normalize(user?.role || ""),
  ].filter(Boolean);
  const isHead = roles.includes("head_admin") || roles.includes("super_admin");
  return {
    isHead,
    isMarket: isHead || roles.includes("wager_admin"),
    isFinance: isHead || roles.includes("finance_admin"),
  };
}

/** Toast for a refused call: the translated sentence for its code, else the server's message. */
export function useAdminRefusal() {
  const t = useTranslations("wagersAdmin");
  return (err: unknown) => {
    const refusal = refusalOf(err);
    const key = refusal?.code ? `errors.${refusal.code}` : "";
    toast.error(key && t.has(key) ? t(key) : getErrorMessage(err, t("errors.generic")));
  };
}

const MARKET_VARIANT: Record<MarketStatus, "default" | "secondary" | "destructive" | "pending"> = {
  DRAFT: "secondary",
  OPEN: "default",
  LOCKED: "pending",
  PENDING_SETTLEMENT: "pending",
  SETTLED: "secondary",
  VOID: "destructive",
};

export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  const t = useTranslations("wagersAdmin");
  return <Badge variant={MARKET_VARIANT[status] ?? "secondary"}>{t(`marketStatus.${status}`)}</Badge>;
}

const WAGER_VARIANT: Record<WagerStatus, "default" | "secondary" | "destructive" | "pending"> = {
  PENDING_PAYMENT: "pending",
  ACTIVE: "default",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
  WON: "default",
  LOST: "secondary",
  REFUNDED: "secondary",
};

export function WagerStatusBadge({ status }: { status: WagerStatus }) {
  const t = useTranslations("wagersAdmin");
  return <Badge variant={WAGER_VARIANT[status] ?? "secondary"}>{t(`wagerStatus.${status}`)}</Badge>;
}

const WITHDRAWAL_VARIANT: Record<string, "default" | "secondary" | "destructive" | "pending"> = {
  REQUESTED: "pending",
  PENDING_COSIGN: "pending",
  APPROVED: "default",
  PAID: "default",
  FAILED: "destructive",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

export function WithdrawalStatusBadge({ status }: { status: string }) {
  const t = useTranslations("wagersAdmin");
  return <Badge variant={WITHDRAWAL_VARIANT[status] ?? "secondary"}>{t(`withdrawalStatus.${status}`)}</Badge>;
}

/** Previous / next over a `{total_count}` page. Offsets, not page numbers, because that is what
 *  the endpoints take. */
export function Pager({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  const t = useTranslations("wagersAdmin");
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{t("pager.pageOf", { page, pages, total })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>{t("pager.prev")}</Button>
        <Button size="sm" variant="secondary" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>{t("pager.next")}</Button>
      </div>
    </div>
  );
}

/** A filled surface with a heading, the card idiom of the wager pages (no stroke). */
export function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A labelled number, the stat idiom of the overview rows. */
export function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="bg-card rounded-md p-4 shadow-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// ISO (backend, UTC) -> "YYYY-MM-DDTHH:MM" in the viewer's local time for <input type="datetime-local">.
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local (viewer local) -> tz-aware ISO the backend parses.
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Whole naira <-> kobo for the admin forms (amounts are typed in naira, sent in kobo). */
export const koboToNairaInput = (kobo: number | null | undefined) => (kobo ? String(Math.floor(kobo / 100)) : "");
export const nairaInputToKobo = (v: string) => Math.round((Number(v) || 0) * 100);
/** bps <-> percent for the rate fields. */
export const bpsToPercentInput = (bps: number | null | undefined) => (bps || bps === 0 ? String(bps / 100) : "");
export const percentInputToBps = (v: string) => Math.round((Number(v) || 0) * 100);

/** A CSV file the browser saves: quoted cells, UTF-8 with a BOM so Excel reads the naira sign. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
