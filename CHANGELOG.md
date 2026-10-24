# Changelog

AFC's releases, newest first. AFC has ONE version number for the whole product, this website and
the AFC-B server together: a release is tagged `vX.Y.Z` in every repo it changed, and the number is
counted across both (`release.json`).

Rule R89 (owner, 17 Oct 2026). Write the bullets in the PR, under `## Unreleased`, in plain words
about what a person notices. The headings decide the kind of release:

- `### Breaking` makes it a **major** (v7.4.2 to v8.0.0): something stops working for people or
  systems outside, e.g. a partner API field removed or renamed, everyone made to sign in again,
  a public address gone with no redirect. Only on the owner's word.
- `### Added` or `### Changed` makes it a **minor** (v7.4.2 to v7.5.0): something new people can
  see or use (anything that earns a NEW badge), or a deliberate change to how a feature behaves.
- `### Fixed`, `### Security` or `### Internal` alone makes it a **patch** (v7.4.2 to v7.4.3).

At release time `node ~/.claude/skills/versioning/scripts/release.mjs next` (or
`node scripts/release-version.mjs next`) prints the number; rename `## Unreleased` to it, merge, tag
the merge commit. A version tag pushed with the wrong number is blocked before the push, and the tag
workflow checks it again before it builds.

## Unreleased

## v7.4.0 - 2026-10-24

### Added
- Event edit (admin and organizer), Basic Info: three switches for the kill stats (sniper kills recorded, head to
  head): a tab on the event page, the live overlays, a CSV for the graphics team. Off by default; NEW tag.
- Every winner on an awards season page now shows the rest of the category's nominees ("Also nominated", with
  their pictures, no vote counts) and the category's nominee poster: beside the winner on a computer, a strip
  to tap on a phone, full size in a viewer that closes with Esc. NFCA 2025 has posters for 26 of 27 categories.
  NEW tag for five days.

### Changed
- On a phone, the small buttons, tabs, switches, checkboxes, dropdowns, info tips, dialog close
  crosses and banner crosses answer a tap across at least 44 x 44 px, Apple's minimum, while they
  look exactly the same size. Measured on 9 pages at 390 px with touch: 81 of the 91 small controls
  on the first screen now take a full 44 px tap, against 1 before. Mouse screens are unchanged.
- Buttons, tabs and toggles darken slightly (and shrink 3%) the moment a finger lands, so a tap shows
  it registered.
- The menu panel slides in over 0.3 s instead of 0.5 s. A phone set to "Reduce motion" gets every
  panel, dialog and menu as a short fade instead of a slide or zoom.
- The notifications bell shows only when signed in. A visitor had a bell that could only open an
  empty panel.
- An event with no banner shows its own name and type on an AFC surface instead of a grey
  "600 x 400" picture, on the tournaments list, the event page and the organization page.
- On a phone, /tournaments shows the search and one Filter button; the pickers and status chips
  open in a sheet from the bottom, so the events start on the first screen.
- The transfer window is one calm line ("closed, opens again on <date>") with the rules behind
  Details, instead of a large red card.
- On a phone the Help button shrinks to a round icon once you scroll, and the footer leaves room
  under it.
- The phone header says "AFC" next to the logo instead of a cut-off name.
- The header and the menu panel are frosted glass with a thin light edge; a device set to reduce
  transparency gets them solid.
- Large titles are set slightly tighter.
- The event page lists its details as a two-column grid, and the QR code moved into a Share
  button beside the title (Copy link, Show QR code).
- On profile edit you press the round picture to choose a new one; the browser's file box is gone.
- Admin and organizer sidebars: every row and the collapse button are 44 px, and the group names
  are no longer small spaced-out capitals.
- On a first visit things come one at a time: the "New access" card first, then the welcome tour,
  and the Help button steps aside while either is open or a page tour runs. The two-step sign-in
  reminder is one line in the page.
- "Submit your result" on an event page now opens only while your group is playing: from the
  group's start time until its maps are done plus a few hours, and only for maps of groups your
  team is in. It used to offer every map of the event, days before or weeks after. It shows when
  the window closes. The server refuses a claim outside the window too, in your language.

### Fixed
- Buttons that show only an icon now have a name for screen readers, in English, French and
  Portuguese: the bell, cart, menu, back arrow, the password eye in the sign-in window, the trash
  button on event lists, the WhatsApp switch on profile edit, the dialog close cross and the info
  tips (which said "More info" in English in every language).
- The site header stays at the top again while you scroll. It had stopped sticking on 30 Jun,
  when a wrapper for printing was put around it.
- On the event page the mode, the kind and the team size are in your language (they were English
  capitals), and Location says Online only for online events (LAN events said Online too).
- An organizer's "Let teams submit their own map results" switch did nothing: the organizer edit page showed it
  but never loaded or saved it. It now saves.
- The line above the map picker told players "Nothing is counted until you approve it" (the
  organizer's line). It now asks which map they are sending a result for.
- The awards hall of fame showed "Ballots 2" for NFCA 2025, which read as two votes cast. It counts the
  season's polls, so it now says "Polls" (French "Sondages", Portuguese "Enquetes").
- The admin "Create leaderboard" page titles (Step 1 of 5, Basic Information, Manual Input and the rest)
  were English on the French and Portuguese site. They now use the same translated words as the
  organizer's leaderboard wizard.

### Security
- zod 4.1.13 to 4.6.7 (GHSA-mrhx-c7xc-m3w5, high: memory could run out while validating very large
  constrained lists) and happy-dom to 21.0.4 (GHSA-834v-8h66-3h79, high). Found by the security ledger in
  check-all, which was blocking every commit.

### Internal
- Design lint follows the Apple materials rule adopted for AFC on 23 Oct (inbox #375): `backdrop-filter: blur()`
  on chrome is no longer read as a decorative blur, and a `ring-1` edge on an element that carries `backdrop-blur`
  is allowed. Self-test 33 cases.

## v7.3.1 - 2026-10-22

### Fixed
- The awards hall of fame (`/awards/<season>`) and the poll pages open for visitors who are not
  signed in. They said "This awards season could not be found" to everybody signed out, because the
  page gave up before asking the server.

### Internal
- New known-bug catcher `fe-public-read-authheaders`: a client's shared read helper that demands a
  session fails the build. The ten admin-only clients that legitimately do are listed with the
  reason, and a listed file that stops matching fails too.

## v7.3.0 - 2026-10-22

### Added
- OCR reviews say when a player was "Remembered from your earlier reviews", and when a suggestion is
  held back because "You turned this player down for this name before". The standalone leaderboard
  review sends each player's decision back so the memory learns from it. In English, French and
  Portuguese (#334, #335).
- The screenshot batch shows each waiting map's place in line and the expected wait, e.g. "Waiting in
  line: 1 of your maps ahead, about 9 seconds" (#334).

### Fixed
- In the screenshot batch on a phone, each map's status and remove button were pushed off the card by
  the map picker.

### Security
- Next.js 16.3.8 to 16.4.1: two advisories published on 22 Oct 2026, a critical remote code execution
  in the image optimizer (GHSA-2464-fhr4-w9xw; the sharp 0.35.5 already in use was its stated
  workaround) and a high denial of service through Server Actions with no workaround
  (GHSA-p3m5-59mp-jv5r).

## v7.2.0 - 2026-10-22

### Added
- The OCR review says which reader read the screenshot, in words: "On-site reader", "On-site
  reader: check every row" with a note asking for a full check before saving, or the AI engine.
  In English, French and Portuguese, with a NEW tag for five days.

### Fixed
- The OCR review dialogs (event OCR and the standalone leaderboard screenshot batch) no longer run
  off the right edge of a phone; the table scrolls inside its own box.

### Security
- follow-redirects pinned to 1.16.1 or later (two high advisories, through axios).

## v7.1.129 - 2026-10-18

### Fixed
- The contact form, the partner application and the feedback dialog get a fresh bot check after
  each send, so a second try after a refusal (or a second contact message) is no longer refused as a
  bot.

### Internal
- known-bugs `fe-botcheck-no-reset` fails a form whose bot check never swaps its spent token.
- `scripts/release-version.mjs` says "already on AFC-B: the same release" once, not twice.

## v7.1.128 - 2026-10-17

### Fixed
- When the server refuses something (a payment that cannot start, a payout, the Help assistant being
  offline, a screenshot that cannot be read, an email news test send), the screen now shows the real
  reason instead of "Something went wrong" (AFC-B #134).
- An email news test send that Amazon SES refuses says why: the SMTP user is not allowed to send, an
  address is not verified while in the sandbox, sending is limited, or the SMTP login was refused
  (AFC-B #134, AFC_Frontend #113).

### Internal
- Releases follow rule R89: this changelog, `release.json` (one number with AFC-B), and the tag
  workflow checks a version tag before it builds (`scripts/release-version.mjs`).

## v7.1.127 - 2026-10-17

The last release labelled the old way: from v7.1.0 on, every release was given the next patch number
whatever it contained. This one shipped email news (AFC-B #132, AFC_Frontend #111). For anything
older, the git tags and their messages are the record.
