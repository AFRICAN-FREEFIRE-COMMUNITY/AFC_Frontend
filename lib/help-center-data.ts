// ─────────────────────────────────────────────────────────────────────────────
// help-center-data.ts  -  the STRUCTURE of the admin and organizer Help Center
// ----------------------------------------------------------------------------
// PURPOSE
//   Backlog item 5 ("find and document every control in the client and what each
//   one does") is not a note, it is the content source for a page. This file is
//   that source: an inventory of the controls an admin or an organizer operates,
//   grouped by area, plus the step by step walkthroughs for the processes those
//   controls add up to.
//
//   Structure lives here. COPY DOES NOT. Every label, description and step body is
//   in the "helpCenter" i18n namespace (messages/{en,fr,pt}/helpCenter.json), keyed
//   off the ids below. This is the same split lib/glossary-data.ts uses with
//   messages/*/glossary.json, for the same reason: the English is authored once and
//   the translate script regenerates fr and pt from it.
//
// HOW IT CONNECTS
//   - RENDERED BY: components/help-center/HelpCenter.tsx, mounted at
//     app/(a)/a/help/page.tsx (admin) and app/(organizer)/organizer/help/page.tsx
//     (organizer). The component resolves every id below through
//     useTranslations("helpCenter").
//   - REACHED FROM: the "Help Center" entry in the admin sidebar
//     (constants/nav-links.ts) and in the organizer portal sidebar
//     (app/(organizer)/organizer/layout.tsx NAV_ITEMS).
//   - SITS ALONGSIDE, NOT INSTEAD OF, the two help systems that already exist:
//       * the per-element ⓘ tooltips (components/ui/info-tip.tsx + lib/help-content.ts)
//       * the "Take a tour" spotlights (app/(a)/a/_components/admin-tour-steps.ts and
//         app/(organizer)/organizer/_components/organizer-tour-steps.ts)
//     A tour shows you where a control is on the real screen. This page tells you
//     what it does when you are not standing in front of it.
//
// ACCURACY RULE
//   Every entry was read out of the component that draws the control, its handler
//   and the endpoint that handler posts to. Nothing here is inferred from a button
//   name. If a control could not be confirmed it was left out, so this inventory is
//   incomplete in places but is not wrong.
//
// ADDING TO IT
//   1. Add the control (or walkthrough) below with a new stable id.
//   2. Add the matching English copy to messages/en/helpCenter.json under the same
//      id: controls.<id>.label + .does, or walkthroughs.<id>.steps.<stepId>.
//   3. Run `pnpm i18n:translate` so fr and pt catch up.
//   Ids are permanent: renaming one orphans its translations, and an id must never
//   contain a dot: next-intl reads "." as nesting and rejects the whole namespace
//   with INVALID_KEY. Use a hyphen (ev-create), which is what every id here does.
//
// COPY RULES: no em dashes or en dashes in any user-facing string (the box drawing
// dashes in these comments never render to a user).
// ─────────────────────────────────────────────────────────────────────────────

/** Which portal a thing shows up in. The same page component serves both. */
export type HelpPortal = "admin" | "organizer";

/** What kind of thing a control is, so the page can label it at a glance. */
export type HelpControlKind =
  | "action" // presses something and changes data
  | "navigation" // takes you to another screen
  | "filter" // narrows what the list below shows
  | "field" // something you fill in or choose
  | "toggle" // flips between two states
  | "view"; // read only

/** Area ids. These group the inventory the way an operator thinks, not the way
 *  the routes are laid out (Teams and Players is one page but two areas here). */
export type HelpAreaId =
  | "events"
  | "leaderboards"
  | "teams"
  | "players"
  | "rankings"
  | "broadcasts"
  | "overlays"
  | "shop"
  | "news"
  | "sponsors"
  | "organizations"
  | "market"
  | "settings"
  | "orgPortal";

export interface HelpArea {
  id: HelpAreaId;
  /** Tabler icon name, resolved to a component in the page's ICONS map. */
  icon: string;
  portals: HelpPortal[];
}

/** A screen a control lives on. Split out from the controls so the same screen
 *  name is written (and translated) once instead of on every row. */
export interface HelpScreen {
  id: string;
  /** A real href. Deep links use the ?tab= the page already supports. Where a
   *  screen needs a specific record (an event, a player), the route points at the
   *  list you pick that record from, because there is no id to link to here. */
  route: string;
  area: HelpAreaId;
  portals: HelpPortal[];
}

/** One control: a button, tab, filter, field or panel someone can look at and
 *  ask "what does this do". */
export interface HelpControl {
  id: string;
  screen: string;
  kind: HelpControlKind;
  /** Roles or organizer permissions that can use it. An empty array means "any
   *  admin who can open the screen at all". head_admin reaches everything, so it
   *  is not repeated on every row. */
  roles: string[];
  /** True when pressing it removes or overwrites something. The page marks these
   *  so a new admin can see the sharp edges before they touch one. */
  destructive?: boolean;
}

/** A process, written as steps a non-developer can follow. */
export interface HelpWalkthrough {
  id: string;
  area: HelpAreaId;
  portals: HelpPortal[];
  roles: string[];
  /** Where the process starts, per portal. The page renders this as a link so the
   *  reader can go and do it rather than only read about it. */
  routes: Partial<Record<HelpPortal, string>>;
  /** Ordered step ids. Copy at walkthroughs.<id>.steps.<stepId>.title / .body. */
  steps: string[];
  /** Video slot. Left undefined on purpose for every guide today: the page renders
   *  a quiet "not recorded yet" note rather than an empty player. Set it to an
   *  embeddable URL later and that guide grows a video without any other change. */
  videoUrl?: string;
}

// ── Areas, in the order the page renders them ────────────────────────────────
export const HELP_AREAS: HelpArea[] = [
  { id: "events", icon: "IconCalendar", portals: ["admin", "organizer"] },
  { id: "leaderboards", icon: "IconTrophy", portals: ["admin", "organizer"] },
  { id: "teams", icon: "IconUsersGroup", portals: ["admin"] },
  { id: "players", icon: "IconUser", portals: ["admin"] },
  { id: "rankings", icon: "IconChartBarPopular", portals: ["admin"] },
  { id: "broadcasts", icon: "IconMessage", portals: ["admin", "organizer"] },
  { id: "overlays", icon: "IconBroadcast", portals: ["admin", "organizer"] },
  { id: "shop", icon: "IconShoppingCart", portals: ["admin"] },
  { id: "news", icon: "IconNews", portals: ["admin"] },
  { id: "sponsors", icon: "IconStar", portals: ["admin", "organizer"] },
  { id: "organizations", icon: "IconBuilding", portals: ["admin"] },
  { id: "market", icon: "IconArrowsExchange", portals: ["admin"] },
  { id: "settings", icon: "IconSettings", portals: ["admin"] },
  { id: "orgPortal", icon: "IconLayoutDashboard", portals: ["organizer"] },
];

// ── Screens, so a screen name is written once and reused by its controls ─────
export const HELP_SCREENS: HelpScreen[] = [
  { id: "eventsList", route: "/a/events", area: "events", portals: ["admin"] },
  { id: "eventCreate", route: "/a/events/create", area: "events", portals: ["admin"] },
  { id: "eventDetail", route: "/a/events", area: "events", portals: ["admin"] },
  { id: "eventEdit", route: "/a/events", area: "events", portals: ["admin"] },
  { id: "eventActions", route: "/a/events", area: "events", portals: ["admin", "organizer"] },
  { id: "eventPayments", route: "/a/events/payments", area: "events", portals: ["admin"] },
  { id: "eventSponsorsPg", route: "/a/events", area: "sponsors", portals: ["admin", "organizer"] },
  { id: "drafts", route: "/a/drafts", area: "events", portals: ["admin"] },
  { id: "lbList", route: "/a/events?tab=leaderboards", area: "leaderboards", portals: ["admin"] },
  { id: "lbCreate", route: "/a/leaderboards/create", area: "leaderboards", portals: ["admin"] },
  { id: "lbView", route: "/a/events?tab=leaderboards", area: "leaderboards", portals: ["admin"] },
  { id: "lbEdit", route: "/a/events?tab=leaderboards", area: "leaderboards", portals: ["admin", "organizer"] },
  { id: "lbOcr", route: "/a/events", area: "leaderboards", portals: ["admin", "organizer"] },
  { id: "lbStandalone", route: "/a/leaderboards/standalone/create", area: "leaderboards", portals: ["admin"] },
  { id: "teamsTab", route: "/a/teams?tab=teams", area: "teams", portals: ["admin"] },
  { id: "playersTab", route: "/a/teams?tab=players", area: "players", portals: ["admin"] },
  { id: "blacklistsTab", route: "/a/teams?tab=blacklists", area: "teams", portals: ["admin"] },
  { id: "reportsTab", route: "/a/teams?tab=reports", area: "players", portals: ["admin"] },
  { id: "watchlistTab", route: "/a/teams?tab=watchlist", area: "players", portals: ["admin"] },
  { id: "playerDetail", route: "/a/teams?tab=players", area: "players", portals: ["admin"] },
  { id: "rkOverview", route: "/a/rankings", area: "rankings", portals: ["admin"] },
  { id: "rkScoring", route: "/a/rankings/scoring-config", area: "rankings", portals: ["admin"] },
  { id: "rkTiers", route: "/a/rankings/tournament-tiers", area: "rankings", portals: ["admin"] },
  { id: "rkResults", route: "/a/rankings/results", area: "rankings", portals: ["admin"] },
  { id: "rkSeasons", route: "/a/rankings/seasons", area: "rankings", portals: ["admin"] },
  { id: "rkGhosts", route: "/a/rankings/ghost-teams", area: "rankings", portals: ["admin"] },
  { id: "rkSocial", route: "/a/rankings/social", area: "rankings", portals: ["admin"] },
  { id: "rkPrize", route: "/a/rankings/prize", area: "rankings", portals: ["admin"] },
  { id: "rkOverrides", route: "/a/rankings/overrides", area: "rankings", portals: ["admin"] },
  { id: "rkAudit", route: "/a/rankings/audit", area: "rankings", portals: ["admin"] },
  { id: "bcAudit", route: "/a/broadcasts", area: "broadcasts", portals: ["admin"] },
  { id: "ovList", route: "/a/overlays", area: "overlays", portals: ["admin"] },
  { id: "ovStudio", route: "/a/overlays", area: "overlays", portals: ["admin", "organizer"] },
  { id: "orgCapture", route: "/organizer/capture", area: "overlays", portals: ["organizer"] },
  { id: "shopDash", route: "/a/shop", area: "shop", portals: ["admin"] },
  { id: "shopInventory", route: "/a/shop/inventory", area: "shop", portals: ["admin"] },
  { id: "shopOrders", route: "/a/shop/orders", area: "shop", portals: ["admin"] },
  { id: "shopOrderDetail", route: "/a/shop/orders", area: "shop", portals: ["admin"] },
  { id: "shopCoupons", route: "/a/shop/coupons", area: "shop", portals: ["admin"] },
  { id: "shopVendors", route: "/a/shop/vendors", area: "shop", portals: ["admin"] },
  { id: "shopApprovals", route: "/a/shop/approvals", area: "shop", portals: ["admin"] },
  { id: "shopPayouts", route: "/a/shop/payouts", area: "shop", portals: ["admin"] },
  { id: "shopCustomers", route: "/a/shop/customers", area: "shop", portals: ["admin"] },
  { id: "newsList", route: "/a/news", area: "news", portals: ["admin"] },
  { id: "newsCreate", route: "/a/news/create", area: "news", portals: ["admin"] },
  { id: "sponsorsList", route: "/a/sponsors", area: "sponsors", portals: ["admin"] },
  { id: "sponsorCreate", route: "/a/sponsors/create", area: "sponsors", portals: ["admin"] },
  { id: "orgsList", route: "/a/organizations", area: "organizations", portals: ["admin"] },
  { id: "orgDetail", route: "/a/organizations", area: "organizations", portals: ["admin"] },
  { id: "orgReports", route: "/a/organizations/reports", area: "organizations", portals: ["admin"] },
  { id: "orgPayoutsAdmin", route: "/a/organizations/payouts", area: "organizations", portals: ["admin"] },
  { id: "marketAdmin", route: "/a/player-markets", area: "market", portals: ["admin"] },
  { id: "settings", route: "/a/settings", area: "settings", portals: ["admin"] },
  { id: "votes", route: "/a/votes", area: "settings", portals: ["admin"] },
  { id: "ocrModel", route: "/a/ocr-model", area: "settings", portals: ["admin"] },
  { id: "apiKeys", route: "/a/partners", area: "settings", portals: ["admin"] },
  { id: "adminDash", route: "/a/dashboard", area: "settings", portals: ["admin"] },
  { id: "orgOverview", route: "/organizer/overview", area: "orgPortal", portals: ["organizer"] },
  { id: "orgEvents", route: "/organizer/events", area: "events", portals: ["organizer"] },
  { id: "orgEventCreate", route: "/organizer/events/create", area: "events", portals: ["organizer"] },
  { id: "orgDrafts", route: "/organizer/events/drafts", area: "events", portals: ["organizer"] },
  { id: "orgEventDetail", route: "/organizer/events", area: "events", portals: ["organizer"] },
  { id: "orgGroups", route: "/organizer/events", area: "events", portals: ["organizer"] },
  { id: "orgLbList", route: "/organizer/leaderboards", area: "leaderboards", portals: ["organizer"] },
  { id: "orgProfile", route: "/organizer/profile", area: "orgPortal", portals: ["organizer"] },
  { id: "orgMembers", route: "/organizer/members", area: "orgPortal", portals: ["organizer"] },
  { id: "orgMetrics", route: "/organizer/metrics", area: "orgPortal", portals: ["organizer"] },
  { id: "orgPayouts", route: "/organizer/payouts", area: "orgPortal", portals: ["organizer"] },
  { id: "orgReviews", route: "/organizer/reviews", area: "orgPortal", portals: ["organizer"] },
  { id: "orgDesign", route: "/organizer/design", area: "orgPortal", portals: ["organizer"] },
  { id: "orgBlacklists", route: "/organizer/blacklists", area: "orgPortal", portals: ["organizer"] },
  { id: "orgWatchlist", route: "/organizer/watchlist", area: "orgPortal", portals: ["organizer"] },
];

// ── The control inventory ────────────────────────────────────────────────────
// Grouped by area in source order, which is the order the page renders them in.
export const HELP_CONTROLS: HelpControl[] = [
  // Events and tournaments
  { id: "ev-create", screen: "eventsList", kind: "navigation", roles: ["event_admin"] },
  { id: "ev-payments", screen: "eventsList", kind: "navigation", roles: ["event_admin"] },
  { id: "ev-search", screen: "eventsList", kind: "filter", roles: [] },
  { id: "ev-stats", screen: "eventsList", kind: "view", roles: [] },
  { id: "ev-rowView", screen: "eventsList", kind: "navigation", roles: [] },
  { id: "ev-rowEdit", screen: "eventsList", kind: "navigation", roles: ["event_admin"] },
  { id: "ev-rowUnpublish", screen: "eventsList", kind: "action", roles: ["event_admin"] },
  { id: "ev-rowDuplicate", screen: "eventsList", kind: "action", roles: ["event_admin"] },
  { id: "ev-rowDelete", screen: "eventsList", kind: "action", roles: ["event_admin"], destructive: true },
  { id: "ev-rowLock", screen: "eventsList", kind: "view", roles: [] },
  { id: "ev-wizardNav", screen: "eventCreate", kind: "navigation", roles: ["event_admin", "can_create_events"] },
  { id: "ev-wizardResume", screen: "eventCreate", kind: "action", roles: ["event_admin", "can_create_events"] },
  { id: "ev-wizardCreate", screen: "eventCreate", kind: "action", roles: ["event_admin", "can_create_events"] },
  { id: "ev-detailTabs", screen: "eventDetail", kind: "navigation", roles: [] },
  { id: "ev-detailOverview", screen: "eventDetail", kind: "view", roles: [] },
  { id: "ev-detailRegistrations", screen: "eventDetail", kind: "view", roles: [] },
  { id: "ev-detailRosters", screen: "eventDetail", kind: "view", roles: [] },
  { id: "ev-detailEngagement", screen: "eventDetail", kind: "view", roles: [] },
  { id: "ev-inviteSingle", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-inviteBulk", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-inviteShared", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-sponsorRequirement", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-linkStage", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-chainMap", screen: "eventDetail", kind: "view", roles: ["event_admin"] },
  { id: "ev-importEvents", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-linkDecide", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-setTier", screen: "eventDetail", kind: "action", roles: ["metrics_admin"] },
  { id: "ev-stageIds", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-deleteNotifs", screen: "eventDetail", kind: "action", roles: ["event_admin"], destructive: true },
  { id: "ev-discordSync", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-discordRetry", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-discordReconcile", screen: "eventDetail", kind: "action", roles: ["event_admin"] },
  { id: "ev-removeNonNigeria", screen: "eventDetail", kind: "action", roles: ["event_admin"], destructive: true },
  { id: "ev-ocrLink", screen: "eventDetail", kind: "navigation", roles: ["event_admin", "can_upload_results"] },
  { id: "act-start", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-pause", screen: "eventActions", kind: "toggle", roles: ["event_admin", "can_edit_events"] },
  { id: "act-cancel", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"], destructive: true },
  { id: "act-complete", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-reopen", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-seed", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-advance", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-branching", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-undoSeed", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-reseed", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-deleteGroup", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"], destructive: true },
  { id: "act-deleteStage", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"], destructive: true },
  { id: "act-forceConfirm", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"], destructive: true },
  { id: "act-broadcast", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-history", screen: "eventActions", kind: "view", roles: ["event_admin", "can_edit_events"] },
  { id: "act-syncDiscord", screen: "eventActions", kind: "action", roles: ["event_admin"] },
  { id: "act-rosterWindow", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "act-visibility", screen: "eventActions", kind: "toggle", roles: ["event_admin", "can_edit_events"] },
  { id: "act-resultsVisibility", screen: "eventActions", kind: "toggle", roles: ["event_admin", "can_edit_events"] },
  { id: "act-export", screen: "eventActions", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "pay-filter", screen: "eventPayments", kind: "filter", roles: ["event_admin"] },
  { id: "pay-summary", screen: "eventPayments", kind: "view", roles: ["event_admin"] },
  { id: "pay-release", screen: "eventPayments", kind: "action", roles: ["event_admin"] },
  { id: "pay-refund", screen: "eventPayments", kind: "action", roles: ["event_admin"] },
  { id: "dr-tabs", screen: "drafts", kind: "filter", roles: [] },
  { id: "dr-search", screen: "drafts", kind: "filter", roles: [] },
  { id: "dr-continue", screen: "drafts", kind: "navigation", roles: [] },
  { id: "dr-publish", screen: "drafts", kind: "action", roles: ["event_admin"] },
  { id: "dr-delete", screen: "drafts", kind: "action", roles: ["event_admin"], destructive: true },
  // Leaderboards and results
  { id: "lb-search", screen: "lbList", kind: "filter", roles: [] },
  { id: "lb-stats", screen: "lbList", kind: "view", roles: [] },
  { id: "lb-rowView", screen: "lbList", kind: "navigation", roles: [] },
  { id: "lb-rowEdit", screen: "lbList", kind: "navigation", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-create", screen: "lbCreate", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-method", screen: "lbCreate", kind: "field", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-fileUpload", screen: "lbCreate", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-exclude", screen: "lbCreate", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-publish", screen: "lbCreate", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-editMatch", screen: "lbEdit", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-clearMap", screen: "lbEdit", kind: "action", roles: ["event_admin", "can_upload_results"], destructive: true },
  { id: "lb-addPlayer", screen: "lbEdit", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-scoring", screen: "lbEdit", kind: "field", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-tiebreak", screen: "lbEdit", kind: "field", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-mvp", screen: "lbEdit", kind: "field", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-flagging", screen: "lbEdit", kind: "view", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-download", screen: "lbView", kind: "action", roles: [] },
  { id: "lb-ocrUpload", screen: "lbOcr", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-ocrReview", screen: "lbOcr", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-ocrCommit", screen: "lbOcr", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "lb-standalone", screen: "lbStandalone", kind: "action", roles: ["event_admin"] },
  // Teams
  { id: "tm-rank", screen: "teamsTab", kind: "navigation", roles: ["teams_admin"] },
  { id: "tm-search", screen: "teamsTab", kind: "filter", roles: [] },
  { id: "tm-list", screen: "teamsTab", kind: "view", roles: [] },
  { id: "tm-view", screen: "teamsTab", kind: "navigation", roles: [] },
  { id: "tm-ban", screen: "teamsTab", kind: "action", roles: ["teams_admin"], destructive: true },
  { id: "tm-ghostCreate", screen: "teamsTab", kind: "action", roles: ["teams_admin"] },
  { id: "tm-ghostDelete", screen: "teamsTab", kind: "action", roles: ["teams_admin"], destructive: true },
  { id: "bl-create", screen: "blacklistsTab", kind: "action", roles: ["teams_admin", "organizer_admin"] },
  { id: "bl-requests", screen: "blacklistsTab", kind: "action", roles: ["teams_admin", "organizer_admin"] },
  // Players
  { id: "pl-stats", screen: "playersTab", kind: "view", roles: [] },
  { id: "pl-search", screen: "playersTab", kind: "filter", roles: [] },
  { id: "pl-view", screen: "playersTab", kind: "navigation", roles: [] },
  { id: "pl-ban", screen: "playersTab", kind: "action", roles: ["teams_admin"], destructive: true },
  { id: "pl-ghostCreate", screen: "playersTab", kind: "action", roles: ["teams_admin"] },
  { id: "pl-setEmail", screen: "playerDetail", kind: "action", roles: ["head_admin"], destructive: true },
  { id: "pl-loginHistory", screen: "playerDetail", kind: "view", roles: ["head_admin"] },
  { id: "rp-stats", screen: "reportsTab", kind: "view", roles: ["teams_admin"] },
  { id: "rp-filters", screen: "reportsTab", kind: "filter", roles: ["teams_admin"] },
  { id: "rp-answer", screen: "reportsTab", kind: "action", roles: ["teams_admin"] },
  { id: "wl-add", screen: "watchlistTab", kind: "action", roles: ["event_admin", "teams_admin", "organizer_admin"] },
  // Rankings and tiers
  { id: "rk-season", screen: "rkOverview", kind: "filter", roles: ["metrics_admin"] },
  { id: "rk-status", screen: "rkOverview", kind: "view", roles: ["metrics_admin"] },
  { id: "rk-evaluate", screen: "rkOverview", kind: "action", roles: ["metrics_admin"], destructive: true },
  { id: "rk-recalc", screen: "rkOverview", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-distribution", screen: "rkOverview", kind: "view", roles: ["metrics_admin"] },
  { id: "rk-publish", screen: "rkOverview", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-teams", screen: "rkOverview", kind: "view", roles: ["metrics_admin"] },
  { id: "rk-scoringScales", screen: "rkScoring", kind: "field", roles: ["metrics_admin"] },
  { id: "rk-scoringSave", screen: "rkScoring", kind: "action", roles: ["metrics_admin"], destructive: true },
  { id: "rk-scoringReset", screen: "rkScoring", kind: "action", roles: ["metrics_admin"] },
  // Listed FIRST for this screen because it decides what every other control on the page is
  // editing: tournaments and scrims keep separate tier rules (owner 2026-08-16).
  { id: "rk-tierCompetition", screen: "rkTiers", kind: "toggle", roles: ["metrics_admin"] },
  { id: "rk-tierRules", screen: "rkTiers", kind: "field", roles: ["metrics_admin"] },
  { id: "rk-tierTest", screen: "rkTiers", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-markerFlags", screen: "rkResults", kind: "toggle", roles: ["metrics_admin"] },
  { id: "rk-markerExclusions", screen: "rkResults", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-seasonCreate", screen: "rkSeasons", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-transferWindow", screen: "rkSeasons", kind: "toggle", roles: ["metrics_admin"] },
  { id: "rk-ghostClaims", screen: "rkGhosts", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-socialVerify", screen: "rkSocial", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-prizeAdd", screen: "rkPrize", kind: "action", roles: ["metrics_admin"] },
  { id: "rk-overrideTier", screen: "rkOverrides", kind: "action", roles: ["metrics_admin"], destructive: true },
  { id: "rk-deduct", screen: "rkOverrides", kind: "action", roles: ["metrics_admin"], destructive: true },
  { id: "rk-banZero", screen: "rkOverrides", kind: "action", roles: ["metrics_admin"], destructive: true },
  { id: "rk-audit", screen: "rkAudit", kind: "view", roles: ["metrics_admin"] },
  { id: "rk-rawData", screen: "rkAudit", kind: "view", roles: ["metrics_admin"] },
  // Broadcasts and messages
  { id: "bc-search", screen: "bcAudit", kind: "filter", roles: ["event_admin", "organizer_admin", "metrics_admin"] },
  { id: "bc-scope", screen: "bcAudit", kind: "filter", roles: ["event_admin", "organizer_admin", "metrics_admin"] },
  { id: "bc-sender", screen: "bcAudit", kind: "filter", roles: ["event_admin", "organizer_admin", "metrics_admin"] },
  { id: "bc-showMore", screen: "bcAudit", kind: "view", roles: ["event_admin", "organizer_admin", "metrics_admin"] },
  // Admins and platform settings
  { id: "bc-audience", screen: "settings", kind: "action", roles: ["head_admin"] },
  { id: "bc-sentHistory", screen: "settings", kind: "view", roles: ["head_admin"] },
  // Events and tournaments
  { id: "bc-rateLimit", screen: "eventActions", kind: "view", roles: ["can_edit_events"] },
  // Live overlays and capture
  { id: "ov-search", screen: "ovList", kind: "filter", roles: ["event_admin"] },
  { id: "ov-new", screen: "ovStudio", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-copyLink", screen: "ovStudio", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-stageGroup", screen: "ovStudio", kind: "field", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-follow", screen: "ovStudio", kind: "toggle", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-animation", screen: "ovStudio", kind: "field", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-timer", screen: "ovStudio", kind: "action", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-captureKey", screen: "ovStudio", kind: "view", roles: ["event_admin", "can_upload_results"] },
  { id: "ov-captureDownload", screen: "orgCapture", kind: "navigation", roles: [] },
  // Shop
  { id: "sh-ordersRange", screen: "shopDash", kind: "filter", roles: ["shop_admin"] },
  { id: "sh-stock", screen: "shopDash", kind: "view", roles: ["shop_admin"] },
  { id: "sh-addProduct", screen: "shopInventory", kind: "action", roles: ["shop_admin"] },
  { id: "sh-addVariant", screen: "shopInventory", kind: "action", roles: ["shop_admin"] },
  { id: "sh-categories", screen: "shopInventory", kind: "action", roles: ["shop_admin"] },
  { id: "sh-statusFilter", screen: "shopInventory", kind: "filter", roles: ["shop_admin"] },
  { id: "sh-toggleProduct", screen: "shopInventory", kind: "toggle", roles: ["shop_admin"] },
  { id: "sh-createCoupon", screen: "shopInventory", kind: "action", roles: ["shop_admin"] },
  { id: "sh-couponMetrics", screen: "shopCoupons", kind: "view", roles: ["shop_admin"] },
  { id: "sh-orderSearch", screen: "shopOrders", kind: "filter", roles: ["shop_admin"] },
  { id: "sh-orderTabs", screen: "shopOrders", kind: "filter", roles: ["shop_admin"] },
  { id: "sh-markPaid", screen: "shopOrderDetail", kind: "action", roles: ["shop_admin"], destructive: true },
  { id: "sh-delivery", screen: "shopCustomers", kind: "action", roles: ["shop_admin"] },
  { id: "sh-addVendor", screen: "shopVendors", kind: "action", roles: ["shop_admin"] },
  { id: "sh-assignProduct", screen: "shopVendors", kind: "action", roles: ["shop_admin"] },
  { id: "sh-vendorStatus", screen: "shopVendors", kind: "toggle", roles: ["shop_admin"] },
  { id: "sh-approve", screen: "shopApprovals", kind: "action", roles: ["shop_admin"] },
  { id: "sh-reject", screen: "shopApprovals", kind: "action", roles: ["shop_admin"] },
  { id: "sh-payouts", screen: "shopPayouts", kind: "action", roles: ["shop_admin"] },
  // News
  { id: "nw-create", screen: "newsList", kind: "navigation", roles: ["news_admin"] },
  { id: "nw-filters", screen: "newsList", kind: "filter", roles: ["news_admin"] },
  { id: "nw-copyLink", screen: "newsList", kind: "action", roles: ["news_admin"] },
  { id: "nw-edit", screen: "newsList", kind: "navigation", roles: ["news_admin"] },
  { id: "nw-delete", screen: "newsList", kind: "action", roles: ["news_admin"], destructive: true },
  // Sponsors
  { id: "sp-create", screen: "sponsorCreate", kind: "action", roles: ["event_admin"] },
  { id: "sp-attachEvent", screen: "sponsorsList", kind: "action", roles: ["event_admin"] },
  { id: "sp-addMember", screen: "sponsorsList", kind: "action", roles: ["event_admin"] },
  { id: "sp-edit", screen: "sponsorsList", kind: "navigation", roles: ["event_admin"] },
  { id: "sp-confirm", screen: "eventSponsorsPg", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "sp-reject", screen: "eventSponsorsPg", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "sp-filterStatus", screen: "eventSponsorsPg", kind: "filter", roles: ["event_admin", "can_manage_registrations"] },
  // Organizations
  { id: "og-create", screen: "orgsList", kind: "action", roles: ["organizer_admin"] },
  { id: "og-search", screen: "orgsList", kind: "filter", roles: ["organizer_admin"] },
  { id: "og-tabs", screen: "orgDetail", kind: "navigation", roles: ["organizer_admin"] },
  { id: "og-addMember", screen: "orgDetail", kind: "action", roles: ["organizer_admin"] },
  { id: "og-transferOwner", screen: "orgDetail", kind: "action", roles: ["organizer_admin"], destructive: true },
  { id: "og-suspend", screen: "orgDetail", kind: "action", roles: ["organizer_admin"], destructive: true },
  { id: "og-verifyEvent", screen: "orgDetail", kind: "action", roles: ["organizer_admin"] },
  { id: "og-resolveReport", screen: "orgReports", kind: "action", roles: ["organizer_admin"] },
  { id: "og-markPaid", screen: "orgPayoutsAdmin", kind: "action", roles: ["organizer_admin"] },
  // Player market
  { id: "pm-tabs", screen: "marketAdmin", kind: "navigation", roles: ["head_admin"] },
  { id: "pm-overview", screen: "marketAdmin", kind: "view", roles: ["head_admin"] },
  { id: "pm-ban", screen: "marketAdmin", kind: "action", roles: ["head_admin"], destructive: true },
  { id: "pm-trialChat", screen: "marketAdmin", kind: "view", roles: ["head_admin"] },
  // Admins and platform settings
  { id: "st-tabs", screen: "settings", kind: "navigation", roles: ["head_admin"] },
  { id: "st-createAdmin", screen: "settings", kind: "action", roles: ["head_admin"] },
  { id: "st-editRoles", screen: "settings", kind: "action", roles: ["head_admin"], destructive: true },
  { id: "st-createRole", screen: "settings", kind: "action", roles: ["head_admin"] },
  { id: "st-deleteRole", screen: "settings", kind: "action", roles: ["head_admin"], destructive: true },
  { id: "st-suspendUser", screen: "settings", kind: "action", roles: ["head_admin"], destructive: true },
  { id: "st-overlap", screen: "settings", kind: "view", roles: ["head_admin"] },
  { id: "st-loginHistory", screen: "settings", kind: "view", roles: ["head_admin"] },
  { id: "st-activities", screen: "settings", kind: "view", roles: ["head_admin"] },
  { id: "vt-sections", screen: "votes", kind: "action", roles: ["head_admin"] },
  { id: "vt-results", screen: "votes", kind: "view", roles: ["head_admin"] },
  { id: "oc-dataset", screen: "ocrModel", kind: "action", roles: ["head_admin"] },
  { id: "oc-promote", screen: "ocrModel", kind: "action", roles: ["head_admin"], destructive: true },
  { id: "oc-rollback", screen: "ocrModel", kind: "action", roles: ["head_admin"] },
  { id: "ak-tabs", screen: "apiKeys", kind: "navigation", roles: ["partner_admin", "support"] },
  { id: "ak-createPartner", screen: "apiKeys", kind: "action", roles: ["partner_admin"] },
  { id: "ak-issueKey", screen: "apiKeys", kind: "action", roles: ["partner_admin"], destructive: true },
  { id: "ak-scope", screen: "apiKeys", kind: "field", roles: ["partner_admin"] },
  { id: "ak-feedback", screen: "apiKeys", kind: "action", roles: ["support"] },
  { id: "ad-metrics", screen: "adminDash", kind: "view", roles: ["head_admin"] },
  { id: "ad-activity", screen: "adminDash", kind: "view", roles: ["head_admin"] },
  // Organizer portal
  { id: "op-switcher", screen: "orgOverview", kind: "field", roles: [] },
  // Events and tournaments
  { id: "op-events", screen: "orgEvents", kind: "view", roles: ["can_create_events", "can_edit_events"] },
  { id: "op-createEvent", screen: "orgEventCreate", kind: "action", roles: ["can_create_events"] },
  { id: "op-groups", screen: "orgGroups", kind: "action", roles: ["can_manage_registrations"] },
  // Leaderboards and results
  { id: "op-leaderboards", screen: "orgLbList", kind: "navigation", roles: ["can_upload_results"] },
  // Organizer portal
  { id: "op-profile", screen: "orgProfile", kind: "field", roles: ["owner"] },
  { id: "op-addMember", screen: "orgMembers", kind: "action", roles: ["can_manage_members", "owner"] },
  { id: "op-removeMember", screen: "orgMembers", kind: "action", roles: ["can_manage_members", "owner"], destructive: true },
  { id: "op-bank", screen: "orgPayouts", kind: "field", roles: ["owner"] },
  { id: "op-earnings", screen: "orgPayouts", kind: "view", roles: ["owner"] },
  { id: "op-metrics", screen: "orgMetrics", kind: "view", roles: ["can_view_metrics"] },
  { id: "op-reviews", screen: "orgReviews", kind: "view", roles: ["can_view_reviews"] },
  { id: "op-design", screen: "orgDesign", kind: "action", roles: ["can_submit_designs"] },
  { id: "op-blacklist", screen: "orgBlacklists", kind: "action", roles: ["can_manage_registrations"] },
  { id: "op-watchlist", screen: "orgWatchlist", kind: "view", roles: [] },
  // Events and tournaments
  { id: "op-mediaAudit", screen: "orgEventDetail", kind: "action", roles: ["can_edit_events"] },
  { id: "ee-tabs", screen: "eventEdit", kind: "navigation", roles: ["event_admin", "can_edit_events"] },
  { id: "ee-save", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-dragStage", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-configureStage", screen: "eventEdit", kind: "field", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-scoringMode", screen: "eventEdit", kind: "field", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-routing", screen: "eventEdit", kind: "field", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-roomDetails", screen: "eventEdit", kind: "field", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-seedToGroup", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-advanceStage", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-removeStage", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_edit_events"], destructive: true },
  { id: "sg-editMatch", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_edit_events"] },
  { id: "sg-releaseWaitlist", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "sg-waDelivery", screen: "eventEdit", kind: "view", roles: ["event_admin", "can_edit_events"] },
  { id: "rt-list", screen: "eventEdit", kind: "view", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-letters", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-checkNoShows", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-noShow", screen: "eventEdit", kind: "toggle", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-allowRosterEdit", screen: "eventEdit", kind: "toggle", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-editRoster", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-disqualify", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"], destructive: true },
  { id: "rt-reactivate", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "rt-removeTeam", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"], destructive: true },
  { id: "rt-addTeams", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
  { id: "wt-promote", screen: "eventEdit", kind: "action", roles: ["event_admin", "can_manage_registrations"] },
];

// ── Walkthroughs: the processes the controls above add up to ─────────────────
export const HELP_WALKTHROUGHS: HelpWalkthrough[] = [
  {
    id: "createEvent",
    area: "events",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_create_events"],
    routes: { admin: "/a/events/create", organizer: "/organizer/events/create" },
    steps: ["open", "details", "requirements", "mode", "stages", "prizes", "rules", "sponsor", "publish"],
  },
  {
    id: "runStage",
    area: "events",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_edit_events"],
    routes: { admin: "/a/events", organizer: "/organizer/events" },
    steps: ["check", "start", "seed", "rooms", "noshows", "results", "advance", "complete"],
  },
  {
    id: "uploadResults",
    area: "leaderboards",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_upload_results"],
    routes: { admin: "/a/events?tab=leaderboards", organizer: "/organizer/leaderboards" },
    steps: ["find", "pick", "method", "log", "ocr", "scoring", "flags", "publish"],
  },
  {
    id: "fixResult",
    area: "leaderboards",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_upload_results"],
    routes: { admin: "/a/events?tab=leaderboards", organizer: "/organizer/leaderboards" },
    steps: ["open", "locate", "small", "big", "missing", "rescore", "verify"],
  },
  {
    id: "publishLeaderboard",
    area: "leaderboards",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_upload_results"],
    routes: { admin: "/a/events?tab=leaderboards", organizer: "/organizer/leaderboards" },
    steps: ["complete", "tiebreak", "mvp", "publish", "timing", "graphic"],
  },
  {
    id: "manageTeams",
    area: "teams",
    portals: ["admin"],
    roles: ["teams_admin", "event_admin"],
    routes: { admin: "/a/teams?tab=teams" },
    steps: ["find", "inspect", "invite", "addLate", "roster", "ban"],
  },
  {
    id: "disputes",
    area: "events",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "teams_admin", "can_manage_registrations"],
    routes: { admin: "/a/teams?tab=reports", organizer: "/organizer/events" },
    steps: ["report", "evidence", "decide", "dq", "remove", "undo", "watch", "rankings"],
  },
  {
    id: "broadcast",
    area: "broadcasts",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_edit_events"],
    routes: { admin: "/a/events", organizer: "/organizer/events" },
    steps: ["open", "scope", "write", "channel", "link", "send", "check"],
  },
  {
    id: "manageShop",
    area: "shop",
    portals: ["admin"],
    roles: ["shop_admin"],
    routes: { admin: "/a/shop" },
    steps: ["product", "variant", "category", "coupon", "orders", "fulfil", "vendors"],
  },
  {
    id: "rankings",
    area: "rankings",
    portals: ["admin"],
    roles: ["metrics_admin"],
    routes: { admin: "/a/rankings" },
    steps: ["season", "config", "tiers", "data", "check", "fix", "evaluate", "publish"],
  },
  {
    id: "setupOrganizer",
    area: "organizations",
    portals: ["admin"],
    roles: ["organizer_admin"],
    routes: { admin: "/a/organizations" },
    steps: ["create", "owner", "members", "bank", "verify", "watch"],
  },
  {
    id: "goLive",
    area: "overlays",
    portals: ["admin", "organizer"],
    roles: ["event_admin", "can_upload_results"],
    routes: { admin: "/a/overlays", organizer: "/organizer/overlays" },
    steps: ["design", "create", "obs", "scope", "timer", "capture", "media"],
  },
];

// ── Lookups the page uses ────────────────────────────────────────────────────
/** Screen by id, so a control row can render its screen name and route. */
export const HELP_SCREEN_BY_ID: Record<string, HelpScreen> = Object.fromEntries(
  HELP_SCREENS.map((s) => [s.id, s]),
);

/** Every control on a given screen, in source order. */
export function controlsForArea(area: HelpAreaId, portal: HelpPortal): HelpControl[] {
  return HELP_CONTROLS.filter((c) => {
    const screen = HELP_SCREEN_BY_ID[c.screen];
    return screen?.area === area && screen.portals.includes(portal);
  });
}

/** Walkthroughs shown in a portal, in source order. */
export function walkthroughsForPortal(portal: HelpPortal): HelpWalkthrough[] {
  return HELP_WALKTHROUGHS.filter((wt) => wt.portals.includes(portal));
}

/** Areas that actually have something to show in this portal, so the filter pills
 *  never offer an area that renders empty. */
export function areasForPortal(portal: HelpPortal): HelpArea[] {
  return HELP_AREAS.filter(
    (a) =>
      a.portals.includes(portal) &&
      (controlsForArea(a.id, portal).length > 0 ||
        walkthroughsForPortal(portal).some((wt) => wt.area === a.id)),
  );
}
