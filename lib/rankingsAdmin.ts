import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the Phase-2 rankings ADMIN write API (prefix /rankings/).
 *
 * Mirrors lib/rankings.ts (axios + the BASE url + the {results, pagination} envelope),
 * but every call carries the Bearer token - the backend admin endpoints are gated on
 * head_admin / metrics_admin. The token is read from the same `auth_token` cookie that
 * AuthContext sets (js-cookie), so callers don't have to thread it through props/hooks.
 *
 * Every write endpoint is reason-gated server-side: pass `reason` (>= 10 chars) in the
 * body or the backend returns 400. Errors surface as axios errors with
 * `err.response.data.message` - handle them with a toast at the call site, like the rest
 * of the app (see app/(a)/a/teams/page.tsx).
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/rankings/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aDelete<T = any>(path: string, body?: any): Promise<T> {
  // axios DELETE carries a body via the `data` option (used for the mandatory reason).
  return (await axios.delete(url(path), { headers: authHeaders(), data: body })).data;
}

export const rankingsAdminApi = {
  // ── Seasons ──────────────────────────────────────────────────────────────
  createSeason: (body: any) => aPost("seasons/", body),
  updateSeason: (seasonId: number, body: any) => aPatch(`seasons/${seasonId}/`, body),
  transferWindow: (seasonId: number, body: any) => aPatch(`seasons/${seasonId}/transfer-window/`, body),
  transferLog: (seasonId: number) => aGet(`seasons/${seasonId}/transfer-log/`),

  // ── Overrides / bans / deductions (season-scoped) ────────────────────────
  overrideTier: (seasonId: number, teamId: number, body: any) =>
    aPatch(`seasons/${seasonId}/team-tier/${teamId}/`, body),
  zeroTeam: (seasonId: number, teamId: number, body: any) =>
    aPost(`seasons/${seasonId}/zero-team/${teamId}/`, body),
  unzeroTeam: (seasonId: number, teamId: number, body: any) =>
    aPost(`seasons/${seasonId}/unzero-team/${teamId}/`, body),
  zeroPlayer: (seasonId: number, playerId: number, body: any) =>
    aPost(`seasons/${seasonId}/zero-player/${playerId}/`, body),
  deductPoints: (seasonId: number, teamId: number, body: any) =>
    aPost(`seasons/${seasonId}/deduct-points/${teamId}/`, body),
  clearDeduction: (seasonId: number, teamId: number, body: any) =>
    aPost(`seasons/${seasonId}/clear-deduction/${teamId}/`, body),

  // ── Audit log + raw viewer (read-only) ───────────────────────────────────
  auditLog: (params?: Record<string, any>) => aGet("admin/audit-log/", params),
  teamRaw: (teamId: number, seasonId?: number) =>
    aGet(`admin/teams/${teamId}/raw/`, seasonId ? { season_id: seasonId } : undefined),
  playerRaw: (playerId: number, seasonId?: number) =>
    aGet(`admin/players/${playerId}/raw/`, seasonId ? { season_id: seasonId } : undefined),

  // ── Ghost teams + players + claims ───────────────────────────────────────
  ghostList: (params?: Record<string, any>) => aGet("ghost-teams/", params),
  ghostDetail: (ghostId: string) => aGet(`ghost-teams/${ghostId}/`),
  createGhost: (body: any) => aPost("ghost-teams/", body),
  // append a single ghost player (one IGN slot) to an existing unclaimed ghost team.
  createGhostPlayer: (ghostId: string, body: any) => aPost(`ghost-teams/${ghostId}/players/`, body),
  // flat create: the ghost team is NOT required. body = { ign, reason, ghost_team_id? }.
  // Omit ghost_team_id to park a standalone (team-less) ghost player; include it to attach the
  // new player to that unclaimed ghost team. Hits POST /rankings/ghost-players/
  // (admin_ghost.ghost_player_create_flat). Consumed by the CreateGhostPlayerModal on the
  // admin Players tab.
  createGhostPlayerFlat: (body: any) => aPost("ghost-players/", body),
  updateGhost: (ghostId: string, body: any) => aPatch(`ghost-teams/${ghostId}/`, body),
  deleteGhost: (ghostId: string, body: any) => aDelete(`ghost-teams/${ghostId}/`, body),
  approveClaim: (ghostId: string, body: any) => aPost(`ghost-teams/${ghostId}/approve-claim/`, body),
  revokeClaim: (ghostId: string, body: any) => aPost(`ghost-teams/${ghostId}/revoke-claim/`, body),

  // ── Admin CLAIM-REQUEST QUEUE (pending ghost-team + ghost-player claims awaiting review) ──
  // The combined queue on /a/rankings (Claim requests section) fetches BOTH pending lists and
  // renders one table, then approves/rejects each row. All Bearer-gated (head_admin |
  // metrics_admin). Endpoints in afc_rankings.admin_ghost. reason must be >= 10 chars on
  // approve/reject (the backend 400s otherwise). Consumed by app/(a)/a/rankings/page.tsx.
  ghostTeamsPending: () => aGet("ghost-teams/", { claim_status: "pending" }),         // GET ghost-teams/?claim_status=pending
  ghostPlayersPending: () => aGet("ghost-players/", { claim_status: "pending" }),     // GET ghost-players/?claim_status=pending
  approveGhostTeamClaim: (ghostId: string, body: any) => aPost(`ghost-teams/${ghostId}/approve-claim/`, body),
  rejectGhostTeamClaim: (ghostId: string, body: any) => aPost(`ghost-teams/${ghostId}/reject-claim/`, body),
  approveGhostPlayerClaim: (playerId: number, body: any) => aPost(`ghost-players/${playerId}/approve-claim/`, body),
  rejectGhostPlayerClaim: (playerId: number, body: any) => aPost(`ghost-players/${playerId}/reject-claim/`, body),

  // ── Scoring config (versioned) ───────────────────────────────────────────
  scoringConfig: () => aGet("scoring-config/"),
  scoringDefaults: () => aGet("scoring-config/defaults/"),
  saveScoringConfig: (body: any) => aPost("scoring-config/", body),

  // ── Tournament tier rules + classifier ───────────────────────────────────
  tierRules: () => aGet("event-tier-rules/"),
  createTierRule: (body: any) => aPost("event-tier-rules/", body),
  updateTierRule: (ruleId: number, body: any) => aPatch(`event-tier-rules/${ruleId}/`, body),
  deleteTierRule: (ruleId: number, body: any) => aDelete(`event-tier-rules/${ruleId}/`, body),
  reorderTierRules: (body: any) => aPost("event-tier-rules/reorder/", body),
  classifyTournament: (body: any) => aPost("event-tier-rules/classify/", body),
  updateTierConfig: (body: any) => aPatch("event-tier-config/", body),

  // ── Prize entry ──────────────────────────────────────────────────────────
  prizes: (params?: Record<string, any>) => aGet("admin/tournament-prizes/", params),
  createPrize: (body: any) => aPost("prize/", body),
  updatePrize: (payoutId: number, body: any) => aPatch(`prize/${payoutId}/`, body),
  deletePrize: (payoutId: number, body: any) => aDelete(`prize/${payoutId}/`, body),

  // ── Result Markers - counting controls (Phase 2b) ─────────────────────────
  resultMarkers: (seasonId?: number) => aGet("admin/results/markers/", seasonId ? { season_id: seasonId } : undefined),
  eventCounting: (eventId: number) => aGet(`event-counting/${eventId}/`),
  setEventCounting: (eventId: number, body: any) => aPatch(`event-counting/${eventId}/`, body),
  resultExclusions: (params?: Record<string, any>) => aGet("result-exclusions/", params),
  createExclusion: (body: any) => aPost("result-exclusions/", body),
  deleteExclusion: (exclusionId: number, body: any) => aDelete(`result-exclusions/${exclusionId}/`, body),

  // ── Social - self-connect + verify (Phase 2b) ─────────────────────────────
  socialList: (seasonId: number) => aGet(`admin/seasons/${seasonId}/social/`),
  socialEdit: (seasonId: number, teamId: number, body: any) => aPatch(`admin/seasons/${seasonId}/social/${teamId}/`, body),
  socialVerify: (seasonId: number, teamId: number, body: any) => aPost(`admin/seasons/${seasonId}/social/${teamId}/verify/`, body),
  socialUnverify: (seasonId: number, teamId: number, body: any) => aPost(`admin/seasons/${seasonId}/social/${teamId}/unverify/`, body),
  socialConnect: (seasonId: number, teamId: number, body: any) => aPost(`admin/seasons/${seasonId}/social/${teamId}/connect/`, body),

  // ── Run evaluation + recalc (Phase 2b) ────────────────────────────────────
  runEvaluation: (seasonId: number, body: any) => aPost(`seasons/${seasonId}/run-evaluation/`, body),
  recalcStatus: (seasonId?: number) => aGet("admin/recalc-status/", seasonId ? { season_id: seasonId } : undefined),
  recalcEntity: (body: any) => aPost("admin/recalc/", body),

  // ── Publish controls + admin draft preview (Phase 2c) ─────────────────────
  // publishState toggles rankings_published and/or tiers_published independently.
  publishState: (seasonId: number, body: any) => aPatch(`seasons/${seasonId}/publish/`, body),
  // ungated draft reads - admin surfaces MUST use these (the public teams/players quarterly
  // endpoints return nothing until published).
  adminTeamsQuarterly: (seasonId?: number) => aGet("admin/teams/quarterly/", seasonId ? { season_id: seasonId } : undefined),
  adminPlayersQuarterly: (seasonId?: number) => aGet("admin/players/quarterly/", seasonId ? { season_id: seasonId } : undefined),
};
