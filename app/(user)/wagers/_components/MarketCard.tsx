"use client";

/**
 * app/(user)/wagers/_components/MarketCard.tsx - one market in the list.
 *
 * A filled surface (no hairline, owner rule 2026-08-17), the event as a small caption, the
 * status as a filled badge, the pool, the lock time in the viewer's zone (LocalTime), and the
 * viewer's own stake when they have one. The whole card is the link (R22: by slug).
 *
 * CONNECTS TO: lib/api/wagers.ts MarketSummary; copy in messages/*\/wagers.json ("card", "status").
 */
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/LocalTime";
import { mediaUrl, naira, type MarketSummary } from "@/lib/api/wagers";

function statusVariant(m: MarketSummary): "default" | "secondary" | "destructive" | "pending" {
  if (m.status === "OPEN" && m.is_open_for_stakes) return "default";
  if (m.status === "VOID") return "destructive";
  if (m.status === "SETTLED") return "secondary";
  return "pending";
}

export function MarketCard({ market }: { market: MarketSummary }) {
  const t = useTranslations("wagers");
  const open = market.status === "OPEN" && market.is_open_for_stakes;
  const status = open ? "OPEN" : market.status === "OPEN" ? "LOCKED" : market.status;
  const image = mediaUrl(market.image);

  return (
    <Link
      href={`/wagers/${market.slug}`}
      className="bg-card text-card-foreground flex min-w-0 flex-col gap-3 rounded-md p-4 shadow-sm focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
    >
      {image && (
        <Image src={image} alt="" width={640} height={360} unoptimized className="aspect-video w-full rounded-md object-cover" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-[11px] uppercase tracking-wide">{market.event.name}</p>
          <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug">{market.title}</h3>
        </div>
        <Badge variant={statusVariant(market)} className="shrink-0">
          {t(`status.${status}`)}
        </Badge>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>
          {t("card.pool")} <span className="text-foreground font-semibold">{naira(market.pool_kobo)}</span>
        </span>
        <span>{t("card.wagers", { count: market.wager_count })}</span>
        {market.featured && <span className="text-primary font-medium">{t("card.featured")}</span>}
      </div>

      <div className="text-muted-foreground text-xs">
        {open ? (
          <span>{t.rich("card.locksIn", { time: () => <LocalTime value={market.lock_at} mode="relative" /> })}</span>
        ) : market.status === "SETTLED" && market.settled_option ? (
          <span className="text-foreground">{t("card.settledAs", { option: market.settled_option })}</span>
        ) : market.status === "VOID" ? (
          <span>{t("card.void")}</span>
        ) : (
          <span>{t("card.awaiting")}</span>
        )}
      </div>

      {market.my_stake_kobo ? (
        <p className="text-primary text-xs font-medium">{t("card.yourStake", { amount: naira(market.my_stake_kobo) })}</p>
      ) : null}
    </Link>
  );
}
