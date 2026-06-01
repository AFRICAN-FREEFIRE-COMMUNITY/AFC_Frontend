/**
 * Shared MOCK data for the admin /a/rankings dashboard mockup.
 * Coherent across all sub-pages (same teams/seasons). Swapped for the real
 * Phase-2 write API once endpoints exist.
 */

export const mockSeasons = [
  {
    season_id: 2, name: "Season 2 2026", quarter: 2, year: 2026, is_active: true,
    start_date: "2026-04-01", end_date: "2026-06-30",
    transfer_window_open: "2026-04-01", transfer_window_close: "2026-04-14",
    tier_eval_run: false, tier_eval_run_at: null, tier_eval_run_by: null,
  },
  {
    season_id: 1, name: "Season 1 2026", quarter: 1, year: 2026, is_active: false,
    start_date: "2026-01-01", end_date: "2026-03-31",
    transfer_window_open: "2026-01-01", transfer_window_close: "2026-01-14",
    tier_eval_run: true, tier_eval_run_at: "2026-04-01T09:12:00Z", tier_eval_run_by: "headadmin",
  },
];

export const mockTeams = [
  { team_id: 1, team_name: "Team Omega", tier: 0, total_score: 174, kills: 600, tournaments: 2, wins: 2, prize: 5, social: 1, floor: true },
  { team_id: 2, team_name: "Team Echo", tier: 1, total_score: 104, kills: 200, tournaments: 2, wins: 1, prize: 5, social: 1, floor: true },
  { team_id: 3, team_name: "Team Delta", tier: 2, total_score: 58, kills: 60, tournaments: 2, wins: 0, prize: 5, social: 1, floor: true },
  { team_id: 4, team_name: "Team Bravo", tier: 3, total_score: 72, kills: 406, tournaments: 1, wins: 0, prize: 5, social: 1, floor: false },
  { team_id: 5, team_name: "Team Alpha", tier: 3, total_score: 62, kills: 18, tournaments: 1, wins: 1, prize: 5, social: 1, floor: false },
];

// tournaments whose result markers an admin sets (winner / finals / mvp / play date)
export const mockResultEvents = [
  {
    event_id: 1, event_name: "AFC Test Cup", tier: "tier_1", played_on: "2026-05-15", status: "needs_markers",
    teams: [
      { tt_id: 11, team_name: "Team Alpha", placement: 1, is_winner: true, reached_finals: true, finals: 1, finalized: true },
      { tt_id: 12, team_name: "Team Bravo", placement: 2, is_winner: false, reached_finals: true, finals: 1, finalized: true },
    ],
    matches: [
      { match_id: 1, number: 1, played_on: "2026-05-15", is_finals: true, mvp: "ShadowAce" },
      { match_id: 2, number: 2, played_on: "2026-05-15", is_finals: true, mvp: null },
    ],
  },
  {
    event_id: 2, event_name: "AFC Elite Series, Leg 1", tier: "tier_1", played_on: "2026-05-20", status: "needs_markers",
    teams: [
      { tt_id: 21, team_name: "Team Omega", placement: 1, is_winner: true, reached_finals: true, finals: 1, finalized: true },
      { tt_id: 22, team_name: "Team Echo", placement: 1, is_winner: true, reached_finals: true, finals: 1, finalized: false },
      { tt_id: 23, team_name: "Team Delta", placement: 2, is_winner: false, reached_finals: true, finals: 1, finalized: false },
    ],
    matches: [{ match_id: 3, number: 1, played_on: "2026-05-20", is_finals: true, mvp: "NovaStrike" }],
  },
];

export const mockGhostTeams = [
  { id: "g1", team_name: "Lagos Lions", country: "Nigeria", external_id: "discord:lions#0420", is_active: true, claim_status: "unclaimed", created_by: "event_admin", created_at: "2026-05-02", players: [{ id: 1, ign: "LionHeart" }, { id: 2, ign: "SavannaX" }, { id: 3, ign: "MambaZero" }, { id: 4, ign: "EagleEye" }] },
  { id: "g2", team_name: "Nairobi Hawks", country: "Kenya", external_id: "bracket:NH-22", is_active: true, claim_status: "pending", claim_requested_by: "Brian Otieno", claimed_team: "Team Echo", created_by: "headadmin", created_at: "2026-04-18", players: [{ id: 1, ign: "HawkEye254" }, { id: 2, ign: "RiftValley" }, { id: 3, ign: "SimbaKE" }, { id: 4, ign: "MaasaiMara" }] },
  { id: "g3", team_name: "Cairo Pharaohs", country: "Egypt", external_id: null, is_active: false, claim_status: "claimed", claimed_team: "Team Omega", created_by: "metrics_admin", created_at: "2026-03-29", players: [{ id: 1, ign: "PharaohX" }, { id: 2, ign: "NileKing" }, { id: 3, ign: "SphinxOne" }] },
];

export const mockSocial = [
  { team_id: 1, team_name: "Team Omega", instagram: 12400, tiktok: 38100, combined: 50500, pts: 10, verified_at: "2026-06-28", verified_by: "metrics_admin" },
  { team_id: 2, team_name: "Team Echo", instagram: 4200, tiktok: 9800, combined: 14000, pts: 7, verified_at: "2026-06-28", verified_by: "metrics_admin" },
  { team_id: 3, team_name: "Team Delta", instagram: 800, tiktok: 1500, combined: 2300, pts: 3, verified_at: null, verified_by: null },
  { team_id: 4, team_name: "Team Bravo", instagram: 0, tiktok: 0, combined: 0, pts: 1, verified_at: null, verified_by: null },
];

export const mockPrize = [
  { event_id: 2, event_name: "AFC Elite Series, Leg 1", team_name: "Team Omega", amount_ngn: 750000, awarded: "2026-05-20" },
  { event_id: 3, event_name: "AFC Elite Series, Leg 2", team_name: "Team Omega", amount_ngn: 500000, awarded: "2026-05-27" },
  { event_id: 1, event_name: "AFC Test Cup", team_name: "Team Alpha", amount_ngn: 120000, awarded: "2026-05-15" },
];

export const mockAudit = [
  { id: 9, type: "evaluation", ref: "season:1", action: "run", by: "headadmin", at: "2026-04-01T09:12:00Z", reason: "Q1 close-out evaluation." },
  { id: 8, type: "tier_override", ref: "team:5", action: "override", by: "headadmin", at: "2026-05-22T14:05:00Z", reason: "Manual correction after disputed result review (Entry → Rising)." },
  { id: 7, type: "ban_zeroing", ref: "team:7", action: "zero", by: "headadmin", at: "2026-05-20T11:40:00Z", reason: "Confirmed cheating; full quarter reset per §16." },
  { id: 6, type: "tournament_result", ref: "match:3", action: "edited", by: "metrics_admin", at: "2026-05-21T08:30:00Z", reason: "Corrected kill count from OCR mis-read (Omega 14 → 16)." },
  { id: 5, type: "transfer_window", ref: "season:2", action: "extended", by: "metrics_admin", at: "2026-04-12T17:00:00Z", reason: "Community request after scheduling clash." },
  { id: 4, type: "ghost_claim", ref: "ghost:g3", action: "approved", by: "headadmin", at: "2026-04-02T10:15:00Z", reason: "Verified team name + country match." },
  { id: 3, type: "prize_money", ref: "event:2", action: "created", by: "metrics_admin", at: "2026-05-20T19:00:00Z", reason: "Leg 1 payout entry." },
  { id: 2, type: "social_media", ref: "team:1", action: "verified", by: "metrics_admin", at: "2026-06-28T12:00:00Z", reason: "End-of-quarter follower snapshot." },
  { id: 1, type: "season", ref: "season:2", action: "created", by: "headadmin", at: "2026-03-30T08:00:00Z", reason: "Open Season 2 2026." },
];

export const mockTransferLog = [
  { id: 2, action: "extended", prev_close: "2026-04-14", new_close: "2026-04-18", by: "metrics_admin", at: "2026-04-12", reason: "Community request after scheduling clash." },
  { id: 1, action: "opened", new_close: "2026-04-14", by: "headadmin", at: "2026-04-01", reason: "Season 2 transfer window open." },
];

export const TIER_LABELS: Record<number, string> = { 0: "Elite", 1: "Competitive", 2: "Rising", 3: "Entry" };
export const ngn = (n: number) => "₦" + n.toLocaleString();
