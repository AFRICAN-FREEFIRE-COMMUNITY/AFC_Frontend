/**
 * check-route-segments.mjs - a person's name in an address, handled by hand.
 *
 * Owner 2026-09-30 (inbox #91), after NG.KILLA's admin page said "Player not found": "How to avoid
 * issues like this NG.KILLA's case across the entire site, it should not happen anywhere."
 *
 * Player, team and sponsor pages are addressed by a name a person typed, so the name has to be
 * percent-encoded into the address and decoded out of it. lib/routes.ts does both; this script
 * fails anything that does it by hand. The list of typed segments is lib/routeSegments.json (the
 * owning declaration, read as data, never re-typed here). Three rules, all BLOCKING:
 *
 *   UNCLASSIFIED  a dynamic folder under app/ that routeSegments.json does not name, or a key there
 *                 naming no folder. A new route is classified in the same commit that adds it.
 *   RAW-LINK      an address to a "text" route built by hand: `/teams/${name}` or "/teams/" + name,
 *                 anywhere in app/, components/, lib/ (lib/routes.ts excepted). Use teamPath() and
 *                 friends, or ${segment(x)} for a one-off. An interpolation already wrapped in
 *                 segment( or encodeURIComponent( passes.
 *   RAW-READ      a file inside a "text" route folder that reads its params (await params,
 *                 use(params), useParams) without readSegment(.
 *   BARE-DECODE   decodeURIComponent( anywhere outside lib/routes.ts. It throws URIError on a lone
 *                 "%", so a team called "100%" had no page at all; readSegment() never throws.
 *
 * Usage:
 *   node scripts/check-route-segments.mjs              prints each hit, "route-segments ok" or a count
 *   node scripts/check-route-segments.mjs --json       for check-all.mjs
 *   node scripts/check-route-segments.mjs --self-test  fixtures both ways
 * Exit 1 on any hit.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const SELF_TEST = args.includes("--self-test");
const ROOT = ".";
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage"]);
const HELPER_FILE = "lib/routes.ts";

const DECL = JSON.parse(readFileSync(join(ROOT, "lib", "routeSegments.json"), "utf8")).routes;
const TEXT_ROUTES = Object.entries(DECL).filter(([, v]) => v.kind === "text");
// Longest first, so "/a/players/" is judged before "/players/" could be.
const PREFIXES = [...new Set(TEXT_ROUTES.map(([, v]) => v.prefix))].sort((a, b) => b.length - a.length);

const posix = (p) => p.split(sep).join("/");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Comments describe old shapes on purpose; they are not code. A scanner, not a regex: a regex read
// the "/*" in a line comment mentioning "messages/*/team.json" as the start of a block comment and
// blanked the code after it. Strings and template literals are copied as they are (a link lives in
// one, and "https://" in one is not a comment). Comment characters become spaces, newlines stay,
// so line numbers still match the source.
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null; // the open string delimiter: ' " or `
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") { out += n ?? ""; i += 2; continue; }
      // ' and " strings cannot span lines, so a quote inside a regex literal (/'/g) that opened
      // a false string is closed at the line break instead of swallowing the rest of the file.
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
      continue;
    }
    if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// ── RAW-LINK ───────────────────────────────────────────────────────────────────────────────────
// A prefix not glued to a word before it ("/a/players/" does not also count as "/players/", and
// "/api/v1/r/" is not "/r/"), followed by an interpolation or a string concatenation.
function rawLinks(code) {
  const hits = [];
  for (const prefix of PREFIXES) {
    const re = new RegExp(`(?<![\\w-])${esc(prefix)}(\\$\\{|["'\`]\\s*\\+)`, "g");
    let m;
    while ((m = re.exec(code))) {
      if (m[1] === "${") {
        const after = code.slice(m.index + m[0].length, m.index + m[0].length + 40);
        if (/^\s*(segment|encodeURIComponent)\(/.test(after)) continue;
      }
      hits.push({ at: m.index, what: `${prefix}${m[1] === "${" ? "${...}" : '" + ...'} built by hand` });
    }
  }
  return hits;
}

// ── RAW-READ ───────────────────────────────────────────────────────────────────────────────────
const READS_PARAMS = /await\s+params\b|use\(\s*params\s*\)|useParams\s*[<(]|params\s*\.\s*then\(/;
function rawRead(code) {
  if (!READS_PARAMS.test(code)) return [];
  const out = [];
  if (!/readSegment\(/.test(code)) out.push("reads a typed [segment] without readSegment()");
  return out;
}

// ── BARE-DECODE ────────────────────────────────────────────────────────────────────────────────
function bareDecodes(code) {
  const out = [];
  const re = /\bdecodeURIComponent\(/g;
  let m;
  while ((m = re.exec(code))) out.push(m.index);
  return out;
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

function walk(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

function dynamicDirs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (/^\[.+\]$/.test(name)) out.push(posix(relative(join(ROOT, "app"), p)));
    dynamicDirs(p, out);
  }
  return out;
}

function scan() {
  const hits = [];
  // UNCLASSIFIED, both directions.
  const onDisk = new Set(dynamicDirs(join(ROOT, "app")));
  for (const d of onDisk) if (!DECL[d]) hits.push({ rule: "UNCLASSIFIED", file: `app/${d}`, line: 0, what: "dynamic route not in lib/routeSegments.json" });
  for (const d of Object.keys(DECL)) if (!onDisk.has(d)) hits.push({ rule: "UNCLASSIFIED", file: "lib/routeSegments.json", line: 0, what: `"${d}" names no folder under app/` });

  const textDirs = TEXT_ROUTES.map(([d]) => `app/${d}/`);
  for (const abs of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
    const rel = posix(relative(ROOT, abs));
    if (rel === HELPER_FILE) continue;
    const src = readFileSync(abs, "utf8");
    const code = stripComments(src);
    for (const h of rawLinks(code)) hits.push({ rule: "RAW-LINK", file: rel, line: lineOf(code, h.at), what: h.what });
    for (const at of bareDecodes(code)) hits.push({ rule: "BARE-DECODE", file: rel, line: lineOf(code, at), what: "decodeURIComponent() throws on a lone %: use readSegment() from lib/routes.ts" });
    // A file belongs to the NEAREST dynamic folder above it; only "text" ones are judged.
    const owner = [...onDisk].map((d) => `app/${d}/`).filter((d) => rel.startsWith(d)).sort((a, b) => b.length - a.length)[0];
    if (owner && textDirs.includes(owner)) for (const what of rawRead(code)) hits.push({ rule: "RAW-READ", file: rel, line: 0, what });
  }
  return hits;
}

// ── self-test: every rule caught, every legitimate shape passed ──────────────────────────────
const LINK_FIXTURES = [
  ["<Link href={`/teams/${team.team_name}`}>", 1],
  ["router.push(`/players/${member.username}`)", 1],
  ["<Link href={`/a/players/${player.name}`}>", 1],
  ["href={\"/teams/\" + name}", 1],
  ["href={`${origin}/teams/${t}/roster`}", 1],
  ["<Link href={`/a/sponsors/${s.username}`}>", 1],
  ["<Link href={`/teams/${encodeURIComponent(team.team_name)}`}>", 0],
  ["<Link href={`/players/${segment(u)}`}>", 0],
  ["<Link href={teamPath(team.team_name, \"/edit\")}>", 0],
  ["fetch(`${API}/team/get-team/${id}`)", 0],
  ["fetch(`${API}/api/v1/r/${code}`)", 0],
  ["<Link href={`/tournaments/${event.slug}`}>", 0],
  ["// old: href={`/teams/${name}`}", 0],
  ["// messages/*/team.json\n<Link href={`/teams/${team.team_name}`}>", 1],
  ["const q = s.replace(/'/g, \"\");\n<Link href={`/teams/${team.team_name}`}>", 1],
];
const READ_FIXTURES = [
  ["const { id } = use(params);\nconst name = decodeURIComponent(id);", 1],
  ["const { username } = await params;\nfetchPlayer(username);", 1],
  ["const { id } = await params;\nconst name = readSegment(id);", 0],
  ["const p = useParams<{ id: string }>();\nconst name = readSegment(p.id);", 0],
  ["export default function Roster({ teamName }) { return teamName; }", 0],
];

const DECODE_FIXTURES = [
  ["const name = decodeURIComponent(id);", 1],
  ["const name = readSegment(id);", 0],
  ["// we used to call decodeURIComponent(id) here", 0],
];

if (SELF_TEST) {
  let failures = 0;
  for (const [code, want] of DECODE_FIXTURES) {
    const got = bareDecodes(stripComments(code)).length;
    if (got !== want) { failures++; console.log(`  MISS decode: expected ${want}, got ${got}: ${code}`); }
  }
  for (const [code, want] of LINK_FIXTURES) {
    const got = rawLinks(stripComments(code)).length;
    if (got !== want) { failures++; console.log(`  MISS link: expected ${want}, got ${got}: ${code}`); }
  }
  for (const [code, want] of READ_FIXTURES) {
    const got = rawRead(stripComments(code)).length;
    if (got !== want) { failures++; console.log(`  MISS read: expected ${want}, got ${got}: ${code.replace(/\n/g, " | ")}`); }
  }
  const n = LINK_FIXTURES.length + READ_FIXTURES.length + DECODE_FIXTURES.length;
  console.log(failures ? `self-test: ${n} cases, ${failures} failures` : `self-test ok: ${n} cases`);
  process.exit(failures ? 1 : 0);
}

const hits = scan();
if (JSON_OUT) { console.log(JSON.stringify({ hits: hits.length, list: hits })); process.exit(hits.length ? 1 : 0); }
for (const h of hits) console.log(`${h.rule.padEnd(12)} ${h.file}${h.line ? `:${h.line}` : ""}  ${h.what}`);
console.log(hits.length ? `route-segments: ${hits.length} hit(s)` : "route-segments ok: 0 hits");
process.exit(hits.length ? 1 : 0);
