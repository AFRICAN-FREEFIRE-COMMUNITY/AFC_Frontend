// howto/clips/register-tournament.mjs - clip 3: a team captain registers the team for a tournament.
//
// Owner, 2026-10-12 (inbox #235, #239). Recorded by howto/render.mjs, starting signed in as the
// invented Kofi, captain of Accra Hawks (four players, every in-game UID set). Seed
// "register-tournament" (howto/stack/seed.py): the free, public Lagos Clash Cup taking
// registrations. Elements are found only by data-howto hooks.

export const meta = {
  id: "register-tournament",
  messages: "registerTournament",
  langs: ["en", "fr", "pt"],
  seconds: [8, 20],
  seed: "register-tournament",
  signedInAs: "KofiPlays",
  storage: { afc_2fa_prompt_dismissed: "1" },
  routes: ["/tournaments", "/tournaments/lagos-clash-cup"],
  hooks: [
    "event-card", "event-register", "register-type", "register-member", "register-members-continue",
    "register-team-info-continue", "register-rules-agree", "register-rules-continue", "register-success",
  ],
};

const PLAYERS = ["KofiPlays", "AmaPlays", "YawPlays", "EsiPlays"];

export default async function registerTournament(s) {
  // 1. Tournaments -> the event
  await s.goto("/tournaments");
  await s.caption("find", "event-card", { extra: '[data-slug="lagos-clash-cup"]', hold: 500 });
  await s.click("event-card", '[data-slug="lagos-clash-cup"]');

  // 2. Register -> as a team
  await s.waitForPath(/^\/tournaments\/lagos-clash-cup/);
  await s.waitFor("event-register");
  await s.quiet();
  await s.caption("register", "event-register", { hold: 450 });
  await s.click("event-register", "", { opens: "register-type" });
  await s.caption("type", "register-type", { extra: '[data-type="team"]', hold: 400 });
  await s.click("register-type", '[data-type="team"]', { opens: "register-member" });

  // 3. The players who will play
  await s.caption("members", "register-member", { extra: `[data-member="${PLAYERS[0]}"]`, hold: 400 });
  for (const p of PLAYERS) {
    if (!(await s.checked("register-member", `[data-member="${p}"]`))) {
      await s.click("register-member", `[data-member="${p}"]`);
    }
  }
  await s.click("register-members-continue", "", { opens: "register-team-info-continue" });

  // 4. Check the summary, accept the rules
  await s.caption("info", "register-team-info-continue", { hold: 500 });
  await s.click("register-team-info-continue", "", { opens: "register-rules-agree" });
  await s.caption("rules", "register-rules-agree", { hold: 400 });
  await s.click("register-rules-agree");
  await s.click("register-rules-continue");

  // 5. Registered
  await s.waitFor("register-success");
  await s.caption("done", "register-success", { hold: 1600 });
}
