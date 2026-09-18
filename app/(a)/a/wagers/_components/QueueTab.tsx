"use client";

// ── Admin · Wagers · Queue tab ───────────────────────────────────────────────────────────────
// What needs a human: LOCKED markets waiting for a result and PENDING_SETTLEMENT markets whose
// suggestion is in. Each card shows the evidence and offers settle / void / suggest again.
// Reads GET /wagers/admin/queue/; writes through MarketActions.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { naira } from "@/lib/api/wagers";
import { getQueue, type AdminMarketDetail } from "@/lib/api/wagersAdmin";

import { Evidence, SettleDialog, SuggestButton, VoidDialog } from "./MarketActions";
import { MarketStatusBadge, useAdminRefusal } from "./shared";

export function QueueTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<AdminMarketDetail[] | null>(null);
  const [settle, setSettle] = useState<AdminMarketDetail | null>(null);
  const [voiding, setVoiding] = useState<AdminMarketDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const out = await getQueue();
      setRows(out.results);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  if (rows === null) return <div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  if (rows.length === 0) return <p className="text-muted-foreground py-12 text-center text-sm">{t("queue.empty")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">{t("queue.intro")}</p>
      {rows.map((m) => (
        <section key={m.slug} className="bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{m.event.name}{m.stage ? ` · ${m.stage}` : ""}{m.match_number ? ` · ${t("form.matchN", { n: m.match_number })}` : ""}</p>
              <Link href={`/a/wagers/${m.slug}`} className="text-base font-semibold hover:underline">{m.title}</Link>
              <p className="text-muted-foreground text-xs">
                {t("queue.pool", { pool: naira(m.pool_kobo), n: m.wager_count })} · {t("queue.lockedAt")} <LocalTime value={m.locked_at ?? m.lock_at} mode="datetime" />
              </p>
            </div>
            <MarketStatusBadge status={m.status} />
          </div>
          <Evidence market={m} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setSettle(m)}>{t("queue.settle")}</Button>
            <SuggestButton market={m} onDone={load} />
            <Button size="sm" variant="destructive" onClick={() => setVoiding(m)}>{t("queue.void")}</Button>
          </div>
        </section>
      ))}
      {settle && <SettleDialog key={`s-${settle.slug}`} market={settle} open onOpenChange={(v) => !v && setSettle(null)} onDone={load} />}
      {voiding && <VoidDialog key={`v-${voiding.slug}`} market={voiding} open onOpenChange={(v) => !v && setVoiding(null)} onDone={load} />}
    </div>
  );
}
