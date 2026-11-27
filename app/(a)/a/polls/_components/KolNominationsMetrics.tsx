"use client";

/**
 * app/(a)/a/polls/_components/KolNominationsMetrics.tsx
 *
 * The Metrics tab's "Nominations round": the KOL creators' nomination round in detail (inbox #653, owner 27 Nov 2026:
 * "the metric page shows no information and i filled something. the metrics page should show very very detailed
 * info, who was most searched (how many times), average time to nominate, stuff like that a lot of metrics and all
 * very detailed"). Built to the mockup the owner approved (WEBSITE/mockups/kol-metrics/, "ship it, then build the
 * metrics"), section by section:
 *   headline tiles; invite-to-counting steps; time to nominate; most searched creators, searches that found nothing
 *   and the words most typed; per award; activity by day and hour; changes; self-only ballots (with a copied
 *   reminder) and write-ins; devices and countries; codes never opened (with Email code); emails; a CSV of one row
 *   per creator.
 *
 * TALKS TO lib/kolNominations.ts kolNominationsAdminApi.editions + .metrics + .sendCodeEmails, which hit AFC-B
 * polls/admin/kol-nominations/ (afc_polls/kol_metrics.py admin_metrics, kol_nominations.admin_emails). Searches,
 * opens and first counts are recorded by the ballot (kol_metrics.record_open / record_save / search_log, the page
 * app/(user)/awards/_kol/KolNominateAward.tsx reports searches). Mounted by AwardsMetrics.tsx (AFC poll admins) and
 * by app/(a)/a/polls/page.tsx for a KOL Admin (Garena's staff), who see only the KOL round.
 *
 * Design: AFC constants (filled cards, no strokes, compact text-xs tables, green bars on a muted track, no glow).
 */
import axios from "axios";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryName } from "@/lib/i18n/countryName";
import { formatNumber } from "@/lib/i18n/number";
import {
  kolNominationsAdminApi,
  type NominationEdition,
  type NominationMetrics,
} from "@/lib/kolNominations";

const SHOW_FIRST = 8;

/** Whole seconds as "48s", "4m 55s", "3h 12m", "2d 3h", in the tab's words. */
function useDuration() {
  const t = useTranslations("adminPolls");
  return useCallback(
    (seconds: number | null | undefined) => {
      if (seconds === null || seconds === undefined) return t("kolMetrics.none");
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (d) return t("kolMetrics.dur.days", { d, h });
      if (h) return m ? t("kolMetrics.dur.hours", { h, m }) : t("kolMetrics.dur.hoursOnly", { h });
      if (m) return s ? t("kolMetrics.dur.minutes", { m, s }) : t("kolMetrics.dur.minutesOnly", { m });
      return t("kolMetrics.dur.seconds", { s });
    },
    [t],
  );
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** A flat bar: muted track, primary fill, rounded data end, no outline (AFC constants). */
function Bar({ percent, label, gold = false }: { percent: number; label: string; gold?: boolean }) {
  return (
    <div className="h-2 w-full rounded-sm bg-muted" role="img" aria-label={label} title={label}>
      <div
        className={`h-2 rounded-sm ${gold ? "bg-gold" : "bg-primary"}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/** Vertical bars with the count printed above and the label under, all bottoms on one line. */
function Columns({ rows, height = 140 }: { rows: { label: string; count: number; title: string }[]; height?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {rows.map((r, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={r.title}>
          <span className="text-[11px] font-semibold tabular-nums">{formatNumber(r.count)}</span>
          <div
            className="w-full max-w-12 rounded-t bg-primary"
            style={{ height: `${Math.max(2, (r.count / max) * 100)}%` }}
            role="img"
            aria-label={r.title}
          />
          <span className="min-h-[2.4em] text-center text-[11px] leading-tight text-muted-foreground">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="bg-card rounded-md py-4 shadow-sm">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <Card className="bg-card min-w-0 rounded-md py-5 shadow-sm">
      <CardContent className="space-y-3 px-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {lead && <p className="mt-0.5 text-xs text-muted-foreground">{lead}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Label / value pairs, value right-aligned. */
function Pairs({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Quiet({ text }: { text: string }) {
  return <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">{text}</p>;
}

/** A compact table in the AFC admin idiom (text-xs, h-10 headers in foreground, p-2 cells), scrolling inside. */
function SmallTable({ heads, rows, right = [] }: { heads: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {heads.map((h, i) => (
              <TableHead key={h} className={`h-10 p-2 text-xs text-foreground ${right.includes(i) ? "text-right" : ""}`}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, r) => (
            <TableRow key={r}>
              {cells.map((cell, i) => (
                <TableCell key={i} className={`p-2 text-xs ${right.includes(i) ? "text-right tabular-nums" : ""}`}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Who({ name, handle }: { name: string; handle: string }) {
  return (
    <span>
      {name} {handle && <span className="text-muted-foreground">@{handle}</span>}
    </span>
  );
}

export function KolNominationsMetrics({ editions: given }: { editions?: NominationEdition[] }) {
  const t = useTranslations("adminPolls");
  const [editions, setEditions] = useState<NominationEdition[] | null>(given ?? null);
  const [slug, setSlug] = useState<string>("");
  const [data, setData] = useState<NominationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // The editions that HAVE a round (the same list as the Nominations tab), unless the page already has them.
  useEffect(() => {
    if (given) return;
    kolNominationsAdminApi
      .editions()
      .then((answer) => setEditions(answer.results))
      .catch(() => setEditions([]));
  }, [given]);
  useEffect(() => {
    if (editions?.length && !slug) setSlug(editions[0].slug);
  }, [editions, slug]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setFailed(false);
    try {
      setData(await kolNominationsAdminApi.metrics(slug));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    load();
  }, [load]);

  if (editions === null) return <FullLoader />;
  if (!editions.length) return <Quiet text={t("kolMetrics.noRound")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {editions.length > 1 ? (
          <div className="w-full max-w-sm space-y-2">
            <Label>{t("kolMetrics.pickEdition")}</Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {editions.map((e) => (
                  <SelectItem key={e.slug} value={e.slug}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-lg font-semibold text-primary">{editions[0].title}</p>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            {t("kolMetrics.refresh")}
          </Button>
          {data && <CsvButton data={data} slug={slug} />}
        </div>
      </div>
      {loading && !data && <FullLoader />}
      {failed && !data && (
        <div className="space-y-3 text-center">
          <Quiet text={t("kolMetrics.loadFailed")} />
          <Button variant="secondary" size="sm" onClick={load}>
            {t("kolMetrics.tryAgain")}
          </Button>
        </div>
      )}
      {data && <MetricsBody data={data} slug={slug} onChanged={load} />}
    </div>
  );
}

function CsvButton({ data, slug }: { data: NominationMetrics; slug: string }) {
  const t = useTranslations("adminPolls");
  const download = () => {
    // One row per creator on Garena's list, the same columns as metrics().creators (afc_polls/kol_metrics.py).
    const heads = [
      "name", "handle", "country", "has_email", "contact_given", "emailed", "opened", "first_open", "visits",
      "searches", "awards_with_pick", "counts", "counted_at", "seconds_to_count", "changes", "ballot_counts_switch",
    ] as const;
    const cell = (value: unknown) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [heads.join(","), ...data.creators.map((row) => heads.map((h) => cell(row[h])).join(","))];
    const url = URL.createObjectURL(new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-nominations-metrics.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="secondary" size="sm" onClick={download}>
      {t("kolMetrics.csv")}
    </Button>
  );
}

function MetricsBody({ data, slug, onChanged }: { data: NominationMetrics; slug: string; onChanged: () => void }) {
  const t = useTranslations("adminPolls");
  const locale = useLocale();
  const dur = useDuration();
  const n = (value: number | null | undefined) => (value === null || value === undefined ? t("kolMetrics.none") : formatNumber(value));
  const h = data.headline;
  const voters = h.voters;
  const started = data.funnel.find((f) => f.key === "picked")?.count ?? 0;
  const [allSearched, setAllSearched] = useState(false);
  const [allUnopened, setAllUnopened] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  const hourMax = useMemo(() => Math.max(1, ...data.activity.by_hour), [data.activity.by_hour]);
  const deviceTotal = data.devices.reduce((sum, d) => sum + d.count, 0);
  const countryMax = Math.max(1, ...data.countries.map((c) => c.ballots));

  const then = (value: string) => {
    if (value.startsWith("picked:")) return t("kolMetrics.then.picked", { name: value.slice(7) });
    if (value.startsWith("added:")) return t("kolMetrics.then.added", { name: value.slice(6) });
    return t("kolMetrics.then.nothing");
  };

  const copyReminder = async (text: string, name: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("kolMetrics.reminderCopied", { name }));
    } catch {
      toast.error(t("kolMetrics.copyFailed"));
    }
  };

  const emailCode = async (creatorId: number, name: string) => {
    setSending(creatorId);
    try {
      await kolNominationsAdminApi.sendCodeEmails(slug, { creator_ids: [creatorId] });
      toast.success(t("kolMetrics.emailQueued", { name }));
      onChanged();
    } catch (err) {
      const code = axios.isAxiosError(err) ? (err.response?.data as { code?: string } | undefined)?.code : undefined;
      toast.error(code && t.has(`kolNom.errors.${code}`) ? t(`kolNom.errors.${code}`) : t("kolNom.failed"));
    } finally {
      setSending(null);
    }
  };

  const searched = allSearched ? data.searches.most_searched : data.searches.most_searched.slice(0, SHOW_FIRST);
  const unopened = allUnopened ? data.codes.never_opened : data.codes.never_opened.slice(0, SHOW_FIRST);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {data.round.opens_at && (
          <>
            {t("kolMetrics.opened")} <LocalTime value={data.round.opens_at} />{" · "}
          </>
        )}
        {data.round.closes_at && (
          <>
            {t("kolMetrics.closes")} <LocalTime value={data.round.closes_at} />{" · "}
          </>
        )}
        {t("kolMetrics.updated")} <LocalTime value={data.generated_at} mode="time" />
      </p>
      {data.time.from_first_save > 0 && (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t("kolMetrics.recordingNote", { n: data.time.from_first_save })}
        </p>
      )}

      {/* ── headline ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Tile label={t("kolMetrics.tiles.counting")} value={n(h.counting)}
          sub={t("kolMetrics.tiles.countingSub", { total: voters, pct: pct(h.counting, voters) })} />
        <Tile label={t("kolMetrics.tiles.started")} value={n(h.started_not_counting)} sub={t("kolMetrics.tiles.startedSub")} />
        <Tile label={t("kolMetrics.tiles.opened")} value={n(h.codes_opened)}
          sub={t("kolMetrics.tiles.openedSub", { n: h.never_opened })} />
        <Tile label={t("kolMetrics.tiles.time")} value={dur(h.median_seconds)}
          sub={t("kolMetrics.tiles.timeSub", { avg: dur(h.average_seconds) })} />
        <Tile label={t("kolMetrics.tiles.searches")} value={n(h.searches)}
          sub={t("kolMetrics.tiles.searchesSub", { by: h.searchers, nothing: h.searches_nothing })} />
        <Tile label={t("kolMetrics.tiles.emails")} value={n(h.code_emails_sent)}
          sub={t("kolMetrics.tiles.emailsSub", { failed: h.code_emails_failed, none: h.no_address })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── invite to counting ── */}
        <Section title={t("kolMetrics.funnel.title")} lead={t("kolMetrics.funnel.lead", { total: voters })}>
          <div className="space-y-3">
            {data.funnel.map((step) => (
              <div key={step.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{t(`kolMetrics.funnel.${step.key}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    <b className="text-sm text-foreground">{formatNumber(step.count)}</b> · {pct(step.count, voters)}%
                  </span>
                </div>
                <Bar percent={pct(step.count, voters)}
                  label={t("kolMetrics.funnel.bar", { step: t(`kolMetrics.funnel.${step.key}`), n: step.count, total: voters })} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── time to nominate ── */}
        <Section title={t("kolMetrics.time.title")} lead={t("kolMetrics.time.lead", { n: data.time.ballots })}>
          {data.time.ballots ? (
            <>
              <Columns rows={data.time.bins.map((b) => ({
                label: t(`kolMetrics.time.bins.${b.key}`), count: b.count,
                title: t("kolMetrics.time.binTitle", { bin: t(`kolMetrics.time.bins.${b.key}`), n: b.count }),
              }))} />
              <Pairs rows={[
                [t("kolMetrics.time.median"), dur(data.time.median_seconds)],
                [t("kolMetrics.time.average"), dur(data.time.average_seconds)],
                [t("kolMetrics.time.openToPick"), dur(data.time.open_to_first_pick_median)],
                [t("kolMetrics.time.pickToCount"), dur(data.time.first_pick_to_counting_median)],
                [t("kolMetrics.time.fastest"), dur(data.time.fastest_seconds)],
                [t("kolMetrics.time.longest"), dur(data.time.longest_seconds)],
                [t("kolMetrics.time.oneVisit"), n(data.time.one_visit)],
                [t("kolMetrics.time.cameBack"), n(data.time.came_back)],
                [t("kolMetrics.time.visits"), n(data.time.visits_average)],
              ]} />
            </>
          ) : (
            <Quiet text={t("kolMetrics.time.empty")} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── searches ── */}
        <Section title={t("kolMetrics.search.title")} lead={t("kolMetrics.search.lead")}>
          {searched.length ? (
            <>
              <SmallTable
                heads={["#", t("kolMetrics.col.creator"), t("kolMetrics.col.searches"), t("kolMetrics.col.by"), t("kolMetrics.col.picks")]}
                right={[0, 2, 3, 4]}
                rows={searched.map((row, i) => [
                  `#${i + 1}`, <Who key="w" name={row.name} handle={row.handle} />, formatNumber(row.searches),
                  formatNumber(row.by), formatNumber(row.picks),
                ])}
              />
              {data.searches.most_searched.length > SHOW_FIRST && (
                <Button variant="secondary" size="sm" onClick={() => setAllSearched((v) => !v)}>
                  {allSearched ? t("kolMetrics.showFewer") : t("kolMetrics.showAll", { n: data.searches.most_searched.length })}
                </Button>
              )}
            </>
          ) : (
            <Quiet text={t("kolMetrics.search.empty")} />
          )}
        </Section>
        <Section title={t("kolMetrics.nothing.title")} lead={t("kolMetrics.nothing.lead")}>
          {data.searches.found_nothing.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.typed"), t("kolMetrics.col.times"), t("kolMetrics.col.by"), t("kolMetrics.col.then")]}
              right={[1, 2]}
              rows={data.searches.found_nothing.map((row) => [
                `"${row.query}"`, formatNumber(row.times), formatNumber(row.by), then(row.then),
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.nothing.empty")} />
          )}
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.typed.title")}</h4>
          {data.searches.most_typed.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.typed"), t("kolMetrics.col.times"), t("kolMetrics.col.endedOn")]}
              right={[1]}
              rows={data.searches.most_typed.map((row) => [
                `"${row.query}"`, formatNumber(row.times),
                t("kolMetrics.typed.endedOn", { name: row.top.name, n: row.top.times }),
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.search.empty")} />
          )}
        </Section>
      </div>

      {/* ── by award ── */}
      <Section title={t("kolMetrics.awards.title")} lead={t("kolMetrics.awards.lead", { n: started })}>
        <SmallTable
          heads={[
            t("kolMetrics.col.award"), t("kolMetrics.col.withPick"), t("kolMetrics.col.empty"), t("kolMetrics.col.onlySelf"),
            t("kolMetrics.col.avgPicks"), t("kolMetrics.col.oneToSix"), t("kolMetrics.col.pickedSelf"),
            t("kolMetrics.col.writeIns"), t("kolMetrics.col.nominees"), t("kolMetrics.col.top"),
          ]}
          right={[1, 2, 3, 4, 6, 7, 8]}
          rows={data.awards.map((a) => {
            const max = Math.max(1, ...a.distribution);
            return [
              a.name, formatNumber(a.with_pick),
              a.empty ? <Badge key="e" variant="outline" className="rounded-full px-2 py-0.5 text-xs text-gold">{formatNumber(a.empty)}</Badge> : "0",
              a.only_self ? <Badge key="o" variant="outline" className="rounded-full px-2 py-0.5 text-xs text-gold">{formatNumber(a.only_self)}</Badge> : "0",
              formatNumber(a.avg_picks, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
              <div key="d" className="flex h-6 items-end gap-0.5" role="img"
                aria-label={t("kolMetrics.awards.distLabel", { counts: a.distribution.join(", ") })}>
                {a.distribution.map((count, k) => (
                  <span key={k} className="block w-2 rounded-t-sm bg-primary"
                    style={{ height: `${Math.max(8, (count / max) * 100)}%` }}
                    title={t("kolMetrics.awards.distTitle", { n: count, picks: k + 1 })} />
                ))}
              </div>,
              formatNumber(a.picked_self), formatNumber(a.write_in_picks), formatNumber(a.nominees),
              a.top ? t("kolMetrics.awards.top", { name: a.top.name, n: a.top.picks }) : t("kolMetrics.none"),
            ];
          })}
        />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── activity ── */}
        <Section title={t("kolMetrics.activity.title")}
          lead={data.activity.peak_hour !== null
            ? t("kolMetrics.activity.lead", { from: String(data.activity.peak_hour).padStart(2, "0"), to: String((data.activity.peak_hour + 1) % 24).padStart(2, "0") })
            : t("kolMetrics.activity.leadNoPeak")}>
          <Columns height={120} rows={data.activity.days.map((d) => ({
            label: "", count: d.counted, title: t("kolMetrics.activity.dayTitle", { day: d.day, n: d.counted }),
          }))} />
          <div className="flex justify-between gap-1">
            {data.activity.days.map((d) => (
              <span key={d.day} className="flex-1 text-center text-[11px] text-muted-foreground">
                <LocalTime value={d.day} mode="date" />
              </span>
            ))}
          </div>
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.activity.byHour")}</h4>
          <div className="flex h-11 items-end gap-0.5">
            {data.activity.by_hour.map((count, hour) => (
              <span key={hour} className="block flex-1 rounded-t-sm bg-primary"
                style={{ height: `${Math.max(3, (count / hourMax) * 100)}%` }}
                title={t("kolMetrics.activity.hourTitle", { hour: String(hour).padStart(2, "0"), n: count })} />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>00:00</span><span>12:00</span><span>23:00</span>
          </div>
        </Section>

        {/* ── changes ── */}
        <Section title={t("kolMetrics.changes.title")} lead={t("kolMetrics.changes.lead")}>
          <Pairs rows={[
            [t("kolMetrics.changes.total"), n(data.changes.total)],
            [t("kolMetrics.changes.after"), n(data.changes.after_counting)],
            [t("kolMetrics.changes.perBallot"), n(data.changes.per_ballot_average)],
            [t("kolMetrics.changes.mostChanged"), data.changes.most_changed_award
              ? t("kolMetrics.changes.mostChangedValue", { name: data.changes.most_changed_award.name, n: data.changes.most_changed_award.count })
              : t("kolMetrics.none")],
            [t("kolMetrics.changes.picksEmails"), t("kolMetrics.changes.picksEmailsValue", { n: data.changes.picks_emails, by: data.changes.picks_emails_by })],
            [t("kolMetrics.changes.contact"), n(data.changes.contact_given)],
          ]} />
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.changes.removedTitle")}</h4>
          {data.changes.most_removed.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.creator"), t("kolMetrics.col.removed"), t("kolMetrics.col.stillPicked")]}
              right={[1, 2]}
              rows={data.changes.most_removed.map((row) => [
                <Who key="w" name={row.name} handle={row.handle} />, formatNumber(row.removed), formatNumber(row.picks),
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.changes.empty")} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── self-nominations and write-ins ── */}
        <Section title={t("kolMetrics.self.title")} lead={t("kolMetrics.self.lead", { n: data.self.picked_self })}>
          {data.self.only_self.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.creator"), t("kolMetrics.col.awardsOnlySelf"), t("kolMetrics.col.lastSaved"), ""]}
              right={[1]}
              rows={data.self.only_self.map((row) => [
                <Who key="w" name={row.name} handle={row.handle} />, formatNumber(row.awards_only_self),
                row.saved_at ? <LocalTime key="s" value={row.saved_at} /> : t("kolMetrics.none"),
                <Button key="b" variant="secondary" size="sm" onClick={() => copyReminder(row.reminder, row.name)}>
                  {t("kolMetrics.copyReminder")}
                </Button>,
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.self.empty")} />
          )}
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.writeIns.title")}</h4>
          {data.self.write_ins.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.creator"), t("kolMetrics.col.addedBy"), t("kolMetrics.col.picks")]}
              right={[2]}
              rows={data.self.write_ins.map((row) => [
                <Who key="w" name={row.name} handle={row.handle} />, row.added_by?.name ?? t("kolMetrics.none"),
                formatNumber(row.picks),
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.writeIns.empty")} />
          )}
        </Section>

        {/* ── devices and countries ── */}
        <Section title={t("kolMetrics.where.title")} lead={t("kolMetrics.where.lead")}>
          {deviceTotal ? (
            <div className="space-y-2">
              {data.devices.map((d) => (
                <div key={d.key} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 text-sm">
                  <span>{t.has(`kolMetrics.device.${d.key}`) ? t(`kolMetrics.device.${d.key}`) : d.key}</span>
                  <Bar percent={pct(d.count, deviceTotal)} label={t("kolMetrics.where.deviceBar", { n: d.count, total: deviceTotal })} />
                  <span className="text-xs text-muted-foreground"><b className="text-foreground">{formatNumber(d.count)}</b> · {pct(d.count, deviceTotal)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <Quiet text={t("kolMetrics.where.empty")} />
          )}
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.where.countries")}</h4>
          {data.countries.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.country"), t("kolMetrics.col.ballots"), t("kolMetrics.col.counting"), t("kolMetrics.col.onList"), t("kolMetrics.col.share")]}
              right={[1, 2, 3]}
              rows={data.countries.map((c) => [
                c.country ? countryName(c.country, locale) : t("kolMetrics.unknownCountry"), formatNumber(c.ballots),
                formatNumber(c.counting), formatNumber(c.on_list),
                <div key="b" className="w-24"><Bar percent={pct(c.ballots, countryMax)} label={t("kolMetrics.where.countryBar", { n: c.ballots })} /></div>,
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.where.empty")} />
          )}
          {data.country_mismatch > 0 && (
            <p className="text-xs text-muted-foreground">{t("kolMetrics.where.mismatch", { n: data.country_mismatch })}</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── codes ── */}
        <Section title={t("kolMetrics.codes.title")}>
          <Pairs rows={[
            [t("kolMetrics.codes.made"), n(data.codes.creator_codes)],
            [t("kolMetrics.codes.opened"), n(data.codes.opened)],
            [t("kolMetrics.codes.never"), n(data.codes.never_opened_count)],
            [t("kolMetrics.codes.spareMade"), n(data.codes.spare_made)],
            [t("kolMetrics.codes.spareClaimed"), n(data.codes.spare_claimed)],
            [t("kolMetrics.codes.revoked"), n(data.codes.revoked)],
          ]} />
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.codes.neverTitle")}</h4>
          {unopened.length ? (
            <>
              <SmallTable
                heads={[t("kolMetrics.col.creator"), t("kolMetrics.col.codeEmail"), t("kolMetrics.col.contact"), ""]}
                rows={unopened.map((row) => [
                  <Who key="w" name={row.name} handle={row.handle} />,
                  row.email_status === "no_address" || !row.has_email ? (
                    <Badge key="s" variant="outline" className="rounded-full px-2 py-0.5 text-xs text-gold">{t("kolMetrics.status.no_address")}</Badge>
                  ) : row.email_status === "failed" ? (
                    <Badge key="s" variant="outline" className="rounded-full px-2 py-0.5 text-xs text-destructive">{t("kolMetrics.status.failed")}</Badge>
                  ) : row.email_status ? (
                    <span key="s">{t(`kolMetrics.status.${row.email_status}`)}{row.emailed_at && <> · <LocalTime value={row.emailed_at} mode="date" /></>}</span>
                  ) : (
                    t("kolMetrics.status.not_sent")
                  ),
                  row.contact_given ? t("kolMetrics.contactGiven") : t("kolMetrics.none"),
                  row.has_email ? (
                    <Button key="b" variant="secondary" size="sm" disabled={sending === row.creator_id}
                      onClick={() => emailCode(row.creator_id, row.name)}>
                      {t("kolMetrics.emailCode")}
                    </Button>
                  ) : (
                    <span key="b" className="text-muted-foreground">{t("kolMetrics.addInCreators")}</span>
                  ),
                ])}
              />
              {data.codes.never_opened.length > SHOW_FIRST && (
                <Button variant="secondary" size="sm" onClick={() => setAllUnopened((v) => !v)}>
                  {allUnopened ? t("kolMetrics.showFewer") : t("kolMetrics.showAll", { n: data.codes.never_opened.length })}
                </Button>
              )}
            </>
          ) : (
            <Quiet text={t("kolMetrics.codes.allOpened")} />
          )}
        </Section>

        {/* ── emails ── */}
        <Section title={t("kolMetrics.emails.title")}>
          <Pairs rows={[
            [t("kolMetrics.emails.sent"), n(data.emails.code_sent)],
            [t("kolMetrics.emails.failed"), n(data.emails.code_failed)],
            [t("kolMetrics.emails.noAddress"), n(data.emails.no_address)],
            [t("kolMetrics.emails.openedAfter"), t("kolMetrics.emails.openedAfterValue", { n: data.emails.opened_after_email, total: data.emails.emailed_creators })],
            [t("kolMetrics.emails.toOpen"), dur(data.emails.email_to_open_median)],
            [t("kolMetrics.emails.picks"), n(data.emails.picks_sent)],
          ]} />
          <h4 className="pt-2 text-sm font-semibold">{t("kolMetrics.emails.failedTitle")}</h4>
          {data.emails.failed.length ? (
            <SmallTable
              heads={[t("kolMetrics.col.creator"), t("kolMetrics.col.address"), t("kolMetrics.col.why")]}
              rows={data.emails.failed.map((row) => [
                <Who key="w" name={row.name} handle={row.handle} />, row.address,
                t.has(`kolNom.errors.${row.error}`) ? t(`kolNom.errors.${row.error}`) : row.error,
              ])}
            />
          ) : (
            <Quiet text={t("kolMetrics.emails.noneFailed")} />
          )}
        </Section>
      </div>
    </div>
  );
}
