# How-to clips

Short looping videos of one task each, recorded from the real AFC site by a script, so any clip can
be made again in one command after the site changes. Asked by the owner on 2026-10-10 (brief:
`WEBSITE/tasks/howto-clips-brief-2026-10-10.md`), blanks filled 2026-10-12: four clips, shown on a
Help page and beside each feature's info tip, DM Sans captions, 8 to 20 seconds, captions of at
most 8 words, desktop (1440) and phone (390), English, French and Portuguese.

## The rule (owner, 2026-10-12)

> "after you create a new feature or you make changes to an existing interface and that interface
> is in the clips you automatically update the clips too"

Held by `scripts/check-howto-clips.mjs`, a blocking step of `scripts/check-all.mjs` (so the
pre-commit hook, every PR and the production build run it):

| Code | Fails when | Fix |
|---|---|---|
| `HOWTO-STALE` | a file the clip's screens are built from changed since its last full render | `node howto/render.mjs <clip>`, commit `howto/clips.lock.json` and deliver the new revision |
| `HOWTO-HOOK` | an element the clip presses (`data-howto="<id>"`) is no longer in the code | put the hook on the element that does that job now, or change the clip script |
| `HOWTO-CAPTION` | a caption is missing in en, fr or pt, or is over 8 words | hand-write it in `messages/<loc>/howto.json` |
| `HOWTO-MONEY` | the seed, a clip script or a caption holds an amount of money | owner, 2026-10-12: "i dont want fake money to be showing on the website". A prize is "Trophy"; route around a screen that prints the demo database's money total (Home's stat row) |

"The files a clip's screens are built from" is computed, never listed by hand
(`howto/lib/sources.mjs`): the page of each route the clip visits, everything those pages import
(through `@/` and relative imports), and the message files of every namespace they translate with.
Layouts (header, menu, footer) are not followed, or every menu change would re-render every clip.
For clip 1 that is 144 files.

## Make or re-make a clip

The recording runs on a LOCAL copy of AFC with a database built fresh from the models before every
take, so no real person is ever on screen, and nothing leaves the machine (every email, WhatsApp
message and Discord DM goes to `howto/out/outbox.txt`).

1. MySQL running locally (`"C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe" --datadir="C:/Users/Sweez/mysql-data" --port=3306 --console` on the owner's machine).
2. A backend checkout on the backend's `main`, with a `.env` copied from another checkout:
   `AFC_BACKEND_TREE=<that folder>`, `AFC_BACKEND_PYTHON=<a Python with the backend's packages>`.
3. The clips backend: `$AFC_BACKEND_PYTHON howto/stack/stack.py serve` (port 8094, settings
   `howto/stack/clips_settings.py`).
4. A production build of THIS branch pointed at it, then served on 3094:
   `HOWTO_CLIPS_BUILD=1 NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8094 NEXT_PUBLIC_URL=http://localhost:3094 NEXT_PUBLIC_TURNSTILE_SITE_KEY= pnpm build`,
   then `HOWTO_CLIPS_BUILD=1 pnpm exec next start -p 3094`. Rebuild after every UI change, or the clip shows the
   old screen. `HOWTO_CLIPS_BUILD=1` lets next/image load the seeded banners from the local backend
   (`images.dangerouslyAllowLocalIP` in next.config.ts); a production build never sets it.
5. `node howto/render.mjs <clip>` renders every language in `meta.langs` at both sizes into
   `howto/out/<clip>/` (MP4 + WebM for the site, a GIF under 3 MB, a still for reduced motion) and
   writes `howto/clips.lock.json`. `--size desktop|phone` and `--lang en` make a quick partial take
   that leaves the lock alone. A failed take leaves `FAILED-<lang>-<size>.png` beside the outputs.
6. Deliver: `node howto/deliver.mjs --revision N --date "<day of the note>" [clip ...]` copies every
   rendered language and size into `How-to Clips 10 October 2026/Revision N, <date>/<Language>/` with plain
   names (`<English title>, desktop.mp4`, `..., phone, still.jpg`). It refuses a revision that already holds
   files (a sent revision is never written into again) and a clip with any file missing. Then update the
   set's `Read me first.txt` and add a row to `WEBSITE/tasks/work-log.md` by hand.

## Write a clip

`howto/clips/<id>.mjs` exports `meta` (id, the `messages` key in `howto.json`, `langs`, `seconds`,
`routes`, `hooks`) and a default function that drives `s`:

| Call | Does |
|---|---|
| `s.goto(path)` | opens a page (loading time is cut down in the edit) |
| `s.caption(key, hook, {extra, hold, place, scrim})` | a numbered caption from `howto.json`, beside / above the element |
| `s.click(hook, extra, {opens})` | moves the cursor there and presses it; `opens` = the hook it must reveal |
| `s.type(hook, text)` | presses then types |
| `s.waitForPath(re)`, `s.waitFor(hook)`, `s.quiet()` | waits, all cut short on screen |
| `s.backend(...)` | the backend's part (`stack.py code`, `link`, `seen`) |

Elements are found ONLY by `data-howto` hooks, never by screen position. Add the hook to the element
in the site's code with a one-line comment naming the clip.

Never show or imitate another company's page. Clip 1 says in a caption what the player does on
Discord's consent screen; the recorder keeps the browser on AFC (a navigation to another site
answers 204) and `stack.py link` records the same link Discord's answer would.
