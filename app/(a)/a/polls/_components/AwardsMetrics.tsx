"use client";

/**
 * app/(a)/a/polls/_components/AwardsMetrics.tsx
 *
 * The "Metrics" tab of /a/polls: the detailed numbers of ANY awards season, open or past
 * (inbox #432, owner 2 Nov 2026: "i want to be able to still see the detailed metrics from the
 * past awards, admins should still be able to see it").
 *
 * WHY IT EXISTS. The old /a/votes dashboard drew per-section, per-category, per-nominee and
 * per-day numbers from the original awards tables. When the poll engine replaced it, /a/votes
 * left the menu and the engine kept only the published winners of the 2025 season, so no screen
 * reached those numbers any more. Two sources, two views:
 *   - "Season ballots": every poll of the picked edition, per question and option, from the poll
 *     engine's own answers. No phase or date gate, so a closed poll shows what an open one did.
 *   - "Original ballot": the 2025 votes still stored in the original awards tables.
 *
 * VOTE TRACKING (inbox #453 and #457, 2 Nov 2026): each poll also shows where and how people voted
 * (VoteTracking.tsx: started vs finished, devices, account ages, awards per ballot, the safety flag
 * review in VoteFlags.tsx) and each nominee row gains its top country and region, pick switches and
 * the voters its link brought, with a Details row. The edition gets Garena's private live link
 * (GarenaLiveLink.tsx).
 *
 * TALKS TO lib/polls.ts adminEditionMetrics + adminLegacyBallotMetrics, which hit
 * afc_polls/views.py admin_edition_metrics + admin_legacy_ballot_metrics (AFC poll admins only).
 * Mounted by app/(a)/a/polls/page.tsx for admins; an organizer never sees the tab.
 */
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/i18n/number";
import { pollsApi, type AwardsEdition } from "@/lib/polls";

import { GarenaLiveLink } from "./GarenaLiveLink";
import { NomineeDetails, OptionColumns, PollTracking, useDetailsToggle, useOptionColumnHeads } from "./VoteTracking";

export function AwardsMetrics({ editions }: { editions: AwardsEdition[] }) {
  const t = useTranslations("adminPolls");
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("metrics.intro")}</p>
      <Tabs defaultValue="season" className="w-full">
        <TabsList className="h-9 bg-muted">
          <TabsTrigger value="season">{t("metrics.seasonTab")}</TabsTrigger>
          <TabsTrigger value="original">{t("metrics.originalTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="season" className="mt-6">
          <SeasonBallots editions={editions} />
        </TabsContent>
        <TabsContent value="original" className="mt-6">
          <OriginalBallot />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card rounded-md py-6 shadow-sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

/** A flat share bar: a muted track with a primary fill, no outline. */
function ShareBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-24 rounded-sm bg-muted sm:w-40" aria-hidden>
      <div className="h-2 rounded-sm bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <Card className="bg-card rounded-md py-6 shadow-sm">
      <CardContent className="text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

// ── Season ballots: one edition at a time, past ones included ──────────────────────────────

function SeasonBallots({ editions }: { editions: AwardsEdition[] }) {
  const t = useTranslations("adminPolls");
  const [slug, setSlug] = useState(editions[0]?.slug || "");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // quiet: refresh the numbers in place after a ballot review, without the full-page loader.
  const load = useCallback(async (quiet = false) => {
    if (!slug) return;
    if (!quiet) setLoading(true);
    try {
      setData(await pollsApi.adminEditionMetrics(slug));
    } catch (error: any) {
      setData(null);
      toast.error(error?.response?.data?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (editions.length === 0) return <EmptyNote text={t("empty.editions")} />;

  return (
    <div className="space-y-6">
      <div className="max-w-sm space-y-2">
        <Label>{t("metrics.pickSeason")}</Label>
        <Select value={slug} onValueChange={setSlug}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {editions.map((edition) => (
              <SelectItem key={edition.slug} value={edition.slug}>
                {edition.title} ({t(`phase.${edition.phase}`)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <FullLoader />}
      {!loading && data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label={t("metrics.polls")} value={formatNumber(data.totals.polls)} />
            <StatTile label={t("metrics.questions")} value={formatNumber(data.totals.questions)} />
            <StatTile label={t("metrics.answers")} value={formatNumber(data.totals.responses)} />
          </div>
          <GarenaLiveLink editionSlug={slug} initialToken={data.live_view_token || ""} />
          {data.polls.length === 0 && <EmptyNote text={t("metrics.noPolls")} />}
          {data.polls.map((poll: any) => (
            <PollMetrics key={poll.slug} poll={poll} onReviewed={() => load(true)} />
          ))}
        </>
      )}
    </div>
  );
}

function PollMetrics({ poll, onReviewed }: { poll: any; onReviewed?: () => void }) {
  const t = useTranslations("adminPolls");
  const trackingHeads = useOptionColumnHeads();
  const details = useDetailsToggle();
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/a/polls/${poll.slug}`} className="text-lg font-semibold text-primary hover:underline">
          {poll.title}
        </Link>
        {poll.is_closed && <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">{t("metrics.closed")}</Badge>}
        <span className="text-xs text-muted-foreground">
          {t("metrics.answersCount", { count: poll.responses })}
          {poll.closes_at && (
            <>
              {" · "}
              {t(poll.is_closed ? "metrics.closedOn" : "metrics.closesOn")} <LocalTime value={poll.closes_at} mode="date" />
            </>
          )}
        </span>
      </div>
      <PollTracking poll={poll} onReviewed={onReviewed} />
      {poll.questions.map((question: any) => (
        <Card key={question.question_id} className="bg-card rounded-md py-4 shadow-sm">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{question.prompt}</p>
              <span className="text-xs text-muted-foreground">
                {t("metrics.votesTotal", { count: question.total_votes })}
              </span>
            </div>
            {question.total_votes === 0 && question.published_winner_option_id != null && (
              <p className="text-xs text-muted-foreground">
                {t("metrics.publishedOnly", {
                  winner: question.options.find((o: any) => o.option_id === question.published_winner_option_id)?.label || "",
                  count: question.published_winner_votes ?? 0,
                })}
              </p>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-10 p-2 text-xs text-foreground">{t("metrics.option")}</TableHead>
                    <TableHead className="h-10 p-2 text-right text-xs text-foreground">{t("metrics.votes")}</TableHead>
                    <TableHead className="h-10 p-2 text-xs text-foreground">{t("metrics.share")}</TableHead>
                    {trackingHeads.map((label, index) => (
                      <TableHead key={label} className={`h-10 p-2 text-xs text-foreground ${index >= 2 ? "text-right" : ""}`}>
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="h-10 p-2 text-xs text-foreground">
                      <span className="sr-only">{t("tracking.details")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {question.options.map((option: any) => (
                    <Fragment key={option.option_id}>
                      <TableRow>
                        <TableCell className="p-2 text-xs">{option.label}</TableCell>
                        <TableCell className="p-2 text-right text-xs tabular-nums">{formatNumber(option.votes)}</TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center gap-2">
                            <ShareBar percent={option.percent} />
                            <span className="text-xs tabular-nums text-muted-foreground">{option.percent}%</span>
                          </div>
                        </TableCell>
                        <OptionColumns option={option} />
                        <TableCell className="p-2 text-right">
                          <button
                            type="button"
                            className="rounded-sm bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                            aria-expanded={details.isOpen(option.option_id)}
                            onClick={() => details.toggle(option.option_id)}
                          >
                            {details.isOpen(option.option_id) ? t("tracking.hideDetails") : t("tracking.details")}
                          </button>
                        </TableCell>
                      </TableRow>
                      {details.isOpen(option.option_id) && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="p-2">
                            <NomineeDetails option={option} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

// ── Original ballot: the 2025 votes in the original awards tables ──────────────────────────

function OriginalBallot() {
  const t = useTranslations("adminPolls");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pollsApi
      .adminLegacyBallotMetrics()
      .then(setData)
      .catch((error: any) => toast.error(error?.response?.data?.message || t("loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <FullLoader />;
  if (!data || data.totals.votes === 0) return <EmptyNote text={t("metrics.originalEmpty")} />;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("metrics.originalNote")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile label={t("metrics.totalVotes")} value={formatNumber(data.totals.votes)} />
        <StatTile label={t("metrics.totalVoters")} value={formatNumber(data.totals.voters)} />
      </div>

      <SimpleTable
        title={t("metrics.bySection")}
        head={[t("metrics.section"), t("metrics.votes")]}
        rows={data.sections.map((row: any) => [row.section, formatNumber(row.votes)])}
      />

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{t("metrics.byCategory")}</h3>
        {data.categories.map((category: any) => (
          <Card key={category.category} className="bg-card rounded-md py-4 shadow-sm">
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{category.category}</p>
                <span className="text-xs text-muted-foreground">
                  {category.section} · {t("metrics.votesTotal", { count: category.votes })}
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {category.nominees.map((nominee: any) => (
                      <TableRow key={nominee.nominee}>
                        <TableCell className="p-2 text-xs">{nominee.nominee}</TableCell>
                        <TableCell className="p-2 text-right text-xs tabular-nums">{formatNumber(nominee.votes)}</TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center gap-2">
                            <ShareBar percent={nominee.percent} />
                            <span className="text-xs tabular-nums text-muted-foreground">{nominee.percent}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <SimpleTable
        title={t("metrics.timeline")}
        head={[t("metrics.day"), t("metrics.votes")]}
        rows={data.timeline.map((row: any) => [<LocalTime key={row.date} value={row.date} mode="date" />, formatNumber(row.votes)])}
      />
    </div>
  );
}

function SimpleTable({ title, head, rows }: { title: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <Card className="bg-card rounded-md py-4 shadow-sm">
        <CardContent className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {head.map((label, index) => (
                  <TableHead key={label} className={`h-10 p-2 text-xs text-foreground ${index > 0 ? "text-right" : ""}`}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, index) => (
                    <TableCell key={index} className={`p-2 text-xs tabular-nums ${index > 0 ? "text-right" : ""}`}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
