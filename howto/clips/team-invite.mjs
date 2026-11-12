// howto/clips/team-invite.mjs - clip 2: a player creates a team and invites a teammate, who accepts.
//
// Owner, 2026-10-12 (inbox #235, #239). Recorded by howto/render.mjs on the clips stack, starting
// signed in as the invented Kofi (clip 1 shows signing up). Seed "team-invite" (howto/stack/seed.py):
// Kofi and Ama, both without a team, and an open transfer window, so no lock warning interrupts.
//
// THE TEAMMATE'S SIDE is a cut to Ama's own screen, said by a caption: the invite reaches her as
// a bell alert whose View opens /invite/<id>. That only works with AFC-B fix/team-invites
// (inbox #240: the form's invites were dropped; #241: the alert had no link). Everything shown is
// AFC's real pages; elements are found only by data-howto hooks.

export const meta = {
  id: "team-invite",
  messages: "teamInvite",
  langs: ["en", "fr", "pt"],
  seconds: [8, 20],
  seed: "team-invite",
  signedInAs: "KofiPlays",
  storage: { afc_2fa_prompt_dismissed: "1" },
  routes: ["/teams", "/teams/create", "/invite/demo", "/teams/accra-hawks"],
  hooks: [
    "teams-create", "team-name", "team-tag", "team-description", "team-join-settings", "team-join-open",
    "team-invite-search", "user-search-option", "team-create-submit", "notif-bell", "notif-link",
    "invite-accept", "team-members-tab", "team-members-list",
  ],
};

const TEAM = { name: "Accra Hawks", tag: "ACH", bio: "Squad from Accra, scrims every night." };

export default async function teamInvite(s) {
  // 1. Teams & Players -> Create team
  await s.goto("/teams");
  await s.caption("create", "teams-create", { hold: 500 });
  await s.click("teams-create");

  // 2. Name, tag, bio
  await s.waitForPath(/^\/teams\/create/);
  await s.caption("details", "team-name", { hold: 450 });
  await s.type("team-name", TEAM.name);
  await s.type("team-tag", TEAM.tag);
  await s.type("team-description", TEAM.bio);

  // 3. Who can join
  await s.caption("join", "team-join-settings", { hold: 400 });
  await s.click("team-join-settings", "", { opens: "team-join-open" });
  await s.click("team-join-open");

  // 4. Find the teammate by name and pick her
  await s.caption("invite", "team-invite-search", { hold: 400 });
  await s.click("team-invite-search", " button");
  await s.keys("Ama");
  await s.click("user-search-option", '[data-username="AmaPlays"]');

  // 5. Create
  await s.caption("submit", "team-create-submit", { hold: 400 });
  await s.click("team-create-submit");
  await s.waitForPath(/^\/teams\/?($|\?)/);

  // 6. Ama's side: the alert arrives, she opens it and accepts
  await s.caption("teammate", null, { scrim: true, hold: 1200 });
  await s.signInAs("AmaPlays");
  await s.clear();
  // Teams, not Home: Home's stat row prints the demo database's prize total, and no money is shown
  // on frame (owner, 12 Oct 2026). The bell is in the header of every page.
  await s.goto("/teams");
  await s.waitFor("notif-bell");
  await s.quiet();
  await s.caption("accept", "notif-bell", { hold: 450 });
  await s.click("notif-bell", "", { opens: "notif-link" });
  await s.click("notif-link", '[data-link^="/invite/"]');
  await s.waitForPath(/^\/invite\//);
  await s.click("invite-accept");

  // 7. On the team page, the Members tab lists both of them. (Pointing at the tab alone ended on
  // the Overview on a phone, the team name scrolled away and the caption over Exit Team.)
  await s.waitForPath(/^\/teams\/[^/?]+/);
  await s.click("team-members-tab");
  await s.caption("done", "team-members-list", { hold: 1500 });
}
