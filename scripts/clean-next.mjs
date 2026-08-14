/**
 * scripts/clean-next.mjs - delete the .next build cache, then let the caller start the dev server.
 *
 * WHY THIS EXISTS (2026-08-14). A corrupted .next does not announce itself. It shows up as a plain
 * 404 on a route whose page.tsx is right there on disk - which reads exactly like a routing bug and
 * sends you hunting through the router instead of the cache. It cost real debugging time on
 * 2026-08-13. The recovery is always the same (wipe .next, restart), so it is a script rather than
 * folklore in a handoff doc.
 *
 * Reach for `pnpm dev:fresh` when the dev server disagrees with the filesystem: a route 404s but
 * the file exists, a deleted component still renders, or a build error names a file you already
 * fixed. Ordinary work should still use `pnpm dev` - this throws away the whole cache, so the next
 * start is a cold rebuild.
 *
 * Not handled here, because Next.js 16 already handles it: starting a SECOND dev server in this
 * same folder. Next detects it, prints the PID holding the port, and exits - so it can no longer
 * be the cause of a scribbled-over cache.
 *
 * How it connects: package.json `dev:fresh` runs this and then `next dev`. Zero dependencies, so
 * it cannot itself be the thing that breaks before the server starts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(root, ".next");

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[clean-next] cleared .next - the next start rebuilds from scratch.");
} else {
  console.log("[clean-next] no .next to clear.");
}
