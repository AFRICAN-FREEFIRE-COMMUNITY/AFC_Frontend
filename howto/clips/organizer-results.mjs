// howto/clips/organizer-results.mjs - clip 4: an organizer enters one map's results by hand.
//
// Owner, 2026-10-12 (inbox #235, #239). Recorded by howto/render.mjs, starting signed in as the
// invented organizer Tolu of Lagos Esports Hub. Seed "organizer-results" (howto/stack/seed.py):
// Lagos Clash Cup, Group A with four teams of four, two maps, a leaderboard with a point system.
// The organizer portal's first-visit page tours count as already closed (meta.storage).
//
// The result screens are shared with the admin pages and are written in English only (not this
// clip's to fix; reported to the owner 2026-10-12), so the fr and pt captions name those English
// labels as they appear.

export const meta = {
  id: "organizer-results",
  messages: "organizerResults",
  langs: ["en", "fr", "pt"],
  seconds: [8, 20],
  seed: "organizer-results",
  signedInAs: "ToluHost",
  storage: {
    afc_2fa_prompt_dismissed: "1",
    afc_org_tour_events_done: "1",
    afc_org_tour_overview_done: "1",
    "afc_org_tour_event-leaderboard_done": "1",
    "afc_org_tour_event-detail_done": "1",
  },
  routes: ["/organizer/events", "/organizer/events/lagos-clash-cup/leaderboard"],
  hooks: [
    "org-event-results", "edit-match-results", "match-picker-select", "match-picker-option",
    "match-picker-continue", "result-method", "result-view", "result-place", "result-player", "result-next-team",
    "result-save",
  ],
};

// Map 1, team by team in the order the screen shows them: finishing place, then kills for the two
// players who got any (a blank or 0 box is a 0, which is how the screen counts it).
const MAP_1 = [
  { place: 2, kills: [["KofiPlays", 4], ["AmaPlays", 2]] },
  { place: 1, kills: [["Chidi_FF", 6], ["BisiFF", 3]] },
  { place: 4, kills: [["WanjiruFF", 1], ["OtienoFF", 1]] },
  { place: 3, kills: [["KwameFF", 3], ["AbenaFF", 2]] },
];

export default async function organizerResults(s) {
  // 1. Events -> Results & Leaderboard
  await s.goto("/organizer/events");
  await s.caption("open", "org-event-results", { extra: '[data-slug="lagos-clash-cup"]', hold: 500 });
  await s.click("org-event-results", '[data-slug="lagos-clash-cup"]');

  // 2. Edit Match Results -> the map
  await s.waitForPath(/\/leaderboard/);
  await s.waitFor("edit-match-results");
  await s.quiet();
  await s.caption("edit", "edit-match-results", { hold: 450 });
  await s.click("edit-match-results", "", { opens: "match-picker-select" });
  await s.caption("map", "match-picker-select", { hold: 400 });
  await s.click("match-picker-select", "", { opens: "match-picker-option" });
  await s.click("match-picker-option", '[data-match="1"]');
  await s.click("match-picker-continue", "", { opens: "result-method" });

  // 3. Manual input
  await s.caption("manual", "result-method", { extra: '[data-method="manual"]', hold: 400 });
  await s.click("result-method", '[data-method="manual"]', { opens: "result-view" });
  // One team at a time: the phone's default; a wide screen opens on "Review all teams", where the
  // place is a typed box. Pressing it on both keeps one clip for both sizes.
  await s.click("result-view", '[data-view="one"]', { opens: "result-place" });

  // 4. Each team: place and kills, then the next team
  await s.caption("enter", "result-place", { extra: '[data-place="1"]', hold: 500 });
  for (const [i, team] of MAP_1.entries()) {
    await s.click("result-place", `[data-place="${team.place}"]`);
    for (const [player, kills] of team.kills) {
      await s.fill("result-player", kills, `[data-player="${player}"] input`);
    }
    if (i < MAP_1.length - 1) await s.click("result-next-team");
  }

  // 5. Save
  await s.caption("save", "result-save", { hold: 400 });
  await s.click("result-save");
  await s.clear();
  await s.quiet();
  await s.caption("done", null, { hold: 1500 });
}
