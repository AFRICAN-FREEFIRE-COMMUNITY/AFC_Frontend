/**
 * install-hooks.mjs - a pre-commit hook that runs every checker on every commit.
 *
 * Owner's rule R32 (2026-09-13): checkers are seen each time somebody submits something. This
 * writes .git/hooks/pre-commit (in the main checkout or a worktree, wherever the hooks dir really
 * is) so `node scripts/check-all.mjs` runs before each commit and stops it on a blocking hit or
 * on debt that went up. It prints the whole table every time, which is the point.
 *
 * Usage:  node scripts/install-hooks.mjs            install (idempotent)
 *         node scripts/install-hooks.mjs --uninstall remove the hook this script wrote
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const MARK = "# afc check-all pre-commit (scripts/install-hooks.mjs)";
const hooksDir = execSync("git rev-parse --git-path hooks", { encoding: "utf8" }).trim();
const hook = join(hooksDir, "pre-commit");
const uninstall = process.argv.includes("--uninstall");

if (uninstall) {
  if (existsSync(hook) && readFileSync(hook, "utf8").includes(MARK)) { unlinkSync(hook); console.log("removed", hook); }
  else console.log("no hook of ours at", hook);
  process.exit(0);
}
if (existsSync(hook) && !readFileSync(hook, "utf8").includes(MARK)) {
  console.error(`a pre-commit hook that is not ours already exists at ${hook}; not overwriting`);
  process.exit(1);
}
mkdirSync(hooksDir, { recursive: true });
// Hooks are shared by every worktree of this repo; a branch that predates the runner commits freely.
writeFileSync(hook, `#!/bin/sh\n${MARK}\n[ -f scripts/check-all.mjs ] || exit 0\nnode scripts/check-all.mjs || { echo "commit stopped by check-all (see the table above)"; exit 1; }\n`);
try { chmodSync(hook, 0o755); } catch { /* windows */ }
console.log("installed", hook);
