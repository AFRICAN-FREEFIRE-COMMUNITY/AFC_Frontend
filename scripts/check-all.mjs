/**
 * check-all.mjs - every checker, every time, with a debt ledger nobody can ignore.
 *
 * Owner's rule R32 (2026-09-13, "a checker nobody acts on is decoration"): a checker that prints a
 * number nobody acts on is worse than none. So this runner does three things the individual
 * checkers cannot do on their own:
 *   1. every counted debt is RECORDED in scripts/debt-ledger.json with the count and the date it
 *      last moved;
 *   2. a count that goes UP fails the run, and the ceiling is NOT moved, so it keeps failing until
 *      somebody brings it back down; a count that FALLS is written back at once, so debt cannot
 *      quietly grow back;
 *   3. a count that has not moved in 7 days is named STUCK with how long it has been sitting.
 * It deliberately does not fail on debt that merely exists: a check that always fails is a check
 * people learn to skip, and then the blocking ones get skipped with it.
 *
 * Checkers today (add a row to CHECKERS when a new one lands; a catcher outside this list is a
 * catcher nobody runs):
 *   known-bugs      scripts/check-known-bugs.mjs   blocking: any hit is red (owner rule 2026-09-11)
 *   check-datetime  scripts/check-datetime.mjs     blocking on DATE faults; NUMBER notes ledgered
 *   check-signed-out scripts/check-signed-out.mjs  blocking: two possibly-absent identities compared
 *
 * Usage:
 *   node scripts/check-all.mjs            run everything, print the table, exit 1 on a breach
 *   node scripts/check-all.mjs --no-write do not update the ledger (CI on a pull request)
 * Runs from `pnpm check:all`, the pre-commit hook (scripts/install-hooks.mjs), checks.yml and the
 * first step of the production build.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const NO_WRITE = args.includes("--no-write");
const ROOT = ".";
const LEDGER = join(ROOT, "scripts", "debt-ledger.json");
const STUCK_DAYS = 7;
const today = new Date().toISOString().slice(0, 10);

function run(cmd, cmdArgs) {
  const r = spawnSync(process.execPath, [cmd, ...cmdArgs], { cwd: ROOT, encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

// Each checker returns {blocking: [...lines], counts: {name: number}}.
const CHECKERS = [
  {
    id: "known-bugs",
    run() {
      const r = run("scripts/check-known-bugs.mjs", []);
      const lines = r.out.split("\n").filter((l) => /^KNOWN-BUG /.test(l));
      return { blocking: r.code === 0 ? [] : lines.length ? lines : ["known-bugs: red run"], counts: {} };
    },
  },
  {
    id: "check-datetime",
    run() {
      const r = run("scripts/check-datetime.mjs", ["--json"]);
      let parsed = { dates: 0, numbers: 0, hits: [] };
      try { parsed = JSON.parse(r.out.trim().split("\n").pop()); } catch { return { blocking: ["check-datetime: could not run"], counts: {} }; }
      const blocking = parsed.hits.filter((h) => h.grade === "DATE").map((h) => `DATE ${h.file}:${h.line}  ${h.what}`);
      return { blocking, counts: { "datetime.numbers": parsed.numbers } };
    },
  },
  {
    id: "check-signed-out",
    run() {
      const r = run("scripts/check-signed-out.mjs", ["--json"]);
      let parsed = { hits: 0, list: [] };
      try { parsed = JSON.parse(r.out.trim().split("\n").pop()); } catch { return { blocking: ["check-signed-out: could not run"], counts: {} }; }
      return { blocking: parsed.list.map((h) => `SIGNED-OUT ${h.file}:${h.line}  ${h.what}`), counts: {} };
    },
  },
];

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { _about: "", counts: {} };
ledger.counts ||= {};

let failed = false;
const rows = [];
for (const c of CHECKERS) {
  const { blocking, counts } = c.run();
  if (blocking.length) {
    failed = true;
    rows.push([c.id, "BLOCKING", `${blocking.length} hit${blocking.length === 1 ? "" : "s"}`]);
    for (const b of blocking) rows.push(["", "", "  " + b]);
  } else {
    rows.push([c.id, "ok", ""]);
  }
  for (const [name, count] of Object.entries(counts)) {
    const prev = ledger.counts[name];
    if (!prev) {
      ledger.counts[name] = { count, ceiling: count, since: today, movedAt: today };
      rows.push([name, "debt", `${count} (first recorded ${today})`]);
      continue;
    }
    if (count > prev.ceiling) {
      failed = true;
      rows.push([name, "WENT UP", `${prev.ceiling} -> ${count}; the ceiling stays at ${prev.ceiling} until it comes back down`]);
      continue;
    }
    if (count < prev.count) {
      rows.push([name, "debt, down", `${prev.count} -> ${count}`]);
      prev.count = count; prev.ceiling = count; prev.movedAt = today;
      continue;
    }
    const days = Math.floor((Date.parse(today) - Date.parse(prev.movedAt)) / 86400000);
    if (count > 0 && days >= STUCK_DAYS) rows.push([name, "STUCK", `${count}, unchanged for ${days} days (since ${prev.movedAt})`]);
    else rows.push([name, "debt", `${count}${count ? `, last moved ${prev.movedAt}` : ""}`]);
  }
}

const w0 = Math.max(...rows.map((r) => r[0].length), 8);
const w1 = Math.max(...rows.map((r) => r[1].length), 6);
for (const [a, b, c] of rows) console.log(`${a.padEnd(w0)}  ${b.padEnd(w1)}  ${c}`);

if (!NO_WRITE) {
  ledger._about = "Every counted debt on this tree, with the count and the date it last moved (owner rule R32, 2026-09-13). Written by scripts/check-all.mjs: a count going UP fails the run and the ceiling stays; a count going DOWN is written back at once; a count unmoved for 7 days is named STUCK. Edit by bringing the number down, never by raising the ceiling.";
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
}
console.log(failed ? "check-all: FAILED" : "check-all: OK");
process.exit(failed ? 1 : 0);
