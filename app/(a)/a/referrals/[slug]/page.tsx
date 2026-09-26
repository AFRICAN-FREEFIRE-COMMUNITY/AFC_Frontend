"use client";

// app/(a)/a/referrals/[slug]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One referral program, for head admins (inbox #47; approved mockup screen 6).
//   funnel       link opened -> signed up -> counted, plus pending / held / rejected
//   Leaderboard  counted referrals per player; "Award leaderboard prizes" once the program has ended
//                (POST .../award-ranks/, idempotent)
//   Held         referrals the server held for review (a burst from one network): Count / Release /
//                Reject (POST referrals/admin/referrals/<token>/decide/)
//   To deliver   diamonds, shop items, cash and custom prizes owed; "Mark delivered" with a note
//                (POST referrals/admin/rewards/<token>/deliver/). Coupons deliver themselves.
//   All          every referral, paginated (GET .../referrals/)
// Export CSV downloads GET .../export/. Endpoints: afc_referrals/views.py.
// ─────────────────────────────────────────────────────────────────────────────
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { formatNumber } from "@/lib/i18n/number";
import { PrizeLabel } from "@/components/referrals/PrizeLabel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  errorCode,
  referralsAdmin,
  type AdminProgram,
  type AdminReferral,
  type AdminReward,
  type Page,
  type ReferralStatus,
} from "@/lib/referrals";
import { StatePill } from "../_components/StatePill";

const PAGE = 25;

const STATUS_TONE: Record<ReferralStatus, string> = {
  counted: "bg-primary/15 text-primary",
  pending: "bg-muted text-muted-foreground",
  flagged: "bg-amber-500/15 text-amber-400",
  rejected: "bg-red-500/15 text-red-300",
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "gold" }) {
  return (
    <div className="rounded-lg bg-muted px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${tone === "green" ? "text-primary" : tone === "gold" ? "text-gold" : ""}`}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function usePaged<T>(fetcher: (offset: number) => Promise<Page<T>>) {
  const [page, setPage] = useState<Page<T> | null>(null);
  const [offset, setOffset] = useState(0);
  const load = useCallback(() => {
    fetcher(offset).then(setPage).catch(() => setPage({ results: [], total_count: 0, has_more: false, next_offset: null }));
  }, [fetcher, offset]);
  useEffect(load, [load]);
  return { page, offset, setOffset, reload: load };
}

function Pager({ offset, total, hasMore, onMove }: { offset: number; total: number; hasMore: boolean; onMove: (o: number) => void }) {
  const t = useTranslations("referralsAdmin");
  if (total <= PAGE) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">
        {t("pagination", { from: offset + 1, to: Math.min(offset + PAGE, total), total })}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => onMove(Math.max(0, offset - PAGE))}>
          {t("prev")}
        </Button>
        <Button size="sm" variant="secondary" disabled={!hasMore} onClick={() => onMove(offset + PAGE)}>
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

export default function ReferralProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useTranslations("referralsAdmin");
  const [program, setProgram] = useState<AdminProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<AdminReward | null>(null);
  const [note, setNote] = useState("");

  const loadProgram = useCallback(() => {
    referralsAdmin.get(slug).then(setProgram).catch((err) => setError(errorCode(err)));
  }, [slug]);
  useEffect(loadProgram, [loadProgram]);

  const held = usePaged<AdminReferral>(useCallback((o: number) => referralsAdmin.referrals(slug, "flagged", o, PAGE), [slug]));
  const all = usePaged<AdminReferral>(useCallback((o: number) => referralsAdmin.referrals(slug, "", o, PAGE), [slug]));
  const owed = usePaged<AdminReward>(useCallback((o: number) => referralsAdmin.rewards(slug, "pending", o, PAGE), [slug]));

  const say = (err: unknown) => {
    const code = errorCode(err);
    toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
  };

  const decide = async (r: AdminReferral, action: "count" | "reject" | "release") => {
    setBusy(r.token);
    try {
      await referralsAdmin.decide(r.token, action);
      toast.success(t(`held.done.${action}`));
      held.reload();
      all.reload();
      owed.reload();
      loadProgram();
    } catch (err) {
      say(err);
    } finally {
      setBusy(null);
    }
  };

  const deliver = async () => {
    if (!delivering) return;
    setBusy(delivering.token);
    try {
      await referralsAdmin.deliver(delivering.token, note);
      toast.success(t("deliver.done"));
      setDelivering(null);
      setNote("");
      owed.reload();
      loadProgram();
    } catch (err) {
      say(err);
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await referralsAdmin.exportCsv(slug);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referrals-${slug}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      say(err);
    }
  };

  const awardRanks = async () => {
    setBusy("ranks");
    try {
      const res = await referralsAdmin.awardRanks(slug);
      setProgram(res.program);
      toast.success(t("board.awarded", { count: res.awarded }));
      owed.reload();
    } catch (err) {
      say(err);
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader back title={t("title")} />
        <p className="text-sm text-muted-foreground">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.error")}</p>
      </div>
    );
  }
  if (!program) return <p className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>;

  const f = program.funnel;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const ended = program.state === "ended";
  const rankPrizes = (program.prizes ?? []).filter((p) => p.kind === "rank");

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title={
          <span className="flex flex-wrap items-center gap-3">
            {program.name} <StatePill state={program.state} />
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/a/referrals/${slug}/edit`}>{t("edit")}</Link>
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              {t("exportCsv")}
            </Button>
          </div>
        }
      />

      <section className="rounded-xl bg-card p-4 md:p-6">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat label={t("funnel.clicks")} value={f.clicks} />
          <Stat label={t("funnel.signups")} value={f.signups} />
          <Stat label={t("funnel.counted")} value={f.counted} tone="green" />
          <Stat label={t("funnel.held")} value={f.flagged} tone="gold" />
        </div>
        <p className="mt-2.5 text-sm text-muted-foreground">
          {/* The link rate counts only signups that came through an opened link: people who typed the
              code have no click, and dividing all signups by clicks read "200%" on the walk. */}
          {t("funnel.note", {
            signupRate: pct(f.signups_via_link, f.clicks),
            typed: f.signups_typed,
            countRate: pct(f.counted, f.signups),
            pending: f.pending,
            flagged: f.flagged,
            rejected: f.rejected,
          })}
        </p>
        {program.program_code && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t.rich("programCodeLine", { code: () => <b className="font-mono text-foreground">{program.program_code}</b> })}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-card p-4 md:p-6">
        <Tabs defaultValue="board">
          <ScrollableTabsList>
            <TabsTrigger value="board">{t("tabs.board")}</TabsTrigger>
            <TabsTrigger value="held" className="gap-1.5">
              {t("tabs.held")}
              {f.flagged > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-300">{f.flagged}</span>}
            </TabsTrigger>
            <TabsTrigger value="deliver" className="gap-1.5">
              {t("tabs.deliver")}
              {program.rewards_pending > 0 && <span className="rounded-full bg-muted px-1.5 text-xs">{program.rewards_pending}</span>}
            </TabsTrigger>
            <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          </ScrollableTabsList>

          {/* ── leaderboard ── */}
          <TabsContent value="board" className="mt-4">
            {(program.leaderboard ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("board.empty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="h-10 text-left">
                      {["rank", "player", "counted", "lastCounted", "prizeAtEnd"].map((h) => (
                        <th key={h} className="px-2 font-semibold whitespace-nowrap">{t(`board.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(program.leaderboard ?? []).map((row) => {
                      const prize = rankPrizes.find((p) => p.rank === row.rank);
                      return (
                        <tr key={row.username} className="odd:bg-muted/40">
                          <td className="p-2">#{row.rank}</td>
                          <td className="p-2 font-semibold">
                            <Link href={`/players/${encodeURIComponent(row.username)}`}>{row.username}</Link>
                          </td>
                          <td className="p-2">{row.counted}</td>
                          <td className="p-2 whitespace-nowrap">{row.last_counted_at && <LocalTime value={row.last_counted_at} />}</td>
                          <td className="p-2">{prize && <PrizeLabel prize={prize} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {rankPrizes.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {program.ranks_awarded_at ? (
                  <span className="text-xs text-muted-foreground">
                    {t.rich("board.awardedOn", { date: () => <LocalTime value={program.ranks_awarded_at} mode="date" /> })}
                  </span>
                ) : (
                  <>
                    <Button variant="secondary" disabled={!ended || busy === "ranks"} onClick={awardRanks}>
                      {t("board.award")}
                    </Button>
                    {!ended && (
                      <span className="text-xs text-muted-foreground">
                        {t.rich("board.awardAfter", { date: () => <LocalTime value={program.ends_at} mode="date" /> })}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── held for review ── */}
          <TabsContent value="held" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">{t("held.help")}</p>
            {!held.page ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>
            ) : held.page.results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("held.empty")}</p>
            ) : (
              <ul className="text-sm">
                {held.page.results.map((r) => (
                  <li key={r.token} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5 odd:bg-muted/40">
                    <span className="min-w-0">
                      <b className="block truncate">{r.referred}</b>
                      <span className="text-xs text-muted-foreground">
                        {t.rich("held.via", {
                          referrer: r.referrer ?? t("programCodeRow"),
                          date: () => <LocalTime value={r.created_at} />,
                        })}
                        {r.reason && t.has(`reasons.${r.reason}`) ? `. ${t(`reasons.${r.reason}`)}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy === r.token} onClick={() => decide(r, "count")}>
                        {t("held.count")}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy === r.token} onClick={() => decide(r, "release")}>
                        {t("held.release")}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" disabled={busy === r.token} onClick={() => decide(r, "reject")}>
                        {t("held.reject")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {held.page && <Pager offset={held.offset} total={held.page.total_count} hasMore={held.page.has_more} onMove={held.setOffset} />}
          </TabsContent>

          {/* ── prizes to deliver ── */}
          <TabsContent value="deliver" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">{t("deliver.help")}</p>
            {!owed.page ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>
            ) : owed.page.results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("deliver.empty")}</p>
            ) : (
              <ul className="text-sm">
                {owed.page.results.map((w) => (
                  <li key={w.token} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5 odd:bg-muted/40">
                    <span className="min-w-0">
                      <b className="block truncate">
                        {w.username}: <PrizeLabel prize={w.prize} />
                      </b>
                      <span className="text-xs text-muted-foreground">
                        {t.rich(`deliver.why.${w.kind}`, {
                          count: w.prize.threshold ?? 0,
                          rank: w.prize.rank ?? 0,
                          date: () => <LocalTime value={w.created_at} mode="date" />,
                        })}
                      </span>
                    </span>
                    <Button size="sm" onClick={() => setDelivering(w)}>
                      {w.prize.prize_type === "cash" ? t("deliver.markPaid") : t("deliver.markDelivered")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {owed.page && <Pager offset={owed.offset} total={owed.page.total_count} hasMore={owed.page.has_more} onMove={owed.setOffset} />}
          </TabsContent>

          {/* ── all referrals ── */}
          <TabsContent value="all" className="mt-4">
            {!all.page ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>
            ) : all.page.results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("all.empty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="h-10 text-left">
                      {["newPlayer", "referredBy", "code", "status", "signedUp", "countedAt"].map((h) => (
                        <th key={h} className="px-2 font-semibold whitespace-nowrap">{t(`all.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {all.page.results.map((r) => (
                      <tr key={r.token} className="odd:bg-muted/40">
                        <td className="p-2 font-semibold whitespace-nowrap">{r.referred}</td>
                        <td className="p-2 whitespace-nowrap">{r.referrer ?? t("programCodeRow")}</td>
                        <td className="p-2 font-mono">{r.code}</td>
                        <td className="p-2">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap ${STATUS_TONE[r.status]}`}>
                            {t(`status.${r.status}`)}
                            {r.status === "rejected" && r.reason && t.has(`reasons.${r.reason}`) ? `: ${t(`reasons.${r.reason}`)}` : ""}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap"><LocalTime value={r.created_at} /></td>
                        <td className="p-2 whitespace-nowrap">{r.counted_at && <LocalTime value={r.counted_at} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {all.page && <Pager offset={all.offset} total={all.page.total_count} hasMore={all.page.has_more} onMove={all.setOffset} />}
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={delivering !== null} onOpenChange={(open) => !open && setDelivering(null)}>
        <DialogContent className="grid-cols-[minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>{t("deliver.title")}</DialogTitle>
            <DialogDescription>{t("deliver.playerSees")}</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="deliver-note" className="mb-1.5 block text-sm font-semibold">
              {t("deliver.note")}
            </label>
            <Input id="deliver-note" value={note} maxLength={200} placeholder={t("deliver.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDelivering(null)}>
              {t("deliver.cancel")}
            </Button>
            <Button onClick={deliver} disabled={busy === delivering?.token}>
              {t("deliver.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
