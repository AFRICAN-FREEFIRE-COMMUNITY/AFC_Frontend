import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the LEADERBOARD DESIGN feature (owner 2026-06-13).
 *
 * Two backend surfaces, one client:
 *   1. The design LIBRARY CRUD (afc_organizers.views_leaderboard_design), mounted under
 *      `organizers/leaderboard-designs/`. A per-org (or AFC-native, org=null) library of branded
 *      leaderboard backgrounds + style. Organizers manage their own org's library; AFC admins
 *      manage the AFC-native one (organization_id omitted).
 *   2. The EXPORT renderer (afc_leaderboard.views.leaderboard_graphic + afc_leaderboard.graphic),
 *      mounted at `leaderboards/standalone/<id>/graphic/`. Renders the live standings onto a chosen
 *      design at Instagram or YouTube size and returns a PNG. It is manager-gated (Bearer), so the
 *      download MUST go through axios with the auth header + responseType "blob" - a plain <a href>
 *      would omit the token and 403.
 *
 * Auth + idiom MIRROR lib/standaloneLeaderboards.ts: axios + an authHeaders() helper reading the
 * `auth_token` cookie that AuthContext writes on login. Multipart create/edit follow the same
 * "don't set Content-Type so axios fills the boundary" rule the OCR upload + organizer design-request
 * upload use. Errors surface as axios errors with `err.response.data.message`, toasted at each call site.
 *
 * CONSUMED BY:
 *  - app/(a)/a/leaderboards/standalone/_components/LeaderboardDesignsManager.tsx (the shared
 *    "Leaderboard designs" library card on BOTH the admin Leaderboards surface and the organizer
 *    Leaderboards page) - list / create / update / remove.
 *  - app/(a)/a/leaderboards/standalone/_components/ExportGraphicDialog.tsx (the "Export graphic"
 *    picker on the shared StandaloneLeaderboardView) - list (to populate the design dropdown) +
 *    downloadGraphic (to fetch + save the PNG).
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// ── Shapes ────────────────────────────────────────────────────────────────────
// Per-logo size band (afc_leaderboard.graphic.LOGO_SIZE_FRAC); scales the logo as a fraction
// of canvas height when rendered.
export type LogoSize = "small" | "medium" | "large";

// One positioned logo on a design (afc_organizers.OrgLeaderboardDesignLogo). Position is the
// logo's CENTRE as a percent of the canvas (0..100), so the same placement maps to both the
// Instagram (portrait) and YouTube (landscape) renders without re-positioning per size.
export interface LeaderboardDesignLogo {
  id: number;
  image: string | null; // media URL of the uploaded logo
  x_pct: number; // centre X, 0..100
  y_pct: number; // centre Y, 0..100
  size: LogoSize;
}

// ── Positionable connected-column fields + freeform text + uploaded fonts (owner 2026-06-14) ──
// A "connected column" binds to a real standings stat (field_type) and is drawn at x_pct for every
// row of its column_group. Available stats (mirror OrgLeaderboardDesignField.FIELD_CHOICES):
// Editable header (title/subtitle) styling. All keys optional; missing = legacy defaults.
export interface HeaderStyle {
  x_pct?: number;
  y_pct?: number;
  font_size_pct?: number;
  color?: string;
  font_id?: number | null;
  align?: TextAlign;
}

export type FieldType =
  // esports_image (owner 2026-07-02): the player's esports photo - image cell like team_logo;
  // blank on team standings rows, populated by solo/versus/MVP feeds.
  | "pos" | "team_name" | "team_logo" | "team_flag" | "esports_image" | "booyah" | "placement_points" | "kill_points"
  | "total_points" | "rush_points" | "kills" | "matches" | "base_total" | "bonus" | "penalty"
  // ── PLAYER-row columns (backend FIELD_CHOICES since the MVP boards, owner 2026-07-05) ──
  // They bind to a PLAYER row rather than a team row: the MVP / top-killer boards and the winning
  // squad of a design-driven booyah. On a TEAM standings row the keys are simply absent, so placing
  // one on a leaderboard design just renders a blank cell. Listed here (and in the editor palette)
  // from 2026-08-06 - the backend accepted them all along but the frontend never offered them, so a
  // roster block could not be laid out at all.
  | "player_name" | "damage" | "assists" | "mvp_count"
  // The MAP a booyah was won on (owner 2026-08-06). Only booyah rows carry it.
  | "match_map"
  // ── Rich LIVE-only stats (owner 2026-07-01, spec §12 + memory project_freefire_live_capture §2/§2b) ──
  // These come ONLY from the in-round debugger stream the capture client tails (Tier 2), NOT from the
  // per-round MatchResult / round_robin standings. So a design column bound to one of these renders a
  // real value while the overlay feed is in LIVE mode (events/overlay/feed/?live=1 -> the Redis
  // snapshot at overlay:live:<event>:<stage>:<group>) and 0/blank in the official per-round feed.
  // Only the stats VERIFIED available in the client logs are exposed (we never add damage,
  // grenades-thrown, or revive-giver, whose data does not exist anywhere in the client). Added to the
  // DesignFieldsEditor palette + the CopyOverlayLinkDialog column chooser, rendered by DesignBoard via
  // row[field.field_type].
  | "deaths" | "knockdowns" | "headshots" | "most_used_weapon" | "survival_time"
  | "revives_received" | "gloowall_used" | "medkit_used";

export type TextAlign = "left" | "center" | "right";

// Row tiling for one column group (the field-layout path). The Dynasty board = two groups, each
// 8 rows, start_rank 1 and 9. An empty column_groups list => the legacy auto-table render.
export interface DesignColumnGroup {
  row_start_pct: number; // Y of the first row centre, 0..100
  row_height_pct: number; // vertical gap between rows, % of canvas height
  row_count: number; // rows this group draws
  start_rank: number; // the standings position the group's first row shows (1, 9, ...)
}

// One explicit PAGE of a multi-page design (afc_organizers.OrgLeaderboardDesignPage,
// owner 2026-06-14). A design with pages.length === 0 is a legacy SINGLE-PAGE design
// (backward compatible): the renderer reads backgrounds + column_groups straight off the
// design row. When >= 1 page rows exist the editor (DesignFieldsEditor.tsx) shows page tabs
// and the export endpoints return a ZIP (one PNG per page) when ?page=all is requested.
// Each page carries its OWN backgrounds + column_groups so different pages (e.g. ranks 1-16
// vs 17-32) can show different row counts / different artwork.
export interface LeaderboardDesignPage {
  id: number;
  page_number: number; // 1-based
  background_instagram: string | null; // media URL (or null when not uploaded for this page)
  background_youtube: string | null; // media URL (or null when not uploaded for this page)
  column_groups: DesignColumnGroup[]; // row tiling for THIS page's fields (Instagram, canonical)
  column_groups_youtube?: DesignColumnGroup[]; // independent YT geometry; empty => fall back to IG
}

// One placed/connected column. font_id/font_size_pct/color are optional overrides (null/"" =>
// renderer default: built-in font, default size, design.text_color).
export interface LeaderboardDesignField {
  id: number;
  field_type: FieldType;
  column_group: number; // index into design.column_groups
  x_pct: number; // centre X, 0..100 (Instagram, canonical)
  x_pct_youtube: number | null; // independent YT X; null => fall back to x_pct
  align: TextAlign;
  font_id: number | null;
  font_size_pct: number | null; // size as % of canvas height
  color: string; // hex, or "" for the design default
  order: number;
  // Per-size enablement (owner 2026-07-05, audit complaint A): whether this column renders on each
  // export size INDEPENDENTLY. show_instagram=false hides it from the IG render only; show_youtube
  // from the YT render only. Both default true (shown on both). Backend build_field_layout drops the
  // field for a size whose flag is false. Toggled in DesignFieldsEditor's per-size palette + the
  // "Shown on Instagram / YouTube" switches; reset to both-true by applyFieldEnablementToAll.
  show_instagram: boolean;
  show_youtube: boolean;
  // Multi-page (owner 2026-06-14): which page this field belongs to. null = legacy / page-1
  // (the design-level layout). The editor filters fields by this to scope each page's canvas.
  page_id: number | null;
}

// One freeform text element (static copy placed anywhere, with its own style).
export interface LeaderboardDesignText {
  id: number;
  text: string;
  x_pct: number; // Instagram (canonical)
  y_pct: number;
  x_pct_youtube: number | null; // independent YT position; null => fall back to x_pct/y_pct
  y_pct_youtube: number | null;
  align: TextAlign;
  font_id: number | null;
  font_size_pct: number | null;
  color: string;
  order: number;
  // Multi-page (owner 2026-06-14): which page this text belongs to. null = legacy / page-1.
  page_id: number | null;
}

// An uploaded font (TTF/OTF) library item (afc_organizers.OrgLeaderboardDesignFont).
export interface LeaderboardDesignFont {
  id: number;
  name: string;
  // CORS-enabled URL to the font bytes, served by the Django font_file view (NOT the raw /media/
  // URL, which nginx serves without CORS in prod). Loaded via the browser FontFace API in
  // DesignFieldsEditor to PREVIEW the typeface in the canvas, the font pickers, and the §E library.
  file: string | null;
}

// One library design as returned by _serialize_design (backend views_leaderboard_design). The two
// background_* fields are media URLs (or null when that size has not been uploaded yet).
export interface LeaderboardDesign {
  id: number;
  name: string;
  background_instagram: string | null; // 1080x1350 portrait background URL
  background_youtube: string | null; // 1920x1080 landscape background URL
  text_color: string; // hex, drives the standings text
  accent_color: string; // hex, drives the rank highlight
  // Transparent overlay flag (owner 2026-07-01): when true the design has NO opaque background
  // fill, so the OBS overlay (app/overlay/leaderboard/[token] -> DesignBoard) and the PNG export
  // render only the placed columns/logos/text on a see-through canvas. Toggled in
  // LeaderboardDesignsManager; serialized by afc_organizers._serialize_design; read by DesignBoard.
  transparent_background: boolean;
  // BG behaviour on the live overlay (owner 2026-07-02): "persistent" = always on, never animates
  // (default); "animate" = the bg animates in with the content on every load/refresh.
  background_behavior?: "persistent" | "animate";
  // Design TYPE (owner 2026-07-02): "leaderboard" (standings rows) or "versus" (a head-to-head
  // look: competitor slots + the stat rows in versus_config.stat_keys). Rendered by H2HView.
  // "booyah" (owner 2026-08-06) is a design laid out for the WINNER moment: the same editor tools,
  // but its rows are slot 1 = the winning team (numbers from the leaderboard) and slots 2+ = that
  // team's players. The type is the marker the booyah overlay checks before rendering a design
  // instead of its legacy banner. See views_overlays._booyah_board + BooyahView.
  design_type?: "leaderboard" | "versus" | "booyah";
  versus_config?: { stat_keys?: string[]; slots?: { x_pct: number; y_pct: number }[] };
  // Title/subtitle styling (owner 2026-07-02): position/size/color/font/align for the header text
  // when show_title/show_subtitle are on. {} = the legacy fixed top-center header.
  title_style?: HeaderStyle;
  subtitle_style?: HeaderStyle;
  show_title: boolean;
  show_subtitle: boolean;
  // ── Board CHROME (owner 2026-08-05, backlog #2) ── three opt-in layers the exported PNG was
  // missing. show_column_headers draws a label above each placed column (MP / BOOYAH / KILL POINTS
  // ...); show_grid draws hairline rules between rows AND columns; show_board_header draws the event
  // name as the header and the stage name as the sub-header. All default false so an existing design
  // (which usually bakes headers into its background art) is unchanged; the AFC default generators
  // turn them on. Toggled in DesignFieldsEditor's design-settings card, drawn by its preview canvas +
  // DesignBoard (overlay) + afc_leaderboard.graphic (the PNG), so all three stay WYSIWYG.
  show_column_headers?: boolean;
  show_grid?: boolean;
  show_board_header?: boolean;
  max_rows: number; // how many standings rows the render fits (1..50)
  is_default: boolean; // the library's auto-selected design
  column_groups: DesignColumnGroup[]; // row tiling per group (Instagram, canonical); [] = legacy table
  column_groups_youtube?: DesignColumnGroup[]; // independent YT geometry; empty => fall back to IG
  // Multi-page (owner 2026-06-14): ordered list of explicit page rows. Empty array = a legacy
  // SINGLE-PAGE design (backward compatible). >1 page => export returns a ZIP (one PNG per page).
  pages: LeaderboardDesignPage[];
  logos: LeaderboardDesignLogo[]; // positioned logos drawn on top of the design
  fields: LeaderboardDesignField[]; // placed/connected data columns
  texts: LeaderboardDesignText[]; // freeform text elements
  created_at: string | null;
}

// The two export canvas sizes the renderer supports (afc_leaderboard.graphic.CANVAS).
export type GraphicSize = "instagram" | "youtube";

// ══ BOARD CHROME geometry (owner 2026-08-05, backlog #2) ═══════════════════════════════════════
// A VERBATIM mirror of afc_leaderboard/graphic.py's chrome constants + _column_edges. It lives here,
// not in a component, because BOTH surfaces that have to match the downloaded PNG import it:
//   • DesignFieldsEditor.tsx  - the design editor's preview canvas
//   • DesignBoard.tsx          - the live OBS overlay board
// If the Python side changes, change this together with it - a drift here means the operator places
// columns against a preview that does not match the file they download.

// field_type -> the header label printed above that column (graphic.COLUMN_HEADER_LABELS).
// Image columns map to "" so no label is stamped over the artwork. `matches` is labelled MP: the
// owner asks for maps played to show as MP, and it is the same number the matches column carries.
export const COLUMN_HEADER_LABELS: Partial<Record<FieldType, string>> = {
  pos: "POS",
  team_name: "TEAM",
  player_name: "PLAYER",
  team_logo: "",
  team_flag: "",
  esports_image: "",
  damage: "DAMAGE",
  assists: "ASSISTS",
  mvp_count: "MVPS",
  match_map: "MAP",
  matches: "MP",
  booyah: "BOOYAH",
  kill_points: "KILL POINTS",
  placement_points: "PLACEMENT POINTS",
  total_points: "TOTAL POINTS",
  kills: "KILLS",
  rush_points: "RUSH POINTS",
  base_total: "BASE TOTAL",
  bonus: "BONUS",
  penalty: "PENALTY",
  deaths: "DEATHS",
  knockdowns: "KNOCKS",
  headshots: "HEADSHOTS",
  most_used_weapon: "WEAPON",
  survival_time: "SURVIVAL",
  revives_received: "REVIVES",
  gloowall_used: "GLOO",
  medkit_used: "MEDKITS",
};

export const HEADER_ROW_GAP = 1.15; // row-heights above row 1 (graphic.HEADER_ROW_GAP)
export const HEADER_SIZE_SCALE = 0.85; // of the column's own font size
export const GRID_LINE_ALPHA = 70 / 255; // graphic.GRID_ALPHA as a CSS opacity
export const GRID_WIDTH_FRAC = 0.0015; // of canvas HEIGHT
const LEFT_ALIGN_EDGE_PAD = 1.0; // percent of width in front of a LEFT-aligned column

// Default board-header placement when the design sets no title_style / subtitle_style
// (graphic.BOARD_TITLE_DEFAULTS / BOARD_SUBTITLE_DEFAULTS).
export const BOARD_TITLE_DEFAULTS: Required<
  Pick<HeaderStyle, "x_pct" | "y_pct" | "font_size_pct" | "align">
> = { x_pct: 50, y_pct: 6.5, font_size_pct: 4.5, align: "center" };
export const BOARD_SUBTITLE_DEFAULTS: Required<
  Pick<HeaderStyle, "x_pct" | "y_pct" | "font_size_pct" | "align">
> = { x_pct: 50, y_pct: 12, font_size_pct: 2.6, align: "center" };

/**
 * Turn a column group's placed columns into TABLE EDGES (percent of canvas width): the boundary in
 * front of each column plus the closing edge after the last. Port of graphic._column_edges - see
 * that docstring for WHY a plain midpoint is wrong (it would rule straight through left-aligned
 * team names, which run into the wide gap before the first numeric column).
 */
export function columnEdges(
  columns: Array<{ x_pct: number; align: TextAlign }>,
): number[] {
  if (!columns.length) return [];
  const cols = [...columns].sort((a, b) => a.x_pct - b.x_pct);
  const xs = cols.map((c) => c.x_pct);
  if (cols.length === 1) return [xs[0] - 6, xs[0] + 6];
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  // The width a column may claim in front of its anchor: the smaller of its two neighbouring gaps.
  const cell = (i: number) =>
    Math.min(i > 0 ? gaps[i - 1] : gaps[0], i < gaps.length ? gaps[i] : gaps[gaps.length - 1]);

  const edges = cols.map((c, i) =>
    c.align === "left"
      ? c.x_pct - LEFT_ALIGN_EDGE_PAD
      : c.align === "right"
        ? c.x_pct - cell(i)
        : c.x_pct - cell(i) / 2,
  );
  const last = cols[cols.length - 1];
  const tail =
    last.align === "right"
      ? LEFT_ALIGN_EDGE_PAD
      : last.align === "left"
        ? cell(cols.length - 1)
        : cell(cols.length - 1) / 2;
  edges.push(last.x_pct + tail);
  // Monotonic guard, so an odd hand-built layout can never produce a backwards rectangle.
  for (let i = 1; i < edges.length; i++) edges[i] = Math.max(edges[i], edges[i - 1]);
  return edges;
}

/** The [left, right] cell a column owns, in percent of canvas width (used to size its header). */
export function columnCell(
  edges: number[],
  xPct: number,
): { left: number; right: number } {
  const lo = edges.filter((e) => e <= xPct);
  const hi = edges.filter((e) => e >= xPct);
  return {
    left: lo.length ? Math.max(...lo) : xPct - 6,
    right: hi.length ? Math.min(...hi) : xPct + 6,
  };
}

// ── Design library CRUD (organizers/leaderboard-designs/) ───────────────────────
// organizationId: a number scopes to that org's library; null/undefined targets the AFC-native
// library (organization=null), which only AFC admins may write. The backend reads organization_id
// from the query string on GET and from the body on POST; PATCH/DELETE key off the design id.
export const leaderboardDesignsApi = {
  // GET organizers/leaderboard-designs/?organization_id=<id?> -> {results, total_count}
  // Full copy of a design (scalars+logos+fields+texts+pages). Owner 2026-07-02.
  duplicate: (designId: number) =>
    axios
      .post<LeaderboardDesign>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/duplicate/`,
        {},
        { headers: authHeaders() },
      )
      .then((r) => r.data),
  list: (organizationId?: number | null) =>
    axios
      .get<{ results: LeaderboardDesign[]; total_count: number }>(
        `${BASE}/organizers/leaderboard-designs/`,
        {
          params:
            organizationId != null ? { organization_id: organizationId } : {},
          headers: authHeaders(),
        },
      )
      .then((r) => r.data),

  // POST organizers/leaderboard-designs/create-default/ (multipart) -> {design, note}.
  // One-click "Create default AFC design": builds a ready-to-use design (AFC dark/green theme +
  // the standard columns POS / TEAM logo+name / KILLS / PLACEMENT POINTS / BOOYAHS / TOTAL POINTS)
  // sized for a team-capacity preset: 12 (one 12-row column), 15 (one 15-row column), or 24 (two
  // 12-row columns). organizationId scopes it to that org's library; omit/null = the AFC-native
  // library. `note` explains how the AFC + org logos were handled. Backed by
  // afc_organizers.views_leaderboard_design.create_default_design. Consumed by
  // LeaderboardDesignsManager's "Create default AFC design" 12/15/24 buttons.
  createDefault: (preset: 12 | 15 | 24, organizationId?: number | null) => {
    const fd = new FormData();
    fd.append("preset", String(preset));
    if (organizationId != null) fd.append("organization_id", String(organizationId));
    return axios
      .post<{ design: LeaderboardDesign; note?: string }>(
        `${BASE}/organizers/leaderboard-designs/create-default/`,
        fd,
        { headers: authHeaders() },
      )
      .then((r) => r.data);
  },

  // POST organizers/leaderboard-designs/ (multipart) -> {design}. The caller builds the FormData
  // (name + optional background_instagram/background_youtube files + style fields + is_default +
  // organization_id when org-scoped). We do NOT set Content-Type so axios writes the boundary.
  create: (form: FormData) =>
    axios
      .post<{ design: LeaderboardDesign }>(
        `${BASE}/organizers/leaderboard-designs/`,
        form,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // PATCH organizers/leaderboard-designs/by-id/<id>/ (multipart) -> {design}. Same FormData shape;
  // only the keys present are changed (replace a background, rename, recolor, toggle default).
  update: (designId: number, form: FormData) =>
    axios
      .patch<{ design: LeaderboardDesign }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/`,
        form,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // DELETE organizers/leaderboard-designs/by-id/<id>/ -> {message}
  remove: (designId: number) =>
    axios
      .delete(`${BASE}/organizers/leaderboard-designs/by-id/${designId}/`, {
        headers: authHeaders(),
      })
      .then((r) => r.data),

  // ── Positioned logos on a design (sub-endpoints) ─────────────────────────────
  // A design carries 0..N logos at a centre position (x_pct/y_pct) + size. The drag-canvas editor
  // adds/moves/removes them. addLogo is multipart (the image rides along); update/delete key off id.
  // POST organizers/leaderboard-designs/by-id/<designId>/logos/  (multipart) -> {logo}
  addLogo: (
    designId: number,
    file: File,
    opts: { x_pct: number; y_pct: number; size: LogoSize },
  ) => {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("x_pct", String(opts.x_pct));
    fd.append("y_pct", String(opts.y_pct));
    fd.append("size", opts.size);
    return axios
      .post<{ logo: LeaderboardDesignLogo }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/logos/`,
        fd,
        { headers: authHeaders() },
      )
      .then((r) => r.data);
  },
  // PATCH .../logos/<logoId>/  - reposition/resize (only the keys sent are changed) -> {logo}
  updateLogo: (
    designId: number,
    logoId: number,
    body: Partial<{ x_pct: number; y_pct: number; size: LogoSize }>,
  ) =>
    axios
      .patch<{ logo: LeaderboardDesignLogo }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/logos/${logoId}/`,
        body,
        { headers: authHeaders() },
      )
      .then((r) => r.data),
  // DELETE .../logos/<logoId>/ -> {message}
  deleteLogo: (designId: number, logoId: number) =>
    axios
      .delete(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/logos/${logoId}/`,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // ── Connected-column FIELDS on a design (owner 2026-06-14) ──────────────────
  // A field binds to a stat (field_type, set on create) + position/style. Plain JSON bodies.
  // POST .../fields/  -> {field}
  addField: (
    designId: number,
    body: {
      field_type: FieldType;
      column_group?: number;
      x_pct?: number;
      align?: TextAlign;
      font_id?: number | null;
      font_size_pct?: number | null;
      color?: string;
      // Per-size enablement (owner 2026-07-05): show this new column on IG / YT independently. Omit =>
      // backend default true (both). The editor sends these so a column added while editing ONE size
      // starts shown on that size only (it does not silently appear on the other size too).
      show_instagram?: boolean;
      show_youtube?: boolean;
      // Multi-page (owner 2026-06-14): scope this field to a page. Omit / null = design-level (page 1).
      page_id?: number | null;
    },
  ) =>
    axios
      .post<{ field: LeaderboardDesignField }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/fields/`,
        body,
        { headers: authHeaders() },
      )
      .then((r) => r.data),
  // PATCH .../fields/<fieldId>/ - only keys sent change -> {field}
  updateField: (
    designId: number,
    fieldId: number,
    body: Partial<{
      column_group: number;
      x_pct: number;
      align: TextAlign;
      font_id: number | null;
      font_size_pct: number | null;
      color: string;
      // Per-size enablement (owner 2026-07-05): toggle this column on/off for one size independently.
      show_instagram: boolean;
      show_youtube: boolean;
      // Which size's layout this edit targets (owner 2026-06-15): "youtube" writes x_pct_youtube,
      // else the canonical Instagram x_pct. Omit = instagram.
      size: "instagram" | "youtube";
    }>,
  ) =>
    axios
      .patch<{ field: LeaderboardDesignField }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/fields/${fieldId}/`,
        body,
        { headers: authHeaders() },
      )
      .then((r) => r.data),
  // DELETE .../fields/<fieldId>/ -> {message}
  deleteField: (designId: number, fieldId: number) =>
    axios
      .delete(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/fields/${fieldId}/`,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // ── Freeform TEXT elements on a design ───────────────────────────────────────
  // POST .../texts/  -> {text}
  addText: (
    designId: number,
    body: {
      text: string;
      x_pct?: number;
      y_pct?: number;
      align?: TextAlign;
      font_id?: number | null;
      font_size_pct?: number | null;
      color?: string;
      // Multi-page (owner 2026-06-14): scope this text to a page. Omit / null = design-level (page 1).
      page_id?: number | null;
    },
  ) =>
    axios
      .post<{ text: LeaderboardDesignText }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/texts/`,
        body,
        { headers: authHeaders() },
      )
      .then((r) => r.data),
  // PATCH .../texts/<textId>/ -> {text}
  updateText: (
    designId: number,
    textId: number,
    body: Partial<{
      text: string;
      x_pct: number;
      y_pct: number;
      align: TextAlign;
      font_id: number | null;
      font_size_pct: number | null;
      color: string;
      // Which size's layout this edit targets (owner 2026-06-15): "youtube" writes the *_youtube
      // position, else the canonical Instagram one. Omit = instagram.
      size: "instagram" | "youtube";
    }>,
  ) =>
    axios
      .patch<{ text: LeaderboardDesignText }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/texts/${textId}/`,
        body,
        { headers: authHeaders() },
      )
      .then((r) => r.data),
  // DELETE .../texts/<textId>/ -> {message}
  deleteText: (designId: number, textId: number) =>
    axios
      .delete(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/texts/${textId}/`,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // ── Page CRUD (multi-page designs, owner 2026-06-14) ────────────────────────
  // A design with >1 page renders/exports as a ZIP (one PNG per page). These three calls manage
  // the OrgLeaderboardDesignPage rows. The backend auto-creates page 1 IMPLICITLY on the first
  // addPage call (copying the design-level backgrounds + column_groups), so the first new page
  // returned by addPage is page 2 and the design-level data becomes page 1. Consumed by
  // DesignFieldsEditor.tsx (the page tabs + "Add page" action). Multipart, so we do NOT set
  // Content-Type (axios writes the boundary), matching the design create/update idiom above.

  // POST .../pages/ -> {page, design}. Creates the next page. columnGroups rides as a JSON string.
  // Returns the UPDATED design too so the editor can refresh its full state (incl. the implicit page 1).
  addPage: (
    designId: number,
    opts?: {
      columnGroups?: DesignColumnGroup[];
      backgroundInstagram?: File;
      backgroundYoutube?: File;
    },
  ) => {
    const fd = new FormData();
    if (opts?.columnGroups) {
      fd.append("column_groups", JSON.stringify(opts.columnGroups));
    }
    if (opts?.backgroundInstagram)
      fd.append("background_instagram", opts.backgroundInstagram);
    if (opts?.backgroundYoutube)
      fd.append("background_youtube", opts.backgroundYoutube);
    return axios
      .post<{ page: LeaderboardDesignPage; design: LeaderboardDesign }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/pages/`,
        fd,
        { headers: authHeaders() },
      )
      .then((r) => r.data);
  },

  // PATCH .../pages/<pageId>/ -> {page}. Update backgrounds and/or column_groups for one page.
  // Only the keys present are changed. The editor uses this to auto-save a page's column layout.
  updatePage: (
    designId: number,
    pageId: number,
    opts: {
      columnGroups?: DesignColumnGroup[];
      backgroundInstagram?: File;
      backgroundYoutube?: File;
      // Which size's column_groups this writes (owner 2026-06-15): "youtube" -> column_groups_youtube.
      size?: "instagram" | "youtube";
    },
  ) => {
    const fd = new FormData();
    if (opts.columnGroups !== undefined) {
      fd.append("column_groups", JSON.stringify(opts.columnGroups));
    }
    if (opts.size) fd.append("size", opts.size);
    if (opts.backgroundInstagram)
      fd.append("background_instagram", opts.backgroundInstagram);
    if (opts.backgroundYoutube)
      fd.append("background_youtube", opts.backgroundYoutube);
    return axios
      .patch<{ page: LeaderboardDesignPage }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/pages/${pageId}/`,
        fd,
        { headers: authHeaders() },
      )
      .then((r) => r.data);
  },

  // DELETE .../pages/<pageId>/ -> {message}. Deletes the page (cascading its fields + texts).
  // The backend collapses back to single-page mode when only one page row remains.
  deletePage: (designId: number, pageId: number) =>
    axios
      .delete(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/pages/${pageId}/`,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // POST .../apply-background-to-all/ -> {design}. Broadcasts the given background image(s) to
  // EVERY explicit page of the design in one operation, saving the per-page upload-and-repeat cycle.
  // Multipart FormData: background_instagram and/or background_youtube (at least one required; the
  // backend validates). We do NOT set Content-Type so axios writes the multipart boundary automatically,
  // matching the addPage/updatePage idiom. Returns the full updated design so the caller can refresh
  // all page background URLs in one state update. Consumed by DesignFieldsEditor.tsx "Apply to all
  // pages" action.
  applyBackgroundToAll: (designId: number, form: FormData) =>
    axios
      .post<{ design: LeaderboardDesign }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/apply-background-to-all/`,
        form,
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // POST .../apply-field-enablement-to-all/ -> {design}. The field-level twin of applyBackgroundToAll
  // (owner 2026-07-05, audit complaint A): copy a placed column's per-size enablement so it shows on
  // BOTH sizes (and, for a single fieldId, across all pages of a multi-page design). Pass fieldId to
  // target one column; omit/null = every field on the design (turn all columns back on for both
  // sizes). Returns the full updated design so the caller refreshes its field flags in one state
  // update. Backed by afc_organizers.views_leaderboard_design.apply_field_enablement_to_all. Consumed
  // by DesignFieldsEditor.tsx "Apply to all" control on the selected field.
  applyFieldEnablementToAll: (designId: number, fieldId?: number | null) =>
    axios
      .post<{ design: LeaderboardDesign }>(
        `${BASE}/organizers/leaderboard-designs/by-id/${designId}/apply-field-enablement-to-all/`,
        fieldId != null ? { field_id: fieldId } : {},
        { headers: authHeaders() },
      )
      .then((r) => r.data),

  // ── Export renderer (leaderboards/standalone/<id>/graphic/) ──────────────────
  // GET the rendered PNG as a Blob. design_id is optional (the backend falls back to the library
  // default, then a plain dark AFC background); size picks the canvas; title defaults to the
  // leaderboard name server-side; subtitle is the free-text stage/group line the user types.
  // Returns the raw Blob so the caller can object-URL + save it (see ExportGraphicDialog).
  // Multi-page (owner 2026-06-14): pass page: "all" to request a ZIP of every page. The backend
  // returns application/zip only when the chosen design actually has >1 page; otherwise it still
  // returns a single PNG, so the caller should decide ZIP vs PNG from design.pages.length itself.
  downloadGraphic: (
    lbId: number | string,
    opts: {
      designId?: number | null;
      size: GraphicSize;
      title?: string;
      subtitle?: string;
      page?: number | "all"; // omit = single PNG; a page number = just that page; "all" = ZIP of all
    },
  ): Promise<Blob> => {
    const params: Record<string, any> = { size: opts.size };
    if (opts.designId != null) params.design_id = opts.designId;
    if (opts.title) params.title = opts.title;
    if (opts.subtitle) params.subtitle = opts.subtitle;
    if (opts.page) params.page = opts.page;
    // Cache-bust (owner 2026-07-01): the export URL is otherwise identical across renders, so the
    // browser served a STALE cached PNG after a design edit ("export doesn't give the updated design").
    // A unique param forces a fresh server render every time.
    params._ts = Date.now();
    return axios
      .get(`${BASE}/leaderboards/standalone/${lbId}/graphic/`, {
        params,
        headers: authHeaders(),
        responseType: "blob",
      })
      .then((r) => r.data as Blob);
  },

  // ── Event stage export (owner 2026-06-14) ────────────────────────────────────
  // GET events/<eventId>/stages/<stageId>/graphic/ -> PNG Blob. Renders the stage's cumulative
  // standings onto a design (the event org's library, or AFC-native). Same blob+auth idiom as
  // downloadGraphic. Consumed by EventGroupExportGraphicDialog on the event leaderboard page.
  // Multi-page (owner 2026-06-14): page: "all" requests a ZIP of every page (same backend rule as
  // downloadGraphic above). Consumed by EventStageExportGraphicDialog.
  downloadEventStageGraphic: (
    eventId: number | string,
    stageId: number | string,
    opts: {
      designId?: number | null;
      size: GraphicSize;
      title?: string;
      subtitle?: string;
      page?: number | "all"; // omit = single PNG; a page number = just that page; "all" = ZIP of all
      // The selected group (owner 2026-06-16): scope the export to ONE group's standings so the
      // image matches the per-group "Overall Leaderboard" shown on the page. Omit for stage-wide.
      groupId?: number | string | null;
      // COMBINE selection (owner 2026-07-05, complaint B): merge the leaderboards of MULTIPLE units
      // into one board. groupIds = individual groups; stageIds = whole stages (each expands to its
      // groups on the backend). When either is non-empty the backend aggregates+re-ranks across them
      // (reusing round_robin._aggregate_team_standings) instead of the single group/stage above. Serialised
      // as CSV query params (?group_ids=1,2&stage_ids=3). Pair with page:"all" so a paginated combined
      // board returns EVERY page (a ZIP when it paginates, a single PNG when it fits one page).
      groupIds?: Array<number | string>;
      stageIds?: Array<number | string>;
    },
  ): Promise<Blob> => {
    const params: Record<string, any> = { size: opts.size };
    if (opts.designId != null) params.design_id = opts.designId;
    if (opts.title) params.title = opts.title;
    if (opts.subtitle) params.subtitle = opts.subtitle;
    if (opts.page) params.page = opts.page;
    if (opts.groupId != null && opts.groupId !== "") params.group_id = opts.groupId;
    // Combine (owner 2026-07-05): CSV of the selected group / stage ids. Only added when non-empty so
    // a normal single-scope export is byte-identical to before.
    if (opts.groupIds && opts.groupIds.length) params.group_ids = opts.groupIds.join(",");
    if (opts.stageIds && opts.stageIds.length) params.stage_ids = opts.stageIds.join(",");
    // Cache-bust: force a fresh render after a design edit (see downloadGraphic).
    params._ts = Date.now();
    return axios
      .get(`${BASE}/events/${eventId}/stages/${stageId}/graphic/`, {
        params,
        headers: authHeaders(),
        responseType: "blob",
      })
      .then((r) => r.data as Blob);
  },
};

// ── Uploaded FONT library (organizers/leaderboard-fonts/) ───────────────────────
// TTF/OTF fonts an org (or AFC, org=null) can apply to a design's fields + freeform text. Same
// org-scoping rule as the design library. Consumed by the editor's font picker + upload control.
export const leaderboardFontsApi = {
  // GET organizers/leaderboard-fonts/?organization_id=<id?> -> {results, total_count}
  list: (organizationId?: number | null) =>
    axios
      .get<{ results: LeaderboardDesignFont[]; total_count: number }>(
        `${BASE}/organizers/leaderboard-fonts/`,
        {
          params: organizationId != null ? { organization_id: organizationId } : {},
          headers: authHeaders(),
        },
      )
      .then((r) => r.data),
  // POST organizers/leaderboard-fonts/ (multipart: file + name? + organization_id?) -> {font}
  upload: (file: File, opts?: { name?: string; organizationId?: number | null }) => {
    const fd = new FormData();
    fd.append("file", file);
    if (opts?.name) fd.append("name", opts.name);
    if (opts?.organizationId != null)
      fd.append("organization_id", String(opts.organizationId));
    return axios
      .post<{ font: LeaderboardDesignFont }>(
        `${BASE}/organizers/leaderboard-fonts/`,
        fd,
        { headers: authHeaders() },
      )
      .then((r) => r.data);
  },
  // DELETE organizers/leaderboard-fonts/by-id/<fontId>/ -> {message}
  remove: (fontId: number) =>
    axios
      .delete(`${BASE}/organizers/leaderboard-fonts/by-id/${fontId}/`, {
        headers: authHeaders(),
      })
      .then((r) => r.data),
};
