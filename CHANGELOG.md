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

### Fixed
- The awards hall of fame (`/awards/<season>`) and the poll pages open for visitors who are not
  signed in. They said "This awards season could not be found" to everybody signed out, because the
  page gave up before asking the server.

### Internal
- New known-bug catcher `fe-public-read-authheaders`: a client's shared read helper that demands a
  session fails the build. The ten admin-only clients that legitimately do are listed with the
  reason, and a listed file that stops matching fails too.

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
