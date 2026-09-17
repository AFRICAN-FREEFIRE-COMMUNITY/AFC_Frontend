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
 *   check-slugs     scripts/check-slugs.mjs        ledgered: a numeric id in a visible address
 *   endpoint-callers ../<backend>/tools/endpoint_callers.py  blocking; skipped with no backend tree beside this one
 *   design-lint     tools/design-lint.mjs              blocking on BLOCK / CHANGED breaches; NOTE reported (R30)
 *   security-ledger  ~/.claude/skills/security-rules (R55 to R61)  blocking when a HIGH count rose; skipped without the checker
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
  {
    // A numeric id in a visible address (owner rule R22). Both counts are LEDGERED rather than
    // blocking: the 5 public ones left are nameless things (orders, market applications) that
    // need an opaque public token on their model before their address can change, and the
    // workspace ones predate the rule. A NEW one raises the count and fails the run.
    id: "check-slugs",
    run() {
      const r = run("scripts/check-slugs.mjs", ["--json"]);
      let parsed = { fails: 0, notes: 0, hits: [] };
      try { parsed = JSON.parse(r.out.trim().split("\n").pop()); } catch { return { blocking: ["check-slugs: could not run"], counts: {} }; }
      return { blocking: [], counts: { "slugs.public": parsed.fails, "slugs.workspace": parsed.notes } };
    },
  },
  {
    // An endpoint needs a caller (owner rule R45): the backend's tools/endpoint_callers.py matched
    // against THIS tree. It needs both checkouts, so it runs where a backend tree sits beside this
    // one (a developer machine, the pre-commit hook) and reports "skipped" in a CI job that has
    // only the frontend. Blocking: an endpoint with no caller and no named consumer.
    id: "endpoint-callers",
    run() {
      const backend = ["../wt-be-ocr", "../backend"].find((d) => existsSync(join(d, "tools", "endpoint_callers.py")));
      if (!backend) return { blocking: [], counts: {}, note: "skipped: no backend tree beside this one" };
      const py = spawnSync("python", [join(backend, "tools", "endpoint_callers.py"), "--frontend", ".", "--json"], { encoding: "utf8" });
      let parsed = null;
      try { parsed = JSON.parse((py.stdout || "").trim().split("\n").pop()); } catch { return { blocking: ["endpoint-callers: could not run (python + the backend tree are needed)"], counts: {} }; }
      const blocking = (parsed.unexplained || []).map((p) => `UNCALLED ${p}  (no frontend caller, not named in tools/endpoint_consumers.json)`);
      return { blocking, counts: {}, note: `${parsed.called} of ${parsed.endpoints} endpoints called; ${parsed.uncalled} named` };
    },
  },
  {
    // A capability that must exist on both sides (owner rule R27): the backend's parity table,
    // whose frontend rows can only be read with this tree beside the backend one.
    id: "check-parity",
    run() {
      const backend = ["../wt-be-ocr", "../backend"].find((d) => existsSync(join(d, "tools", "check_parity.py")));
      if (!backend) return { blocking: [], counts: {}, note: "skipped: no backend tree beside this one" };
      const py = spawnSync("python", [join(backend, "tools", "check_parity.py"), "--frontend", ".", "--json"], { encoding: "utf8" });
      let parsed = null;
      try { parsed = JSON.parse((py.stdout || "").trim().split("\n").pop()); } catch { return { blocking: ["check-parity: could not run"], counts: {} }; }
      const blocking = (parsed.failures || []).map((f) => `PARITY ${f.capability}: built on ${f.have.join(", ") || "no side"}, missing on ${f.lack.join(", ")}`);
      return { blocking, counts: {}, note: `${parsed.ok} rows on both sides${parsed.skipped.length ? `, ${parsed.skipped.length} skipped` : ""}` };
    },
  },
  {
    // The design rules of CLAUDE.md, checked by a machine (owner rule R30, wired 2026-09-17): the
    // hairline and glow bans and the vibecoded list live in tools/design-lint.mjs. BLOCK rules and
    // CHANGED rules (judged on files this branch touched) block; NOTE rules are reported. The
    // 2026-09-03 audit was a one-off until now; this makes it run on every commit.
    id: "design-lint",
    run() {
      const r = spawnSync("node", ["tools/design-lint.mjs", "--json"], { encoding: "utf8" });
      let findings = [];
      try { findings = JSON.parse(r.stdout || "[]"); } catch { return { blocking: ["design-lint: could not run"], counts: {} }; }
      const gate = spawnSync("node", ["tools/design-lint.mjs"], { encoding: "utf8" });
      const blocking = gate.status === 0 ? [] : (gate.stdout || "").split(String.fromCharCode(10)).filter((l) => /^\s+\S+:\d+\s+\[/.test(l)).map((l) => l.trim());
      if (gate.status !== 0 && !blocking.length) blocking.push("design-lint: blocking breaches (run node tools/design-lint.mjs)");
      const notes = findings.filter((f) => f.tier === "NOTE").length;
      return { blocking, counts: {}, note: `${findings.length - notes} blocking-tier, ${notes} note(s)` };
    },
  },
  {
    // The owner's security rules R55 to R61 (2026-09-17): the global checker's ledger for THIS
    // tree and, when it sits beside us, the backend tree. `--ledger` fails only when a HIGH count
    // has RISEN since security/debt.json was written (owner rule R32); a count that fell is
    // written back. The checker lives with the owner's skills, so a machine without it (CI, a
    // fresh clone) reports "skipped" rather than blocking. Onboarding: security-rules.json and
    // security/ in each repo; the mapping table is WEBSITE/CLAUDE.md "Owner rules 55 to 61".
    id: "security-ledger",
    run() {
      const home = process.env.USERPROFILE || process.env.HOME || "";
      const checker = join(home, ".claude", "skills", "security-rules", "scripts", "check-security.mjs");
      if (!existsSync(checker)) return { blocking: [], counts: {}, note: "skipped: check-security.mjs is not installed on this machine" };
      const trees = [".", ...["../wt-be-ocr", "../backend"].filter((d) => existsSync(join(d, "security-rules.json")))];
      const blocking = [], notes = [];
      for (const dir of trees) {
        const r = spawnSync("node", [checker, "--ledger", "--quiet", "--project", dir], { encoding: "utf8" });
        const out = ((r.stdout || "") + (r.stderr || "")).trim();
        // The ledger prints one row per rule: "R60     1/0           1/0" = HIGH/MEDIUM now, then
        // at the baseline. Sum the HIGH column for the one-line note; the full table is a
        // `check-security --ledger` away.
        const highs = [...out.matchAll(/^\s*R\d\d\s+(\d+)\/(\d+)/gm)].reduce((n, m) => n + Number(m[1]), 0);
        const rows = [...out.matchAll(/^\s*R\d\d\s+\d+\/\d+/gm)].length;
        if (r.status !== 0) blocking.push(`${dir}: ${out.split(String.fromCharCode(10)).filter(Boolean).pop() || "ledger failed"}`);
        else notes.push(`${dir === "." ? "frontend" : "backend"} ${rows} rules, ${highs} high`);
      }
      return { blocking, counts: {}, note: notes.join("; ") };
    },
  },
];

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { _about: "", counts: {} };
ledger.counts ||= {};

let failed = false;
const rows = [];
for (const c of CHECKERS) {
  const { blocking, counts, note } = c.run();
  if (blocking.length) {
    failed = true;
    rows.push([c.id, "BLOCKING", `${blocking.length} hit${blocking.length === 1 ? "" : "s"}`]);
    for (const b of blocking) rows.push(["", "", "  " + b]);
  } else {
    rows.push([c.id, "ok", note || ""]);
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
