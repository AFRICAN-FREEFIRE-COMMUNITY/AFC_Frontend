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

  // ══════════════════════════════════════════════════════════════════════════
  // Rankings & Tiering — the system that scores every team and player each
  // quarter and locks them into tiers (Elite / Competitive / Rising / Entry).
  // One sub-section per /a/rankings/* page; identical controls reuse one id.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Rankings › Overview ─────────────────────────────────────────────────────
  "rankings._page":
    "The control room for the public rankings — pick a season, evaluate tiers, publish, and fix individual scores. Everything that drives the team and player ladders lives here or one click away.",
  "rankings.season_select":
    "Which season's scores you're viewing and acting on. The active season is what the public board reads.",
  "rankings.evaluation._section":
    "Lock tiers for the quarter, or re-derive one team or player's score. Head Admin or Metrics Admin only.",
  "rankings.run_evaluation":
    "Locks every team and player into a tier for the next quarter from their current scores. Preview the result first — it writes nothing — then run to commit.",
  "rankings.recalc_entity":
    "Re-derive a single team or player's score from the source results, without re-running the whole season. Queued through the same pipeline as live edits.",
  "rankings.tier_distribution._section":
    "How many teams currently sit in each tier (Elite / Competitive / Rising / Entry) for this season.",
  "rankings.publish._section":
    "The public ladder and tier badges stay hidden until you publish them. Rankings and tiers are controlled separately — publish one without the other.",
  "rankings.publish_rankings":
    "Make the public team and player ladder visible for this season. Hidden as a draft until you do.",
  "rankings.publish_tiers":
    "Make the locked tier badges (S / A / B / C) visible to the public for this season, independently of the ladder.",
  "rankings.teams_table._section":
    "Every team's current quarterly standing for this season — rank, tier, tournaments, kills and total score. Drill into a team to edit its result markers.",

  // ── Rankings › Scoring Config (the weights behind every score) ──────────────
  "rankings.scoring._page":
    "The weights, brackets and thresholds behind every ranking and tier calculation. Saving drafts a new immutable version and recalculates every team and player's score for the season.",
  "rankings.scoring.save":
    "Drafts a new immutable config version from the current values and queues a full recalculation across the season. A reason is required for the audit log.",
  "rankings.scoring.reset_defaults":
    "Loads the spec defaults from constants.py into the editor. Nothing is saved until you Save — this just stages them.",
  "rankings.scoring.tier_multipliers._section":
    "Per-tier multipliers applied to placement, kill and finals points only — never to win bonus, scrim, prize or social points.",
  "rankings.scoring.win_bonus._section":
    "Flat points for a win (not compressed, not multiplied) plus the finals-appearance base, which is multiplied by the tier multiplier.",
  "rankings.scoring.placement_points._section":
    "Points awarded by finishing position in each match. 11th place and beyond award 0.",
  "rankings.scoring.thresholds._section":
    "The minimum total score (inclusive) a team needs to reach each tier. Entry is the default floor below the lowest cut-off.",
  "rankings.scoring.kill_scale._section":
    "Cumulative raw kills compress to bounded points so high-kill teams don't run away with the score. The last row is open-ended.",
  "rankings.scoring.placement_scale._section":
    "Cumulative raw placement points compress to bounded points, the same way the kill scale does. The last row is open-ended.",
  "rankings.scoring.prize_scale._section":
    "Quarterly team tiering only — total prize money won (₦) maps to bounded points.",
  "rankings.scoring.social_scale._section":
    "Teams only, capped at 10 points — combined Instagram + TikTok followers map to bounded points.",
  "rankings.scoring.scrim._section":
    "Scrims count at a reduced weight and are capped relative to a team's tournament output, then capped again per day and per month.",
  "rankings.scoring.player_weights._section":
    "Flat per-event points that build an individual player's quarterly score — MVP, finals, team win, participation and scrim contributions.",

  // ── Rankings › Tournament Tiers (how events classify into Tier 1–3) ─────────
  "rankings.tiers._page":
    "Decide how each event is classified into Tier 1–3, which sets its scoring multiplier. Rules run top-down — the first rule a tournament matches sets its tier.",
  "rankings.tiers.save":
    "Applies your rule changes to how every future event is classified. Already-locked results aren't re-tiered. A reason is required for the audit log.",
  "rankings.tiers.reset":
    "Discards your unsaved edits and reverts the rules to the last saved version.",
  "rankings.tiers.rule_priority":
    "Drag to reorder. Rules are evaluated top-down and the first match wins, so put the most specific rules highest.",
  "rankings.tiers.match_mode":
    "Match ALL requires every condition to hold; Match ANY fires if any single condition holds.",
  "rankings.tiers.default_tier":
    "The tier an event falls into when it matches none of the rules above.",
  "rankings.tiers.test._section":
    "Enter sample event details to see which rule fires and the tier it would get — a dry run against the live classifier, nothing is saved.",

  // ── Rankings › Result Markers (which results count) ─────────────────────────
  "rankings.results._page":
    "Control which tournament results count toward rankings. Switch a whole event's winner / placement / kills off, or exclude specific teams or players. Turning anything off needs a reason.",
  "rankings.results.count_winner":
    "Whether the event's winner bonus counts toward rankings. Turn off to drop just the win points for this event.",
  "rankings.results.count_placement":
    "Whether placement points from this event count toward rankings.",
  "rankings.results.count_kills":
    "Whether kill points from this event count toward rankings.",
  "rankings.results.toggle_all":
    "Turn every marker (winner, placement, kills) on or off for this event at once. Disabling all removes the event from rankings entirely.",
  "rankings.results.exclusions":
    "Exclude specific teams or players so their results in this event don't count, while everyone else's still does.",
  "rankings.results.bulk_disable":
    "Stop the selected events from counting toward rankings in one action. Requires a reason.",

  // ── Rankings › Seasons (windows + the quarterly lock) ───────────────────────
  "rankings.seasons._page":
    "Define competition seasons, open and close the transfer window, and run the quarterly tier evaluation. The active season is what the public board reads.",
  "rankings.seasons.create":
    "Set up a new competition season — its dates, transfer window, and whether it's the active one driving the public board.",
  "rankings.seasons.active_season":
    "Only one season should be active at a time — it's the one the public ranking board reads from.",
  "rankings.seasons.transfer_window":
    "Open, close or extend the window during which players may switch teams without breaking their ranking history.",
  "rankings.seasons.run_evaluation":
    "Lock every team and player into a tier for the quarter from their current scores. Re-running overwrites the previously assigned tiers.",
  "rankings.seasons.transfer_log._section":
    "Every open, close and extend of this season's transfer window — who changed it, when, and the reason given.",

  // ── Rankings › Ghost Teams (off-platform placeholders) ──────────────────────
  "rankings.ghost._page":
    "Provisional placeholder teams that hold off-platform results until a registered team claims them. Approving a claim transfers all that history to the real team.",
  "rankings.ghost.create":
    "Create a placeholder team with a provisional roster so off-platform results can be recorded before a real team registers.",
  "rankings.ghost.external_id":
    "Optional reference linking this placeholder to its off-platform source (e.g. a Discord tag or bracket code), so you can match it later.",
  "rankings.ghost.approve_claim":
    "Transfer all of this ghost team's history, stats and prize money to the claiming team and recalculate the quarter. Only undone by a head-admin revoke.",
  "rankings.ghost.revoke_claim":
    "Reject a pending claim request, or detach an already-approved claim — which pulls the transferred history back off the team and recalculates.",

  // ── Rankings › Social Verification ──────────────────────────────────────────
  "rankings.social._page":
    "Teams connect their own Instagram and TikTok from their dashboard. Here you verify, unverify, or correct the follower counts that award up to 10 social points.",
  "rankings.social.verify":
    "Confirm a connected team's combined follower count for the quarter, awarding it social points on the bracket scale. Re-verifying an already-verified team needs a reason.",
  "rankings.social.unverify":
    "Pull a team's social points until it's checked again. The connected counts are kept, but award 0 points while unverified.",
  "rankings.social.verify_all":
    "Verify every connected, not-yet-verified team at once — first-time verifications only.",

  // ── Rankings › Prize Money ──────────────────────────────────────────────────
  "rankings.prize._page":
    "Record tournament prize payouts in Naira. Prize money feeds each team's quarterly score on the §7.2 prize scale — there is no currency conversion.",
  "rankings.prize.add":
    "Log a prize payout for a team in an event. The amount is entered directly in Naira and feeds the team's quarterly prize-money points.",
  "rankings.prize.amount":
    "The payout amount in Naira. Entered as-is — no exchange rate or conversion is applied.",

  // ── Rankings › Overrides & Bans (manual corrections) ────────────────────────
  "rankings.overrides._page":
    "Manually correct tier assignments and zero out cheating teams or players. Every action here is logged with a reason and sticks until you change it.",
  "rankings.overrides.override_tier":
    "Force a team onto a specific tier regardless of its computed score. The override sticks until you clear it — set it back to the computed tier to remove it.",
  "rankings.overrides.deduct_points":
    "Subtract a set number of points as a partial penalty while leaving the team ranked. Deductions accumulate and can be reset.",
  "rankings.overrides.clear_deduction":
    "Remove a team's partial point penalty and restore its full computed score.",
  "rankings.overrides.ban_zero_team":
    "Force a team's score to 0 and the bottom tier for the whole quarter. Use only for confirmed cheating — it isn't lifted by recalculation, only by an explicit restore.",
  "rankings.overrides.restore_team":
    "Lift a team's ban-zero so the next recalculation rebuilds its score and tier from scratch.",
  "rankings.overrides.ban_zero_player":
    "Zero a single player's contribution for the quarter (e.g. confirmed individual cheating) and recalculate their team. Players inherit their team's tier and can't be tier-overridden.",

  // ── Rankings › Audit Log ────────────────────────────────────────────────────
  "rankings.audit._page":
    "Every ranking edit, override and recalculation — who did it, what changed, when, and why. Visible to Head Admin and Metrics Admin only.",
  "rankings.audit.raw_viewer":
    "Look up the uncompressed, component-by-component breakdown behind any team or player's current-quarter score. Admins-only — these raw values are never shown publicly.",

  // ══════════════════════════════════════════════════════════════════════════
  // Organizations — third-party organizers who run events on AFC. The admin
  // surface manages the orgs themselves plus two review queues: design requests
  // and integrity reports. One sub-section per /a/organizations/* page.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Organizations › List ────────────────────────────────────────────────────
  "organizations._page":
    "Every organization that runs events on AFC. Search the list, drill into one to manage its profile, members and events, or create a new org and assign its owner.",
  "organizations.create":
    "Spin up a new organization and hand it to an existing user as owner. The owner starts with every organizer permission.",
  "organizations.owner_username":
    "The existing AFC user who will own this organization. They get all organizer permissions by default.",

  // ── Organizations › Detail (tabs) ───────────────────────────────────────────
  "organizations.detail._page":
    "Manage a single organization — edit its profile, control who can do what, review its events, and handle reports filed against it.",
  "organizations.profile._section":
    "The org's public-facing details — name, email, description and social links — plus its active/suspended status.",
  "organizations.members._section":
    "Everyone in this organization and what they can do. Add members, hand over ownership, or remove someone.",
  "organizations.events._section":
    "Every event this organization runs. Verify an event's rankings so its results count, or unverify to pull them.",
  "organizations.reports._section":
    "Integrity reports filed against this organization. Each is handled from the central Org Reports queue.",
  "organizations.suspend":
    "Temporarily block the organization's access without deleting it. Unsuspend to restore everything as it was.",
  "organizations.delete":
    "Soft-delete the organization. Its events re-home to AFC so their history is kept. This can't be undone.",
  "organizations.add_member":
    "Add an existing AFC user to this org and choose exactly which organizer actions they can take.",
  "organizations.member_permissions":
    "The granular actions this member can take — creating events, uploading results, managing registrations, and so on. Owners hold all of them automatically.",
  "organizations.set_owner":
    "Hand organization ownership to this member. They gain every permission; the previous owner becomes a regular member.",
  "organizations.verify_event":
    "Mark this event's rankings as verified so its results count toward the public ladder. Unverify to pull them back out.",

  // ── Organizations › Design Requests (review queue) ──────────────────────────
  "organizations.design._page":
    "The review queue for organizer leaderboard-design requests across every organization. Move each request through its lifecycle and leave notes the organizer then sees.",
  "organizations.design.resolve":
    "Move this request along (open → in progress → applied / rejected) and write resolution notes the organizer reads on their Design page.",
  "organizations.design.status":
    "Where the request sits in its lifecycle: Open (untouched), In progress (being worked), Applied (done), or Rejected.",

  // ── Organizations › Reports (integrity review queue) ────────────────────────
  "organizations.reports._page":
    "The review queue for reports filed against organizations — suspected rankings manipulation, fake results, unfair conduct. Resolve each one and, if needed, pull the reported event from rankings.",
  "organizations.reports.resolve":
    "Move this report along (open → reviewing → resolved / dismissed), record what you found, and optionally exclude the reported event from rankings.",
  "organizations.reports.status":
    "Where the report sits: Open (unhandled), Reviewing (being looked into), Resolved (action taken), or Dismissed (no action needed).",
  "organizations.reports.exclude_event":
    "Unverify the reported event so its results stop counting toward rankings — the integrity action for a substantiated report. Only available when the report is tied to an event.",

  // ══════════════════════════════════════════════════════════════════════════
  // Teams — admin team management. The list ranks every team into tiers and
  // bans/unbans; the detail screen manages a single team's roster, tier and
  // ownership. Ghost teams (provisional placeholders) live in Rankings, reused
  // here, so their copy stays under the rankings.ghost.* ids.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Teams › List ────────────────────────────────────────────────────────────
  "teams._page":
    "Every registered team on AFC. Search and filter by tier, open a team to manage its roster, or ban a team that breaks the rules.",
  "teams.rank_into_tiers":
    "Re-run the tier algorithm across every team, sorting them into Tier 1–3 from their current stats. Use after a batch of results lands.",
  "teams.list._section":
    "All teams with their tier, member count, wins and earnings. View opens the team's detail page; Ban/Unban toggles platform access.",
  "teams.ghost._section":
    "Provisional placeholder teams that hold tournament results before a real team claims them. Shared with Rankings & Tiering — claims and history transfers happen there.",

  // ── Teams › Detail ──────────────────────────────────────────────────────────
  "teams.detail._page":
    "Manage a single team — review its stats and history, edit its roster, override its tier, or hand ownership to another member.",
  "teams.detail.members._section":
    "Everyone on this team and their management role. Add an existing player, or remove anyone except the owner.",
  "teams.detail.add_member":
    "Search for an existing player and add them to this team. Moving a player off another team, or going past the 8-member cap, needs an extra confirmation.",
  "teams.detail.remove_member":
    "Take this player off the team. They're notified and can be re-added at any time. The owner can't be removed — transfer ownership first.",
  "teams.detail.actions._section":
    "Admin-only controls for this team: override its tier or transfer ownership. Both notify the team and are logged.",
  "teams.detail.change_tier":
    "Manually move the team to a chosen tier, overriding the ranking system's assignment. The owner is notified.",
  "teams.detail.transfer_ownership":
    "Hand ownership to another team member. The current owner becomes a regular member — undone only by transferring again.",

  // ══════════════════════════════════════════════════════════════════════════
  // Players — admin player management. The list shows stat leaders and bans;
  // the detail screen is a full profile with stats, history and login records.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Players › List ──────────────────────────────────────────────────────────
  "players._page":
    "Every registered player on AFC. Filter by team or status, scan the stat leaders, and ban or unban individual players.",
  "players.list._section":
    "All players with their team, kills, wins and MVPs. View opens the player's full profile; Ban/Unban toggles their platform access.",

  // ── Players › Detail ────────────────────────────────────────────────────────
  "players.detail._page":
    "A player's full admin profile — contact details, lifetime stats, match and event history, and login records. Ban or unban from here too.",
  "players.detail.statistics._section":
    "Career performance split across tournaments and scrims — KDR, win rate, kills, wins and booyahs.",
  "players.detail.login_history":
    "On demand, pull this player's recent sign-in records (IP, location, time) — useful for spotting account sharing or suspicious access.",

  // ══════════════════════════════════════════════════════════════════════════
  // Player Market — admin oversight of the recruitment marketplace: team and
  // player listings, the trials/applications pipeline, and integrity reports.
  // One sub-section per tab.
  // ══════════════════════════════════════════════════════════════════════════
  "player_market._page":
    "Oversight of the player market — recruitment listings, the trials and applications pipeline, and reports filed against either side. Read-only for most tabs; act on listings and reports.",
  "player_market.overview._section":
    "At-a-glance counts of active listings, ongoing trials and pending reports, plus the auto-enforcement health checks that keep banned entities hidden.",
  "player_market.team_listings._section":
    "Recruitment posts from teams looking for players — the roles, tier and commitment each is after. Expired posts drop off automatically.",
  "player_market.player_listings._section":
    "Availability posts from players looking for a team — their roles, country and availability. Expired posts drop off automatically.",
  "player_market.trials._section":
    "Every application and trial across the market, from first apply through invite, trial and final decision. Open one to see its full history.",
  "player_market.reports._section":
    "Reports and flagged content from across the market — harassment, fake listings, expired-but-visible posts. Review each and take action.",

  // ══════════════════════════════════════════════════════════════════════════
  // Shop — the diamond store admin. Dashboard, inventory (products + variants),
  // coupons, and orders. Each list has create/edit subpages. Prices are USD on
  // products but orders settle in Naira (₦) through Paystack.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Shop › Dashboard ────────────────────────────────────────────────────────
  "shop._page":
    "The store control room — revenue and order snapshots, live stock levels, and quick links into inventory and orders.",
  "shop.stock_status._section":
    "Current on-hand quantity for each product variant. Red means out or critically low, yellow is running low, green is healthy.",

  // ── Shop › Inventory ────────────────────────────────────────────────────────
  "shop.inventory._page":
    "Manage what the store sells — diamond products and their variants, stock levels, and the coupons buyers can apply at checkout.",
  "shop.add_product":
    "Create a new product and its variants in one go — each variant is a buyable SKU with its own price, diamond amount and stock.",
  "shop.products._section":
    "Every product and its variant count, combined stock and price range. Edit drills into the variants; Deactivate hides it from the store without deleting it.",
  "shop.delete_product":
    "Permanently remove this product and all its variants. This can't be undone — deactivate instead if you only want to hide it.",
  "shop.upload_codes._section":
    "Bulk-replenish a limited-stock product by uploading a CSV of diamond codes, one per line. Each code becomes a unit of sellable stock.",
  "shop.coupons._section":
    "Discount codes buyers apply at checkout. Create new ones, or deactivate/delete existing codes. Stats live on each coupon's page.",
  "shop.delete_coupon":
    "Permanently remove this coupon code. Past redemptions are kept for the records, but the code can no longer be used.",

  // ── Shop › Coupon create / edit fields ──────────────────────────────────────
  "shop.coupon_discount_type":
    "Percentage takes a share off the order total; Fixed Amount takes a flat dollar value off. This sets how Discount Value is read.",
  "shop.coupon_max_uses":
    "How many times this code can be redeemed across all buyers before it stops working.",
  "shop.coupon_min_order":
    "The smallest order total a buyer needs before this coupon applies. Leave at 0 for no minimum.",

  // ── Shop › Product variant fields ───────────────────────────────────────────
  "shop.variant._section":
    "Each variant is one buyable option of the product — its own SKU, price, diamond amount and stock. A product needs at least one.",
  "shop.variant_sku":
    "A unique code identifying this variant in orders and stock (e.g. DIA-100). Keep it stable — it's what fulfilment and reports key on.",
  "shop.variant_diamonds":
    "How many in-game diamonds this variant grants the buyer. Drives what's delivered on a paid order.",
  "shop.limited_stock":
    "On: the store tracks a finite stock count and stops selling at zero. Off: the variant is always purchasable (unlimited supply).",

  // ── Shop › Orders ───────────────────────────────────────────────────────────
  "shop.orders._page":
    "Every order across the store. Filter by status, search by ID or product, and open an order to see its items and take admin action.",
  "shop.orders.list._section":
    "All orders with their buyer, items, status and total (in ₦). Pending means awaiting payment; Paid has settled through Paystack.",
  "shop.order_detail._page":
    "Everything about one order — the buyer's details, the items and totals, and admin actions like marking it paid.",
  "shop.mark_as_paid":
    "Manually settle this order as paid — for payments confirmed outside Paystack (e.g. a bank transfer). Use only once you've verified the money landed.",

  // ══════════════════════════════════════════════════════════════════════════
  // News — admin news/article management. The list filters and manages every
  // article; create and edit share the same fields. Articles surface on the
  // public site once published.
  // ══════════════════════════════════════════════════════════════════════════
  "news._page":
    "Every news article on AFC. Search, filter by category, status or date, then create a new one or edit, view and delete existing articles.",
  "news.create":
    "Write and publish a new article. It goes live on the public News page as soon as you publish.",
  "news.delete":
    "Permanently remove this article from the site. This can't be undone.",
  "news.create._page":
    "Write a new article — give it a title, body, category and cover image, then publish it to the public News page.",
  "news.edit._page":
    "Update a published article. Changes go live on the public News page as soon as you save.",
  "news.category":
    "Where the article is filed on the public site — General, Tournament updates, or Ban announcements. Drives how readers filter the feed.",
  "news.related_event":
    "Optionally tie the article to a tournament so it shows alongside that event. Leave blank for general news.",
} as const;

export type HelpId = keyof typeof HELP;
