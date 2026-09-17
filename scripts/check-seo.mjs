/**
 * scripts/check-seo.mjs - every public page answers the SEO questions; every private one says noindex.
 *
 * WHY (owner rule R23, the SEO half, 2026-09-17). The rule reads: server-rendered title,
 * description, canonical, OG, JSON-LD from real fields, sitemap or noindex. The pieces existed
 * (lib/seo.ts builds all of them; six entity pages emit JSON-LD) but nothing held them, and the
 * CLAUDE.md row still said "0 JSON-LD blocks" because a grep for the literal string cannot see the
 * jsonLd() helper. On 2026-09-17 the survey behind this checker found /orders, /shop/cart,
 * /shop/saved, the team settings pages, the partner credentials page and a bare /invite that
 * rendered the word "page", all indexable, and five real public pages missing from the sitemap.
 *
 * WHAT IT READS. The app tree, offline: every page.tsx under app/(user) and app/(root), and for
 * each one the metadata it will render, resolved the way Next resolves it (the page's own export,
 * else the nearest ancestor layout's). hreflang is not asked for: the locale is a cookie
 * (NEXT_LOCALE), every language answers on ONE address, so there is no alternate URL to declare.
 *
 * THE RULES
 *   BLOCKING  a page with no metadata source at all (no title anywhere above it)
 *   BLOCKING  an indexable page with no dynamic segment that app/sitemap.ts does not list:
 *             a new public page goes in the sitemap, or it says noindex (privatePageMetadata)
 *   BLOCKING  a noindex page that app/sitemap.ts lists (the two answers contradict)
 *   LEDGERED  seo.entity.no_jsonld: an indexable entity page (dynamic segment) whose page or
 *             layout emits no jsonLd(...). Counted, so it can only fall (R32).
 *
 *   --live [origin]   fetch the sitemap's static routes plus the first URL of each entity kind
 *                     from the DEPLOYED site and check the rendered HTML: <title>, description,
 *                     canonical, og:title, og:image, and JSON-LD on entity pages. Network; not
 *                     part of check-all. Default origin: https://africanfreefirecommunity.com.
 *
 * USAGE   node scripts/check-seo.mjs [--json]      offline, read by scripts/check-all.mjs (step seo)
 *         node scripts/check-seo.mjs --live         the deployed site
 *         node scripts/check-seo.mjs --self-test    the rules against a fixture tree, both ways (R28)
 *
 * KNOWN LIMIT. The sitemap's static list is read out of app/sitemap.ts by pattern (`path: "..."`
 * inside the staticRoutes literal); the file cannot be imported because it fetches. The count of
 * matches is asserted against the number of `{ path:` rows in that literal (R47), so a rewrite of
 * the literal that the pattern cannot read fails loudly rather than passing with zero routes.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const GROUPS = ["(user)", "(root)"];
const DEFAULT_ORIGIN = "https://africanfreefirecommunity.com";
const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);
const norm = (s) => s.split(BS).join("/");

// ── the pages and what each will render ──
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}
const hasMeta = (t) => /export\s+(async\s+)?function\s+generateMetadata|export\s+const\s+metadata/.test(t);
// robots is decided by the nearest file that sets it: privatePageMetadata and `index: false`
// say noindex; generatePageMetadata (index: true unless noIndex) and an explicit robots: block
// say index. A title-only export inherits from the layout above it, the way Next merges.
const setsRobots = (t) => /privatePageMetadata\(|robots:|noIndex:\s*true|generatePageMetadata\(/.test(t);
const saysNoindex = (t) => /privatePageMetadata\(|noIndex:\s*true|index:\s*false/.test(t);

function routeOf(APP, pagePath) {
  const rel = norm(relative(APP, dirname(pagePath)));
  const segs = rel.split("/").filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segs.join("/");
}

function resolve(ROOT, pagePath) {
  const APP = join(ROOT, "app");
  let dir = dirname(pagePath);
  let source = null;
  let robots = null;
  let jsonld = false;
  while (dir.length >= APP.length) {
    const files = dir === dirname(pagePath) ? ["page.tsx", "layout.tsx"] : ["layout.tsx"];
    for (const f of files) {
      const fp = join(dir, f);
      if (!existsSync(fp)) continue;
      const t = readFileSync(fp, "utf8");
      if (/jsonLd\(/.test(t)) jsonld = true;
      if (!source && hasMeta(t)) source = norm(relative(ROOT, fp));
      if (robots === null && hasMeta(t) && setsRobots(t)) robots = saysNoindex(t) ? "noindex" : "index";
    }
    dir = dirname(dir);
  }
  return { source, robots: robots ?? "index", jsonld };
}

// ── the sitemap's static list ──
function sitemapStaticRoutes(ROOT) {
  const text = readFileSync(join(ROOT, "app", "sitemap.ts"), "utf8");
  const decl = text.indexOf("const staticRoutes");
  const start = decl < 0 ? -1 : text.indexOf("= [", decl);
  const end = start < 0 ? -1 : text.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("app/sitemap.ts: the staticRoutes literal was not found");
  const literal = text.slice(start, end);
  const paths = [...literal.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
  const rows = (literal.match(/\{\s*path:/g) || []).length;
  if (paths.length !== rows) throw new Error(`app/sitemap.ts: ${rows} rows in staticRoutes but ${paths.length} readable paths`);
  return new Set(paths);
}

function scan(ROOT) {
  const APP = join(ROOT, "app");
  const pages = GROUPS.filter((g) => existsSync(join(APP, g))).flatMap((g) => walk(join(APP, g))).sort();
  const listed = sitemapStaticRoutes(ROOT);
  const blocking = [];
  const noJsonLd = [];
  const rows = [];
  for (const p of pages) {
    const rel = norm(relative(ROOT, p));
    const route = routeOf(APP, p);
    const dynamic = /\[[^\]]+\]/.test(route);
    const r = resolve(ROOT, p);
    rows.push({ file: rel, route, dynamic, ...r });
    if (!r.source) { blocking.push(`NO-METADATA ${rel}: no title anywhere above it`); continue; }
    if (!dynamic && r.robots === "index" && !listed.has(route)) blocking.push(`NOT-IN-SITEMAP ${route} (${rel}): add it to app/sitemap.ts or export privatePageMetadata`);
    if (!dynamic && r.robots === "noindex" && listed.has(route)) blocking.push(`CONTRADICTION ${route} (${rel}): noindex but listed in app/sitemap.ts`);
    if (dynamic && r.robots === "index" && !r.jsonld) noJsonLd.push(route);
  }
  return { blocking, noJsonLd, pages: rows.length, indexable: rows.filter((r) => r.robots === "index").length, rows };
}

// ── the deployed site ──
async function live(origin) {
  const get = async (url) => {
    const res = await fetch(url, { headers: { "user-agent": "afc-check-seo/1 (+scripts/check-seo.mjs)" }, redirect: "follow" });
    return { status: res.status, html: await res.text(), url: res.url };
  };
  const sm = await get(`${origin}/sitemap.xml`);
  if (sm.status !== 200) { console.log(`LIVE ${origin}/sitemap.xml answered ${sm.status}`); return 1; }
  const locs = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const kinds = ["/tournaments/", "/teams/", "/organizations/", "/news/", "/players/", "/shop/"];
  const sample = new Set();
  for (const u of locs) {
    const path = u.replace(origin, "");
    const kind = kinds.find((k) => path.startsWith(k) && path.length > k.length);
    if (!kind) { sample.add(u); continue; }
    if (![...sample].some((s) => s.replace(origin, "").startsWith(kind) && s.replace(origin, "").length > kind.length)) sample.add(u);
  }
  let failures = 0;
  console.log(`LIVE ${origin}: ${locs.length} sitemap URLs, checking ${sample.size}`);
  for (const u of sample) {
    let page;
    try { page = await get(u); } catch (e) { console.log(`  FAIL ${u}: ${e.message}`); failures++; continue; }
    const h = page.html;
    const path = u.replace(origin, "");
    const entity = kinds.some((k) => path.startsWith(k) && path.length > k.length);
    const checks = {
      status: page.status === 200,
      title: /<title>[^<]+<\/title>/.test(h),
      description: /<meta\s+name="description"\s+content="[^"]+"/.test(h),
      canonical: /<link\s+rel="canonical"\s+href="[^"]+"/.test(h),
      "og:title": /property="og:title"/.test(h),
      "og:image": /property="og:image"/.test(h),
      ...(entity ? { jsonld: /<script[^>]*type="application\/ld\+json"/.test(h) } : {}),
    };
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (missing.length) failures++;
    console.log(`  ${missing.length ? "FAIL" : "ok  "} ${path || "/"}${missing.length ? "  missing: " + missing.join(", ") : ""}`);
  }
  console.log(failures ? `${failures} page(s) failed` : "every sampled page answers title, description, canonical, OG" + " and JSON-LD where it is an entity");
  return failures ? 1 : 0;
}

// ── the rules against a fixture tree: each must fire on its offender and stay quiet otherwise ──
function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "afc-check-seo-"));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  put("app/sitemap.ts", ['const staticRoutes: { path: string }[] = [', '  { path: "/listed" },', '  { path: "/contradiction" },', '];'].join(NL));
  put("app/(user)/layout.tsx", 'export const metadata = generatePageMetadata({ title: "Site" });');
  put("app/(user)/listed/page.tsx", 'export const metadata = { title: "Listed" };');            // inherits index, listed: ok
  put("app/(user)/orphan/page.tsx", 'export const metadata = { title: "Orphan" };');            // inherits index, not listed: NOT-IN-SITEMAP
  put("app/(user)/private/page.tsx", 'export const metadata = privatePageMetadata("Private");'); // noindex, not listed: ok
  put("app/(user)/contradiction/page.tsx", 'export const metadata = privatePageMetadata("X");'); // noindex but listed: CONTRADICTION
  put("app/(user)/thing/[slug]/page.tsx", ['export async function generateMetadata() {}', '<script {...jsonLd(schema)} />'].join(NL)); // entity with schema: ok
  put("app/(user)/bare/[id]/page.tsx", 'export async function generateMetadata() {}');           // entity without schema: ledgered
  put("app/(root)/page.tsx", "export default function P() {}");                                    // no metadata anywhere: NO-METADATA
  let r;
  try { r = scan(root); } finally { rmSync(root, { recursive: true, force: true }); }
  const want = ["NOT-IN-SITEMAP /orphan", "CONTRADICTION /contradiction", "NO-METADATA app/(root)/page.tsx"];
  const fired = want.map((w) => r.blocking.some((b) => b.startsWith(w)));
  const ok = fired.every(Boolean) && r.blocking.length === want.length && r.noJsonLd.length === 1 && r.noJsonLd[0] === "/bare/[id]";
  console.log(`self-test: ${ok ? "OK" : "FAILED"} (${r.blocking.length} blocking of 3 expected, ${r.noJsonLd.length} entity without JSON-LD of 1 expected)`);
  if (!ok) for (const b of r.blocking) console.log("  " + b);
  return ok;
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) process.exit(selfTest() ? 0 : 1);
if (args.includes("--live")) {
  const origin = args[args.indexOf("--live") + 1]?.startsWith("http") ? args[args.indexOf("--live") + 1] : DEFAULT_ORIGIN;
  process.exit(await live(origin.replace(/\/$/, "")));
}
const result = scan(process.cwd());
if (args.includes("--json")) {
  console.log(JSON.stringify({ blocking: result.blocking, noJsonLd: result.noJsonLd, pages: result.pages, indexable: result.indexable }));
  process.exit(0);
}
for (const b of result.blocking) console.log(b);
console.log(`${result.pages} public pages, ${result.indexable} indexable, ${result.blocking.length} blocking; entity pages without JSON-LD: ${result.noJsonLd.length}${result.noJsonLd.length ? " (" + result.noJsonLd.join(", ") + ")" : ""}`);
process.exit(result.blocking.length ? 1 : 0);
