// constants/rules.ts
//
// Structural skeleton for the public AFC Handbook / Rules page
// (app/(root)/rules/page.tsx). This file intentionally holds NO user-facing
// copy: every human-readable string (category name, category description, and
// each rule's title + content) now lives in the "rules" i18n namespace at
// messages/{en,fr,pt}/rules.json and is rendered via next-intl on the page.
//
// What stays here is pure structure so the page can iterate in a stable order:
//   - `id`        : anchor / accordion key AND the i18n lookup key
//                   (messages -> categories.<id>.name / .description /
//                    .rules.<index>.title / .rules.<index>.content).
//   - `icon`      : the @tabler icon component shown next to the category.
//   - `rules`     : one entry per rule, in order. Only `citations` (source
//                   section references such as "[General Rules 2.1]") remains,
//                   because those are section-number / doc-name references that
//                   must NOT be translated and are not rendered on the page.
//
// Ordering, ids and rule counts here MUST stay in lockstep with the key set in
// messages/en/rules.json (and its fr/pt mirrors) - the page derives every
// translation key from `id` + the rule's array index.
//
// Consumed by: app/(root)/rules/page.tsx (RulesPage), which pairs each entry
// with useTranslations("rules").

import {
  IconAlertCircle,
  IconChartBar,
  IconCircleCheck,
  IconDeviceMobile,
  IconFileCheck,
  IconGavel,
  IconMessageExclamation,
  IconScale,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";

export const AFC_RULES_DATA = [
  {
    id: "player-eligibility",
    icon: IconUsers,
    rules: [
      { citations: "[General Rules 2.1, Player Rules 3.1]" },
      { citations: "[General Rules 2.1]" },
      { citations: "[General Rules 2.1]" },
      { citations: "[Player Rules 3.4]" },
      { citations: "[Code of Conduct 2.3, Game Participation 3.2]" },
    ],
  },
  {
    id: "team-registration",
    icon: IconFileCheck,
    rules: [
      { citations: "[Team Registration 2.2, AFC Metrics Doc Section 10.1-10.2]" },
      { citations: "[Team Registration 2.2, Team Regulations 4.2]" },
      { citations: "[Team Regulations 4.2]" },
      { citations: "[Team Regulations 4.2, Contract Guidelines Section 2.1]" },
      { citations: "[Game Participation 3.2]" },
    ],
  },
  {
    id: "code-of-conduct",
    icon: IconScale,
    rules: [
      { citations: "[Code of Conduct 2.3, Conduct Standards 3.3]" },
      { citations: "[Code of Conduct 2.3, Conduct Standards 3.3, Disciplinary 6.1]" },
      { citations: "[Conduct Standards 3.3]" },
      { citations: "[Conduct Standards 3.3]" },
      { citations: "[Conduct Standards 3.3, Communication 3.5]" },
      { citations: "[Conduct Standards 3.3]" },
      { citations: "[Disciplinary 6.1]" },
    ],
  },
  {
    id: "game-participation",
    icon: IconDeviceMobile,
    rules: [
      { citations: "[Game Participation 3.2]" },
      { citations: "[Game Participation 3.2, Tournament Rules Doc]" },
      { citations: "[During Match Conduct 5.3]" },
      { citations: "[During Match Conduct 5.3, Tournament Rules Doc]" },
      { citations: "[Pre-Match Checks 5.2]" },
    ],
  },
  {
    id: "equipment-technical",
    icon: IconDeviceMobile,
    rules: [
      { citations: "[Equipment Guidelines 7.1, Technical Conduct 3.4]" },
      { citations: "[Equipment Guidelines 7.1]" },
      { citations: "[Equipment Guidelines 7.1]" },
      { citations: "[Technical Conduct 3.4, Disciplinary 6.1]" },
      { citations: "[Technical Conduct 3.4]" },
    ],
  },
  {
    id: "dress-code",
    icon: IconUsers,
    rules: [
      { citations: "[Dress Code 7.2]" },
      { citations: "[Dress Code 7.2]" },
      { citations: "[Dress Code 7.2]" },
      { citations: "[Disciplinary 6.1]" },
      { citations: "[Unauthorized Communications 5.4]" },
      { citations: "[Dress Code 7.2]" },
    ],
  },
  {
    id: "team-ownership",
    icon: IconGavel,
    rules: [
      { citations: "[Team Ownership 4.1]" },
      { citations: "[Team Ownership 4.1]" },
      { citations: "[Team Ownership 4.1]" },
      { citations: "[Team Ownership 4.1]" },
      { citations: "[Team Ownership 4.1]" },
      { citations: "[Team Ownership 4.1]" },
    ],
  },
  {
    id: "roster-transfers",
    icon: IconFileCheck,
    rules: [
      { citations: "[Roster Changes 4.2]" },
      { citations: "[Roster Changes 4.2, Special Provisions 9.3, Tournament Rules Doc]" },
      { citations: "[Special Provisions 9.3]" },
      { citations: "[Contract Guidelines 4.2]" },
      { citations: "[Contract Guidelines 4.2]" },
    ],
  },
  {
    id: "slot-trading",
    icon: IconCircleCheck,
    rules: [
      { citations: "[Slot Guidelines 5.2.1]" },
      { citations: "[Slot Guidelines 5.2.2]" },
      { citations: "[Slot Guidelines 5.2.3]" },
      { citations: "[Slot Guidelines 5.2.4]" },
      { citations: "[Slot Guidelines 5.3.1]" },
      { citations: "[Slot Guidelines 5.3.2]" },
      { citations: "[Slot Guidelines 5.4]" },
      { citations: "[Slot Guidelines 5.5]" },
      { citations: "[Slot Guidelines 5.7]" },
    ],
  },
  {
    id: "contracts",
    icon: IconFileCheck,
    rules: [
      { citations: "[Contract Guidelines 2.1, 7.1]" },
      { citations: "[Contract Guidelines 2.1]" },
      { citations: "[Contract Guidelines 2.1, 7.2]" },
      { citations: "[Contract Guidelines 2.2]" },
      { citations: "[Contract Guidelines 4.1]" },
      { citations: "[Contract Guidelines 4.3]" },
      { citations: "[Contract Guidelines 3]" },
      { citations: "[Contract Guidelines 6, Slot Guidelines 5.5]" },
    ],
  },
  {
    id: "sponsor-regulations",
    icon: IconTrophy,
    rules: [
      { citations: "[Sponsor Regulations 4.3]" },
      { citations: "[Team Obligations 4.4, Disciplinary 6.1]" },
      { citations: "[Team Obligations 4.4, Special Provisions 9.1]" },
    ],
  },
  {
    id: "competition-structure",
    icon: IconTrophy,
    rules: [
      { citations: "[Competition Structure 5.1, Introduction 1.1]" },
      { citations: "[Competition Structure 5.1, Disciplinary 6.1]" },
      { citations: "[Pre-Match Checks 5.2]" },
      { citations: "[Unauthorized Communications 5.4, Communication 3.5]" },
    ],
  },
  {
    id: "communication",
    icon: IconMessageExclamation,
    rules: [
      { citations: "[Communication 3.5]" },
      { citations: "[Communication 3.5, Prize Distribution 8.2]" },
      { citations: "[Communication 3.5, Conduct Standards 3.3]" },
    ],
  },
  {
    id: "disciplinary",
    icon: IconAlertCircle,
    rules: [
      { citations: "[Disciplinary 6.1]" },
      { citations: "[Disciplinary 6.1]" },
      { citations: "[Disciplinary 6.2]" },
      { citations: "[Disciplinary 6.2]" },
      { citations: "[Disciplinary 6.2]" },
      { citations: "[Disciplinary 6.2]" },
      { citations: "[Disciplinary 6.2]" },
    ],
  },
  {
    id: "prize-distribution",
    icon: IconTrophy,
    rules: [
      { citations: "[Prize Distribution 8.1]" },
      { citations: "[Prize Distribution 8.1, Team Obligations 4.4]" },
      { citations: "[Prize Distribution 8.2]" },
      { citations: "[Prize Distribution 8.2]" },
    ],
  },
  {
    id: "ip-media-rights",
    icon: IconFileCheck,
    rules: [
      { citations: "[Special Provisions 9.2]" },
      { citations: "[Special Provisions 9.2]" },
      { citations: "[Special Provisions 9.2]" },
    ],
  },
  {
    id: "organizer-authority",
    icon: IconGavel,
    rules: [
      { citations: "[Special Provisions 9.1]" },
      { citations: "[Special Provisions 9.1]" },
      { citations: "[Special Provisions 9.1, Disciplinary 6.2]" },
    ],
  },
  {
    id: "monthly-ranking",
    icon: IconChartBar,
    rules: [
      { citations: "[AFC Metrics 3.1]" },
      { citations: "[AFC Metrics 3.2]" },
      { citations: "[AFC Metrics 3.3]" },
      { citations: "[AFC Metrics 3.4]" },
      { citations: "[AFC Metrics 6]" },
    ],
  },
  {
    id: "quarterly-tiering",
    icon: IconChartBar,
    rules: [
      { citations: "[AFC Metrics 4.1]" },
      { citations: "[AFC Metrics 4.2]" },
      { citations: "[AFC Metrics 4.3]" },
      { citations: "[AFC Metrics 5.1]" },
      { citations: "[AFC Metrics 5.2]" },
      { citations: "[AFC Metrics 5.3]" },
      { citations: "[AFC Metrics 5.4]" },
      { citations: "[AFC Metrics 5.5]" },
      { citations: "[AFC Metrics 5.6]" },
      { citations: "[AFC Metrics 5.7]" },
    ],
  },
  {
    id: "tier-classifications",
    icon: IconTrophy,
    rules: [
      { citations: "[AFC Metrics 8]" },
      { citations: "[AFC Metrics 9]" },
      { citations: "[AFC Metrics 7]" },
    ],
  },
  {
    id: "metrics-compliance",
    icon: IconAlertCircle,
    rules: [
      { citations: "[AFC Metrics 10.1-10.2]" },
      { citations: "[AFC Metrics 10.3-10.4]" },
      { citations: "[AFC Metrics 10.5]" },
      { citations: "[AFC Metrics 10.6]" },
      { citations: "[AFC Metrics 11]" },
      { citations: "[AFC Metrics 12]" },
    ],
  },
];
