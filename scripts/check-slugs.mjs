/**
 * check-slugs.mjs - a numeric id in a visible address.
 *
 * Owner's rule R22 (2026-09-13, "slugs everywhere, ids nowhere"): no numeric id appears in a URL a
 * person can see. The slug follows the name; every old address keeps working through SlugHistory
 * (afc_auth/slugs.py); nameless things get an opaque token. This script greps the frontend for
 * addresses built from an id and grades them:
 *
 *   FAIL   on a PUBLIC surface (app/(user), app/(root), components/, lib/): an href, a router
 *          push/replace or a `path:` built with `?id=` or with `${x.id}` / `${x.<thing>_id}` /
 *          `${x._id}` inside the path.
 *   NOTE   the same shape on a workspace surface (app/(a), app/(organizer), app/(sponsor),
 *          app/(vendor)): admin and organizer routes were built on ids before the rule existed;
 *          ledgered in scripts/debt-ledger.json so the count can only come down.
 *   OK     an address built from a slug, a username, a name, or an opaque token; an external URL
 *          (gtag, embeds); a comment describing the old shape.
 *
 * The scope is deliberately the address, not the fetch: `?product_id=` on an API call is the wire,
 * not a URL a person sees, and the backend accepts ids there on purpose (legacy links resolve).
 *
 * Usage:
 *   node scripts/check-slugs.mjs               prints every hit, "check-slugs: N public ids, M workspace notes"
 *   node scripts/check-slugs.mjs --json        for check-all.mjs
 *   node scripts/check-slugs.mjs --self-test   fixtures both ways
 * Exit 1 on any FAIL.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const ROOT = opt("--root", ".");
const JSON_OUT = args.includes("--json");
const SELF_TEST = args.includes("--self-test");
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage"]);
const WORKSPACE = /^app\/\((a|organizer|sponsor|vendor)\)\//;

// Where an address is built: an href attribute, a Link/router call, a `path:`/`url:` field, or a
// redirect. The template inside is what we grade.
const ADDRESS_SITES = /(href=\{?\s*`|\.(?:push|replace|prefetch)\(\s*`|\b(?:path|url|href|pathname):\s*`|redirect\(\s*`|permanentRedirect\(\s*`)([^`]*)`/g;
// A numeric id is a MEMBER access (`x.id`, `x._id`, `x.team_id`) or an `_id` variable; a bare
// `${id}` is the route's own param, which on a slug route IS the slug (teams are addressed by
// name, products by slug), so it is not graded.
const ID_IN_PATH = /\$\{[^}]*?(?:\.(?:id|_id|[a-z]+_id)|(?<![\w.])[a-z]+_id)\b[^}]*\}/;
const QUERY_ID = /[?&]id=/;
const EXTERNAL = /^(https?:)?\/\//;

/** Grade one comment-stripped line from a file at `rel`. */
export function classify(line, rel) {
  const hits = [];
  let m;
  ADDRESS_SITES.lastIndex = 0;
  while ((m = ADDRESS_SITES.exec(line))) {
    const tpl = m[2];
    if (EXTERNAL.test(tpl.trim()) || tpl.trim().startsWith("#")) continue; // external, or an in-page anchor
    // `${product.slug || product.id}` is the fallback for an unslugged row: the slug wins when
    // present, so the id only shows on a row that has no name yet. Allowed.
    const idInPath = ID_IN_PATH.test(tpl) && !/slug\s*(\|\||\?\?)/.test(tpl);
    const queryId = QUERY_ID.test(tpl) && !/\$\{slug\}|\$\{[a-z]*slug/i.test(tpl);
    if (!idInPath && !queryId) continue;
    const grade = WORKSPACE.test(rel) ? "NOTE" : "FAIL";
    hits.push({ grade, what: `${queryId ? "?id= in" : "an id in"} the address \`${tpl.slice(0, 80)}\`` });
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
      lines.forEach((ln, i) => { for (const h of classify(ln, rel)) hits.push({ file: rel, line: i + 1, ...h }); });
    }
  }
  return hits;
}

const FIXTURES = [
  // public: FAIL
  ["<Link href={`/shop/${product.id}`}>", "app/(user)/shop/_components/ShopClient.tsx", "FAIL"],
  ["router.push(`/player-markets/${post.post_id}`)", "app/(user)/player-markets/page.tsx", "FAIL"],
  ["<Link href={`/events/view-event?id=${e.id}`}>", "app/(user)/x.tsx", "FAIL"],
  ["path: `/orders/${order.order_id}`,", "app/(user)/shop/_components/OrdersClient.tsx", "FAIL"],
  // workspace: NOTE
  ["<Link href={`${basePath}/create?id=${leaderboard.id}`}>", "app/(a)/a/leaderboards/x.tsx", "NOTE"],
  ["router.push(`/organizer/leaderboards/standalone/${lb.id}`)", "app/(organizer)/organizer/x.tsx", "NOTE"],
  // OK
  ["<Link href={`/shop/${product.slug || product.id}`}>", "app/(user)/shop/_components/ShopClient.tsx", "OK"],
  ["<Link href={`/tournaments/${event.slug}`}>", "app/(user)/x.tsx", "OK"],
  ["<Link href={`/teams/${player.team.team_name}`}>", "app/(user)/x.tsx", "OK"],
  ["<Link href={`/players/${username}`}>", "app/(user)/x.tsx", "OK"],
  ["src=\"https://www.googletagmanager.com/gtag/js?id=G-E21CNCZKFL\"", "app/layout.tsx", "OK"],
  ["embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}&theme=dark`,", "lib/videoEmbed.ts", "OK"],
  ["const res = await fetch(`${API}/shop/view-product-details/?product_id=${id}`)", "app/(user)/x.tsx", "OK"],
  ["// used to be href={`/shop/${product.id}`}", "app/(user)/x.tsx", "OK"],
  ["<Link href={`/overlay/leaderboard/${token}`}>", "app/(user)/x.tsx", "OK"],
  ["path: `/shop/${id}`,", "app/(user)/shop/[id]/page.tsx", "OK"],
  ["href={`/tournaments/${invitation.event_slug || invitation.event_id}`}", "app/(user)/x.tsx", "OK"],
  ["<a href={`#${section.id}`}>", "components/x.tsx", "OK"],
  ["href={`/teams/${userTeam.team_id}/edit`}", "app/(user)/x.tsx", "FAIL"],
];

if (SELF_TEST) {
  let failures = 0;
  for (const [code, rel, want] of FIXTURES) {
    const grades = classify(stripComments(code), rel).map((h) => h.grade);
    const got = grades.includes("FAIL") ? "FAIL" : grades.includes("NOTE") ? "NOTE" : "OK";
    if (got !== want) { failures++; console.log(`  MISS expected ${want}, got ${got}: ${code}`); }
  }
  console.log(`self-test: ${FIXTURES.length} cases, ${failures} failures`);
  process.exit(failures ? 1 : 0);
}

const hits = scan();
const fails = hits.filter((h) => h.grade === "FAIL");
const notes = hits.filter((h) => h.grade === "NOTE");
if (JSON_OUT) { console.log(JSON.stringify({ fails: fails.length, notes: notes.length, hits })); process.exit(fails.length ? 1 : 0); }
for (const h of fails) console.log(`ID-IN-URL ${h.file}:${h.line}  ${h.what}`);
for (const h of notes) console.log(`NOTE      ${h.file}:${h.line}  ${h.what}`);
console.log(`check-slugs: ${fails.length} public ids, ${notes.length} workspace notes`);
process.exit(fails.length ? 1 : 0);
