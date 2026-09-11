/**
 * check-known-bugs.mjs - runs the registry in scripts/known-bugs.json against the tree.
 *
 * Owner's workflow rule (2026-09-11): a bug met more than once gets a checker; the checker runs on
 * every push and PR; a red checker is fixed before anything else. This is the runner. It has no
 * dependencies and finishes in well under a second, so it sits as the FIRST step of the build
 * workflow and as `pnpm check:bugs` locally.
 *
 * Two kinds of check today:
 *   regex           a pattern that must not appear in the listed globs (optionally ignoring
 *                   comment lines via ignoreLineRegex)
 *   i18n-namespace  every useTranslations("a.b.c") / getTranslations("a.b.c") must resolve to an
 *                   OBJECT at messages/en/a.json -> b -> c (next-intl prints the raw key when it
 *                   does not, and nothing else catches that)
 *
 * Output on failure, one line per hit, greppable:
 *   KNOWN-BUG <id> <file>:<line>  <title>
 * followed by the fix the registry prescribes. Exit code 1 = red run.
 *
 * Usage:  node scripts/check-known-bugs.mjs [--registry scripts/known-bugs.json] [--root .]
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const ROOT = opt("--root", ".");
const REGISTRY = opt("--registry", join(ROOT, "scripts", "known-bugs.json"));
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage"]);

const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));

// ---- tiny glob: supports "dir/**/*.ext" and "dir/*.ext" only, which is all the registry uses ----
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function globToRegex(g) {
  const esc = g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.*/)?").replace(/\*/g, "[^/]*");
  return new RegExp("^" + esc + "$");
}
const allFiles = walk(ROOT).map((p) => relative(ROOT, p).split(sep).join("/"));
function filesFor(globs) {
  const res = globs.map(globToRegex);
  return allFiles.filter((f) => res.some((r) => r.test(f)));
}

// ---- checks ----
const hits = [];
function hit(bug, file, line, detail = "") {
  hits.push({ id: bug.id, file, line, title: bug.title, fix: bug.fix, detail });
}

function checkRegex(bug) {
  const re = new RegExp(bug.pattern, "u");
  const ignore = bug.ignoreLineRegex ? new RegExp(bug.ignoreLineRegex) : null;
  for (const f of filesFor(bug.globs)) {
    const lines = readFileSync(join(ROOT, f), "utf8").split("\n");
    lines.forEach((ln, i) => {
      if (ignore && ignore.test(ln)) return;
      if (re.test(ln)) hit(bug, f, i + 1, ln.trim().slice(0, 100));
    });
  }
}

function checkI18nNamespace(bug) {
  const callRe = /\b(?:useTranslations|getTranslations)\(\s*(['"])([^'"]+)\1/g;
  const cache = new Map();
  const loadNs = (root) => {
    if (cache.has(root)) return cache.get(root);
    const p = join(ROOT, bug.messagesDir, root + ".json");
    const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
    cache.set(root, v);
    return v;
  };
  for (const f of filesFor(bug.globs)) {
    const src = readFileSync(join(ROOT, f), "utf8");
    let m;
    while ((m = callRe.exec(src))) {
      const ns = m[2];
      // a call quoted inside a comment (docs, examples) is not a call
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      const lineEnd = src.indexOf("\n", m.index);
      const lineText = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      if (/^\s*(\*|\/\/|\/\*)/.test(lineText)) continue;
      // A generic parameter like useTranslations<...>() or a variable is not checkable; strings only.
      const [root, ...rest] = ns.split(".");
      let node = loadNs(root);
      if (node === null) { hit(bug, f, lineOf(src, m.index), `namespace "${ns}": messages/en/${root}.json does not exist`); continue; }
      let ok = true;
      for (const key of rest) {
        if (node && typeof node === "object" && key in node) node = node[key]; else { ok = false; break; }
      }
      if (!ok || typeof node !== "object" || node === null) {
        hit(bug, f, lineOf(src, m.index), `namespace "${ns}" does not resolve to an object in messages/en/${root}.json`);
      }
    }
  }
}
function lineOf(src, idx) { return src.slice(0, idx).split("\n").length; }

for (const bug of registry.bugs) {
  if (bug.kind === "regex") checkRegex(bug);
  else if (bug.kind === "i18n-namespace") checkI18nNamespace(bug);
  else { console.error(`unknown check kind "${bug.kind}" for ${bug.id}`); process.exit(2); }
}

if (hits.length === 0) {
  console.log(`known-bugs: ${registry.bugs.length} checks, ${allFiles.length} files, 0 hits`);
  process.exit(0);
}
const byId = new Map();
for (const h of hits) { if (!byId.has(h.id)) byId.set(h.id, []); byId.get(h.id).push(h); }
for (const [id, list] of byId) {
  for (const h of list) console.log(`KNOWN-BUG ${id} ${h.file}:${h.line}  ${h.title}${h.detail ? "  |  " + h.detail : ""}`);
  console.log(`  fix: ${list[0].fix}\n`);
}
console.log(`known-bugs: ${hits.length} hit(s) across ${byId.size} known bug(s). Fix them; do not merge around them.`);
process.exit(1);
