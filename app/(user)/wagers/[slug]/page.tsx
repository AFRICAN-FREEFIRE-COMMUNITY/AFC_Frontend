"use client";

/**
 * app/(user)/wagers/[slug]/page.tsx - one market: the options and their share of the pool, the
 * terms, the viewer's own wagers on it (each line, its status, what came back), placing (the
 * sheet), cancelling (a confirm dialog naming the fee), and the result once settled.
 *
 * ONE SOURCE OF TRUTH FOR "CAN I STAKE": the server's `is_open_for_stakes` (status AND lock_at
 * together). The May page derived it twice (walk rows 3.9 to 3.11) and showed "open" beside
 * "Awaiting result". Here the badge, the button and the cancel all read the same flag.
 *
 * THE RETURN FROM PAYSTACK: the checkout sends the player back here with ?paid=<reference>. The
 * page verifies it (GET wagers/payments/verify/), which activates the stake (idempotent with the
 * webhook), toasts, and strips the parameter.
 *
 * Public page (R25): a visitor reads everything; the place control is behind NeedsAccount (R26).
 * Addressed by slug; an old slug answers {status: "moved"} and the page replaces the URL (R22).
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconArrowLeft } from "@tabler/icons-react";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NeedsAccount } from "@/components/NeedsAccount";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/gating";
import { getErrorMessage } from "@/lib/http";
import {
  cancelWager, getLimits, getMarket, getSettings, mediaUrl, naira, refusalOf, verifyPayment, type Limits, type MarketDetail, type Wager,
  type WagerSettingsPublic,
} from "@/lib/api/wagers";

import { PlaceWagerSheet } from "../_components/PlaceWagerSheet";

function MarketPageInner() {
  const t = useTranslations("wagers");
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const { loading: sessionLoading, signedIn } = useViewer();
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toCancel, setToCancel] = useState<Wager | null>(null);
  const [busy, setBusy] = useState(false);
  // A player on a break or self-excluded sees why the button is gone, not a refusal after typing.
  const [limits, setLimits] = useState<Limits | null>(null);
  // The kill switch: while wagering is paused the button gives way to the maintenance message.
  const [settings, setSettings] = useState<WagerSettingsPublic | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMarket(params.slug);
      if ("status" in data && data.status === "moved") {
        router.replace(`/wagers/${(data as { slug: string }).slug}`);
        return;
      }
      setMarket(data as MarketDetail);
      setError(null);
    } catch (err) {
      const refusal = refusalOf(err);
      setError(refusal?.code && t.has(`errors.${refusal.code}`) ? t(`errors.${refusal.code}`) : getErrorMessage(err, t("errors.generic")));
    }
  }, [params.slug, router, t]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || !signedIn) return;
    getLimits().then(setLimits).catch(() => setLimits(null));
  }, [sessionLoading, signedIn]);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(null));
  }, []);
  const paused = settings !== null && !settings.wagering_enabled;

  const now = Date.now();
  const excludedUntil = limits?.self_excluded_until && new Date(limits.self_excluded_until).getTime() > now ? limits.self_excluded_until : null;
  const breakUntil = !excludedUntil && limits?.cooloff_until && new Date(limits.cooloff_until).getTime() > now ? limits.cooloff_until : null;

  // The return from Paystack: verify once, tell the player, clean the address.
  useEffect(() => {
    const reference = search.get("paid");
    if (!reference || sessionLoading || !signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const out = await verifyPayment(reference);
        if (cancelled) return;
        if (out.code === "payment_pending") toast.message(t("detail.paymentPending"));
        else toast.success(t("detail.paymentConfirmed"));
      } catch (err) {
        const refusal = refusalOf(err);
        toast.error(refusal?.code && t.has(`errors.${refusal.code}`) ? t(`errors.${refusal.code}`) : t("detail.paymentNotFound"));
      } finally {
        if (!cancelled) {
          router.replace(`/wagers/${params.slug}`);
          void load();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, sessionLoading, signedIn, params.slug, router, load, t]);

  const doCancel = async () => {
    if (!toCancel || !market) return;
    setBusy(true);
    try {
      const out = await cancelWager(toCancel.token);
      toast.success(out.message);
      setToCancel(null);
      await load();
    } catch (err) {
      const refusal = refusalOf(err);
      toast.error(refusal?.code && t.has(`errors.${refusal.code}`) ? t(`errors.${refusal.code}`) : getErrorMessage(err, t("errors.generic")));
    } finally {
      setBusy(false);
    }
  };

  const status = useMemo(() => {
    if (!market) return "OPEN";
    if (market.status === "OPEN") return market.is_open_for_stakes ? "OPEN" : "LOCKED";
    return market.status;
  }, [market]);

  if (error) {
    return (
      <div className="container py-10">
        <p className="text-muted-foreground text-center text-sm">{error}</p>
        <div className="mt-4 text-center">
          <Link href="/wagers" className="text-primary text-sm font-medium">{t("detail.back")}</Link>
        </div>
      </div>
    );
  }
  if (!market) return <FullLoader />;

  const canStake = market.is_open_for_stakes;
  const canCancel = (w: Wager) => w.status === "ACTIVE" && market.is_open_for_stakes;
  const feeFor = (w: Wager) => Math.floor((w.total_stake_kobo * market.cancel_fee_bps) / 10000);

  return (
    <div className="container py-6">
      <Link href="/wagers" className="text-muted-foreground inline-flex items-center gap-1 text-sm">
        <IconArrowLeft className="size-4" /> {t("detail.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            <Link href={`/tournaments/${market.event.slug}`} className="hover:text-foreground">{market.event.name}</Link>
            {market.stage ? ` · ${market.stage}` : ""}
            {market.match_number ? ` · ${t("detail.match", { number: market.match_number })}` : ""}
          </p>
          <h1 className="text-primary mt-1 text-3xl font-bold md:text-4xl">{market.title}</h1>
          {market.description && <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{market.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={status === "OPEN" ? "default" : status === "VOID" ? "destructive" : status === "SETTLED" ? "secondary" : "pending"}>
            {t(`status.${status}`)}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {status === "OPEN" ? (
              <>{t.rich("detail.locksAt", { time: () => <LocalTime value={market.lock_at} mode="datetime" /> })}</>
            ) : market.settled_at ? (
              <>{t.rich("detail.settledAt", { time: () => <LocalTime value={market.settled_at} mode="datetime" /> })}</>
            ) : (
              <>{t.rich("detail.lockedAt", { time: () => <LocalTime value={market.lock_at} mode="datetime" /> })}</>
            )}
          </span>
        </div>
      </div>

      {market.status === "VOID" && (
        <div className="bg-muted mt-4 rounded-md px-4 py-3 text-sm">{t("detail.voidReason", { reason: market.void_reason })}</div>
      )}

      {mediaUrl(market.image) && (
        <Image src={mediaUrl(market.image)!} alt="" width={1200} height={675} unoptimized className="mt-4 aspect-video w-full rounded-md object-cover lg:max-h-72" />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── options ── */}
        <section className="bg-card rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("detail.options")}</h2>
            <span className="text-muted-foreground text-xs">
              {t("detail.totalPool")} <span className="text-foreground font-semibold">{naira(market.pool_kobo)}</span>
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {market.options.map((o) => {
              const winner = market.settled_option_id === o.id;
              return (
                <div key={o.id} className={`rounded-md p-3 ${winner ? "bg-primary/15" : "bg-muted/60"}`}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {o.label}
                      {winner && <span className="text-primary ml-2 text-xs font-semibold uppercase">{t("detail.winner")}</span>}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {naira(o.pool_kobo)} · {t("card.wagers", { count: o.line_count })}
                    </span>
                  </div>
                  <div className="bg-background/60 mt-2 h-2 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(o.share_percent, 100)}%` }} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px]">{t("detail.share", { percent: o.share_percent.toFixed(0) })}</p>
                </div>
              );
            })}
            {market.pool_kobo === 0 && <p className="text-muted-foreground text-xs">{t("detail.noStakes")}</p>}
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            {t("detail.terms", {
              rake: market.rake_bps / 100,
              fee: market.cancel_fee_bps / 100,
              min: naira(market.min_stake_kobo),
              max: market.max_stake_per_user_kobo ? naira(market.max_stake_per_user_kobo) : "-",
            })}
          </p>
          {market.rules_text && (
            <div className="mt-3">
              <h3 className="text-sm font-medium">{t("detail.rules")}</h3>
              <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{market.rules_text}</p>
            </div>
          )}
        </section>

        {/* ── the viewer's side ── */}
        <aside className="flex flex-col gap-4">
          {canStake && paused ? (
            <div className="bg-card rounded-md p-4 text-sm shadow-sm">{settings?.maintenance_message || t("paused")}</div>
          ) : canStake && (excludedUntil || breakUntil) ? (
            <div className="bg-card rounded-md p-4 text-sm shadow-sm">
              <p>
                {excludedUntil
                  ? t.rich("detail.excluded", { time: () => <LocalTime value={excludedUntil} mode="date" /> })
                  : t.rich("detail.onBreak", { time: () => <LocalTime value={breakUntil} mode="datetime" /> })}
              </p>
              <Link href="/winnings?tab=limits" className="text-primary mt-2 inline-block text-xs font-medium">{t("detail.limitsLink")}</Link>
            </div>
          ) : canStake ? (
            <NeedsAccount action={t("card.place").toLowerCase()} className="bg-card rounded-md p-4 text-sm shadow-sm">
              <Button className="w-full" size="lg" onClick={() => setSheetOpen(true)}>{t("card.place")}</Button>
            </NeedsAccount>
          ) : null}

          {signedIn && market.my_wagers.length > 0 && (
            <section className="bg-card rounded-md p-4 shadow-sm">
              <h2 className="font-semibold">{t("detail.myWagers")}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {market.my_wagers.map((w) => (
                  <div key={w.token} className="bg-muted/60 rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{naira(w.total_stake_kobo)}</span>
                      <Badge variant={w.status === "WON" ? "default" : w.status === "ACTIVE" ? "secondary" : w.status === "LOST" || w.status === "EXPIRED" ? "destructive" : "pending"}>
                        {t(`wagerStatus.${w.status}`)}
                      </Badge>
                    </div>
                    <ul className="text-muted-foreground mt-1 text-xs">
                      {w.lines.map((l) => (
                        <li key={l.option_id}>{t("detail.line", { amount: naira(l.stake_kobo), option: l.option })}</li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground mt-1 text-xs">
                      <LocalTime value={w.created_at} mode="datetime" />
                    </p>
                    {w.status === "WON" && <p className="text-primary mt-1 text-xs font-medium">{t("mine.payout", { amount: naira(w.payout_kobo) })}</p>}
                    {(w.status === "REFUNDED" || w.status === "CANCELLED") && <p className="mt-1 text-xs">{t("mine.refund", { amount: naira(w.refund_kobo) })}</p>}
                    {w.status === "PENDING_PAYMENT" && (
                      <div className="mt-2 flex flex-col gap-1">
                        <p className="text-xs">{t.rich("detail.payExpires", { time: () => <LocalTime value={w.payment_expires_at} mode="time" /> })}</p>
                        {w.payment_url && (
                          <a href={w.payment_url} className="text-primary text-xs font-medium">{t("detail.payNow")}</a>
                        )}
                      </div>
                    )}
                    {w.status === "EXPIRED" && <p className="text-muted-foreground mt-1 text-xs">{t("detail.expired")}</p>}
                    {canCancel(w) && (
                      <Button variant="secondary" size="sm" className="mt-2" onClick={() => setToCancel(w)}>
                        {t("detail.cancel")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      <PlaceWagerSheet market={market} open={sheetOpen} onOpenChange={setSheetOpen} />

      <AlertDialog open={!!toCancel} onOpenChange={(v) => !busy && !v && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel &&
                t("detail.cancelBody", {
                  refund: naira(toCancel.total_stake_kobo - feeFor(toCancel)),
                  fee: market.cancel_fee_bps / 100,
                  feeAmount: naira(feeFor(toCancel)),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("detail.cancelKeep")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doCancel(); }} disabled={busy}>
              {t("detail.cancelConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense>
      <MarketPageInner />
    </Suspense>
  );
}
