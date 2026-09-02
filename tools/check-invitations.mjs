#!/usr/bin/env node
// tools/check-invitations.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Static guards for the two invitation fixes (owner 2026-09-02).
//
// Both bugs were the same shape: the BACKEND already sent what was needed and the frontend never
// read it. `my_invitation` had been on the wire since 2026-08-26 with a docstring naming its
// consumer, and the per-player refusal body was being narrowed to its first sentence. Neither is
// the kind of fault a type checker or a build can see, because nothing was broken; something was
// simply never wired. So these checks assert that the wiring EXISTS.
//
// Usage:  node tools/check-invitations.mjs [check ...]   (no args = all)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVENT = join(ROOT, "app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx");
const CARD = join(ROOT, "app/(user)/teams/[id]/_components/EventInvitationsCard.tsx");
const PANEL = join(ROOT, "components/events/RosterRequirementsList.tsx");
const BANNER = join(ROOT, "components/events/EventInvitationBanner.tsx");

const read = (p) => readFileSync(p, "utf8");

const CHECKS = {
  // A1 - the key that was on the wire and unread.
  "reads-my-invitation": () => {
    const s = read(EVENT);
    const bad = [];
    if (!/my_invitation/.test(s)) bad.push("  EventDetailsWrapper never reads my_invitation");
    if (!/hasPendingInvitation/.test(s)) bad.push("  no pending-invitation state derived from it");
    return bad;
  },

  // A2 - an addressed invitation opens a private event, as an invite link does.
  "private-gate": () => {
    const s = read(EVENT);
    const m = s.match(/const canRegister =[\s\S]{0,200}?;/);
    if (!m) return ["  canRegister not found"];
    return /hasPendingInvitation/.test(m[0])
      ? []
      : ["  canRegister ignores an addressed invitation: " + m[0].replace(/\s+/g, " ").slice(0, 120)];
  },

  // B1 - one panel, not two copies.
  "shared-panel": () => {
    const bad = [];
    if (!existsSync(PANEL)) return ["  components/events/RosterRequirementsList.tsx is missing"];
    const event = read(EVENT);
    if (!/RosterRequirementsList/.test(event))
      bad.push("  the tournament page no longer uses the shared panel");
    // The inline copy must be GONE from the 5,400-line file, or the two will drift.
    if (/rosterReqIssues\.map\(/.test(event))
      bad.push("  EventDetailsWrapper still renders its own copy of the rows");
    return bad;
  },

  // B2 - the dialog shows the panel rather than narrowing the body to one sentence.
  "dialog-uses-panel": () => {
    const s = read(CARD);
    const bad = [];
    if (!/RosterRequirementsList/.test(s)) bad.push("  the accept dialog does not render the panel");
    if (!/parseRequirementIssues/.test(s)) bad.push("  the refusal body is never parsed");
    if (!/errorBody/.test(s)) bad.push("  the card still reads only `message` from the refusal");
    return bad;
  },

  // C4 - every new string exists in all three locales, and the ICU parses.
  i18n: () => {
    const bad = [];
    const need = {
      "event.bannerTitleTeam": 1,
      "event.bannerTitleSolo": 1,
      "event.bannerByline": 1,
      "event.bannerBylineUnknown": 1,
      "event.bannerAccept": 1,
      "event.bannerDecline": 1,
      "event.bannerNote": 1,
      "team.blockedBack": 1,
    };
    for (const loc of ["en", "fr", "pt"]) {
      const d = JSON.parse(read(join(ROOT, `messages/${loc}/eventInvites.json`)));
      for (const key of Object.keys(need)) {
        const [ns, k] = key.split(".");
        const value = d?.[ns]?.[k];
        if (!value) {
          bad.push(`  ${loc} is missing ${key}`);
          continue;
        }
        // A lone apostrophe before a brace starts ICU quoting and silently eats the placeholder.
        if (/\{/.test(value) && /'(?=\{)/.test(value))
          bad.push(`  ${loc}.${key} has an unescaped apostrophe before a placeholder`);
      }
    }
    return bad;
  },

  // The banner exists and hands off rather than registering on its own.
  "banner-hands-off": () => {
    if (!existsSync(BANNER)) return ["  components/events/EventInvitationBanner.tsx is missing"];
    const s = read(BANNER);
    const bad = [];
    if (!/onAccept/.test(s)) bad.push("  the banner does not hand off accepting to the page");
    // Accepting IS registering, so the banner must NOT post to accept/ behind the gates' back.
    if (/team-invitations\/\$\{invitation\.id\}\/accept/.test(s))
      bad.push("  the banner posts accept/ itself, bypassing the registration flow");
    return bad;
  },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CHECKS);
let failed = 0;
for (const name of names) {
  const check = CHECKS[name];
  if (!check) {
    console.log(`FAIL ${name}: no such check. Available: ${Object.keys(CHECKS).join(", ")}`);
    failed++;
    continue;
  }
  const bad = check();
  if (bad.length) {
    failed++;
    console.log(`FAIL ${name}`);
    bad.forEach((b) => console.log(b));
  } else {
    console.log(`OK ${name}`);
  }
}
if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nOK all ${names.length} checks passed`);
