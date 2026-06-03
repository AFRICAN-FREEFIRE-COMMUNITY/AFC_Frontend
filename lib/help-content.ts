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
} as const;

export type HelpId = keyof typeof HELP;
