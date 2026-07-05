import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";
import type { LeaderboardDesign } from "@/lib/leaderboardDesigns";

/**
 * OBS LIVE-OVERLAY client (owner 2026-07-01).
 * =============================================================================
 * Two backend surfaces, one client:
 *
 *   1. The PUBLIC overlay FEED (afc_tournament_and_scrims.views, prefix `events/`):
 *        GET events/overlay/feed/?token=&stage=&group=&design=&size=&live=&cols=
 *      No auth — the `token` (Event.overlay_token) is itself the read capability. It returns the
 *      resolved DESIGN (full _serialize_design output) + the live STANDINGS in one call, so the OBS
 *      Browser Source page (app/overlay/leaderboard/[token]/page.tsx) needs only this one request.
 *      Fetched with a raw axios GET WITHOUT authHeaders (precedent: EventDetailsWrapper's
 *      get-event-details-not-logged-in). Same-origin from the FE, so no CORS concern.
 *
 *   2. The overlay TOKEN mint/rotate (Bearer, org-scoped):
 *        POST events/<eventId>/overlay/token/            -> ensure (create if null) + return
 *        POST events/<eventId>/overlay/token/?regenerate=1 -> rotate (revokes the old link)
 *      Only an organizer of the event's OWN org (or a super admin) may mint/rotate. Consumed by the
 *      "Copy OBS overlay link" dialog (components/overlay/CopyOverlayLinkDialog.tsx) to build the
 *      public overlay URL and to offer a "Regenerate token" action.
 *
 * The overlay URL the dialog builds (points at THIS frontend, which serves the overlay route):
 *   `${NEXT_PUBLIC_URL}/overlay/leaderboard/<overlay_token>?type=event&event=&stage=&group=
 *     &design=&size=&anim=&reveal=&interval=&cols=`
 *
 * Auth idiom mirrors lib/leaderboardDesigns.ts (axios + authHeaders() reading the auth_token cookie).
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// ── Feed shapes ─────────────────────────────────────────────────────────────
// The overlay size the feed/design renders at: YouTube landscape or Instagram portrait.
export type OverlaySize = "youtube" | "instagram";

// One standings row, keyed by design field_type so DesignBoard can map any placed column straight
// to a value (row[field.field_type]). team_logo / player-image field types carry an image URL.
// Numeric stats are numbers; pos is the 1-based rank. Extra keys are tolerated (index signature).
export interface OverlayStandingRow {
  pos: number;
  team_name?: string;
  team_logo?: string | null;
  kills?: number;
  placement_points?: number;
  kill_points?: number;
  total_points?: number;
  booyah?: number;
  matches?: number;
  // Solo events may key the competitor under a player-ish name; kept open for forward-compat.
  [field_type: string]: number | string | null | undefined;
}

// The board identity line (which stage/group + the title/subtitle text the design may render).
export interface OverlayBoard {
  stage_id?: number | null;
  group_id?: number | null;
  title?: string;
  subtitle?: string;
}

// The event context echoed for display/debugging (the token already scopes to it server-side).
export interface OverlayEvent {
  name?: string;
  status?: string;
  participant_type?: string;
}

// The full feed response. `design` is the same shape lib/leaderboardDesigns.LeaderboardDesign uses
// (afc_organizers._serialize_design), including transparent_background + column_groups(+_youtube) +
// fields[]/logos[]/texts[]. `live` is true when a Redis in-round snapshot (Tier 2) was returned.
export interface OverlayFeed {
  event: OverlayEvent;
  board: OverlayBoard;
  size: OverlaySize;
  design: LeaderboardDesign;
  standings: OverlayStandingRow[];
  results_hidden?: boolean;
  live: boolean;
  updated_at?: string;
}

// ── Feed fetch (public, no auth) ─────────────────────────────────────────────
// The overlay page self-polls this. `token` is the Event.overlay_token from the URL path segment.
// `cols` is an OPTIONAL comma-separated field_type allow-list (empty => the design's full field set).
export interface OverlayFeedParams {
  token: string;
  stage?: string | number | null;
  group?: string | number | null;
  // Per-overlay COMBINE (owner 2026-07-05, complaint C): comma-separated group ids and/or whole-stage
  // ids to merge into ONE cumulative board. When set they supersede stage/group + broadcast-follow on
  // the backend (_parse_overlay_combine -> _overlay_cumulative_rows). Empty/undefined => untouched.
  groups?: string;
  stages?: string;
  design?: string | number | null;
  size?: OverlaySize;
  live?: boolean;
  cols?: string; // "pos,team_name,total_points" — subset of the design's placed fields
}

export async function fetchOverlayFeed(
  params: OverlayFeedParams,
  signal?: AbortSignal,
): Promise<OverlayFeed> {
  // Only send params that are set, so the backend applies its own defaults for the rest.
  const q: Record<string, string> = { token: params.token };
  if (params.stage != null && params.stage !== "") q.stage = String(params.stage);
  if (params.group != null && params.group !== "") q.group = String(params.group);
  // Combine spec (csv of ids); only sent when non-empty so single/follow callers are unaffected.
  if (params.groups) q.groups = params.groups;
  if (params.stages) q.stages = params.stages;
  if (params.design != null && params.design !== "") q.design = String(params.design);
  if (params.size) q.size = params.size;
  if (params.live) q.live = "1";
  if (params.cols) q.cols = params.cols;

  const res = await axios.get<OverlayFeed>(`${BASE}/events/overlay/feed/`, {
    params: q,
    signal,
    // Explicitly NO auth header: the token in the query string is the whole capability.
  });
  return res.data;
}

// ── Token mint / rotate (Bearer, org-scoped) ─────────────────────────────────
// ensure(): POST events/<eventId>/overlay/token/ — creates the token if the event has none, else
// returns the existing one. regenerate:true adds ?regenerate=1 to ROTATE it (invalidates old links).
// The backend response field name isn't final, so we read overlay_token first, then a couple of
// sensible fallbacks, so the dialog keeps working whichever the server settles on.
export const overlayTokenApi = {
  ensure: async (
    eventId: number | string,
    opts?: { regenerate?: boolean },
  ): Promise<string> => {
    const res = await axios.post<{
      overlay_token?: string;
      token?: string;
      event?: { overlay_token?: string };
    }>(
      `${BASE}/events/${eventId}/overlay/token/`,
      {},
      {
        params: opts?.regenerate ? { regenerate: 1 } : {},
        headers: authHeaders(),
      },
    );
    const data = res.data || {};
    const tok = data.overlay_token || data.token || data.event?.overlay_token;
    if (!tok) throw new Error("The server did not return an overlay token.");
    return tok;
  },
};

// ── Capture-client UPLOAD token (Bearer, org-scoped) ─────────────────────────
// The WRITE key the AFC Capture desktop client uses to auto-post match results (and push live
// standings) for one event. Separate from the read-only overlay_token: it maps to an EventUploadToken
// (afc_tournament_and_scrims), is event-scoped + revocable. ensure() creates-or-returns; regenerate
// revokes the old one and issues a new (so a leaked/old key stops working). Consumed by the capture
// page (app/(organizer)/organizer/capture) so the organizer can copy the key into the desktop app.
//   POST events/<eventId>/upload/token/            -> ensure
//   POST events/<eventId>/upload/token/?regenerate=1 -> rotate
export const uploadTokenApi = {
  ensure: async (
    eventId: number | string,
    opts?: { regenerate?: boolean },
  ): Promise<string> => {
    const res = await axios.post<{ upload_token?: string; token?: string }>(
      `${BASE}/events/${eventId}/upload/token/`,
      {},
      {
        params: opts?.regenerate ? { regenerate: 1 } : {},
        headers: authHeaders(),
      },
    );
    const data = res.data || {};
    const tok = data.upload_token || data.token;
    if (!tok) throw new Error("The server did not return a capture key.");
    return tok;
  },
};

// ── Website BROADCAST control (Bearer, org/event-admin scoped) ────────────────
// Lets an organizer/admin choose ON THE WEBSITE which stage/group the live overlay shows, and combine
// groups/stages into a CUMULATIVE, WITHOUT touching OBS (owner 2026-07-01). The overlay feed
// (events/overlay/feed/) resolves the event's saved broadcast selection whenever its URL OMITS both
// stage & group, so a single "follow broadcast" overlay link tracks whatever is set here — the overlay
// re-reads it within one self-poll (see app/overlay/leaderboard/[token]/page.tsx + fetchOverlayFeed).
//
// Consumed by components/overlay/BroadcastControl.tsx (mounted on the admin leaderboard edit page and
// the organizer event leaderboard page). Explicit stage/group in an overlay URL still OVERRIDE this.

// The four ways the overlay can resolve standings when it follows the broadcast selection:
//   group  -> one specific group's standings
//   stage  -> every group in one stage, combined into a stage cumulative
//   event  -> every stage/group in the event, combined into an event cumulative
//   custom -> an arbitrary set of groups (group_ids) combined into one cumulative
export type BroadcastScope = "group" | "stage" | "event" | "custom";

// One group in the event's structure (for the pickers). Mirrors the stages/groups shape the
// leaderboard-details + CopyOverlayLinkDialog already use, but as the broadcast endpoint returns it.
export interface BroadcastGroup {
  group_id: number;
  group_name: string;
}
export interface BroadcastStage {
  stage_id: number;
  stage_name: string;
  groups: BroadcastGroup[];
}

// The full GET/POST payload: the currently-live selection PLUS the event's stage/group structure the
// control renders its pickers from. stage_id/group_id are set for the single-target scopes; group_ids
// carries the chosen groups for scope="custom". `stages` is echoed so one GET populates the whole UI.
export interface BroadcastSelection {
  scope: BroadcastScope;
  stage_id: number | null;
  group_id: number | null;
  group_ids: number[];
  stages: BroadcastStage[];
}

// The POST body when switching what is live. Only the fields relevant to the chosen scope are sent
// (stage_id for stage/group, group_id for group, group_ids for custom); the backend ignores the rest.
export interface BroadcastSetBody {
  scope: BroadcastScope;
  stage_id?: number | null;
  group_id?: number | null;
  group_ids?: number[];
}

// broadcastApi.get:  GET  events/<eventId>/broadcast/      -> current selection + stage/group structure
// broadcastApi.set:  POST events/<eventId>/broadcast/set/  -> persists the selection, returns it saved
// Both are Bearer + org/event-admin gated (authHeaders() reads the auth_token cookie, same idiom as the
// overlay/upload token clients above). The saved selection takes effect on the overlay within one poll.
export const broadcastApi = {
  get: async (eventId: number | string): Promise<BroadcastSelection> => {
    const res = await axios.get<BroadcastSelection>(
      `${BASE}/events/${eventId}/broadcast/`,
      { headers: authHeaders() },
    );
    return res.data;
  },
  set: async (
    eventId: number | string,
    body: BroadcastSetBody,
  ): Promise<BroadcastSelection> => {
    const res = await axios.post<BroadcastSelection>(
      `${BASE}/events/${eventId}/broadcast/set/`,
      body,
      { headers: authHeaders() },
    );
    return res.data;
  },
};

// ── EVENT OVERLAYS (owner 2026-07-02, studio v2) ─────────────────────────────
// Saved, NAMED overlays per event: created from a design (kind "leaderboard") or as a scene (kind
// "timer"), renamed, duplicated, deleted. Each overlay's public link is STABLE
// (/overlay/view/<overlay_token>/<id>): it polls overlayConfigApi below, so studio edits (design,
// stage/group, animations, timer trigger) update what the SAME link renders — no re-copying into OBS.
// BE: afc_tournament_and_scrims/views_overlays.py (CRUD via the broadcast gate; config feed public).

// Overlay KINDS (owner 2026-07-05, complaints G + H): "mvp" (the event MVP board) and "top_killers"
// (players ranked by summed kills) join the existing leaderboard / timer / booyah / h2h scenes. Both
// are PLAYER-driven boards that render THROUGH a bound design and REUSE the leaderboard COMBINE shape
// ({scope, group_ids, stage_ids}) — see PlayerBoardConfig / PlayerBoardPayload below and the render
// branches in app/overlay/view/[token]/[overlayId]/page.tsx.
export type OverlayKind =
  | "leaderboard"
  | "timer"
  | "booyah"
  | "h2h"
  | "mvp"
  | "top_killers";

// kind "leaderboard": design_id, follow, anim, reveal, interval, live, bg_behavior, PLUS the standings
//   selection, which is one of:
//     • follow:true                          -> tracks the event's BroadcastControl selection;
//     • scope:"single" (or absent) + stage_id + optional group_id   -> one group / whole stage (legacy);
//     • scope:"combine" + group_ids:[..] and/or stage_ids:[..]      -> COMBINE those groups + whole
//       stages into one cumulative board (owner 2026-07-05, complaint C; stages expand to their groups).
//   The link is STABLE regardless: the card re-saves this config and the same /overlay/view link
//   re-renders. Rows with no `scope` behave as single, so existing overlays are unchanged.
// kind "timer":       end_at (ISO), label.
export type OverlayConfig = Record<string, unknown>;

export interface EventOverlayRow {
  id: number;
  name: string;
  kind: OverlayKind;
  config: OverlayConfig;
  active: boolean;
  updated_at?: string;
}

export const overlaysApi = {
  list: async (eventId: number | string): Promise<EventOverlayRow[]> => {
    const res = await axios.get<{ overlays: EventOverlayRow[] }>(
      `${BASE}/events/${eventId}/overlays/`,
      { headers: authHeaders() },
    );
    return res.data.overlays ?? [];
  },
  create: async (
    eventId: number | string,
    body: { name: string; kind: OverlayKind; config?: OverlayConfig },
  ): Promise<EventOverlayRow> => {
    const res = await axios.post<EventOverlayRow>(
      `${BASE}/events/${eventId}/overlays/create/`,
      body,
      { headers: authHeaders() },
    );
    return res.data;
  },
  // Partial edit: rename (name), reconfigure (config replaces wholesale), trigger/hide (active).
  update: async (
    eventId: number | string,
    overlayId: number,
    body: { name?: string; config?: OverlayConfig; active?: boolean },
  ): Promise<EventOverlayRow> => {
    const res = await axios.post<EventOverlayRow>(
      `${BASE}/events/${eventId}/overlays/${overlayId}/update/`,
      body,
      { headers: authHeaders() },
    );
    return res.data;
  },
  duplicate: async (
    eventId: number | string,
    overlayId: number,
  ): Promise<EventOverlayRow> => {
    const res = await axios.post<EventOverlayRow>(
      `${BASE}/events/${eventId}/overlays/${overlayId}/duplicate/`,
      {},
      { headers: authHeaders() },
    );
    return res.data;
  },
  remove: async (eventId: number | string, overlayId: number): Promise<void> => {
    await axios.post(
      `${BASE}/events/${eventId}/overlays/${overlayId}/delete/`,
      {},
      { headers: authHeaders() },
    );
  },
};

// PUBLIC config poll behind every overlay's stable link (no auth: the token is the capability).
export interface OverlayConfigFeed {
  kind: OverlayKind;
  name: string;
  config: OverlayConfig;
  active: boolean;
  event_id: number;
  server_time: string;
  // kind "leaderboard" only: the RESOLVED standings the overlay currently shows, bundled with the
  // poll (owner 2026-07-05, complaint C) — combine configs return rows spanning every chosen
  // group/stage. The stable link still RENDERS leaderboards via the inner /overlay/leaderboard iframe
  // (which pulls the same rows from overlay_feed); this field is the config poll's own copy, so a
  // direct consumer / verification sees the combined result without a second request.
  standings?: OverlayStandingRow[];
  // kind "h2h" only: the RESOLVED competitor slots (this-event stats) + the picked design's look,
  // bundled with the poll so the public page needs one request. See views_overlays._h2h_payload.
  // kind "booyah" only: the picked design's look + the booyah team's roster (players' names +
  // esport images), resolved per poll (views_overlays._booyah_payload).
  booyah?: {
    design: {
      background: string | null;
      text_color: string;
      accent_color: string;
      transparent: boolean;
    } | null;
    roster: Array<{ name: string; image: string | null }>;
  };
  h2h?: {
    mode: "team" | "player";
    competitors: Array<{
      name: string;
      image: string | null;
      stats: Record<string, number>;
    }>;
    design: {
      background: string | null;
      text_color: string;
      accent_color: string;
      transparent: boolean;
      // The versus design's picked stat rows (order = display order); [] = show everything.
      stat_keys?: string[];
      // Placeable competitor slot positions (centre %, 2-3); [] = default centered row.
      slots?: { x_pct: number; y_pct: number }[];
    } | null;
  };
  // kind "mvp" only (owner 2026-07-05, complaint G): the RESOLVED ranked PLAYER rows + the bound
  // design's look, bundled with the poll (mirrors h2h/booyah). See views_overlays._mvp_payload.
  mvp?: PlayerBoardPayload;
  // kind "top_killers" only (owner 2026-07-05, complaint H): identical payload shape to `mvp` (ONE
  // FE renderer serves both), but the players are ranked by summed kills. views_overlays._top_killers_payload.
  top_killers?: PlayerBoardPayload;
}

// ── PLAYER BOARDS: MVP (G) + Top Killers (H) (owner 2026-07-05) ───────────────
// Two new player-driven overlay kinds. They REUSE the leaderboard COMBINE path complaint C added:
// the config carries a bound design_id + a {scope, group_ids, stage_ids} selection (whole STAGES +
// individual GROUPS), and the backend resolves it with the SAME validator a leaderboard board uses.
// The overlay renders each board's ROWS through the bound design's look (bg + colors), with
// esports_image drawn as an <img>, ordered by pos — the same "draw field_type rows through a design"
// idea the leaderboard overlay uses, adapted to the scene-payload shape h2h/booyah already ship.

// One RANKED player row, keyed by the design player FIELD_CHOICES field types (build_player_design_rows
// in the backend). `pos` is the 1-based rank; `esports_image` is a photo URL (render as <img>); the MVP
// board's headline stat is `mvp_count`, the Top Killers board's is `kills`. Extra keys tolerated so a
// design column bound to any field_type maps straight to row[field_type].
export interface PlayerBoardRow {
  pos: number;
  player_name: string;
  team_name: string;
  team_country?: string;
  esports_image: string | null;
  kills: number;
  damage: number;
  assists: number;
  mvp_count: number;
  matches: number;
  [field_type: string]: number | string | null | undefined;
}

// The design LOOK bundled with an mvp / top_killers poll (same shape _design_look returns for h2h /
// booyah): a background image + text/accent colors + the transparent flag. null when no design is bound.
export interface PlayerBoardDesignLook {
  background: string | null;
  text_color: string;
  accent_color: string;
  transparent: boolean;
  stat_keys?: string[];
}

// The resolved payload for an mvp / top_killers overlay (views_overlays._mvp_payload /
// _top_killers_payload). `top` is row 0 (the MVP / top killer); `combine` echoes the resolved scope
// so the UI can label "combined across N groups".
export interface PlayerBoardPayload {
  kind: "mvp" | "top_killers";
  players: PlayerBoardRow[];
  top: PlayerBoardRow | null;
  combine: { group_ids: number[] | null; combined: boolean };
  design: PlayerBoardDesignLook | null;
}

// The saved config for an mvp / top_killers EventOverlay. design_id binds the look; scope + group_ids +
// stage_ids reuse the leaderboard COMBINE shape (scope "single" -> one whole stage or one group; scope
// "combine" -> merge the checked whole stages + groups). ui_stage_id is a FE-only picker context for the
// single-scope group dropdown (the backend never reads it). The backend reads group_ids/stage_ids (+ a
// singular group_id/stage_id fold-in), so single scope writes the plural arrays too — never a bare
// singular — to keep "one group" from implicitly pulling in its whole stage.
export interface PlayerBoardConfig {
  design_id?: number | null;
  scope?: "single" | "combine";
  group_ids?: number[];
  stage_ids?: number[];
  ui_stage_id?: number | null;
}

export const overlayConfigApi = async (
  token: string,
  overlayId: number | string,
): Promise<OverlayConfigFeed> => {
  const res = await axios.get<OverlayConfigFeed>(`${BASE}/events/overlay/config/`, {
    params: { token, overlay: overlayId },
  });
  return res.data;
};

// ── PLAYER BOARD endpoints: MVP (G) + Top Killers (H) (owner 2026-07-05) ──────
// The read-only ranked lists behind the leaderboard editor's MVP + Top Killers tabs, and the
// through-a-design PNG export both tabs offer. All three are Bearer + _broadcast_gate scoped (AFC
// event admin OR org can_edit_events), so they authHeaders() like the other clients here.
//
//   GET events/<id>/mvp/?group_ids=&stage_ids=          -> the event MVP ranking (compute_event_mvp)
//   GET events/<id>/top-killers/?group_ids=&stage_ids=  -> players by summed kills (compute_top_killers)
//   GET events/<id>/player-board-graphic/?kind=&design_id=&size=&group_ids=&stage_ids= -> PNG blob
//
// COMBINE: an OPTIONAL {groupIds, stageIds} selection (whole stages expand to their groups on the
// backend); omit both for the WHOLE event. Serialised as CSV query params, only when non-empty, so a
// whole-event call is byte-identical to the pre-combine shape.
//
// CONSUMED BY: app/(a)/a/leaderboards/_components/MvpTab.tsx (mvp + downloadPlayerBoardGraphic),
// app/(a)/a/leaderboards/_components/TopKillersTab.tsx (topKillers + downloadPlayerBoardGraphic), both
// mounted on the admin leaderboard editor AND the organizer event-leaderboard page.

// One player row as the MVP / top-killers ENDPOINTS return it (richer than the design-row PlayerBoardRow
// the overlay ships: keyed by user_id/in_game_name for the editor tables). Extra stat keys tolerated.
export interface PlayerRankingRow {
  user_id: number;
  username: string;
  in_game_name: string;
  team_name: string | null;
  team_country?: string | null;
  esports_image: string | null;
  kills: number;
  damage: number;
  assists: number;
  matches: number;
  mvp_count: number;
  deaths?: number;
  kdr?: number;
}

// The echoed combine scope both endpoints append (group_ids resolved to concrete this-event ids, or
// null for the whole event).
export interface PlayerBoardCombineEcho {
  group_ids: number[] | null;
  combined: boolean;
}

// A combine selection the tabs pass down: whole stages and/or individual groups. Empty => whole event.
export interface PlayerBoardScope {
  groupIds?: Array<number | string>;
  stageIds?: Array<number | string>;
}

function scopeParams(scope?: PlayerBoardScope): Record<string, string> {
  const q: Record<string, string> = {};
  if (scope?.groupIds?.length) q.group_ids = scope.groupIds.join(",");
  if (scope?.stageIds?.length) q.stage_ids = scope.stageIds.join(",");
  return q;
}

// GET events/<id>/top-killers/ — players ranked by summed kills over the (optional) combine scope.
export async function fetchTopKillers(
  eventId: number | string,
  scope?: PlayerBoardScope,
): Promise<{ players: PlayerRankingRow[]; top: PlayerRankingRow | null; combine: PlayerBoardCombineEcho }> {
  const res = await axios.get(`${BASE}/events/${eventId}/top-killers/`, {
    params: scopeParams(scope),
    headers: authHeaders(),
  });
  return res.data;
}

// GET events/<id>/player-board-graphic/ — the MVP / Top Killers board rendered THROUGH a design as a
// PNG blob (esports_image drawn as an image server-side). Same auth-gated blob idiom as
// leaderboardDesignsApi.downloadEventStageGraphic (a plain <a href> would omit the Bearer + 403).
export async function downloadPlayerBoardGraphic(
  eventId: number | string,
  opts: {
    kind: "mvp" | "top_killers";
    designId?: number | null;
    size: OverlaySize; // "youtube" | "instagram"
    groupIds?: Array<number | string>;
    stageIds?: Array<number | string>;
  },
): Promise<Blob> {
  const params: Record<string, any> = { kind: opts.kind, size: opts.size };
  if (opts.designId != null) params.design_id = opts.designId;
  if (opts.groupIds?.length) params.group_ids = opts.groupIds.join(",");
  if (opts.stageIds?.length) params.stage_ids = opts.stageIds.join(",");
  // Cache-bust so a design edit is reflected on the next download (mirrors downloadEventStageGraphic).
  params._ts = Date.now();
  const res = await axios.get(`${BASE}/events/${eventId}/player-board-graphic/`, {
    params,
    headers: authHeaders(),
    responseType: "blob",
  });
  return res.data as Blob;
}
