// ─────────────────────────────────────────────────────────────────────────────
// guided-tour-stops.ts  —  the ordered stop list for the interactive welcome tour
// ----------------------------------------------------------------------------
// PURPOSE
//   One central, ordered catalogue describing every STOP in the guided welcome
//   tour. Each stop carries BOTH:
//     a) the HUB-MODAL content (the animated card: icon, headline, body, the
//        "Show me on the <page>" launcher + its target route), consumed by
//        WelcomeTour.tsx; and
//     b) the ON-PAGE driver.js STEPS (the spotlight popovers over the real
//        [data-tour] controls on that route), consumed by PageGuide.tsx.
//   Keeping both in one file means a stop is defined in exactly one place.
//
// HOW IT CONNECTS
//   - CONSUMED BY contexts/GuidedTourContext.tsx (GUIDED_STOPS drives index/length),
//     app/(user)/_components/WelcomeTour.tsx (renders each stop's hub card), and
//     app/(user)/_components/PageGuide.tsx (runs each stop's driver steps).
//   - Each step targets a real control via a `[data-tour="..."]` selector. Those
//     attributes are added (surgically, attribute-only) on the four target pages:
//       profile/edit/page.tsx, teams/page.tsx, player-markets/page.tsx,
//       tournaments/page.tsx.
//   - PageGuide reuses AdminTour's missing-selector guard, so a step whose target is
//     absent is DROPPED (never throws); a stop that resolves to zero steps simply
//     returns to the hub with no empty overlay.
//
// STOP ORDER
//   intro (modal only) -> profile -> teams -> market -> tournaments -> outro
//   (modal only). The first and last stops have no `route`/`steps` (they are pure
//   hub-modal moments: the esports+AFC intro and the glossary+celebration finish).
//
// OPTIONAL-BY-DESIGN (idle auto-lead, refinement 1a)
//   Every on-page step is a POINTER, never a task the user must complete. The copy
//   makes that explicit ("you can do this later", "no need to fill this in now") so a
//   passive user just clicks Next through the spotlight and is then carried to the
//   next page automatically. The user NEVER has to add a UID, create a team, etc. to
//   proceed. The hub's auto-advance + PageGuide's idle fallback (see those files) do
//   the carrying; the copy here just sets the expectation that nothing is required.
//
// ROUTE NOTE (profile)
//   The read-only /profile page has no editable UID / in-game-name / save controls;
//   those live on /profile/edit (the "Edit Profile" form). So the profile stop's
//   route is "/profile/edit", where the real fields exist, and the anchors sit on
//   that form. This is the "nearest sensible element" choice the design doc allows.
//
// COPY RULES (AFC hard rule)
//   NO em dashes or en dashes in any user-facing string below (titles, bodies,
//   button labels, step copy). Use commas, periods, parentheses or a spaced hyphen.
//   Box-drawing dashes in these comments never render to the user.
//
// i18n NOTE
//   This is a plain .ts module, so it cannot call next-intl hooks. Every user-facing
//   string field below therefore holds a TRANSLATION KEY (relative to the "home"
//   namespace), not English text. The consumers resolve them: WelcomeTour.tsx runs
//   t(stop.title) / t(stop.body) / t(stop.launchLabel) / t(stop.outroCta.label) and
//   PageGuide.tsx runs t(step.title) / t(step.description). The English values for
//   these keys live in messages/en/home.json under tour.stops.*. Keys, not strings,
//   keep the catalogue declarative while staying fully translatable.
// ─────────────────────────────────────────────────────────────────────────────

import {
  IconConfetti,
  IconUserCircle,
  IconUsersGroup,
  IconUserSearch,
  IconTrophy,
  IconBook2,
} from "@tabler/icons-react";

// The tabler package does not export its IconProps type, so derive the component
// type from a real imported icon (they all share one signature).
type TablerIconComponent = typeof IconConfetti;

// The looping "idle" animation key for a stop's big hub icon (matches the variants
// defined in WelcomeTour.tsx -> iconIdle()).
export type StopIdle = "wave" | "bounce" | "pulse" | "spin" | "pop" | "party";

// Brand accent that tints a stop's icon halo + headline (green primary or gold).
export type StopAccent = "primary" | "gold";

// One driver.js step on a stop's real page. `element` is a CSS selector resolved at
// runtime; if it matches nothing PageGuide drops it (guarded, never throws). side /
// align position the popover around the target (driver.js terms).
export interface GuidedTourStep {
  element: string;
  // i18n keys (home namespace), resolved by PageGuide.tsx via t(...).
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
}

// One stop in the tour.
export interface GuidedStop {
  id: string;
  // ── Hub-modal card content ──
  icon: TablerIconComponent;
  idle: StopIdle;
  accent: StopAccent;
  // i18n keys (home namespace), resolved by WelcomeTour.tsx via t(...).
  title: string;
  body: string;
  // ── Stop kind ──
  // "intro" / "outro" are modal-only (no route, no steps). "guide" stops have a
  // route + a "Show me" launcher + driver steps.
  kind: "intro" | "guide" | "outro";
  // The page the "Show me" launcher navigates to (guide stops only).
  route?: string;
  // The launcher button label (guide stops only) - i18n key, resolved in WelcomeTour.
  // Outro carries its own CTA below.
  launchLabel?: string;
  // The on-page driver.js steps for this stop (guide stops only).
  steps?: GuidedTourStep[];
  // Outro CTA: navigates to the glossary (handled by the hub, not driver.js).
  // `label` is an i18n key, resolved in WelcomeTour; `href` is a real route.
  outroCta?: { label: string; href: string };
}

// NOTE: every title/body/launchLabel/step.title/step.description/outroCta.label below
// is an i18n KEY under the "home" namespace (resolved by the consumers via t(...)).
// The English copy for each key lives in messages/en/home.json -> tour.stops.*.
export const GUIDED_STOPS: GuidedStop[] = [
  // ── 0. Intro (modal only) ──
  {
    id: "welcome",
    icon: IconConfetti,
    idle: "party",
    accent: "primary",
    title: "tour.stops.welcome.title",
    body: "tour.stops.welcome.body",
    kind: "intro",
  },

  // ── 1. Profile (route /profile/edit) ──
  {
    id: "profile",
    icon: IconUserCircle,
    idle: "bounce",
    accent: "gold",
    title: "tour.stops.profile.title",
    body: "tour.stops.profile.body",
    kind: "guide",
    route: "/profile/edit",
    launchLabel: "tour.stops.profile.launchLabel",
    steps: [
      {
        element: '[data-tour="profile-uid"]',
        title: "tour.stops.profile.steps.uid.title",
        description: "tour.stops.profile.steps.uid.description",
        side: "bottom",
        align: "start",
      },
      {
        element: '[data-tour="profile-ign"]',
        title: "tour.stops.profile.steps.ign.title",
        description: "tour.stops.profile.steps.ign.description",
        side: "bottom",
        align: "start",
      },
      {
        element: '[data-tour="profile-save"]',
        title: "tour.stops.profile.steps.save.title",
        description: "tour.stops.profile.steps.save.description",
        side: "top",
        align: "start",
      },
      {
        // Esport image stop (owner 2026-06-14): the photo organizers use as your
        // player picture in event graphics, and the image that powers your
        // shareable profile card. Anchored on the esport-image Card in
        // profile/edit/page.tsx ([data-tour="profile-esports"]).
        element: '[data-tour="profile-esports"]',
        title: "tour.stops.profile.steps.esports.title",
        description: "tour.stops.profile.steps.esports.description",
        side: "top",
        align: "center",
      },
    ],
  },

  // ── 2. Teams (route /teams) ──
  {
    id: "teams",
    icon: IconUsersGroup,
    idle: "pop",
    accent: "primary",
    title: "tour.stops.teams.title",
    body: "tour.stops.teams.body",
    kind: "guide",
    route: "/teams",
    launchLabel: "tour.stops.teams.launchLabel",
    steps: [
      {
        element: '[data-tour="teams-create"]',
        title: "tour.stops.teams.steps.create.title",
        description: "tour.stops.teams.steps.create.description",
        side: "bottom",
        align: "end",
      },
      {
        element: '[data-tour="teams-list"]',
        title: "tour.stops.teams.steps.browse.title",
        description: "tour.stops.teams.steps.browse.description",
        side: "top",
        align: "center",
      },
    ],
  },

  // ── 3. Player Market (route /player-markets) ──
  {
    id: "market",
    icon: IconUserSearch,
    idle: "pulse",
    accent: "gold",
    title: "tour.stops.market.title",
    body: "tour.stops.market.body",
    kind: "guide",
    route: "/player-markets",
    launchLabel: "tour.stops.market.launchLabel",
    steps: [
      {
        element: '[data-tour="market-create"]',
        title: "tour.stops.market.steps.create.title",
        description: "tour.stops.market.steps.create.description",
        side: "bottom",
        align: "end",
      },
      {
        element: '[data-tour="market-tabs"]',
        title: "tour.stops.market.steps.tabs.title",
        description: "tour.stops.market.steps.tabs.description",
        side: "bottom",
        align: "start",
      },
    ],
  },

  // ── 4. Tournaments and Scrims (route /tournaments) ──
  {
    id: "tournaments",
    icon: IconTrophy,
    idle: "bounce",
    accent: "primary",
    title: "tour.stops.tournaments.title",
    body: "tour.stops.tournaments.body",
    kind: "guide",
    route: "/tournaments",
    launchLabel: "tour.stops.tournaments.launchLabel",
    steps: [
      {
        element: '[data-tour="tournaments-filter"]',
        title: "tour.stops.tournaments.steps.filter.title",
        description: "tour.stops.tournaments.steps.filter.description",
        side: "bottom",
        align: "start",
      },
      {
        element: '[data-tour="tournaments-list"]',
        title: "tour.stops.tournaments.steps.list.title",
        description: "tour.stops.tournaments.steps.list.description",
        side: "top",
        align: "center",
      },
    ],
  },

  // ── 5. Outro (modal only) ──
  {
    id: "done",
    icon: IconBook2,
    idle: "spin",
    accent: "gold",
    title: "tour.stops.done.title",
    body: "tour.stops.done.body",
    kind: "outro",
    outroCta: { label: "tour.stops.done.ctaLabel", href: "/glossary" },
  },
];
