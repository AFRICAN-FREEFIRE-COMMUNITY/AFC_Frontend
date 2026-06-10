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
  title: string;
  body: string;
  // ── Stop kind ──
  // "intro" / "outro" are modal-only (no route, no steps). "guide" stops have a
  // route + a "Show me" launcher + driver steps.
  kind: "intro" | "guide" | "outro";
  // The page the "Show me" launcher navigates to (guide stops only).
  route?: string;
  // The launcher button label (guide stops only). Outro carries its own CTA below.
  launchLabel?: string;
  // The on-page driver.js steps for this stop (guide stops only).
  steps?: GuidedTourStep[];
  // Outro CTA: navigates to the glossary (handled by the hub, not driver.js).
  outroCta?: { label: string; href: string };
}

export const GUIDED_STOPS: GuidedStop[] = [
  // ── 0. Intro (modal only) ──
  {
    id: "welcome",
    icon: IconConfetti,
    idle: "party",
    accent: "primary",
    title: "Welcome to AFC!",
    body: "Esports just means organized competitive gaming, players and teams competing for real. AFC is the home of Free Fire competition in Africa. We will walk you through the site one stop at a time. Just click through, you do not have to do anything on each page. We will carry you all the way to the end.",
    kind: "intro",
  },

  // ── 1. Profile (route /profile/edit) ──
  {
    id: "profile",
    icon: IconUserCircle,
    idle: "bounce",
    accent: "gold",
    title: "Set up your profile",
    body: "Add your Free Fire UID and in-game name so teams and tournaments can find you. A complete profile is your ticket into the action.",
    kind: "guide",
    route: "/profile/edit",
    launchLabel: "Show me on my profile",
    steps: [
      {
        element: '[data-tour="profile-uid"]',
        title: "Add your Free Fire UID",
        description:
          "Enter your in-game UID here so teams and tournaments can find and verify you.",
        side: "bottom",
        align: "start",
      },
      {
        element: '[data-tour="profile-ign"]',
        title: "Set your in-game name",
        description:
          "This is the name people will see across AFC. Make it match your Free Fire account.",
        side: "bottom",
        align: "start",
      },
      {
        element: '[data-tour="profile-save"]',
        title: "Save your profile",
        description:
          "Save changes lives here when you are ready. No need to fill anything in right now, just click Next to keep the tour going.",
        side: "top",
        align: "start",
      },
    ],
  },

  // ── 2. Teams (route /teams) ──
  {
    id: "teams",
    icon: IconUsersGroup,
    idle: "pop",
    accent: "primary",
    title: "Find your squad",
    body: "Create your own team or join one. Squads compete together, climb the rankings together, and win together. Going solo? You can do that too.",
    kind: "guide",
    route: "/teams",
    launchLabel: "Show me on teams",
    steps: [
      {
        element: '[data-tour="teams-create"]',
        title: "Create your own team",
        description:
          "Start a squad here, name it, set it up, and invite your players.",
        side: "bottom",
        align: "end",
      },
      {
        element: '[data-tour="teams-list"]',
        title: "Or browse and join a team",
        description:
          "Scroll the teams here and tap Apply to Join to ask an existing squad to take you on. You can do this later, just click Next for now.",
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
    title: "Player Market",
    body: "Recruit players for your team, or post yourself so teams can recruit you. Think of it as the transfer window, open all year.",
    kind: "guide",
    route: "/player-markets",
    launchLabel: "Show me the market",
    steps: [
      {
        element: '[data-tour="market-create"]',
        title: "Create a post",
        description:
          "Post here to recruit players for your team, or to put yourself up so teams can recruit you.",
        side: "bottom",
        align: "end",
      },
      {
        element: '[data-tour="market-tabs"]',
        title: "Switch between sides",
        description:
          "Flip these tabs to see teams that are recruiting, or players who are open to join. Have a look any time, nothing to do here now, just click Next.",
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
    title: "Tournaments and Scrims",
    body: "Tournaments are official competitions with prizes and ranking points. Scrims are practice matches to train your team. Jump into either when you are ready.",
    kind: "guide",
    route: "/tournaments",
    launchLabel: "Show me the events",
    steps: [
      {
        element: '[data-tour="tournaments-filter"]',
        title: "Tournaments versus scrims",
        description:
          "Tournaments are official competitions with prizes. Scrims are practice matches to train. Switch these tabs to see each.",
        side: "bottom",
        align: "start",
      },
      {
        element: '[data-tour="tournaments-list"]',
        title: "Browse and open an event",
        description:
          "Every event lives here. Open one to read the details and register your team whenever you like. For now, just click Done to wrap up the tour.",
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
    title: "You are all set!",
    body: "New to the lingo? The Glossary explains every esports term in plain words, anytime you need it. Now go have fun and good luck out there.",
    kind: "outro",
    outroCta: { label: "Open glossary", href: "/glossary" },
  },
];
