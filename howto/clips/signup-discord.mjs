// howto/clips/signup-discord.mjs - clip 1: a new player signs up and connects Discord.
//
// Owner, 2026-10-12 (inbox #235): the first of four clips. Recorded on the local clips stack by
// howto/render.mjs, which hands this script `s` (goto, caption, click, type, stack ...). Every
// element is found by its data-howto hook; the hooks are declared below and
// scripts/check-howto-clips.mjs fails when one of them is no longer in the site's code.
//
// The player is invented (Kofi Mensah). The address is a Gmail one on purpose: /auth/verify-code/
// refuses any domain outside ALLOWED_EMAIL_DOMAINS (afc_auth/views.py), so a tutorial showing
// example.com would teach a sign-up that cannot be finished (inbox #238). Nothing is ever sent to it:
// the clips stack writes every email to its outbox. The database is rebuilt before every recording.
//
// THE DISCORD STEP: pressing Connect sends the browser to Discord's consent page. The clip does not
// show or imitate that page (it is someone else's, and it would carry a real Discord account). The
// recorder keeps the browser on AFC (render.mjs answers outside navigations with 204), a caption
// says what the player does on Discord, stack.py links the account exactly as Discord's answer
// would, and the clip lands where the real callback lands: /profile/connected-apps?connected=discord.

export const meta = {
  id: "signup-discord",
  messages: "signupDiscord", // messages/<lang>/howto.json -> clips.signupDiscord
  langs: ["en", "fr", "pt"],
  seconds: [8, 20],
  // The screens this clip shows. Their page files, everything those import and the message
  // namespaces they use are what "this interface" means for the clips rule (howto/lib/sources.mjs).
  routes: ["/create-account", "/email-confirmation", "/login", "/onboarding", "/profile", "/profile/connected-apps"],
  hooks: [
    "signup-full-name", "signup-ingame-name", "signup-email", "signup-password", "signup-confirm-password",
    "signup-terms", "signup-submit", "confirm-code", "confirm-submit", "login-identifier", "login-password",
    "login-submit", "onboarding-skip", "nav-menu", "nav-my-profile", "profile-connections", "connect-account",
    "connection-row",
  ],
};

const PLAYER = {
  fullName: "Kofi Mensah",
  gameName: "KofiPlays",
  email: "kofiplays.demo@gmail.com",
  password: "Kofi#2026play",
  discord: "kofiplays",
  discordId: "100000000000000001",
};

export default async function signupDiscord(s) {
  // 1. The form
  await s.goto("/create-account");
  await s.caption("details", "signup-full-name", { hold: 400 });
  await s.type("signup-full-name", PLAYER.fullName);
  await s.type("signup-ingame-name", PLAYER.gameName);
  await s.type("signup-email", PLAYER.email);
  await s.type("signup-password", PLAYER.password);
  await s.type("signup-confirm-password", PLAYER.password);

  // 2. Terms + Register
  await s.caption("register", "signup-submit", { hold: 450 });
  await s.click("signup-terms");
  await s.click("signup-submit");

  // 3. The emailed code (read from the stack's outbox, the way the player reads their inbox)
  await s.waitForPath(/^\/email-confirmation/);
  await s.caption("code", "confirm-code", { hold: 400 });
  const code = await s.backend("code", PLAYER.email);
  await s.type("confirm-code", code);
  await s.click("confirm-submit");

  // 4. Log in
  await s.waitForPath(/^\/login/);
  // A brand-new account gets the first-run welcome tour on its first page after setup, and on the
  // first recording it covered Home and swallowed the press on the menu. Set before the
  // login press, so the profile the site loads after login already says so. This clip is about signing
  // up and Discord, so the tour counts as already closed (the same flag its own Skip button sets).
  await s.backend("seen", PLAYER.gameName);
  await s.caption("login", "login-identifier", { hold: 450 });
  await s.type("login-identifier", PLAYER.gameName);
  await s.type("login-password", PLAYER.password);
  await s.click("login-submit");

  // 5. First-login setup: skippable, and this clip is about Discord
  await s.waitFor("onboarding-skip");
  await s.caption("skip", "onboarding-skip", { hold: 500 });
  await s.click("onboarding-skip");

  // 6. Menu -> My profile. Wait for /home first: the setup page carries the same header, and a
  // menu opened there is closed again by the move to /home (fourth recording).
  await s.waitForPath(/^\/home/);
  await s.waitFor("nav-menu");
  await s.quiet();
  await s.caption("profile", "nav-menu", { hold: 450 });
  await s.click("nav-menu", "", { opens: "nav-my-profile" });
  await s.click("nav-my-profile");

  // 7. Manage connections -> Connect beside Discord
  await s.waitForPath(/^\/profile$/);
  await s.caption("connections", "profile-connections", { hold: 450 });
  await s.click("profile-connections");
  await s.waitForPath(/^\/profile\/connected-apps/);
  await s.caption("connect", "connect-account", { extra: '[data-provider="discord"]', hold: 500 });
  await s.click("connect-account", '[data-provider="discord"]');

  // 8. Discord's own page: said, never shown
  await s.caption("discord", null, { scrim: true, hold: 1300 });
  await s.backend("link", PLAYER.gameName, "discord", PLAYER.discord, PLAYER.discordId);
  await s.clear();

  // 9. Back on AFC, connected
  await s.goto("/profile/connected-apps?connected=discord");
  // Holds trimmed by about 0.9 s in all on 12 Oct 2026: the desktop takes ran 20.1 and 20.2 s on a
  // machine short of memory (owner's ceiling is 20 s). 1.2 s here, plus the 0.8 s the encoder holds
  // the last frame.
  await s.caption("done", "connection-row", { extra: '[data-provider="discord"]', hold: 1200 });
}
