// howto/lib/sources.mjs - which files a how-to clip's screens are built from.
//
// The clips rule (owner 2026-10-12, inbox #237): "after you create a new feature or you make changes
// to an existing interface and that interface is in the clips you automatically update the clips
// too". To hold that with a check rather than a memory, every clip needs an exact answer to "which
// files is this interface", and a hand-written list would drift the first time a component moves.
// So the answer is computed:
//
//   1. each route the clip visits (meta.routes) -> its app/**/page.tsx (route groups and dynamic
//      segments resolved the way Next does)
//   2. everything those pages import, followed through "@/..." and relative imports, transitively
//      (packages in node_modules are not followed: a library bump is not an interface change)
//   3. the message files of every namespace those files translate with (messages/<loc>/<ns>.json),
//      because a changed label IS a changed interface
//   4. the clip's own script, the recorder and the overlay, and messages/<loc>/howto.json
//
// Layouts are left out on purpose: the site header, menu and footer are in every frame of every
// clip, and following them would make any change to the menu a re-render of every clip. The clips
// show TASKS; the rule follows the screens the task happens on.
//
// Over-inclusion is the safe direction: an import written inside a comment is followed too (the
// R47 trap), which can only ask for a re-render that was not needed, never miss one that was.
// Used by: howto/render.mjs (writes the hashes into clips.lock.json) and
// scripts/check-howto-clips.mjs (compares them on every check-all).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const CODE = /\.(tsx|ts|jsx|js|mjs)$/;
const LOCALES = ["en", "fr", "pt"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const posix = (p) => p.replace(/\\/g, "/");

// "/create-account" -> "app/(auth)/create-account/page.tsx". A [slug] segment matches anything.
export function pageFor(repo, route) {
  const pages = walk(join(repo, "app"))
    .filter((f) => /[\\/]page\.(tsx|ts|jsx|js)$/.test(f))
    .map((f) => posix(relative(repo, f)));
  return bestPage(pages, route);
}

// Of the page files ("app/..." paths) that could serve `route`, the one Next serves: a fixed segment
// beats a [param], decided at the first position where two candidates differ, so /teams/create is
// teams/create/page.tsx and never teams/[id]/page.tsx. Decided by specificity, NEVER by the order the
// disk lists folders in: Windows lists "create" before "[id]" and the Linux CI runner did not, so the
// first match differed between the two and team-invite read as HOWTO-STALE on CI only (12 Nov 2026,
// AFC_Frontend PR #156). Exported for the self-test, which hands it the candidates in both orders.
export function bestPage(pages, route) {
  const want = route.split("?")[0].replace(/\/+$/, "").split("/").filter(Boolean);
  const isParam = (s) => /^\[.+\]$/.test(s);
  let best = null;
  let bestRank = null;
  for (const file of [...pages].sort()) {
    // "app/(user)/teams/create/page.tsx" -> ["teams", "create"]: drop "app", the file and route groups
    const segs = file.split("/").slice(1, -1).filter((s) => s && s !== "." && !/^\(.*\)$/.test(s));
    if (segs.length !== want.length) continue;
    if (!segs.every((s, i) => s === want[i] || isParam(s))) continue;
    const rank = segs.map((s) => (isParam(s) ? "1" : "0")).join(""); // lower = more specific
    if (bestRank === null || rank < bestRank) {
      best = file;
      bestRank = rank;
    }
  }
  return best;
}

function resolveImport(repo, fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(repo, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dirname(join(repo, fromFile)), spec);
  else return null; // a package
  const tries = ["", ".tsx", ".ts", ".jsx", ".js", ".mjs", "/index.tsx", "/index.ts", "/index.js"];
  for (const t of tries) {
    const p = base + t;
    if (existsSync(p) && statSync(p).isFile()) {
      const rel = posix(relative(repo, p));
      return rel.startsWith("node_modules/") || rel.startsWith("..") ? null : rel;
    }
  }
  return null;
}

// The recorder's own output (howto/lib/publish.mjs writes the take lengths there after the lock).
// A page that shows a clip imports it, but it is not part of any interface: following it would make a
// clip stale the moment its own render published it.
const RECORDER_OUTPUTS = new Set(["lib/howto-clips.generated.json"]);

const IMPORT_RE =/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const NS_RE = /(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*?namespace:\s*)?['"]([A-Za-z0-9_]+)/g;

export function clipSources(repo, meta, clipFile) {
  const start = [];
  for (const route of meta.routes) {
    const page = pageFor(repo, route);
    if (!page) throw new Error(`howto: no page for route ${route} (clip ${meta.id})`);
    start.push(page);
  }
  const seen = new Set();
  const queue = [...start];
  const namespaces = new Set(["howto"]);
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!CODE.test(file)) continue;
    const src = readFileSync(join(repo, file), "utf8");
    for (const m of src.matchAll(IMPORT_RE)) {
      const next = resolveImport(repo, file, m[1] || m[2] || m[3]);
      if (next && !seen.has(next) && !RECORDER_OUTPUTS.has(next)) queue.push(next);
    }
    for (const m of src.matchAll(NS_RE)) namespaces.add(m[1]);
  }
  for (const ns of namespaces) {
    for (const loc of LOCALES) {
      const f = `messages/${loc}/${ns}.json`;
      if (existsSync(join(repo, f))) seen.add(f);
    }
  }
  for (const f of [posix(relative(repo, clipFile)), "howto/render.mjs", "howto/lib/overlay.mjs"]) seen.add(f);
  return [...seen].sort();
}
