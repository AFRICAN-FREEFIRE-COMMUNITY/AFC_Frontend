/**
 * check-signed-out.mjs - two possibly-absent identities are never compared.
 *
 * Owner's rule R26 (2026-09-13, "a signed-out visitor never sees a control they cannot use"). The
 * class of fault this catches: `org?.owner?.username === session?.user?.username`. Signed out, both
 * sides are undefined, undefined === undefined is TRUE, and every organisation offers Manage to a
 * stranger. Optional chaining makes it likely rather than rare: `a?.b === c?.d` reads as careful
 * while being precisely the fault. It shipped fourteen times across five files on another
 * platform before its checker existed.
 *
 * What it flags (FAIL): an equality (`===`, `!==`, `==`, `!=`) whose BOTH sides contain optional
 * chaining and neither side is a literal (a string, a number, true/false/null/undefined). A
 * comparison with a literal on one side (`board?.status === "open"`) is fine: it is false for an
 * absent side. Use sameId / sameUser from lib/gating.ts, which are false unless both sides exist,
 * or guard the absent case explicitly.
 *
 * What it does NOT catch, on purpose: a write control rendered for a stranger and refused on press.
 * That is what the signed-out and middle-role Chrome walks are for (owner rule R43); wrap the
 * control in <NeedsAccount/> (components/NeedsAccount.tsx).
 *
 * Comments are stripped first (owner rule R47).
 *
 * Usage:
 *   node scripts/check-signed-out.mjs               prints every hit, "check-signed-out: N hits"
 *   node scripts/check-signed-out.mjs --json        for check-all.mjs
 *   node scripts/check-signed-out.mjs --self-test   fixtures both ways
 * Exit 1 on any hit.
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

// An operand: an identifier chain with at least one `?.`, allowing calls and index access
// (`a?.b()?.c`, `x?.[0]?.id`). Deliberately simple: the fault shape is simple.
const OPERAND = String.raw`[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*(?:\([^()]*\))?|\?\.\[[^\]]*\]|\[[^\]]*\])*`;
const CMP = new RegExp(String.raw`(${OPERAND})\s*(===|!==|==|!=)\s*(${OPERAND})`, "g");
const LITERAL = /^(["'`]|-?\d|true$|false$|null$|undefined$)/;

/** Returns the flagged comparisons on one comment-stripped line. */
export function classify(line) {
  const hits = [];
  let m;
  CMP.lastIndex = 0;
  while ((m = CMP.exec(line))) {
    const [, left, , right] = m;
    if (!left.includes("?.") || !right.includes("?.")) continue;
    if (LITERAL.test(left.trim()) || LITERAL.test(right.trim())) continue;
    hits.push({ what: `${left} ${m[2]} ${right}: both sides can be absent, and absent equals absent` });
  }
  return hits;
}

export function stripComments(src) {
  let out = "", i = 0, inBlock = false, inLine = false, inStr = null, inTpl = false;
  while (i < src.length) {
    const ch = src[i], nx = src[i + 1];
    if (inBlock) { if (ch === "*" && nx === "/") { inBlock = false; i += 2; continue; } out += ch === "\n" ? "\n" : " "; i++; continue; }
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

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
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
      const lines = stripComments(readFileSync(p, "utf8")).split("\n");
      lines.forEach((ln, i) => { for (const h of classify(ln)) hits.push({ file: rel, line: i + 1, ...h }); });
    }
  }
  return hits;
}

const FIXTURES = [
  // the fault, in its original shape and in AFC's
  ["|| org?.owner?.username === session?.user?.username", 1],
  ["return voteCategoryName?.toLowerCase() === categoryName?.toLowerCase();", 1],
  ["if (post?.author?.id !== viewer?.id) return null;", 1],
  ["const mine = team?.owner?.user_id == session?.user?.user_id;", 1],
  // fine: one side is a literal, or one side cannot be absent
  ["board?.status === \"open\" ? a : b", 0],
  ["if (e?.response?.status === 409 && e?.response?.data?.requires_force) return x;", 0],
  ["isEditUserOpen && selectedUser?.id === user.id", 0],
  ["if (details?.status === \"ACCEPTED\" || details?.status === \"REJECTED\")", 0],
  ["sameUser(org?.owner, viewer.user)", 0],
  ["// org?.owner?.username === session?.user?.username was the bug", 0],
  ["const same = a?.id === undefined;", 0],
];

if (SELF_TEST) {
  let failures = 0;
  for (const [code, want] of FIXTURES) {
    const got = classify(stripComments(code)).length;
    if ((got > 0) !== (want > 0)) { failures++; console.log(`  MISS expected ${want ? "a hit" : "clean"}: ${code}`); }
  }
  console.log(`self-test: ${FIXTURES.length} cases, ${failures} failures`);
  process.exit(failures ? 1 : 0);
}

const hits = scan();
if (JSON_OUT) { console.log(JSON.stringify({ hits: hits.length, list: hits })); process.exit(hits.length ? 1 : 0); }
for (const h of hits) console.log(`SIGNED-OUT ${h.file}:${h.line}  ${h.what}`);
console.log(`check-signed-out: ${hits.length} hit${hits.length === 1 ? "" : "s"}`);
process.exit(hits.length ? 1 : 0);
