"use client";

/**
 * components/referrals/ReferralsTab.tsx
 * The "Referrals" tab on the player's OWN profile (inbox #47; approved mockup screen 3). Only the
 * owner ever sees it (R26, R58): it lives on /profile, which is the signed-in person's page, and its
 * data comes from GET referrals/mine/ with their session.
 *
 * Per running program they may refer in: their link and code (copy, WhatsApp, the phone's share
 * sheet, a QR), the numbers (link opened, signed up, counted, rank), the progress to the next
 * milestone, and the program's prizes. Then their rewards (coupon codes shown here, one use) and, if
 * they joined through somebody, that line.
 *
 * How it connects: lib/referrals.ts getMine(); prizes through PrizeLabel / PrizeWhen (viewer's
 * currency); the QR is the same white plate + download as the QR codes feature
 * (components/qr/qrDownload.ts); dates through LocalTime. Opened by /profile#referrals, which is
 * where the prize notification links (afc_referrals/notify.py).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "react-qr-code";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { downloadQrPng } from "@/components/qr/qrDownload";
import { PrizeLabel, PrizeWhen } from "@/components/referrals/PrizeLabel";
import { env } from "@/lib/env";
import { getMine, type Mine, type MyProgram, type MyReward } from "@/lib/referrals";

function useCopy() {
  const t = useTranslations("referrals");
  return useCallback(
    async (text: string, done: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(done);
      } catch {
        toast.error(t("tab.copyFailed"));
      }
    },
    [t],
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "green" | "gold" }) {
  return (
    <div className="rounded-lg bg-muted px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${tone === "green" ? "text-primary" : tone === "gold" ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

function ProgramBlock({ program }: { program: MyProgram }) {
  const t = useTranslations("referrals");
  const copy = useCopy();
  const link = `${env.NEXT_PUBLIC_URL.replace(/\/$/, "")}${program.link_path}`;
  const shareText = t("tab.shareText", { link });
  const rule =
    program.count_rule === "event" && program.count_event
      ? t("rules.eventNamed", { event: program.count_event.name })
      : t(`rules.${program.count_rule}`);
  const next = program.next_milestone;
  const nextPrize = next ? program.prizes.find((p) => p.kind === "milestone" && p.threshold === next.threshold) : null;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: program.name, text: shareText, url: link });
      } catch {
        // The person closed the share sheet: nothing to do
      }
    } else {
      await copy(link, t("tab.linkCopied"));
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">{program.name}</h2>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{t("tab.running")}</span>
          <span className="text-sm text-muted-foreground">
            {t.rich("tab.until", { date: () => <LocalTime value={program.ends_at} mode="date" /> })}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{rule}</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_280px] space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("tab.yourLink")}</p>
            <div className="mt-1 flex min-w-0 items-center gap-2 rounded-md bg-muted py-1.5 pr-1.5 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted-foreground">{link}</code>
              <Button size="sm" variant="ghost" className="bg-background" onClick={() => copy(link, t("tab.linkCopied"))}>
                {t("tab.copy")}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("tab.yourCode")}</span>
            <span className="font-mono text-xl font-bold tracking-[0.12em]">{program.code}</span>
            <Button size="sm" variant="secondary" onClick={() => copy(program.code, t("tab.codeCopied"))}>
              {t("tab.copyCode")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                {t("tab.whatsapp")}
              </a>
            </Button>
            <Button size="sm" variant="secondary" onClick={share}>
              {t("tab.share")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadQrPng(link, `afc-invite-${program.code.toLowerCase()}`)}>
              {t("tab.downloadQr")}
            </Button>
          </div>
        </div>
        {/* A camera reads dark on light: fixed white plate whatever the theme (as components/TotpQrCode) */}
        <div className="w-28 shrink-0 rounded-lg bg-white p-2.5" aria-hidden="true">
          <QRCode value={link} level="M" bgColor="#FFFFFF" fgColor="#0b0d10" style={{ width: "100%", height: "auto" }} />
        </div>
      </div>

      <div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat label={t("tab.stats.clicks")} value={program.clicks} />
          <Stat label={t("tab.stats.signups")} value={program.signups} />
          <Stat label={t("tab.stats.counted")} value={program.counted} tone="green" />
          <Stat label={t("tab.stats.rank")} value={program.rank ? `#${program.rank}` : "-"} tone="gold" />
        </div>
        {program.pending > 0 && <p className="mt-1.5 text-xs text-muted-foreground">{t("tab.pendingNote", { count: program.pending })}</p>}
      </div>

      {next && nextPrize ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{t("tab.nextPrize")}</h3>
            <span className="text-sm">{t("tab.nextOf", { counted: program.counted, threshold: next.threshold })}</span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={next.threshold}
            aria-valuenow={program.counted}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (program.counted / next.threshold) * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm">{t.rich("tab.nextMore", { count: next.remaining, prize: () => <b><PrizeLabel prize={nextPrize} /></b> })}</p>
        </div>
      ) : program.prizes.some((p) => p.kind === "milestone") ? (
        <p className="text-sm text-muted-foreground">{t("tab.allMilestones")}</p>
      ) : null}

      {program.prizes.length > 0 && (
        <div>
          <h3 className="mb-2.5 font-semibold">{t("tab.prizesTitle")}</h3>
          <ul className="grid gap-2">
            {program.prizes.map((prize) => {
              const earned = prize.kind === "milestone" && (prize.threshold ?? Infinity) <= program.counted;
              return (
                <li key={prize.prize_id} className={`flex items-center gap-3 rounded-lg p-2.5 ${earned ? "bg-primary/15" : "bg-muted"}`}>
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-md font-extrabold ${
                      earned ? "bg-primary text-primary-foreground" : "bg-background"
                    } ${prize.kind === "welcome" ? "text-[11px]" : ""}`}
                  >
                    {prize.kind === "milestone" ? prize.threshold : prize.kind === "rank" ? `#${prize.rank}` : t("tab.each")}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate"><PrizeLabel prize={prize} /></b>
                    <span className="text-xs text-muted-foreground">
                      <PrizeWhen prize={prize} />
                      {earned ? `. ${t("tab.earned")}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function RewardRow({ reward }: { reward: MyReward }) {
  const t = useTranslations("referrals");
  const copy = useCopy();
  const ready = reward.status === "delivered";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 odd:bg-muted/60">
      <span className="min-w-0">
        <b className="block truncate font-semibold"><PrizeLabel prize={reward.prize} /></b>
        <span className="text-xs text-muted-foreground">
          {reward.coupon_code
            ? t.rich("tab.couponCode", { code: () => <b className="font-mono text-foreground">{reward.coupon_code}</b> })
            : t.rich("tab.rewardFrom", { program: reward.program, date: () => <LocalTime value={reward.created_at} mode="date" /> })}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {reward.coupon_code && (
          <Button size="sm" variant="secondary" onClick={() => copy(reward.coupon_code!, t("tab.couponCopied"))}>
            {t("tab.copy")}
          </Button>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            ready ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {reward.coupon_code && ready ? t("tab.rewardStatus.ready") : t(`tab.rewardStatus.${reward.status === "delivered" ? "delivered" : "pending"}`)}
        </span>
      </span>
    </li>
  );
}

export function ReferralsTab() {
  const t = useTranslations("referrals");
  const [data, setData] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);

  // The effect only fetches; state is set in the promise callbacks (react-hooks/set-state-in-effect)
  const fetchMine = useCallback(() => {
    getMine()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    fetchMine();
  }, [fetchMine]);
  const retry = () => {
    setFailed(false);
    fetchMine();
  };

  if (failed) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <Button className="mt-3" variant="secondary" onClick={retry}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-3 py-2" aria-busy="true">
        <div className="h-6 w-1/2 rounded bg-muted" />
        <div className="h-24 rounded-lg bg-muted/60" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {data.programs.length === 0 ? (
        <div className="rounded-lg bg-muted/40 p-5">
          <p className="font-semibold">{t("tab.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("tab.emptyBody")}</p>
        </div>
      ) : (
        data.programs.map((program) => <ProgramBlock key={program.slug} program={program} />)
      )}

      {data.rewards.length > 0 && (
        <section>
          <h3 className="mb-2.5 font-semibold">{t("tab.rewardsTitle")}</h3>
          <ul className="text-sm">{data.rewards.map((r) => <RewardRow key={r.token} reward={r} />)}</ul>
        </section>
      )}

      {data.referred_by && (
        <p className="text-sm text-muted-foreground">
          {data.referred_by.referrer
            ? t.rich("tab.joinedThrough", {
                referrer: data.referred_by.referrer,
                program: data.referred_by.program,
                b: (chunks) => <b className="text-foreground">{chunks}</b>,
              })
            : t("tab.joinedThroughProgram", { program: data.referred_by.program })}{" "}
          {t(`tab.referralStatus.${data.referred_by.status}`)}
        </p>
      )}
    </div>
  );
}
