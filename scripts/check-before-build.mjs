/**
 * scripts/check-before-build.mjs - refuse `pnpm build` while a dev server is using this tree.
 *
 * WHY THIS EXISTS (owner rule R40, 2026-09-17; the lesson is from 2026-08-14). `next build` and
 * `next dev` share `.next/`. A build run while a dev server is up clobbers the dev server's
 * output: the running site starts answering blank pages and 404s for routes whose files are right
 * there, and the walk that follows reads as "everything is broken" when nothing in the code is.
 * It cost a clean walk on 13 August. A script that checks is cheaper than a lesson file that
 * hopes to be read.
 *
 * WHAT IT CHECKS. Two signs together: `.next/dev/` exists (the dev server's own output folder in
 * Next 16), and something is listening on the dev port (3000 by default, or PORT). Both true = a
 * dev server is using this tree; the build stops with the way out. Either alone passes: a stale
 * `.next/dev` with nothing listening is just a cache, and a listener on 3000 with no `.next/dev`
 * is some other program.
 *
 * Wired as the `prebuild` script, so `pnpm build` runs it first. The production image builds in
 * a container with no dev server, so it passes there. `AFC_BUILD_FORCE=1 pnpm build` skips it
 * for the rare case you know better.
 */
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

const ROOT = process.cwd();
const port = Number(process.env.PORT || 3000);

if (process.env.AFC_BUILD_FORCE === "1") {
  console.log("check-before-build: AFC_BUILD_FORCE=1, skipping");
  process.exit(0);
}

const devDir = join(ROOT, ".next", "dev");
if (!existsSync(devDir)) {
  console.log("check-before-build: no .next/dev, no dev server output to clobber");
  process.exit(0);
}

function listening(p) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port: p });
    const done = (v) => { try { sock.destroy(); } catch { /* closed */ } resolve(v); };
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
    sock.setTimeout(800, () => done(false));
  });
}

if (await listening(port)) {
  console.error(
    `check-before-build: a dev server is listening on :${port} and .next/dev exists in this tree.\n` +
    `  Building now would overwrite the dev server's output and the running site would go blank.\n` +
    `  Stop the dev server first (or build from a separate worktree). AFC_BUILD_FORCE=1 overrides.`,
  );
  process.exit(1);
}
console.log(`check-before-build: .next/dev exists but nothing listens on :${port}, safe to build`);
