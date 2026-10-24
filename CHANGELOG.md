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

### Added
- Every winner on an awards season page now shows the rest of the category's nominees ("Also nominated", with
  their pictures, no vote counts) and the category's nominee poster: beside the winner on a computer, a strip
  to tap on a phone, full size in a viewer that closes with Esc. NFCA 2025 has posters for 26 of 27 categories.
  NEW tag for five days (set its date to the go-live day at ship).

### Changed
- "Submit your result" on an event page now opens only while your group is playing: from the
  group's start time until its maps are done plus a few hours, and only for maps of groups your
  team is in. It used to offer every map of the event, days before or weeks after. It shows when
  the window closes. The server refuses a claim outside the window too, in your language.

### Fixed
- The line above the map picker told players "Nothing is counted until you approve it" (the
  organizer's line). It now asks which map they are sending a result for.
- The awards hall of fame showed "Ballots 2" for NFCA 2025, which read as two votes cast. It counts the
  season's polls, so it now says "Polls" (French "Sondages", Portuguese "Enquetes").
- The admin "Create leaderboard" page titles (Step 1 of 5, Basic Information, Manual Input and the rest)
  were English on the French and Portuguese site. They now use the same translated words as the
  organizer's leaderboard wizard.

### Security
- zod 4.1.13 to 4.6.7 (GHSA-mrhx-c7xc-m3w5, high), same bump as PR #118.
- zod 4.1.13 to 4.6.7 (GHSA-mrhx-c7xc-m3w5, high: memory could run out while validating very large
  constrained lists). Found by the security ledger in check-all, which was blocking every commit.

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
