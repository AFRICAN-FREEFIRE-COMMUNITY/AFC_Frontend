// Single source of all admin help copy. Keyed area.page.element; _page = page tip,
// _section = section tip, bare key = field/action. `as const` so InfoTip ids are type-checked.
export const HELP = {
  // ── Events › Create wizard ────────────────────────────────────────────────
  // Page-level tip (top of the wizard).
  "events.create._page":
    "Create a tournament or scrim — set the details, stages, prizes and rules, then publish.",

  // Step / section tips — one per wizard step (the `_section` suffix marks a heading tip).
  "events.create.step1._section":
    "The core identity of the event: who can play, when registration runs, and when the event itself runs.",
  "events.create.event_mode._section":
    "Where the event is played. This is informational only — it doesn't change the bracket.",
  "events.create.stages._section":
    "How many rounds the event has (e.g. Group Stage, then Finals). Name each one, then configure it.",
  "events.create.prizes._section":
    "The overall prize pool shown to players. Per-stage and per-group prizes are set inside each stage.",
  "events.create.rules._section":
    "The rules players agree to. Type them inline or upload a PDF/DOC — only one is used.",
  "events.create.sponsor._section":
    "Optionally gate registration behind a sponsor task (e.g. install an app and submit a UUID).",
  "events.create.waitlist._section":
    "Let players queue once the event is full, so spots that open up get filled automatically.",
  "events.create.publish._section":
    "Decide where this event goes live, or park it as a draft to finish later.",

  // ── Step 1 fields ──────────────────────────────────────────────────────────
  "events.create.competition_type":
    "Tournament for a full bracketed competition; Scrims for casual practice matches.",
  "events.create.participant_type":
    "Team size players register as — Solo (1), Duo (2) or Squad (4). This sets how rosters are built.",
  "events.create.event_type":
    "Internal events are run and tracked on AFC; External events register through an outside link you provide.",
  "events.create.is_public":
    "Public events are listed for everyone; Private events are hidden and only reachable by direct link.",
  "events.create.max_teams_or_players":
    "The registration cap. Once this many teams or players sign up, registration closes.",
  "events.create.registration_open":
    "When sign-ups open and close. Players can only register inside this window.",
  "events.create.registration_time":
    "Optional exact time registration opens or closes — defaults to the start/end of the day if left blank.",
  "events.create.event_dates":
    "When the event itself runs. Must fall after registration so players have time to sign up.",
  "events.create.event_time":
    "Optional exact start or end time for the event — leave blank if only the date matters.",

  // ── Step 2: Event mode ─────────────────────────────────────────────────────
  "events.create.event_mode":
    "Virtual (online), Physical (LAN, in-person) or Hybrid (a mix of both).",

  // ── Step 3: Stage count ────────────────────────────────────────────────────
  "events.create.number_of_stages":
    "How many rounds the event has. Each stage is configured separately on the next screen.",

  // ── Stage modal fields (inside a stage) ────────────────────────────────────
  "events.create.stage_format":
    "The scoring system for this round — e.g. Battle Royale points or a Clash Squad series.",
  "events.create.champion_point":
    "A win rule where the first team to Booyah while already at or above a points threshold wins the stage.",
  "events.create.champion_point_threshold":
    "The points a team must already have before a Booyah counts as the stage win.",
  "events.create.point_rush":
    "Awards placement bonuses in this stage and banks them into a later stage as a head start.",
  "events.create.point_rush_reward":
    "How many bonus points each finishing position earns (e.g. 1st = 10, 2nd = 7).",
  "events.create.point_rush_target":
    "The later stage that receives these bonus points. Only stages after this one can be chosen.",
  "events.create.number_of_groups":
    "How many groups (lobbies) this stage is split into. Each group is configured separately.",
  "events.create.teams_qualifying":
    "How many teams advance out of this group to the next round.",
  "events.create.match_count":
    "Number of matches this group plays to decide standings.",
  "events.create.match_maps":
    "The maps played in this group. Use +/− to set how many times each map is played.",

  // ── Waitlist ───────────────────────────────────────────────────────────────
  "events.create.is_waitlist_enabled":
    "Turn on to let players queue once the event is full and auto-fill any spots that open up.",
  "events.create.waitlist_capacity":
    "The maximum number of players allowed to wait in the queue.",

  // ── Publish & save actions ─────────────────────────────────────────────────
  "events.create.publish_to_tournaments":
    "Make the event live on the public Tournaments page so players can find and register.",
  "events.create.save_to_drafts":
    "Save your progress without publishing. Drafts aren't visible to players until you publish them.",

  // ══════════════════════════════════════════════════════════════════════════
  // Events › Edit flow (tabbed). The edit screen exposes the same fields as the
  // create wizard PLUS live-event controls (seeding, verify, results). Where a
  // field is identical to create we REUSE the create id (e.g. stage_format) so
  // there is one source of copy — the ids below are only the edit-only extras.
  // ══════════════════════════════════════════════════════════════════════════

  // Page-level tip (top of the edit screen).
  "events.edit._page":
    "Edit a live or upcoming event — update its details, manage registered teams and stages, then save. Some changes affect players who have already registered.",

  // ── Tab / section tips (one per edit tab heading) ──────────────────────────
  "events.edit.basic_info._section":
    "The event's core details — name, format, dates and registration window. Editing these after players register can affect their sign-ups.",
  "events.edit.registered_teams._section":
    "Everyone who has registered. Disqualify or reactivate competitors, or add teams in manually.",
  "events.edit.stages_groups._section":
    "Every stage and its groups. Edit a stage's setup, seed competitors into the next round, or enter results.",
  "events.edit.prize_rules._section":
    "The overall prize pool and the rules players agree to. Per-stage and per-group prizes are set inside each stage.",
  "events.edit.actions._section":
    "Run-the-event controls — start or end the tournament, seed and advance stages, broadcast announcements, and export data.",
  "events.edit.sponsor._section":
    "Gate registration behind a sponsor task (e.g. install an app and submit a UUID), and review who has completed it.",
  "events.edit.waitlist._section":
    "Let players queue once the event is full, and see who is currently waiting for a spot.",

  // ── Edit-only stage actions (live events) ──────────────────────────────────
  "events.edit.seed_to_next_stage":
    "Send the qualifying competitors from this group up into the next stage. Run this once the group's results are final.",
  "events.edit.add_teams":
    "Manually place teams into this event, stage or group — useful for invited teams or fixing a missed registration.",

  // ── Event Actions tab controls ─────────────────────────────────────────────
  "events.edit.start_tournament":
    "Lock registration and seed everyone into Stage 1. The event becomes live and players can no longer sign up.",
  "events.edit.cancel_event":
    "Mark the event cancelled and notify every registered player. Use when the event won't go ahead.",
  "events.edit.complete_event":
    "Finalise the event and lock all results so nothing can be changed afterwards.",
  "events.edit.seed_to_groups":
    "Randomly distribute a stage's competitors across its groups. Run before the stage's matches begin.",
  "events.edit.advance_stage":
    "Push the top competitors from a chosen group into the next stage.",
  "events.edit.sync_discord":
    "Re-assign any missing Discord roles for a group — handy if a role didn't apply when players were seeded.",
  "events.edit.export_participants":
    "Download the full list of registered players or teams as a CSV or Excel file.",

  // ══════════════════════════════════════════════════════════════════════════
  // Leaderboards › point-system config + manual result entry
  // ══════════════════════════════════════════════════════════════════════════

  // Page-level tip (Leaderboards management list).
  "leaderboards._page":
    "Build and manage match leaderboards — pick an event, set how points are scored, then enter or import each match's results.",

  // ── Point-system section + fields ──────────────────────────────────────────
  "leaderboards.point_system._section":
    "Defines how a match is scored: how many points each finishing position is worth, plus points for kills, assists and damage.",
  "leaderboards.placement_points":
    "Points awarded for each finishing position — e.g. 1st = 100, 2nd = 80. Add a row for every position you want to score.",
  "leaderboards.kill_point":
    "Points added for each kill a competitor gets. Kills are always shown on the leaderboard.",
  "leaderboards.assist_point":
    "Points added for each assist a player records.",
  "leaderboards.damage_point":
    "Points added for every 1000 damage a player deals.",
  "leaderboards.apply_to_all_maps":
    "On: one point system scores every map in this group. Off: configure each map's scoring separately.",

  // ── Manual result-entry section + fields ───────────────────────────────────
  "leaderboards.manual_result._section":
    "Enter this match's results by hand. Uncheck anyone who didn't play so they aren't scored for this match.",
  "leaderboards.result_placement":
    "Where the team or player finished this match (1 = winner). Drives the placement points above.",
  "leaderboards.result_kills":
    "Total kills this competitor got in the match.",
  "leaderboards.result_damage":
    "Total damage this player dealt in the match — scored per 1000.",
  "leaderboards.result_assists":
    "Total assists this player recorded in the match.",
  "leaderboards.result_bonus_points":
    "Extra points to add on top of the calculated score — e.g. an admin reward.",
  "leaderboards.result_penalty_points":
    "Points to subtract from the calculated score — e.g. a rules penalty.",
} as const;

export type HelpId = keyof typeof HELP;
