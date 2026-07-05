"use client";

// CombinedStandings
// ─────────────────
// The "Combined" tab on a tournament's detail page. EventDetailsWrapper renders this
// when the main-view tab is set to "combined" (next to Results and Structure). It lets a
// viewer merge the standings of several groups/stages (or the whole event) into ONE
// aggregate leaderboard.
//
// Backend endpoint (owner feature): POST events/get-event-combined-standings/
//   body: { event_id, group_ids?: number[], stage_ids?: number[] }  // omit both => whole event
//   response: { event_id, participant_type, results_published, group_ids,
//               standings: [ { tournament_team_id, team_name, team_country, total_points,
//                              kills, placement_points, booyah, matches_played, team_logo? } ],
//               note? }
// The endpoint is PUBLIC (no auth needed); we still forward the Authorization header when a
// token exists (harmless), matching every other user-facing fetch in this folder. It reuses
// the SAME server-side aggregator as the OBS live broadcast overlay, so the numbers rendered
// here always agree with the on-stream leaderboard.
//
// Where it sits: sibling to TournamentStructure.tsx (Structure tab) and StageResultsTable
// (Results tab). The standings table below deliberately MIRRORS TournamentStructure's row
// renderers + column styling so the three views read as the work of one designer.

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import axios from "axios";
import { toast } from "sonner";
// i18n: all copy lives in messages/en/tournaments.json under the "combined.*" keys;
// useTranslations("tournaments") resolves the active locale from the NEXT_LOCALE cookie.
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader } from "@/components/Loader";
// Subtle clickable team name + country flag, exactly as TournamentStructure's standings rows.
import { TeamLink } from "@/components/ui/entity-link";
import { env } from "@/lib/env";
// The signed-in user's JWT (from AuthContext), forwarded to the endpoint when present.
import { useAuth } from "@/contexts/AuthContext";

// ── Prop shapes ──
// Local mirror of the (stage -> groups) shape EventDetailsWrapper already holds. We only need
// each stage's id/name and each group's id/name to build the pick list + the request body.
interface CombinedGroup {
  group_id: number;
  group_name: string;
}
interface CombinedStage {
  stage_id: number;
  stage_name: string;
  groups: CombinedGroup[];
}
interface Props {
  // This event's numeric id (Event.event_id). Sent as `event_id` in every request body.
  eventId: number;
  // The event's stages (with their groups) so the viewer can pick what to combine.
  stages: CombinedStage[];
  // "solo" | "duo" | "squad". Combined standings are team-only; solo shows a note instead.
  participantType: string;
  // Event.results_published: false => the organizer has hidden the standings for the whole
  // event, so we show a "not published yet" state instead of the picker/table.
  resultsPublished?: boolean;
  // Event IANA timezone, accepted for parity with the sibling views. Unused here (this view
  // renders no dates/times), kept so the call site mirrors TournamentStructure/YourMatchCallout.
  timezone?: string | null;
}

// ── Aggregated standings row (from get-event-combined-standings/) ──
// Keys mirror the OBS overlay aggregator's output. Optional/defensive so any shape drift still
// renders a number instead of a blank cell.
interface CombinedRow {
  tournament_team_id?: number;
  team_name?: string;
  team_country?: string | null;
  total_points?: number | string;
  kills?: number;
  placement_points?: number;
  booyah?: number;
  matches_played?: number;
  team_logo?: string | null;
}
interface CombinedResponse {
  event_id: number;
  participant_type: string;
  results_published: boolean;
  group_ids: number[] | null;
  standings: CombinedRow[];
  note?: string;
}

// ── Row renderers ──
// These MIRROR TournamentStructure.tsx's rowName/rowCountry/rowKills/rowPlacementPts/rowPoints
// so the combined table's columns read identically to the per-group standings there. The
// combined endpoint returns flat keys (team_name/kills/placement_points/booyah/total_points),
// so the fallbacks are simpler than TournamentStructure's, but the intent is the same.
const rowName = (row: CombinedRow, idx: number): string =>
  row.team_name || `#${idx + 1}`;
const rowCountry = (row: CombinedRow): string | undefined =>
  row.team_country ?? undefined;
const rowKills = (row: CombinedRow): number => row.kills ?? 0;
const rowPlacementPts = (row: CombinedRow): number => row.placement_points ?? 0;
const rowBooyah = (row: CombinedRow): number => row.booyah ?? 0;
const rowPoints = (row: CombinedRow): number => {
  const n = parseFloat(String(row.total_points ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export function CombinedStandings({
  eventId,
  stages,
  participantType,
  resultsPublished,
}: Props) {
  const t = useTranslations("tournaments");
  const { token } = useAuth();

  // Combined standings are team-only (the backend returns standings:[] + a note for solo).
  const isSolo = participantType === "solo";
  // Explicit false only => organizer hid the standings for the whole event.
  const hidden = resultsPublished === false;

  // ── Selection model ──
  // "Whole event" (default) => send no ids. Otherwise the viewer ticks whole STAGES and/or
  // individual GROUPS. Ticking a whole stage checks + disables its group boxes (the stage_id
  // already covers every group in it); ticking any stage/group turns "Whole event" off.
  const [wholeEvent, setWholeEvent] = useState(true);
  const [stageSel, setStageSel] = useState<Set<number>>(new Set());
  const [groupSel, setGroupSel] = useState<Set<number>>(new Set());

  // ── Fetch state ──
  const [rows, setRows] = useState<CombinedRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  // results_published echoed by the LAST response (subset could differ defensively).
  const [respPublished, setRespPublished] = useState<boolean | null>(null);

  // At least one thing is picked (whole event, or >=1 stage/group) => Apply is enabled.
  const hasSelection = wholeEvent || stageSel.size > 0 || groupSel.size > 0;

  // Whole-event toggle: turning it ON clears the granular picks (they are the alternative
  // path); turning it OFF leaves an empty selection until the viewer picks a stage/group.
  const toggleWholeEvent = (checked: boolean | "indeterminate") => {
    const on = checked === true;
    setWholeEvent(on);
    if (on) {
      setStageSel(new Set());
      setGroupSel(new Set());
    }
  };

  // Whole-stage toggle: (un)checks the stage_id and drops any individual group picks inside it,
  // since the stage_id already represents all of the stage's groups in the request body.
  const toggleStage = (stageId: number, groups: CombinedGroup[]) => {
    setWholeEvent(false);
    setStageSel((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
    setGroupSel((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => next.delete(g.group_id));
      return next;
    });
  };

  // Single-group toggle.
  const toggleGroup = (groupId: number) => {
    setWholeEvent(false);
    setGroupSel((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── Fetch ──
  // POST events/get-event-combined-standings/ with the current selection. Omit both id arrays
  // for the whole event; else send whole-stage picks as stage_ids and single-group picks as
  // group_ids (the backend ORs the two). Auth header forwarded when a token exists (harmless).
  const fetchCombined = useCallback(async () => {
    if (isSolo || hidden || !hasSelection) return; // guarded UI states below never fetch
    setLoading(true);
    try {
      const body: {
        event_id: number;
        stage_ids?: number[];
        group_ids?: number[];
      } = { event_id: eventId };
      if (!wholeEvent) {
        if (stageSel.size > 0) body.stage_ids = Array.from(stageSel);
        if (groupSel.size > 0) body.group_ids = Array.from(groupSel);
      }
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-combined-standings/`,
        body,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      const data: CombinedResponse = res.data;
      setRespPublished(data.results_published);
      setRows(Array.isArray(data.standings) ? data.standings : []);
    } catch {
      // Silent-fail with the same toast idiom the rest of this folder uses; keep the last
      // table on screen would be nicer, but null + prompt is the simplest honest state.
      toast.error(t("combined.loadError"));
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [
    eventId,
    isSolo,
    hidden,
    hasSelection,
    wholeEvent,
    stageSel,
    groupSel,
    token,
    t,
  ]);

  // Auto-load the default "Whole event" standings on first mount (team + published only), so
  // the tab shows the full-event leaderboard immediately. Later changes apply via the button.
  useEffect(() => {
    if (!isSolo && !hidden) fetchCombined();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Heading + one-line explainer ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
          {t("combined.heading")}
        </p>
        <p className="text-xs text-muted-foreground">{t("combined.explainer")}</p>
      </div>

      {isSolo ? (
        // Solo events: the aggregator is team-only, so we never fetch and just explain why.
        <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
          {t("combined.teamsOnly")}
        </div>
      ) : hidden ? (
        // Organizer has hidden the standings for the whole event.
        <div className="px-5 py-8 text-center text-sm text-muted-foreground bg-card rounded-md border">
          <p className="font-medium">{t("combined.notPublished")}</p>
        </div>
      ) : (
        <>
          {/* ── Picker: whole event, or per-stage / per-group ── */}
          <div className="bg-card rounded-md border p-5 space-y-4">
            {/* Whole event (default) */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={wholeEvent}
                onCheckedChange={toggleWholeEvent}
              />
              <span className="text-sm font-semibold">
                {t("combined.wholeEvent")}
              </span>
            </label>

            <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("combined.orPick")}
            </p>

            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
              {stages.map((s) => {
                const stageChecked = stageSel.has(s.stage_id);
                return (
                  <div
                    key={s.stage_id}
                    className="rounded-md border p-3 space-y-2.5"
                  >
                    {/* whole-stage pick */}
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={stageChecked}
                        onCheckedChange={() => toggleStage(s.stage_id, s.groups)}
                      />
                      <span className="text-sm font-semibold">
                        {s.stage_name}
                      </span>
                      <Badge
                        variant="outline"
                        className="ml-auto rounded-full px-2 py-0.5 text-[0.62rem]"
                      >
                        {t("combined.stagesLabel")}
                      </Badge>
                    </label>

                    {/* per-group picks (disabled + shown checked when the whole stage is on) */}
                    {s.groups?.length > 0 && (
                      <div className="space-y-1.5 pl-6">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("combined.groupsLabel")}
                        </p>
                        {s.groups.map((g) => (
                          <label
                            key={g.group_id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={stageChecked || groupSel.has(g.group_id)}
                              disabled={stageChecked}
                              onCheckedChange={() => toggleGroup(g.group_id)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {g.group_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Apply the current selection (re-fetches with the chosen ids). */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={fetchCombined}
                disabled={!hasSelection || loading}
              >
                {t("combined.apply")}
              </Button>
              {!hasSelection && (
                <span className="text-xs text-muted-foreground">
                  {t("combined.selectPrompt")}
                </span>
              )}
            </div>
          </div>

          {/* ── Result states ── */}
          {loading ? (
            <div className="py-10">
              <Loader text={t("combined.loading")} />
            </div>
          ) : respPublished === false ? (
            // Defensive: response says the standings are not published.
            <div className="px-5 py-8 text-center text-sm text-muted-foreground bg-card rounded-md border">
              <p className="font-medium">{t("combined.notPublished")}</p>
            </div>
          ) : rows === null ? (
            // Not fetched yet (or an error was toasted): prompt to pick + apply.
            <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
              {t("combined.selectPrompt")}
            </div>
          ) : rows.length === 0 ? (
            // Fetched, published, but no aggregated rows for the selection.
            <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
              {t("combined.empty")}
            </div>
          ) : (
            // ── The combined standings table (mirrors TournamentStructure's styling) ──
            <div className="bg-card rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left font-semibold px-5 py-2.5 w-10">
                      {t("combined.colPos")}
                    </th>
                    <th className="text-left font-semibold px-5 py-2.5">
                      {t("combined.teamColumn")}
                    </th>
                    <th className="text-center font-semibold px-3 py-2.5">
                      {t("combined.booyah")}
                    </th>
                    <th className="text-center font-semibold px-3 py-2.5">
                      {t("combined.placePts")}
                    </th>
                    <th className="text-center font-semibold px-3 py-2.5">
                      {t("combined.kills")}
                    </th>
                    <th className="text-right font-semibold px-5 py-2.5">
                      {t("combined.points")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    // Backend returns the rows pre-sorted (total_points desc), so the position
                    // is simply the 1-based index. Header shows "#", cell shows the number,
                    // exactly like TournamentStructure's rank column.
                    const placement = idx + 1;
                    return (
                      <tr key={row.tournament_team_id ?? `r${idx}`}>
                        <td className="px-5 py-2.5 font-bold border-t border-border/60 text-muted-foreground">
                          {placement}
                        </td>
                        <td className="px-5 py-2.5 font-semibold border-t border-border/60">
                          {/* logo + country flag + linked team name (team-only view) */}
                          <span className="inline-flex items-center gap-2">
                            {row.team_logo && (
                              <Image
                                src={row.team_logo}
                                alt={rowName(row, idx)}
                                width={20}
                                height={20}
                                className="size-5 rounded-full object-cover border border-border"
                              />
                            )}
                            <TeamLink
                              name={rowName(row, idx)}
                              country={rowCountry(row)}
                            />
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center border-t border-border/60">
                          {rowBooyah(row)}
                        </td>
                        <td className="px-3 py-2.5 text-center border-t border-border/60">
                          {rowPlacementPts(row)}
                        </td>
                        <td className="px-3 py-2.5 text-center border-t border-border/60">
                          {rowKills(row)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-bold border-t border-border/60">
                          {rowPoints(row).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
