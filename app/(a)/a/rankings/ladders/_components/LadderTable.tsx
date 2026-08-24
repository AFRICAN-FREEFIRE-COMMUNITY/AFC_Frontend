"use client";

/**
 * LadderTable - the two ladder tables rendered by the admin Ladders view.
 *
 * One component per SUBJECT (TeamLadderTable / PlayerLadderTable) rather than one generic table,
 * because the two row shapes are genuinely different (afc_rankings.serializers team_monthly /
 * team_quarterly vs player_monthly / player_quarterly) and a single component would have to widen
 * both into `any`. Each takes a `period` and swaps the period-specific columns:
 *
 *   teams   monthly    Rank | Team | Tournaments | Wins | Kills | Score
 *           quarterly  Rank | Team | Tier | Tournaments | Wins | Kills | Score
 *   players monthly    Rank | Player | Kills | MVPs | Scrim pts | Score
 *           quarterly  Rank | Player | Tier | Prize pts | Score
 *
 * Rows come straight off the ADMIN draft endpoints, so they are the live computed values whether
 * or not the season is published (lib/rankingsAdmin.ts adminTeamsMonthly / adminTeamsQuarterly /
 * adminPlayersMonthly / adminPlayersQuarterly). The preview-vs-public marking is NOT in here, it
 * is the caller's PublishNotice / PublishBadge (./PublishNotice.tsx) so one strip covers the card.
 *
 * Design idiom is copied from the neighbouring admin ranking tables (app/(a)/a/rankings/page.tsx
 * and overrides/page.tsx): shadcn Table, #-prefixed rank, TierBadge, outline "Ghost" pill, right
 * aligned tabular-nums numerics. shadcn's Table already wraps itself in an overflow-x-auto
 * container, so the extra columns scroll INSIDE the card on a phone instead of widening the page.
 */

import { useTranslations } from "next-intl";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "@/components/rankings/TierBadge";
import { TeamRow, PlayerRow } from "@/lib/rankings";
import { IconHash } from "@tabler/icons-react";

export type LadderPeriod = "monthly" | "quarterly";

/* ---------------------------------------------------------------- shared cells */
// Rank cell, matching the admin overview table (# + number). A row can legitimately be unranked
// (rank is nullable on the score models until a rerank runs), so fall back to a dash.
function RankCell({ rank }: { rank: number | null }) {
  return (
    <TableCell className="font-semibold text-muted-foreground">
      {rank == null ? (
        "-"
      ) : (
        <span className="inline-flex flex-wrap items-center"><IconHash className="size-3" />{rank}</span>
      )}
    </TableCell>
  );
}

// Ghost teams / ghost players have no profile page, so the name stays plain text (no TeamLink /
// PlayerLink) and only gets a marker pill. The backend already prefixes the name "[Ghost] ...",
// so this badge must not repeat the word into the name itself.
function NameCell({ name, isGhost, ghostLabel }: { name: string; isGhost?: boolean; ghostLabel: string }) {
  return (
    <TableCell className="font-medium">
      <span className="inline-flex items-center gap-1.5">
        {name}
        {isGhost && (
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
            {ghostLabel}
          </Badge>
        )}
      </span>
    </TableCell>
  );
}

// Score is the headline number of every ladder: primary colour, one decimal, same as the public
// ladder (app/(user)/rankings/page.tsx) so a preview reads identically to what it will publish as.
function ScoreCell({ value }: { value: number }) {
  return (
    <TableCell className="text-right font-semibold tabular-nums text-primary">
      {value.toFixed(1)}
    </TableCell>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

/* ---------------------------------------------------------------- teams */
export function TeamLadderTable({
  rows, period, emptyText,
}: {
  rows: TeamRow[];
  period: LadderPeriod;
  /** Already resolved by the caller so it can distinguish "no data" from "no search match". */
  emptyText: string;
}) {
  const t = useTranslations("rankings.admin.ladders");
  const quarterly = period === "quarterly";
  const cols = quarterly ? 7 : 6;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">{t("colRank")}</TableHead>
          <TableHead>{t("colTeam")}</TableHead>
          {/* No tier exists at the monthly level, it is assigned per season by the quarterly
              evaluation, so the column only appears on the quarterly ladder. */}
          {quarterly && <TableHead>{t("colTier")}</TableHead>}
          <TableHead className="text-right">{t("colTournaments")}</TableHead>
          <TableHead className="text-right">{t("colWins")}</TableHead>
          <TableHead className="text-right">{t("colKills")}</TableHead>
          <TableHead className="text-right">{t("colScore")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={cols} text={emptyText} />
        ) : rows.map((r, i) => (
          // Ghost rows carry team_id = null, so the key falls back to the ghost id then the index.
          <TableRow key={r.team_id ?? r.ghost_team_id ?? `row-${i}`}>
            <RankCell rank={r.rank} />
            <NameCell name={r.team_name} isGhost={r.is_ghost} ghostLabel={t("ghost")} />
            {quarterly && <TableCell><TierBadge tier={r.tier ?? null} /></TableCell>}
            <TableCell className="text-right tabular-nums">{r.tournaments_played ?? 0}</TableCell>
            <TableCell className="text-right tabular-nums">{r.wins ?? 0}</TableCell>
            <TableCell className="text-right tabular-nums">{r.kills ?? 0}</TableCell>
            <ScoreCell value={r.total_score} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ---------------------------------------------------------------- players */
export function PlayerLadderTable({
  rows, period, emptyText,
}: {
  rows: PlayerRow[];
  period: LadderPeriod;
  emptyText: string;
}) {
  const t = useTranslations("rankings.admin.ladders");
  const quarterly = period === "quarterly";
  const cols = quarterly ? 5 : 6;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">{t("colRank")}</TableHead>
          <TableHead>{t("colPlayer")}</TableHead>
          {/* Quarterly players carry an inherited tier + the prize-money component; the monthly
              row instead carries the raw activity numbers (kills / MVPs / scrim points). */}
          {quarterly ? (
            <>
              <TableHead>{t("colTier")}</TableHead>
              <TableHead className="text-right">{t("colPrize")}</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-right">{t("colKills")}</TableHead>
              <TableHead className="text-right">{t("colMvps")}</TableHead>
              <TableHead className="text-right">{t("colScrim")}</TableHead>
            </>
          )}
          <TableHead className="text-right">{t("colScore")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={cols} text={emptyText} />
        ) : rows.map((r, i) => (
          // Ghost player rows have player_id = null on the wire; fall back like the team table.
          <TableRow key={r.player_id ?? r.ghost_player_id ?? `row-${i}`}>
            <RankCell rank={r.rank} />
            <NameCell name={r.username} isGhost={r.is_ghost} ghostLabel={t("ghost")} />
            {quarterly ? (
              <>
                <TableCell><TierBadge tier={r.tier ?? null} /></TableCell>
                <TableCell className="text-right tabular-nums">
                  {(r.prize_money_pts ?? 0).toFixed(1)}
                </TableCell>
              </>
            ) : (
              <>
                <TableCell className="text-right tabular-nums">{r.kills ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{r.mvps ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {(r.scrim_pts ?? 0).toFixed(1)}
                </TableCell>
              </>
            )}
            <ScoreCell value={r.total_score} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
