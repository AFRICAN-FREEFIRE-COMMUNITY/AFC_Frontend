/**
 * check-datetime.mjs - every date and time on the site goes through the timing model.
 *
 * Owner's rule R31 (2026-09-13, "one timing model"): every date and time is written and read
 * through the project's one datetime module. In AFC that is lib/i18n/time.ts (formatLocalTime,
 * formatLocalDateOnly, formatTimeInZone, getActiveLocale, getBrowserTimeZone) and the components
 * that wrap it (components/LocalTime.tsx, components/LocalEventTime.tsx). The trap this catches is
 * the one that looks fine: `new Date(iso).toLocaleDateString()` passes no locale and no zone, so it
 * renders in whatever language the DEVICE is set to, in the device's zone; a reader who picked
 * Portuguese on the site gets English dates on an English phone and it looks correct to whoever
 * built the page. There is nothing to grep for in the ordinary sense, because the bug is an
 * argument that is not there. This script greps for the calls and grades them.
 *
 * Three grades:
 *   DATE    a date or time rendered outside the model: bare toLocaleDateString / toLocaleTimeString,
 *           toLocaleString on something that is a Date (a `new Date(` on the same statement, or
 *           date-shaped options such as month:/year:/hour:), Intl.DateTimeFormat with no locale,
 *           "default", or a hardcoded string locale. These FAIL: the count must be 0.
 *   NUMBER  a number formatted with the device locale (toLocaleString on a number without a locale,
 *           Intl.NumberFormat with a hardcoded locale). Graded as NOTES: cosmetic, many, ledgered
 *           in scripts/debt-ledger.json so the count can only go down (owner's rule R32).
 *   OK      the model itself, a call that passes getActiveLocale()/a locale variable, the
 *           resolvedOptions().timeZone read (allowed, though getBrowserTimeZone() is the one door).
 *
 * Comments are stripped before matching (owner's rule R47: a checker that reads source by regex is
 * reading comments too), so a comment describing the old bug is not a hit.
 *
 * Usage:
 *   node scripts/check-datetime.mjs                 prints every hit, "check-datetime: N date faults, M number notes"
 *   node scripts/check-datetime.mjs --json          machine output for check-all.mjs
 *   node scripts/check-datetime.mjs --self-test     fixtures both ways; exits 1 on any miss
 *
 * Exit code: 1 when any DATE fault exists (the ledger decides about NUMBER notes), else 0.
 * Wired into scripts/check-all.mjs, `pnpm check:all`, checks.yml and the production build.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const ROOT = opt("--root", ".");
const JSON_OUT = args.includes("--json");
const SELF_TEST = args.includes("--self-test");

const SCAN_DIRS = ["app", "components", "contexts", "hooks", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage"]);
// The timing model and the money model: the only files allowed to talk to Intl directly.
const MODEL_FILES = new Set([
  "lib/i18n/time.ts",
  "components/LocalTime.tsx",
  "components/LocalEventTime.tsx",
  "lib/money.ts",
  "components/Money.tsx",
  "lib/currencies.ts",
  "lib/i18n/number.ts",
]);

// ── the classifier ───────────────────────────────────────────────────────────────────────────
// Each pattern is applied to a comment-stripped line plus its statement context (the previous
// two lines joined), because `new Date(x)\n  .toLocaleString()` spans lines in this codebase.
const DATE_OPTION_KEYS = /\b(weekday|year|month|day|hour|minute|second|timeZoneName|dateStyle|timeStyle)\s*:/;

/** Is the first argument of a `(...)` call a device or hardcoded locale? */
function localeArgKind(argText) {
  const a = argText.trim();
  if (a === "" || a.startsWith("undefined") || a.startsWith("null")) return "device";
  if (/^["'`]default["'`]/.test(a)) return "device";
  if (/^["'`][a-z]{2}(-[A-Za-z]{2,4})?["'`]/.test(a)) return "hardcoded";
  if (/^\{/.test(a)) return "device"; // options object passed as the first arg: no locale at all
  return "variable"; // getActiveLocale(), locale, resolvedLocale, ...
}

/** Text of the first argument of the call that starts right after `openParenIndex`. */
function firstArg(text, openParenIndex) {
  let depth = 0;
  let out = "";
  for (let i = openParenIndex + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) return out;
      depth--;
    }
    if (ch === "," && depth === 0) return out;
    out += ch;
  }
  return out;
}

/**
 * Classify one line (with `context` = the two lines before it, comment-stripped).
 * Returns [] or a list of {grade, what}.
 */
export function classify(line, context = "") {
  const hits = [];
  const joined = context + "\n" + line;
  const isDateReceiver =
    /new\s+Date\s*\(/.test(joined) || /\b(d|date|dt|when|ts|start|end|expiry|day)\s*\.\s*toLocale/.test(line);

  let m;
  const dateStr = /\.toLocale(Date|Time)String\s*\(/g;
  while ((m = dateStr.exec(line))) {
    const kind = localeArgKind(firstArg(line, m.index + m[0].length - 1));
    if (kind === "variable") continue; // a locale from the model: fine
    hits.push({ grade: "DATE", what: `.toLocale${m[1]}String(${kind === "device" ? "device locale" : "hardcoded locale"})` });
  }

  const plain = /\.toLocaleString\s*\(/g;
  while ((m = plain.exec(line))) {
    const arg = firstArg(line, m.index + m[0].length - 1);
    const kind = localeArgKind(arg);
    const rest = line.slice(m.index);
    const dateShaped = DATE_OPTION_KEYS.test(rest) || DATE_OPTION_KEYS.test(joined.slice(joined.indexOf(m[0])));
    if (isDateReceiver || dateShaped) {
      if (kind !== "variable") hits.push({ grade: "DATE", what: `.toLocaleString(${kind === "device" ? "device locale" : "hardcoded locale"}) on a date` });
    } else if (kind !== "variable") {
      hits.push({ grade: "NUMBER", what: `.toLocaleString(${kind === "device" ? "device locale" : "hardcoded locale"}) on a number` });
    }
  }

  const dtf = /Intl\.DateTimeFormat\s*\(/g;
  while ((m = dtf.exec(line))) {
    const arg = firstArg(line, m.index + m[0].length - 1);
    const after = line.slice(m.index + m[0].length);
    if (arg.trim() === "" && /^\s*\)\s*\.resolvedOptions\(\)/.test(after)) continue; // the zone read
    const kind = localeArgKind(arg);
    if (kind !== "variable") hits.push({ grade: "DATE", what: `Intl.DateTimeFormat(${kind === "device" ? "device locale" : "hardcoded locale"})` });
  }

  const nf = /Intl\.NumberFormat\s*\(/g;
  while ((m = nf.exec(line))) {
    const kind = localeArgKind(firstArg(line, m.index + m[0].length - 1));
    if (kind !== "variable") hits.push({ grade: "NUMBER", what: `Intl.NumberFormat(${kind === "device" ? "device locale" : "hardcoded locale"})` });
  }
  return hits;
}

// ── comment stripping ────────────────────────────────────────────────────────────────────────
/** Remove // and /* *\/ comments while keeping line numbers (block comments become blank lines). */
export function stripComments(src) {
  let out = "";
  let i = 0;
  let inBlock = false, inLine = false, inStr = null, inTpl = false;
  while (i < src.length) {
    const ch = src[i], nx = src[i + 1];
    if (inBlock) {
      if (ch === "*" && nx === "/") { inBlock = false; i += 2; continue; }
      out += ch === "\n" ? "\n" : " "; i++; continue;
    }
    if (inLine) { if (ch === "\n") { inLine = false; out += "\n"; } i++; continue; }
    if (inStr) { out += ch; if (ch === "\\") { out += nx ?? ""; i += 2; continue; } if (ch === inStr) inStr = null; i++; continue; }
    if (inTpl) { out += ch; if (ch === "\\") { out += nx ?? ""; i += 2; continue; } if (ch === "`") inTpl = false; i++; continue; }
    if (ch === "/" && nx === "*") { inBlock = true; i += 2; out += "  "; continue; }
    if (ch === "/" && nx === "/") { inLine = true; i += 2; continue; }
    if (ch === "\"" || ch === "'") { inStr = ch; out += ch; i++; continue; }
    if (ch === "`") { inTpl = true; out += ch; i++; continue; }
    out += ch; i++;
  }
  return out;
}

// ── the walk ─────────────────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

function scan() {
  const hits = [];
  for (const d of SCAN_DIRS) {
    let files = [];
    try { files = walk(join(ROOT, d)); } catch { continue; }
    for (const p of files) {
      const rel = relative(ROOT, p).split(sep).join("/");
      if (MODEL_FILES.has(rel)) continue;
      const lines = stripComments(readFileSync(p, "utf8")).split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ctx = lines.slice(Math.max(0, i - 2), i).join("\n");
        for (const h of classify(lines[i], ctx)) hits.push({ file: rel, line: i + 1, ...h });
      }
    }
  }
  return hits;
}

// ── self-test: fixtures from this codebase, both directions ──────────────────────────────────
const FIXTURES = [
  // must be caught as DATE
  ["new Date(invite.created_at).toLocaleString(),", "", "DATE"],
  ["{new Date(order.created_at).toLocaleDateString()}", "", "DATE"],
  ["return d.toLocaleDateString(\"default\", { month: \"short\", day: \"numeric\" });", "", "DATE"],
  ["end.toLocaleDateString(\"en-US\", { month: \"short\" })", "", "DATE"],
  ["return d.toLocaleString(undefined, { day: \"2-digit\", month: \"short\", year: \"numeric\" });", "", "DATE"],
  [").toLocaleString()", "? new Date(\n  (eventDetails as any).roster_edit_until,", "DATE"],
  ["const month = date.toLocaleString(\"default\", { month: \"long\" });", "", "DATE"],
  ["return new Intl.DateTimeFormat(undefined, { month: \"long\" }).format(d)", "", "DATE"],
  ["new Intl.DateTimeFormat(\"en-GB\", { day: \"numeric\" })", "", "DATE"],
  ["new Date(x).toLocaleTimeString()", "", "DATE"],
  // must be graded NUMBER, not DATE
  ["{preview.recipient_count.toLocaleString()}", "", "NUMBER"],
  ["const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });", "", "NUMBER"],
  ["return new Intl.NumberFormat(\"en-NG\", { style: \"currency\", currency: \"NGN\" }).format(v)", "", "NUMBER"],
  // must pass
  ["return new Intl.DateTimeFormat(getActiveLocale(), { month: \"long\", timeZone: getBrowserTimeZone() }).format(d)", "", "OK"],
  ["const fmt = (n: number, locale?: string) => n.toLocaleString(locale);", "", "OK"],
  ["timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || \"\",", "", "OK"],
  ["value={winners.length.toLocaleString(locale)}", "", "OK"],
  ["const label = formatLocalTime(order.created_at, \"datetime\");", "", "OK"],
  ["<LocalTime value={r.timestamp} />", "", "OK"],
  ["// used to call toLocaleDateString(), which follows the browser", "", "OK"],
  ["/* new Date(x).toLocaleString() was the bug */ const y = 1;", "", "OK"],
];

if (SELF_TEST) {
  let failures = 0;
  for (const [code, ctx, expect] of FIXTURES) {
    const stripped = stripComments(code);
    const hits = classify(stripped, stripComments(ctx));
    const grades = hits.map((h) => h.grade);
    const got = grades.includes("DATE") ? "DATE" : grades.includes("NUMBER") ? "NUMBER" : "OK";
    if (got !== expect) { failures++; console.log(`  MISS expected ${expect}, got ${got}: ${code}`); }
  }
  console.log(`self-test: ${FIXTURES.length} cases, ${failures} failures`);
  process.exit(failures ? 1 : 0);
}

const hits = scan();
const dates = hits.filter((h) => h.grade === "DATE");
const numbers = hits.filter((h) => h.grade === "NUMBER");
if (JSON_OUT) {
  console.log(JSON.stringify({ dates: dates.length, numbers: numbers.length, hits }));
  process.exit(dates.length ? 1 : 0);
}
for (const h of dates) console.log(`DATE    ${h.file}:${h.line}  ${h.what}`);
for (const h of numbers) console.log(`NUMBER  ${h.file}:${h.line}  ${h.what}`);
console.log(`check-datetime: ${dates.length} date faults, ${numbers.length} number notes`);
process.exit(dates.length ? 1 : 0);
