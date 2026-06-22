"use client";

// TournamentStructure
// ───────────────────
// The graphical "Structure" view for a tournament's detail page (the Results⇄Structure
// toggle in EventDetailsWrapper renders this when "Structure" is active).
//
// It is 100% data-driven off the SAME payload the page already fetches
// (get-event-details-not-logged-in): one node per `stage`, the stage's real
// `stage_format` label, its `teams_qualifying_from_stage` ("top N advance"), and each
// group's `overall_leaderboard` standings with a green qualify line after
// `group.teams_qualifying`. No hardcoded stage count/format - add/remove a stage or
// change a format in admin and this re-renders correctly.
//
// Honest scope (matches the data model): we show stage ORDER + how many advance, not a
// wired "group A -> lobby 2" routing (the backend stores advancement as "top-N into the
// next stage", not per-group edges). Points-based formats (incl. "Knockout" labels) all
// render as their accurate standings, because that is how AFC records results.

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
// i18n: tournament-section strings live in messages/en/tournaments.json under
// the "structure.*" keys; useTranslations("tournaments") resolves the active
// locale from the NEXT_LOCALE cookie (en fallback).
import { useTranslations } from "next-intl";
// i18n date/time: stage + group schedule dates render in the VIEWER's locale via <LocalTime
// mode="date"/>; the group's playing TIME renders dual-tz (viewer + host) via <LocalEventTime/>,
// since playing_time is a host wall-clock paired with the event's IANA timezone. (owner 2026-06-22)
import { LocalTime } from "@/components/LocalTime";
import { LocalEventTime } from "@/components/LocalEventTime";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Trophy, ChevronRight, ArrowUp } from "lucide-react";
// IconArrowRight matches the LinkedEventsCard chip aesthetic (components/event-links.tsx).
import { IconArrowRight } from "@tabler/icons-react";
import { FORMAT_LABEL } from "@/lib/eventFormats";
// Public qualification-link client (lib/eventLinks.ts publicStructure -> GET
// events/<id>/links/structure/, no auth). Powers the "Qualification Links" section below.
import { eventLinksApi, type PublicLinksStructure } from "@/lib/eventLinks";
import { env } from "@/lib/env";
// Subtle clickable name -> public player/team profile (standings rows).
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";

// Local mirrors of the Stage/StageGroup shapes from EventDetailsWrapper (kept local so
// this component stays self-contained; `any` rows because leaderboard keys vary solo/squad).
interface StageGroup {
  group_id: number;
  group_name: string;
  teams_qualifying: number;
  // Schedule (owner 2026-06-22): when this group plays. playing_date is a "YYYY-MM-DD"; playing_time
  // is a host wall-clock "HH:MM[:SS]" tied to the event's timezone. Both echoed by get_event_details.
  playing_date?: string | null;
  playing_time?: string | null;
  overall_leaderboard?: any[];
  matches?: any[];
}
interface Stage {
  stage_id: number;
  stage_name: string;
  stage_format: string;
  teams_qualifying_from_stage: number;
  is_finals_stage?: boolean; // present on the model; fall back to "last stage" if absent
  // Schedule (owner 2026-06-22): the stage's start/end DATEs ("YYYY-MM-DD"), echoed by
  // get_event_details. Shown under each stage so users see when it runs.
  start_date?: string | null;
  end_date?: string | null;
  groups: StageGroup[];
}

interface Props {
  stages: Stage[];
  participantType: string; // "solo" | "duo" | "squad"
  // Event IANA timezone (Event.timezone), for the dual-tz group playing-time display. Optional:
  // legacy events / missing tz -> LocalEventTime shows the host wall-clock without conversion.
  timezone?: string | null;
  // OPTIONAL (owner 2026-06-15): this event's numeric id, used to fetch its qualification
  // links for the "Qualification Links" section. The parent (EventDetailsWrapper) renders
  // this component with only stages + participantType and must NOT be edited, so when eventId
  // is absent we resolve it ourselves from the URL slug (see useEffect below). Optional keeps
  // the existing 2-prop call site valid without touching the wrapper.
  eventId?: number;
}

// Pull a competitor's display name from a leaderboard row regardless of solo/squad shape.
function rowName(row: any, idx: number): string {
  return (
    row.username ||
    row.team_name ||
    row.competitor__user__username ||
    row.tournament_team__team__team_name ||
    `#${row.placement ?? idx + 1}`
  );
}
const rowKills = (row: any) => row.total_kills ?? row.kills ?? 0;
// Summed placement points for the row. Backend returns it as `placement_sum` on the overall
// standings (single-map stats expose `placement_points`); always renders a number, 0 when none.
const rowPlacementPts = (row: any) =>
  row.placement_sum ?? row.placement_points ?? 0;
const rowPoints = (row: any) => {
  const p = row.total_points ?? row.total_pts ?? 0;
  const n = parseFloat(p);
  return Number.isFinite(n) ? n : 0;
};
const fmtLabel = (f: string) => FORMAT_LABEL[f] || f;

export function TournamentStructure({ stages, participantType, eventId, timezone }: Props) {
  const t = useTranslations("tournaments");
  const [sel, setSel] = useState(0);

  // ── Qualification Links (owner 2026-06-15) ──
  // This event's place in the season: events that qualify INTO it (inbound) and events its
  // stages qualify INTO (outbound), as clickable chips. Source: lib/eventLinks.ts
  // publicStructure() -> GET events/<id>/links/structure/ (public, no auth).
  //
  // We need this event's numeric id. The parent EventDetailsWrapper renders us with only
  // stages + participantType (and must not be edited), and the stages payload carries no
  // event_id, so when the eventId prop is absent we resolve it from the route slug via the
  // SAME public endpoint the page already uses (get-event-details-not-logged-in).
  const params = useParams();
  const routeSlug = typeof params?.slug === "string" ? params.slug : undefined;
  const [linkEventId, setLinkEventId] = useState<number | null>(eventId ?? null);
  const [links, setLinks] = useState<PublicLinksStructure | null>(null);

  // Resolve the event id from the slug only when it was not passed in as a prop.
  useEffect(() => {
    if (eventId != null) {
      setLinkEventId(eventId);
      return;
    }
    if (!routeSlug) return;
    let cancelled = false;
    (async () => {
      try {
        // get-event-details-not-logged-in: the same public detail endpoint page.tsx fetches;
        // we only read event_id off the top of the payload.
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-not-logged-in/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: decodeURIComponent(routeSlug) }),
          },
        );
        if (!res.ok) return;
        const json = await res.json();
        const id = json?.event_details?.event_id;
        if (!cancelled && typeof id === "number") setLinkEventId(id);
      } catch {
        /* non-critical enhancement: silently skip the section if resolution fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, routeSlug]);

  // Fetch the qualification links once we know the event id.
  useEffect(() => {
    if (linkEventId == null) return;
    let cancelled = false;
    eventLinksApi
      .publicStructure(linkEventId)
      .then((data) => {
        if (!cancelled) setLinks(data);
      })
      .catch(() => {
        /* non-critical: leave links null so the section stays hidden on error */
      });
    return () => {
      cancelled = true;
    };
  }, [linkEventId]);

  if (!stages || stages.length === 0) {
    return (
      <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
        {t("structure.noStages")}
      </div>
    );
  }

  // Finals = the stage flagged is_finals_stage, else the last stage in order.
  const finalsIdx = (() => {
    const flagged = stages.findIndex((s) => s.is_finals_stage);
    return flagged >= 0 ? flagged : stages.length - 1;
  })();
  const competitorWord =
    participantType === "solo"
      ? t("structure.playerWord")
      : t("structure.teamWord");
  const stage = stages[sel];

  return (
    <div className="space-y-10">
      {/* ── 1. Stage-flow spine ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
          {t("structure.tournamentFlow")}
        </p>
        <div className="flex items-stretch overflow-x-auto pb-2">
          {stages.map((s, i) => {
            const isFinals = i === finalsIdx;
            const advancing = s.teams_qualifying_from_stage;
            return (
              <div key={s.stage_id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  className={`text-left min-w-[230px] flex-1 bg-card rounded-md border p-5 transition-colors
                    ${i === sel ? "ring-1 ring-primary/40 border-primary/50" : "hover:border-primary/40"}
                    ${isFinals ? "border-gold/50" : ""}`}
                >
                  <div
                    className={`text-[0.7rem] font-bold uppercase tracking-wider ${
                      isFinals ? "text-gold" : "text-muted-foreground"
                    }`}
                  >
                    {isFinals
                      ? t("structure.finals")
                      : t("structure.stage", { number: i + 1 })}
                  </div>
                  <div className="text-lg font-bold mt-1 mb-3 flex items-center gap-1.5">
                    {isFinals && <Trophy className="size-4 text-gold" />}
                    {s.stage_name}
                  </div>
                  <Badge variant="outline" className="rounded-full font-medium">
                    {fmtLabel(s.stage_format)}
                  </Badge>
                  {/* Stage schedule (owner 2026-06-22): the dates this stage runs, in the viewer's
                      locale. Shows a range when start/end differ, a single date when they match. */}
                  {s.start_date && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5 shrink-0" />
                      {s.end_date && s.end_date !== s.start_date ? (
                        <span>
                          <LocalTime value={s.start_date} mode="date" />
                          {" "}
                          {t("structure.dateTo")}{" "}
                          <LocalTime value={s.end_date} mode="date" />
                        </span>
                      ) : (
                        <LocalTime value={s.start_date} mode="date" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground flex-wrap">
                    {isFinals ? (
                      <span>{t("structure.championCrowned")}</span>
                    ) : (
                      <>
                        <Badge className="rounded-full gap-1 bg-primary/10 text-primary border border-primary/50">
                          <ArrowUp className="size-3" />{" "}
                          {t("structure.topAdvance", { count: advancing })}
                        </Badge>
                        <span>
                          {t("structure.advanceGroups", {
                            count: s.groups?.length || 0,
                            groupWord:
                              s.groups?.length === 1
                                ? t("structure.groupSingular")
                                : t("structure.groupPlural"),
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </button>
                {/* arrow between stages */}
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center justify-center min-w-[54px] text-muted-foreground">
                    <ChevronRight className="size-6" />
                    {!isFinals && (
                      <span className="text-[0.6rem] mt-0.5">
                        {t("structure.topN", { count: advancing })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 1b. Qualification Links (owner 2026-06-15) ──
          This event's place in the season cascade: inbound = events that qualify INTO this
          event, outbound = events this event's stages qualify INTO. Each is a clickable chip
          to /tournaments/<event_slug>. Data: lib/eventLinks.ts publicStructure() -> GET
          events/<id>/links/structure/. Aesthetic mirrors LinkedEventsCard (components/
          event-links.tsx): rounded-full Badge + IconArrowRight + primary/green accents.
          The whole section is hidden when both directions are empty. */}
      {links && (links.inbound.length > 0 || links.outbound.length > 0) && (
        <section>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            {t("structure.qualificationLinks")}
          </p>
          <div className="space-y-5">
            {/* inbound: events that feed INTO this one ("Qualifies from") */}
            {links.inbound.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("structure.qualifiesFrom")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {links.inbound.map((row) => {
                    // chip text: "Qualifies from: <event_name> - <stage> top N"
                    const label = t("structure.qualifiesFromChip", {
                      eventName: row.event_name,
                      stageName: row.stage_name,
                      count: row.qualify_count,
                    });
                    // Navigate to the feeder event by its slug; if a slug is missing (older
                    // event), render a non-clickable badge rather than a broken link.
                    const chip = (
                      <Badge
                        variant="outline"
                        className="rounded-full gap-1.5 px-3 py-1 text-xs border-primary/50 text-primary transition-colors hover:bg-primary/10"
                      >
                        <IconArrowRight className="size-3.5 shrink-0" />
                        {label}
                      </Badge>
                    );
                    return row.event_slug ? (
                      <Link key={row.link_id} href={`/tournaments/${row.event_slug}`}>
                        {chip}
                      </Link>
                    ) : (
                      <span key={row.link_id} className="opacity-70">{chip}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* outbound: events THIS one qualifies into ("Qualifies into") */}
            {links.outbound.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("structure.qualifiesInto")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {links.outbound.map((row) => {
                    // chip text: "Top N of <stage> qualifies into: <event_name>"
                    const label = t("structure.qualifiesIntoChip", {
                      count: row.qualify_count,
                      stageName: row.stage_name,
                      eventName: row.event_name,
                    });
                    const chip = (
                      <Badge
                        variant="outline"
                        className="rounded-full gap-1.5 px-3 py-1 text-xs border-primary/50 text-primary transition-colors hover:bg-primary/10"
                      >
                        {label}
                        <IconArrowRight className="size-3.5 shrink-0" />
                      </Badge>
                    );
                    return row.event_slug ? (
                      <Link key={row.link_id} href={`/tournaments/${row.event_slug}`}>
                        {chip}
                      </Link>
                    ) : (
                      <span key={row.link_id} className="opacity-70">{chip}</span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 2. Standings & qualification for the selected stage ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          {t("structure.standingsHeading", { stageName: stage.stage_name })}
        </p>
        <div className="flex gap-5 flex-wrap text-sm text-muted-foreground mb-5">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-primary" />{" "}
            {t("structure.qualifiedLegend")}
          </span>
          {sel !== finalsIdx && (
            <span>
              {t.rich("structure.advancePerGroup", {
                count: stage.teams_qualifying_from_stage,
                b: (chunks) => <b className="text-primary">{chunks}</b>,
              })}
            </span>
          )}
        </div>

        {!stage.groups || stage.groups.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
            {t("structure.noGroups")}
          </div>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(380px,1fr))]">
            {stage.groups.map((g) => {
              const rows = Array.isArray(g.overall_leaderboard)
                ? g.overall_leaderboard
                : [];
              const qN = g.teams_qualifying ?? 0;
              return (
                <div key={g.group_id} className="bg-card rounded-md border overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
                    <div className="min-w-0">
                      <span className="font-bold">{g.group_name}</span>
                      {/* Group schedule (owner 2026-06-22): when this group plays. The date is in the
                          viewer's locale; the time is dual-tz (viewer + host) since playing_time is a
                          host wall-clock paired with the event timezone. */}
                      {g.playing_date && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5 shrink-0" />
                          <LocalTime value={g.playing_date} mode="date" />
                          {g.playing_time && (
                            <>
                              <span aria-hidden>·</span>
                              <LocalEventTime
                                date={g.playing_date}
                                startTime={g.playing_time}
                                tz={timezone}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground text-right">
                      {t("structure.matchCount", {
                        count: g.matches?.length || 0,
                        matchWord:
                          g.matches?.length === 1
                            ? t("structure.matchSingular")
                            : t("structure.matchPlural"),
                      })}
                      {qN > 0 && t("structure.topNAdvance", { count: qN })}
                    </span>
                  </div>

                  {/* Room details (owner 2026-06-17): the backend only fills room_id/name/password on
                      these match rows for the group's registered competitors AND only after the
                      organizer posts them, so this block simply renders whatever creds arrived. Anon
                      viewers / non-members / pre-release get nulls -> nothing shows. */}
                  {(() => {
                    const withRoom = (g.matches || []).filter((m: any) => m.room_id || m.room_name || m.room_password);
                    if (withRoom.length === 0) return null;
                    return (
                      <div className="border-b bg-primary/[0.05] px-5 py-3">
                        <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-primary">
                          {t("structure.roomDetails")}
                        </p>
                        <div className="space-y-2">
                          {withRoom.map((m: any) => (
                            <div key={m.match_id} className="rounded-md border bg-card px-3 py-2 text-xs">
                              <span className="font-medium">
                                {t("structure.roomMatch", { n: m.match_number })}
                                {m.match_map ? ` · ${m.match_map}` : ""}
                              </span>
                              <div className="mt-1 grid gap-1 sm:grid-cols-3">
                                {m.room_id && (
                                  <span>
                                    <span className="text-muted-foreground">{t("structure.roomId")}: </span>
                                    <span className="font-mono font-semibold">{m.room_id}</span>
                                  </span>
                                )}
                                {m.room_name && (
                                  <span>
                                    <span className="text-muted-foreground">{t("structure.roomName")}: </span>
                                    <span className="font-semibold">{m.room_name}</span>
                                  </span>
                                )}
                                {m.room_password && (
                                  <span>
                                    <span className="text-muted-foreground">{t("structure.roomPassword")}: </span>
                                    <span className="font-mono font-semibold">{m.room_password}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {rows.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground italic">
                      {t("structure.resultsPending")}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left font-semibold px-5 py-2.5 w-10">
                            {t("structure.rank")}
                          </th>
                          <th className="text-left font-semibold px-5 py-2.5">
                            {competitorWord}
                          </th>
                          <th className="text-center font-semibold px-3 py-2.5">
                            {t("structure.kills")}
                          </th>
                          <th className="text-center font-semibold px-3 py-2.5">
                            {t("structure.placePts")}
                          </th>
                          <th className="text-right font-semibold px-5 py-2.5">
                            {t("structure.points")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row: any, idx: number) => {
                          const placement = row.placement ?? idx + 1;
                          const qualified = qN > 0 && placement <= qN;
                          // green qualify-line divider, drawn once right after the last qualifier
                          const showLine =
                            qN > 0 && placement === qN && idx < rows.length - 1;
                          return (
                            <Fragment key={`${g.group_id}-r${idx}`}>
                              <tr
                                key={`${g.group_id}-${idx}`}
                                className={qualified ? "bg-primary/[0.07]" : ""}
                              >
                                <td
                                  className={`px-5 py-2.5 font-bold border-t border-border/60 ${
                                    qualified
                                      ? "text-primary shadow-[inset_3px_0_0_var(--primary)]"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {placement}
                                </td>
                                <td className="px-5 py-2.5 font-semibold border-t border-border/60">
                                  {/* Competitor name links to the public profile:
                                      solo events list players, squad events list teams. */}
                                  {participantType === "solo" ? (
                                    <PlayerLink name={rowName(row, idx)} />
                                  ) : (
                                    <TeamLink name={rowName(row, idx)} />
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center border-t border-border/60">
                                  {rowKills(row)}
                                </td>
                                <td className="px-3 py-2.5 text-center border-t border-border/60">
                                  {rowPlacementPts(row)}
                                </td>
                                <td className="px-5 py-2.5 text-right font-bold border-t border-border/60">
                                  {rowPoints(row).toFixed(1)}
                                </td>
                              </tr>
                              {showLine && (
                                <tr key={`${g.group_id}-qline`}>
                                  <td colSpan={5} className="p-0">
                                    <div className="flex items-center gap-2 px-5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-primary bg-primary/[0.08]">
                                      <span className="h-px flex-1 bg-primary/30" />
                                      {t("structure.qualificationLine")}
                                      <span className="h-px flex-1 bg-primary/30" />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* honest note: this is built from stored data, no invented brackets */}
        <p className="mt-8 text-xs text-muted-foreground bg-card border border-dashed border-border rounded-md px-4 py-3.5 leading-relaxed">
          {t("structure.footnote")}
        </p>
      </section>
    </div>
  );
}
