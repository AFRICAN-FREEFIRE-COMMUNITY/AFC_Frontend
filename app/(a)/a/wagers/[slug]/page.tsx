"use client";

// ── Admin · Wagers · one market ──────────────────────────────────────────────────────────────
// Everything about a market in one place: its state and the next step (publish a draft, lock
// an open one, reopen a locked one, suggest and settle, void), the options with their pools,
// the settlement record once it exists, the wagers on it, and the edit form. A retired slug
// answers `moved` and the page follows it (R22).
//
// Reads GET /wagers/admin/markets/<slug>/ and .../wagers/; writes through MarketActions and
// MarketForm.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { naira } from "@/lib/api/wagers";
import {
  getAdminMarket, listMarketWagers, lockMarket, publishMarket, type AdminMarketDetail, type AdminWagerRow,
} from "@/lib/api/wagersAdmin";

import { Evidence, ReopenDialog, SettleDialog, SuggestButton, VoidDialog } from "../_components/MarketActions";
import { MarketForm } from "../_components/MarketForm";
import { MarketStatusBadge, Pager, Panel, Stat, useAdminRefusal, WagerStatusBadge } from "../_components/shared";

const LIMIT = 25;

export default function AdminMarketPage() {
  const t = useTranslations("wagersAdmin");
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const refuse = useAdminRefusal();
  const [market, setMarket] = useState<AdminMarketDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [wagers, setWagers] = useState<AdminWagerRow[] | null>(null);
  const [wTotal, setWTotal] = useState(0);
  const [wOffset, setWOffset] = useState(0);
  const [dialog, setDialog] = useState<"settle" | "void" | "reopen" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const out = await getAdminMarket(params.slug);
      if ("status" in out && out.status === "moved") {
        router.replace(`/a/wagers/${out.slug}`);
        return;
      }
      setMarket(out as AdminMarketDetail);
    } catch (err) {
      refuse(err);
      setMissing(true);
    }
  }, [params.slug, router]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  const loadWagers = useCallback(async () => {
    if (!market) return;
    try {
      const page = await listMarketWagers(market.slug, { limit: LIMIT, offset: wOffset });
      setWagers(page.results);
      setWTotal(page.total_count);
    } catch (err) {
      refuse(err);
      setWagers([]);
    }
  }, [market?.slug, wOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadWagers(); }, [loadWagers]);

  const act = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const out = await fn();
      toast.success(out.message);
      await load();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  if (missing) return <p className="text-muted-foreground py-12 text-center text-sm">{t("errors.market_not_found")}</p>;
  if (!market) return <FullLoader />;

  const m = market;
  const s = m.settlement;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link href="/a/wagers"><IconArrowLeft />{t("common.backToMarkets")}</Link>
      </Button>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">{m.title}<MarketStatusBadge status={m.status} /></span>}
        description={`${m.event.name}${m.stage ? ` · ${m.stage}` : ""}${m.match_number ? ` · ${t("form.matchN", { n: m.match_number })}` : ""} · ${m.template_detail.name}`}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/wagers/${m.slug}`} target="_blank" rel="noreferrer"><IconExternalLink />{t("detail.viewPublic")}</Link>
          </Button>
        }
      />

      {/* ── the numbers ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("detail.pool")} value={naira(m.pool_kobo)} />
        <Stat label={t("detail.wagers")} value={m.wager_count} />
        <Stat label={m.status === "OPEN" || m.status === "DRAFT" ? t("detail.locksAt") : t("detail.lockedAt")} value={<LocalTime value={m.locked_at ?? m.lock_at} mode="datetime" />} />
        <Stat label={t("detail.rakeFee")} value={`${m.rake_bps / 100}% · ${m.cancel_fee_bps / 100}%`} />
      </div>

      {/* ── the next step ── */}
      <Panel title={m.status === "SETTLED" || m.status === "VOID" ? t("detail.settlement") : t("detail.nextStep")}>
        {m.status === "DRAFT" && (
          <>
            <p className="text-muted-foreground text-xs">{t("detail.draftHint", { n: m.options.length })}</p>
            <Button className="self-start" disabled={busy || m.options.length < 2} onClick={() => void act(() => publishMarket(m.slug))}>{t("detail.publish")}</Button>
          </>
        )}
        {m.status === "OPEN" && (
          <>
            <p className="text-muted-foreground text-xs">{t("detail.openHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void act(() => lockMarket(m.slug))}>{t("detail.lockNow")}</Button>
              <Button variant="destructive" disabled={busy} onClick={() => setDialog("void")}>{t("queue.void")}</Button>
            </div>
          </>
        )}
        {(m.status === "LOCKED" || m.status === "PENDING_SETTLEMENT") && (
          <>
            <p className="text-muted-foreground text-xs">{m.status === "LOCKED" ? t("detail.lockedHint") : t("detail.pendingHint")}</p>
            <Evidence market={m} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => setDialog("settle")}>{t("queue.settle")}</Button>
              <SuggestButton market={m} onDone={load} size="default" />
              <Button variant="secondary" disabled={busy} onClick={() => setDialog("reopen")}>{t("detail.reopen")}</Button>
              <Button variant="destructive" disabled={busy} onClick={() => setDialog("void")}>{t("queue.void")}</Button>
            </div>
          </>
        )}
        {(m.status === "SETTLED" || m.status === "VOID") && s && (
          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">{t("detail.resolution")}:</span> {t(`resolutions.${s.resolution}`)}</p>
            <p><span className="text-muted-foreground">{t("detail.finalOption")}:</span> {s.final_option ?? "-"}</p>
            <p><span className="text-muted-foreground">{t("settle.suggested")}:</span> {s.suggested_option ?? "-"}</p>
            <p><span className="text-muted-foreground">{t("detail.confirmedBy")}:</span> {s.confirmed_by ?? "-"} · <LocalTime value={s.confirmed_at} mode="datetime" /></p>
            <p><span className="text-muted-foreground">{t("detail.rakeTaken")}:</span> {naira(s.rake_kobo)}</p>
            <p><span className="text-muted-foreground">{t("detail.paidOut")}:</span> {naira(s.paid_total_kobo)} · {t("detail.winners", { n: s.winners_count })}</p>
            <p><span className="text-muted-foreground">{t("detail.refunded")}:</span> {naira(s.refund_total_kobo)}</p>
            <p><span className="text-muted-foreground">{t("detail.dust")}:</span> {naira(s.dust_kobo)}</p>
            {s.resolution === "WINNER" && s.override_reason && <p className="sm:col-span-2"><span className="text-muted-foreground">{t("settle.overrideReason")}:</span> {s.override_reason}</p>}
            {m.void_reason && <p className="sm:col-span-2"><span className="text-muted-foreground">{t("void.reason")}:</span> {m.void_reason}</p>}
          </div>
        )}
      </Panel>

      <Tabs defaultValue="options">
        <TabsList className="w-full">
          <TabsTrigger value="options" className="w-full">{t("detail.tabOptions")}</TabsTrigger>
          <TabsTrigger value="wagers" className="w-full">{t("detail.tabWagers", { n: m.wager_count })}</TabsTrigger>
          <TabsTrigger value="edit" className="w-full">{t("detail.tabEdit")}</TabsTrigger>
        </TabsList>

        <TabsContent value="options" className="mt-4">
          <div className="bg-card rounded-md p-2 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.colOption")}</TableHead>
                  <TableHead className="text-right">{t("detail.colPool")}</TableHead>
                  <TableHead className="text-right">{t("detail.colShare")}</TableHead>
                  <TableHead className="text-right">{t("detail.colLines")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.options.map((o, i) => (
                  <TableRow key={o.id} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium">
                      {o.label}
                      {m.settled_option_id === o.id && <span className="text-primary ml-2 text-[10px] font-semibold uppercase">{t("detail.winner")}</span>}
                      {m.suggested_option_id === o.id && m.settled_option_id !== o.id && <span className="text-muted-foreground ml-2 text-[10px] font-semibold uppercase">{t("settle.suggested")}</span>}
                    </TableCell>
                    <TableCell className="text-right">{naira(o.pool_kobo)}</TableCell>
                    <TableCell className="text-right">{o.share_percent}%</TableCell>
                    <TableCell className="text-right">{o.line_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="wagers" className="mt-4 flex flex-col gap-3">
          {wagers === null ? null : wagers.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("detail.noWagers")}</p>
          ) : (
            <div className="bg-card rounded-md p-2 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("detail.colPlayer")}</TableHead>
                      <TableHead>{t("detail.colStatus")}</TableHead>
                      <TableHead>{t("detail.colLinesOn")}</TableHead>
                      <TableHead className="text-right">{t("detail.colStake")}</TableHead>
                      <TableHead className="text-right">{t("detail.colPayout")}</TableHead>
                      <TableHead>{t("detail.colPlaced")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wagers.map((w, i) => (
                      <TableRow key={w.token} className={i % 2 ? "bg-muted/40" : ""}>
                        <TableCell className="font-medium"><Link href={`/a/winnings/players/${w.user}`} className="hover:underline">{w.user}</Link></TableCell>
                        <TableCell><WagerStatusBadge status={w.status} /></TableCell>
                        <TableCell>{w.lines.map((l) => `${naira(l.stake_kobo)} ${t("detail.on")} ${l.option}`).join(", ")}</TableCell>
                        <TableCell className="text-right">{naira(w.total_stake_kobo)}</TableCell>
                        <TableCell className="text-right">{w.payout_kobo ? naira(w.payout_kobo) : w.refund_kobo ? `${t("detail.refund")} ${naira(w.refund_kobo)}` : "-"}</TableCell>
                        <TableCell><LocalTime value={w.paid_at ?? w.created_at} mode="datetime" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <Pager offset={wOffset} limit={LIMIT} total={wTotal} onChange={setWOffset} />
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          {m.status === "DRAFT" || m.status === "OPEN" ? (
            <MarketForm key={m.slug + m.status} existing={m} onSaved={(saved) => { if (saved.slug !== m.slug) router.replace(`/a/wagers/${saved.slug}`); else setMarket(saved); }} />
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("errors.market_not_editable")}</p>
          )}
        </TabsContent>
      </Tabs>

      {dialog === "settle" && <SettleDialog market={m} open onOpenChange={(v) => !v && setDialog(null)} onDone={load} />}
      {dialog === "void" && <VoidDialog market={m} open onOpenChange={(v) => !v && setDialog(null)} onDone={load} />}
      {dialog === "reopen" && <ReopenDialog market={m} open onOpenChange={(v) => !v && setDialog(null)} onDone={load} />}
    </div>
  );
}
