"use client";

/**
 * app/(a)/a/polls/_components/VoteTracking.tsx
 *
 * The vote tracking blocks of the awards Metrics tab (inbox #453 and #457, owner 2 Nov 2026: "I need
 * you to be able to track these things, locations of who voted then, countries the votes came from
 * for each nominee", then every item on deck Revision 9 slides 05 and 06).
 *
 *   PollTracking    one poll: started vs finished ballots, removed after review, flags to review,
 *                   device, account age, awards filled per ballot, and the flag review list.
 *   OptionColumns   the extra cells on each nominee row (top country and region, switches, link).
 *   NomineeDetails  the expanded row: profile country, where the votes came from (country and
 *                   region), votes per day, and per hour over the last 48 hours.
 *
 * Every number comes from afc_polls/views.py admin_edition_metrics (via AwardsMetrics.tsx), built by
 * _tracking_for_poll from what submit_response stores (afc_polls/vote_tracking.py). Locations are
 * the voter's connection at the moment of the vote, from DB-IP's free database (CC BY 4.0, hence
 * the attribution line); the IP address itself is never stored.
 */
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell } from "@/components/ui/table";
import { countryName } from "@/lib/i18n/countryName";
import { formatNumber } from "@/lib/i18n/number";

import { VoteFlags } from "./VoteFlags";

/** The day the tracking went live; the NEW badges on these blocks expire five days after it. */
export const TRACKING_LIVE_SINCE = "2026-11-02";

type Bucket = { code?: string; country?: string; region?: string; votes: number };

function TrackingTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card rounded-md py-4 shadow-sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

/** A small titled list of label / number rows, on the inner surface of a card. */
function MiniList({ title, rows, empty }: { title: string; rows: { key: string; label: ReactNode; value: number }[]; empty: string }) {
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
              <span className="tabular-nums text-foreground">{formatNumber(row.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PollTracking({ poll }: { poll: any }) {
  const t = useTranslations("adminPolls");
  const tracking = poll.tracking;
  if (!tracking) return null;
  const ageLabel = (bucket: string) => t(`tracking.age.${bucket}`);
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {t("tracking.title")}
        <NewBadge since={TRACKING_LIVE_SINCE} />
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TrackingTile label={t("tracking.started")} value={formatNumber(tracking.started)} />
        <TrackingTile label={t("tracking.finished")} value={formatNumber(tracking.finished)} />
        <TrackingTile label={t("tracking.removed")} value={formatNumber(tracking.removed)} />
        <TrackingTile label={t("tracking.toReview")} value={formatNumber(tracking.flags.to_review)} />
      </div>
      <Card className="bg-card rounded-md py-4 shadow-sm">
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniList
            title={t("tracking.devices")}
            empty={t("tracking.none")}
            rows={tracking.devices.map((row: any) => ({
              key: row.device || "unknown",
              label: t(`tracking.device.${row.device || "unknown"}`),
              value: row.ballots,
            }))}
          />
          <MiniList
            title={t("tracking.accountAge")}
            empty={t("tracking.none")}
            rows={tracking.account_ages.map((row: any) => ({ key: row.bucket, label: ageLabel(row.bucket), value: row.ballots }))}
          />
          <MiniList
            title={t("tracking.awardsPerBallot")}
            empty={t("tracking.none")}
            rows={tracking.awards_per_ballot.map((row: any) => ({
              key: String(row.awards),
              label: t("tracking.awardsCount", { count: row.awards }),
              value: row.ballots,
            }))}
          />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {t("tracking.privacy")}{" "}
        <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline">
          {t("tracking.attribution")}
        </a>
      </p>
      <VoteFlags pollSlug={poll.slug} summary={tracking.flags} />
    </div>
  );
}

/** The first bucket as "Name (n)", or "Unknown" when there is none. */
function topLabel(rows: Bucket[], format: (row: Bucket) => string, unknown: string) {
  const first = rows.find((row) => format(row));
  return first ? `${format(first)} (${formatNumber(first.votes)})` : unknown;
}

/** The extra cells on a nominee row. Kept here so the table in AwardsMetrics stays readable. */
export function OptionColumns({ option }: { option: any }) {
  const t = useTranslations("adminPolls");
  const locale = useLocale();
  const unknown = t("tracking.unknown");
  return (
    <>
      <TableCell className="p-2 text-xs">
        {topLabel(option.ip_countries || [], (row) => countryName(row.code, locale), unknown)}
      </TableCell>
      <TableCell className="p-2 text-xs">
        {topLabel(option.regions || [], (row) => row.region || "", unknown)}
      </TableCell>
      <TableCell className="p-2 text-right text-xs tabular-nums">
        {formatNumber(option.switched_away || 0)} / {formatNumber(option.switched_to || 0)}
      </TableCell>
      <TableCell className="p-2 text-right text-xs tabular-nums">
        {t("tracking.viaLinkValue", { ballots: option.referred_ballots || 0, votes: option.referred_votes || 0 })}
      </TableCell>
    </>
  );
}

/** The column headers that match OptionColumns, in the same order. */
export function useOptionColumnHeads(): string[] {
  const t = useTranslations("adminPolls");
  return [t("tracking.col.topCountry"), t("tracking.col.topRegion"), t("tracking.col.switches"), t("tracking.col.viaLink")];
}

export function NomineeDetails({ option }: { option: any }) {
  const t = useTranslations("adminPolls");
  const locale = useLocale();
  const unknown = t("tracking.unknown");
  const none = t("tracking.none");
  const country = (code: string) => countryName(code, locale) || unknown;
  return (
    <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2 lg:grid-cols-5">
      <MiniList
        title={t("tracking.profileCountry")}
        empty={none}
        rows={(option.countries || []).map((row: Bucket) => ({ key: row.code || "unknown", label: country(row.code || ""), value: row.votes }))}
      />
      <MiniList
        title={t("tracking.voteCountry")}
        empty={none}
        rows={(option.ip_countries || []).map((row: Bucket) => ({ key: row.code || "unknown", label: country(row.code || ""), value: row.votes }))}
      />
      <MiniList
        title={t("tracking.voteRegion")}
        empty={none}
        rows={(option.regions || []).map((row: Bucket) => ({
          key: `${row.country}-${row.region}`,
          label: `${row.region}, ${country(row.country || "")}`,
          value: row.votes,
        }))}
      />
      <MiniList
        title={t("tracking.perDay")}
        empty={none}
        rows={(option.by_day || []).map((row: any) => ({ key: row.date, label: <LocalTime value={row.date} mode="date" />, value: row.votes }))}
      />
      <MiniList
        title={t("tracking.perHour")}
        empty={none}
        rows={[...(option.by_hour || [])].reverse().map((row: any) => ({ key: row.hour, label: <LocalTime value={row.hour} />, value: row.votes }))}
      />
    </div>
  );
}

/** The Details toggle on a nominee row, with its own open state. */
export function useDetailsToggle() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return {
    isOpen: (id: number) => !!open[id],
    toggle: (id: number) => setOpen((prev) => ({ ...prev, [id]: !prev[id] })),
  };
}
