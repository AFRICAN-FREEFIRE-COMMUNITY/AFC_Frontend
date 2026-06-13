import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

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

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

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

// One library design as returned by _serialize_design (backend views_leaderboard_design). The two
// background_* fields are media URLs (or null when that size has not been uploaded yet).
export interface LeaderboardDesign {
  id: number;
  name: string;
  background_instagram: string | null; // 1080x1350 portrait background URL
  background_youtube: string | null; // 1920x1080 landscape background URL
  text_color: string; // hex, drives the standings text
  accent_color: string; // hex, drives the rank highlight
  show_title: boolean;
  show_subtitle: boolean;
  max_rows: number; // how many standings rows the render fits (1..50)
  is_default: boolean; // the library's auto-selected design
  logos: LeaderboardDesignLogo[]; // positioned logos drawn on top of the design
  created_at: string | null;
}

// The two export canvas sizes the renderer supports (afc_leaderboard.graphic.CANVAS).
export type GraphicSize = "instagram" | "youtube";

// ── Design library CRUD (organizers/leaderboard-designs/) ───────────────────────
// organizationId: a number scopes to that org's library; null/undefined targets the AFC-native
// library (organization=null), which only AFC admins may write. The backend reads organization_id
// from the query string on GET and from the body on POST; PATCH/DELETE key off the design id.
export const leaderboardDesignsApi = {
  // GET organizers/leaderboard-designs/?organization_id=<id?> -> {results, total_count}
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
  // PATCH .../logos/<logoId>/  — reposition/resize (only the keys sent are changed) -> {logo}
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

  // ── Export renderer (leaderboards/standalone/<id>/graphic/) ──────────────────
  // GET the rendered PNG as a Blob. design_id is optional (the backend falls back to the library
  // default, then a plain dark AFC background); size picks the canvas; title defaults to the
  // leaderboard name server-side; subtitle is the free-text stage/group line the user types.
  // Returns the raw Blob so the caller can object-URL + save it (see ExportGraphicDialog).
  downloadGraphic: (
    lbId: number | string,
    opts: {
      designId?: number | null;
      size: GraphicSize;
      title?: string;
      subtitle?: string;
    },
  ): Promise<Blob> => {
    const params: Record<string, any> = { size: opts.size };
    if (opts.designId != null) params.design_id = opts.designId;
    if (opts.title) params.title = opts.title;
    if (opts.subtitle) params.subtitle = opts.subtitle;
    return axios
      .get(`${BASE}/leaderboards/standalone/${lbId}/graphic/`, {
        params,
        headers: authHeaders(),
        responseType: "blob",
      })
      .then((r) => r.data as Blob);
  },
};
