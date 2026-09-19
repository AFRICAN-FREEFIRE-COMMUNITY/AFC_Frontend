"use client";

// ── Admin · Wagers · the lifecycle dialogs ───────────────────────────────────────────────────
// Settle (pick the winner; a choice that differs from the suggestion needs a written reason),
// void (refund everyone, reason required), reopen (a new lock time and a reason). Used by the
// Queue tab and the market detail page, so the two never drift.
// Writes: POST /wagers/admin/markets/<slug>/{settle,void,reopen,suggest}/.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/api/wagers";
import {
  reopenMarket, settleMarket, suggestMarket, voidMarket, type AdminMarketDetail,
} from "@/lib/api/wagersAdmin";

import { isoToLocalInput, localInputToIso, useAdminRefusal } from "./shared";

/** The suggestion and its evidence, readable: rule, winner, and the rows it was read from. */
export function Evidence({ market }: { market: AdminMarketDetail }) {
  const t = useTranslations("wagersAdmin");
  const ev = market.suggestion_evidence || {};
  const rows = (ev.placements || ev.kills) as { team?: string; player?: string; placement?: number; kills?: number }[] | undefined;
  if (!market.suggested_option && !Object.keys(ev).length) {
    return <p className="text-muted-foreground text-xs">{t("settle.noSuggestion")}</p>;
  }
  return (
    <div className="bg-muted/60 rounded-md p-3 text-xs">
      <p>
        <span className="font-semibold">{t("settle.suggested")}:</span> {market.suggested_option ?? t("settle.noWinner")}
        {typeof ev.rule === "string" && <span className="text-muted-foreground"> · {t(`rules.${ev.rule}`)}</span>}
        {market.suggested_at && <span className="text-muted-foreground"> · <LocalTime value={market.suggested_at} mode="datetime" /></span>}
      </p>
      {typeof ev.total_kills === "number" && <p className="mt-1">{t("settle.totalKills", { total: ev.total_kills, line: Number(ev.line ?? market.over_under_line ?? 0) })}</p>}
      {typeof ev.mvp === "string" && <p className="mt-1">{t("settle.mvp", { name: ev.mvp })}</p>}
      {typeof ev.note === "string" && <p className="text-muted-foreground mt-1">{ev.note}</p>}
      {Array.isArray(rows) && rows.length > 0 && (
        <ul className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{r.team ?? r.player ?? "-"}</span>
              <span className="text-muted-foreground">
                {r.placement !== undefined ? `#${r.placement}` : ""}{r.kills !== undefined ? ` ${t("settle.kills", { n: r.kills })}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettleDialog({ market, open, onOpenChange, onDone }: {
  market: AdminMarketDetail; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [optionId, setOptionId] = useState<string>(market.suggested_option_id ? String(market.suggested_option_id) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const differs = market.suggested_option_id !== null && optionId !== "" && Number(optionId) !== market.suggested_option_id;
  const chosen = market.options.find((o) => String(o.id) === optionId);
  const canConfirm = optionId !== "" && (!differs || reason.trim().length > 0) && !busy;

  const confirm = async () => {
    setBusy(true);
    try {
      const out = await settleMarket(market.slug, Number(optionId), differs ? reason.trim() : "");
      toast.success(out.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settle.title", { title: market.title })}</DialogTitle>
          <DialogDescription>{t("settle.intro", { pool: naira(market.pool_kobo), rake: market.rake_bps / 100 })}</DialogDescription>
        </DialogHeader>
        <Evidence market={market} />
        <div className="flex flex-col gap-1">
          <Label>{t("settle.winner")}</Label>
          <Select value={optionId} onValueChange={setOptionId}>
            <SelectTrigger aria-label={t("settle.winner")}><SelectValue placeholder={t("settle.pickWinner")} /></SelectTrigger>
            <SelectContent>
              {market.options.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.label} · {naira(o.pool_kobo)} · {t("settle.wagersOn", { n: o.line_count })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {chosen && chosen.pool_kobo === 0 && <p className="text-muted-foreground text-xs">{t("settle.noWinnerNote")}</p>}
          {chosen && chosen.pool_kobo > 0 && (
            <p className="text-xs">
              {chosen.pool_kobo >= market.pool_kobo
                ? t("settle.previewSolo")
                : t("settle.preview", {
                    net: naira(market.pool_kobo - Math.floor(market.pool_kobo * market.rake_bps / 10000)),
                    rake: naira(Math.floor(market.pool_kobo * market.rake_bps / 10000)),
                    n: chosen.line_count,
                  })}
            </p>
          )}
        </div>
        {differs && (
          <div className="flex flex-col gap-1">
            <Label>{t("settle.overrideReason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("settle.overridePlaceholder")} rows={3} />
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={() => void confirm()} disabled={!canConfirm}>{t("settle.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VoidDialog({ market, open, onOpenChange, onDone }: {
  market: AdminMarketDetail; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      const out = await voidMarket(market.slug, reason.trim());
      toast.success(out.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("void.title", { title: market.title })}</DialogTitle>
          <DialogDescription>{t("void.intro", { pool: naira(market.pool_kobo), n: market.wager_count })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label>{t("void.reason")}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("void.reasonPlaceholder")} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>{t("common.cancel")}</Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy || reason.trim().length < 3}>{t("void.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReopenDialog({ market, open, onOpenChange, onDone }: {
  market: AdminMarketDetail; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [lockAt, setLockAt] = useState(isoToLocalInput(market.lock_at));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const iso = localInputToIso(lockAt);
  const confirm = async () => {
    if (!iso) return;
    setBusy(true);
    try {
      const out = await reopenMarket(market.slug, iso, reason.trim());
      toast.success(out.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reopen.title", { title: market.title })}</DialogTitle>
          <DialogDescription>{t("reopen.intro")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label>{t("form.lockAt")}</Label>
          <Input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("reopen.reason")}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={() => void confirm()} disabled={busy || !iso || new Date(iso).getTime() <= Date.now() || reason.trim().length < 3}>{t("reopen.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Ask the stats again": recompute the suggestion from the match result. */
export function SuggestButton({ market, onDone, size = "sm" }: { market: AdminMarketDetail; onDone: () => void; size?: "sm" | "default" }) {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const out = await suggestMarket(market.slug);
      toast.success(out.message);
      onDone();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };
  return <Button size={size} variant="secondary" disabled={busy} onClick={() => void run()}>{t("settle.suggestAgain")}</Button>;
}
