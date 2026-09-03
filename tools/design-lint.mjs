#!/usr/bin/env node
// tools/design-lint.mjs
// ─────────────────────────────────────────────────────────────────────────────
// THE DESIGN RULES, CHECKED BY A MACHINE INSTEAD OF BY MEMORY.
//
// CLAUDE.md carries a long list of things this project does not ship: no hairline outlines, no
// glowing or pulsing accents, no em dashes, no banned typefaces. Every one of them is greppable,
// and until now nothing grepped them, so compliance depended on somebody remembering at the end of
// a long session. That is exactly when people stop remembering.
//
// WHY THREE TIERS AND NOT ONE RULE SET
//
// Measured on the repo before a line of this was written:
//
//   em / en dashes in user copy ..... 0        the rule is holding perfectly
//   pulsing / glowing accents ....... 4        real breaches, one on the public homepage
//   pulsing LOADERS ................. 2        correct, and REQUIRED by the same rules
//   thin outlines ................... 299 files  because the shadcn primitives carry a border
//
// A single blanket checker would flag the required loaders and 299 files of library default. **A
// check that reports 299 problems reports none**, and a gate that goes red for the wrong reason
// teaches you to ignore red gates. So:
//
//   BLOCK    absolutes that are already near-clean. Cheap to keep at zero.
//   CHANGED  the outline rule, judged only on files this branch touched. Nobody is asking for a
//            299-file rewrite; the ask is not to add the 300th.
//   NOTE     judgement calls. Reported, never blocking.
//
// WHAT IT CANNOT DO, said plainly: it cannot tell whether a screen LOOKS right. "Does this read as
// the same designer's work" is still eyes on a screenshot. This catches the mechanical half, which
// is the half that gets forgotten.
//
// Usage:
//   node tools/design-lint.mjs              check (block + changed + notes)
//   node tools/design-lint.mjs --all        ignore the changed-files narrowing; show every outline
//   node tools/design-lint.mjs --json       machine-readable
//   node tools/design-lint.mjs --self-test  prove the rules fire and the allowances hold
//   node tools/design-lint.mjs --baseline   rewrite the baseline from what is here now
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = join(ROOT, "tools", "design-lint-baseline.json");

const SCAN_DIRS = ["app", "components", "lib", "messages"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "__tests__", "__fixtures__"]);
const CODE_EXT = /\.(tsx|ts|jsx|js|css)$/;
const COPY_EXT = /\.json$/;

// ── rule definitions ─────────────────────────────────────────────────────────
// `where`: "code" (source files), "copy" (message JSON), or "both".
// `comments`: true when the rule applies INSIDE comments too. Only the dash rule does: CLAUDE.md
//   says "prose, code, comments, commit messages", and a comment is still read by a human. Visual
//   rules do the opposite - a blurred orb inside /* */ renders nothing at all.
// `allow`: a line-level escape hatch, so a legitimate use is not a permanent false positive.
const RULES = [
  {
    id: "em-dash",
    tier: "BLOCK",
    where: "both",
    comments: true,
    test: /[—–]/,
    says: "em or en dash. Use a comma, a colon, brackets, or a spaced hyphen.",
  },
  {
    id: "pulsing-accent",
    tier: "BLOCK",
    where: "code",
    test: /\banimate-(pulse|ping)\b/,
    // A LOADING shimmer is a different thing from a glowing accent, and the same rule set REQUIRES
    // loading states. Allowed when the line or the file says so.
    allow: (line, file) =>
      /skeleton|loading|loader|spinner/i.test(line) || /skeleton\.(tsx|ts)$/i.test(file),
    says: "pulsing accent. A live marker is a solid dot or a text label, never a pulse.",
  },
  {
    id: "decorative-blur",
    tier: "BLOCK",
    where: "code",
    test: /\bblur-(2xl|3xl)\b|filter:\s*blur\(/,
    says: "blurred decorative orb / colour bloom.",
  },
  {
    id: "glow-shadow",
    tier: "BLOCK",
    where: "code",
    // A glow is a shadow with no offset. Neutral downward elevation is fine and common.
    test: /box-shadow:\s*0\s+0\s+[1-9]|drop-shadow\(\s*0\s+0\s+[1-9]|shadow-\[0_0_[1-9]|text-shadow:\s*0\s+0\s+[1-9]/,
    says: "glow (a shadow with no offset). Elevation shadows must be offset and neutral.",
  },
  {
    id: "glow-keyframes",
    tier: "BLOCK",
    where: "code",
    test: /@keyframes\s+(glow|pulse|breathe|shimmer)\b/,
    says: "ambient animation keyframes.",
  },
  {
    id: "banned-typeface",
    tier: "BLOCK",
    where: "code",
    test: /\b(Space_Grotesk|Space Grotesk)\b|["']Geist["']|\bfont-family:[^;]*\bInter\b|next\/font\/google['"]\s*\)?[^;]*\bInter\b/,
    says: "banned typeface (Inter / Geist / Space Grotesk). This project uses DM Sans.",
  },
  {
    id: "hairline-structure",
    tier: "CHANGED",
    where: "code",
    // Structure drawn with a line. The bare `border` utility is excluded on purpose: the shadcn
    // primitives carry it, which is the 299 files, and rewriting those is not what was asked for.
    test: /\bring-[12]\b|\bdivide-[xy]\b|\bborder-dashed\b|<hr\b|\boutline:\s*1px/,
    says: "structure drawn with a line. Use a filled surface and space instead.",
  },
  {
    id: "emoji-in-ui-copy",
    tier: "NOTE",
    where: "copy",
    // Emoji as UI is banned; emoji inside real user-generated content is fine, and message files
    // are UI copy by definition. A NOTE rather than a block because a few are deliberate.
    test: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    says: "emoji used as UI. State and meaning should come from words, colour or an icon.",
  },
];

// ── file walking ─────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Blank out comments so a VISUAL rule cannot fire on code nobody renders. Replaced with spaces
 *  rather than deleted, so reported line numbers still point at the real line. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/** Files this branch actually touched, for the CHANGED tier. Falls back to "everything" when git
 *  cannot answer, because a checker that silently checks nothing is the worst outcome of all. */
function changedFiles() {
  for (const base of ["origin/master", "origin/main", "HEAD~1"]) {
    try {
      const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
        .toString().trim();
      const staged = execSync("git diff --name-only HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
        .toString().trim();
      const all = [out, staged].filter(Boolean).join("\n").split("\n").filter(Boolean);
      if (all.length) return new Set(all.map((f) => f.split("/").join(sep)));
      return new Set();
    } catch {
      /* try the next base */
    }
  }
  return null; // unknown: treat every file as changed rather than check nothing
}

// ── the scan ─────────────────────────────────────────────────────────────────
function scan() {
  const findings = [];
  const changed = changedFiles();
  const everythingChanged = changed === null || process.argv.includes("--all");

  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      // Normalised to forward slashes FIRST. Every path test below is written with `/`, and
      // relative() hands back backslashes on Windows, which silently defeated both skips.
      const rel = relative(ROOT, file).split(sep).join("/");
      const isCode = CODE_EXT.test(file);
      const isCopy = COPY_EXT.test(file);
      if (!isCode && !isCopy) continue;
      // The lint's own baseline and this file would otherwise report themselves.
      if (rel.includes("design-lint")) continue;
      // i18n source caches mirror the English file; reporting both is the same finding twice.
      if (/\/\.[^/]+\.source\.json$/.test(rel)) continue;
      // Copy is AUTHORED IN ENGLISH and machine-translated (pnpm i18n:translate), so fr/pt are
      // copies of a finding, never a finding of their own. Fix the English key and both follow.
      if (isCopy && rel.startsWith("messages/") && !rel.startsWith("messages/en/")) continue;

      const raw = readFileSync(file, "utf8");
      const stripped = isCode ? stripComments(raw) : raw;

      for (const rule of RULES) {
        if (rule.where === "code" && !isCode) continue;
        if (rule.where === "copy" && !isCopy) continue;
        if (rule.tier === "CHANGED" && !everythingChanged && !changed.has(rel)) continue;

        const haystack = rule.comments ? raw : stripped;
        haystack.split(/\r?\n/).forEach((line, i) => {
          if (!rule.test.test(line)) return;
          if (rule.allow && rule.allow(line, file)) return;
          findings.push({
            rule: rule.id,
            tier: rule.tier,
            file: rel,
            line: i + 1,
            says: rule.says,
            text: line.trim().slice(0, 110),
          });
        });
      }
    }
  }
  return findings;
}

// ── baseline ─────────────────────────────────────────────────────────────────
// Known, pre-existing breaches, listed openly with a date. The point is NOT to forgive them: it is
// so the check is green on a clean tree while the debt stays counted and visible, and so anything
// NEW fails the moment it appears. A baseline that grows is a signal; one that shrinks is progress.
const loadBaseline = () =>
  existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : { entries: [] };

const key = (f) => `${f.rule}|${f.file}`;

function writeBaseline(findings) {
  const entries = [...new Map(
    findings.filter((f) => f.tier === "BLOCK").map((f) => [key(f), {
      rule: f.rule, file: f.file, note: f.says, recorded: new Date().toISOString().slice(0, 10),
    }]),
  ).values()].sort((a, b) => key(a).localeCompare(key(b)));
  writeFileSync(BASELINE_PATH, JSON.stringify({
    why: "Pre-existing design-rule breaches, recorded so NEW ones fail immediately while these stay "
       + "visible and counted. Shrink this list; never grow it. Remove an entry when the file is fixed.",
    entries,
  }, null, 2) + "\n");
  return entries.length;
}

// ── self test ────────────────────────────────────────────────────────────────
// Proves each rule FIRES and each allowance HOLDS, against strings written here. Without this the
// lint could quietly match nothing and report a clean repo forever, which is the failure mode of
// every checker nobody checked.
function selfTest() {
  const cases = [
    ["em-dash", 'const a = "one — two";', true],
    ["em-dash", 'const a = "one - two";', false],
    ["pulsing-accent", 'className="bg-orange-500 animate-pulse"', true],
    ["pulsing-accent", 'className="bg-accent animate-pulse" // skeleton', false],
    ["pulsing-accent", '<Loader className="animate-pulse" /> {t("loading")}', false],
    ["decorative-blur", 'className="bg-green-500/20 blur-3xl rounded-full"', true],
    ["decorative-blur", 'className="rounded-full bg-green-500"', false],
    ["glow-shadow", "box-shadow: 0 0 12px #0f0;", true],
    ["glow-shadow", "box-shadow: 0 2px 8px rgba(0,0,0,.4);", false],
    // A ring drawn with a zero-blur shadow is a hairline, not a glow. Learned from a false
    // positive on the shadcn sidebar the first time this ran.
    ["glow-shadow", 'className="shadow-[0_0_0_1px_hsl(var(--border))]"', false],
    ["glow-shadow", 'className="shadow-[0_0_40px_rgba(0,0,0,.5)]"', true],
    ["glow-keyframes", "@keyframes glow {", true],
    ["banned-typeface", 'import { Space_Grotesk } from "next/font/google";', true],
    ["banned-typeface", 'import { DM_Sans } from "next/font/google";', false],
    ["hairline-structure", 'className="ring-1 ring-white/10"', true],
    ["hairline-structure", "<hr />", true],
    ["hairline-structure", 'className="rounded-md bg-muted/40 p-2"', false],
    ["emoji-in-ui-copy", '"openTitle": "\u{1F7E2} Transfer window is OPEN"', true],
    ["emoji-in-ui-copy", '"openTitle": "Transfer window is OPEN"', false],
  ];
  let bad = 0;
  for (const [id, line, shouldFire] of cases) {
    const rule = RULES.find((r) => r.id === id);
    const fired = rule.test.test(line) && !(rule.allow && rule.allow(line, "x.tsx"));
    if (fired !== shouldFire) {
      bad++;
      console.log(`  FAIL ${id}: expected ${shouldFire ? "a hit" : "no hit"} for ${line}`);
    }
  }
  console.log(bad ? `\n${bad} self-test case(s) failed` : `OK self-test: ${cases.length} cases, every rule fires and every allowance holds`);
  return bad === 0;
}

// ── main ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

if (argv.includes("--help")) {
  console.log("design-lint - the CLAUDE.md design rules, checked by a machine.\n" +
    "  (no flags)     BLOCK rules everywhere, CHANGED rules on touched files, NOTE rules reported\n" +
    "  --all          check CHANGED rules across the whole repo too\n" +
    "  --json         machine-readable output\n" +
    "  --self-test    prove the rules fire and the allowances hold\n" +
    "  --baseline     rewrite the baseline from what exists now");
  process.exit(0);
}

if (argv.includes("--self-test")) process.exit(selfTest() ? 0 : 1);

const findings = scan();

if (argv.includes("--baseline")) {
  const n = writeBaseline(findings);
  console.log(`baseline written: ${n} pre-existing BLOCK breach(es) recorded in tools/design-lint-baseline.json`);
  process.exit(0);
}

if (argv.includes("--json")) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(0);
}

const baseline = new Set(loadBaseline().entries.map(key));
const isKnown = (f) => f.tier === "BLOCK" && baseline.has(key(f));

const blocking = findings.filter((f) => (f.tier === "BLOCK" && !isKnown(f)) || f.tier === "CHANGED");
const known = findings.filter(isKnown);
const notes = findings.filter((f) => f.tier === "NOTE");

const show = (list, heading) => {
  if (!list.length) return;
  console.log(`\n${heading}`);
  for (const f of list) console.log(`  ${f.file}:${f.line}  [${f.rule}] ${f.says}\n      ${f.text}`);
};

show(blocking, "BLOCKING");
show(notes, "NOTES (not blocking)");

if (known.length) {
  console.log(`\nKNOWN, already recorded in the baseline (${known.length}). Fix and remove the entry:`);
  for (const f of known) console.log(`  ${f.file}:${f.line}  [${f.rule}]`);
}

if (blocking.length) {
  console.log(`\n${blocking.length} blocking design-rule breach(es).`);
  process.exit(1);
}
console.log(`\nOK design-lint: nothing blocking${known.length ? `, ${known.length} known in baseline` : ""}${notes.length ? `, ${notes.length} note(s)` : ""}.`);
