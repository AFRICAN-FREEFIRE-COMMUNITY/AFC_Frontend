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
 *   SEARCH CONSOLE RULES (2026-10-16, owner: "i dont ever want those issues happening"), blocking:
 *             REDIRECTED-LINK, NAME-PATH, SITEMAP-RAW-NAME, ROBOTS-BLOCKS-ASSET, SEARCH-ACTION,
 *             INVENTED-NUMBER and the I18N-* rules of scripts/i18n-namespaces.mjs (see staticRules).
 *
 *   --live [origin]   the DEPLOYED site read as Googlebot, one rule per Search Console report
 *                     (hosts, API noindex, EVERY sitemap address, titles, canonicals, robots,
 *                     declared images, Product data, same-site links) plus two ledgered counts in
 *                     scripts/seo-live-ledger.json. --update-ledger records a count that fell.
 *                     Network; not part of check-all; run daily by .github/workflows/seo-live.yml.
 *   --lighthouse [origin]  Lighthouse phone runs of the landing, a team and a tournament page:
 *                     layout shift over 0.1 fails, LCP is printed (lab trend).
 *
 * USAGE   node scripts/check-seo.mjs [--json]      offline, read by scripts/check-all.mjs (step seo)
 *         node scripts/check-seo.mjs --live         the deployed site
 *         node scripts/check-seo.mjs --lighthouse   Core Web Vitals in the lab
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
import { spawnSync } from "node:child_process";
import { check as checkI18nPayload, stripComments } from "./i18n-namespaces.mjs";

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
// Which file decides the canonical: Next merges metadata SHALLOWLY, so a page that sets no
// `alternates` inherits its nearest ancestor's canonical whole. The helpers all set one.
const setsCanonical = (t) => /canonical|generatePageMetadata\(|buildEntityMetadata\(|generateDynamicMetadata\(|privatePageMetadata\(/.test(t);

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
  let canonicalFrom = null; // the route whose file sets the canonical this page will carry
  while (dir.length >= APP.length) {
    const files = dir === dirname(pagePath) ? ["page.tsx", "layout.tsx"] : ["layout.tsx"];
    for (const f of files) {
      const fp = join(dir, f);
      if (!existsSync(fp)) continue;
      const t = readFileSync(fp, "utf8");
      if (/jsonLd\(/.test(t)) jsonld = true;
      if (!source && hasMeta(t)) source = norm(relative(ROOT, fp));
      if (robots === null && hasMeta(t) && setsRobots(t)) robots = saysNoindex(t) ? "noindex" : "index";
      if (canonicalFrom === null && hasMeta(t) && setsCanonical(t)) canonicalFrom = routeOf(APP, fp);
    }
    dir = dirname(dir);
  }
  return { source, robots: robots ?? "index", jsonld, canonicalFrom };
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
    // CANONICAL-INHERITED (Search Console 2026-10-16: /brand and /partners/api named the home page
    // as their canonical): an indexable page must get its canonical from its OWN folder.
    if (r.robots === "index" && r.canonicalFrom !== route) blocking.push(`CANONICAL-INHERITED ${route} (${rel}): its canonical comes from ${r.canonicalFrom ?? "nowhere"}; set alternates.canonical for this page`);
    if (dynamic && r.robots === "index" && !r.jsonld) noJsonLd.push(route);
  }
  blocking.push(...staticRules(ROOT));
  return { blocking, noJsonLd, pages: rows.length, indexable: rows.filter((r) => r.robots === "index").length, rows };
}

// ── the Search Console rules that can be read from the code (owner, 2026-10-16, inbox #264:
//    "i dont ever want those issues happening ... automatic checks ... always checked") ──
//
//   REDIRECTED-LINK      a link to an address that only redirects (next.config.ts exact sources,
//                        and pages whose whole job is a redirect, like /contact): Search Console
//                        "Page with redirect". Link the destination.
//   NAME-PATH            a name address helper in lib/routes.ts that skips nameSegment, or a
//                        nameSegment that trims anything but TRAILING whitespace: "Alternative page
//                        with proper canonical" / "Duplicate without user-selected canonical"
//                        (space-ended team and player addresses).
//   SITEMAP-RAW-NAME     app/sitemap.ts encoding a name by hand instead of teamPath / playerPath.
//   ROBOTS-BLOCKS-ASSET  robots.ts disallowing an address lib/seo.ts hands to crawlers as an image
//                        (/api/og-image): "Blocked by robots.txt", 528 rows on 2026-10-16.
//   SEARCH-ACTION        the retired WebSite SearchAction in lib/seo.ts (its template address was
//                        crawled as a page).
//   INVENTED-NUMBER      a typed-in figure with a "+" or a money sign in page text ("1,200+",
//                        "$500K+"): the landing page showed both while production held 175 events.
//   I18N-*               scripts/i18n-namespaces.mjs: the public translation set is stale or cannot
//                        be read, which would either bloat every page again or render raw keys.
function redirectSources(ROOT) {
  const out = new Map(); // source path -> where it is declared
  const cfg = join(ROOT, "next.config.ts");
  if (existsSync(cfg)) {
    for (const m of stripComments(readFileSync(cfg, "utf8")).matchAll(/source:\s*"(\/[^"]*)"/g)) {
      if (!/[:(*]/.test(m[1])) out.set(m[1], "next.config.ts");
    }
  }
  const APP = join(ROOT, "app");
  const pages = existsSync(APP) ? walkAll(APP).filter((p) => p.endsWith("page.tsx")) : [];
  for (const p of pages) {
    const code = stripComments(readFileSync(p, "utf8"));
    // A page whose default export does nothing but redirect.
    if (/export\s+default\s+(?:async\s+)?function\s+\w*\s*\([^)]*\)\s*\{\s*(?:permanentRedirect|redirect)\(\s*"[^"]+"\s*\);?\s*\}/.test(code)) {
      const route = routeOf(APP, p);
      if (!/\[/.test(route)) out.set(route, norm(relative(ROOT, p)));
    }
  }
  return out;
}

function walkAll(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkAll(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split(NL).length;
}

export function staticRules(ROOT) {
  const findings = [];
  const sources = redirectSources(ROOT);
  const codeFiles = ["app", "components", "lib", "contexts"].flatMap((d) => (existsSync(join(ROOT, d)) ? walkAll(join(ROOT, d)) : []));

  for (const file of codeFiles) {
    const rel = norm(relative(ROOT, file));
    const raw = readFileSync(file, "utf8");
    const code = stripComments(raw);
    // REDIRECTED-LINK
    for (const m of code.matchAll(/(?:href=\{?\s*|router\.(?:push|replace)\(\s*)"(\/[^"?#]*)[^"]*"/g)) {
      const target = m[1].length > 1 ? m[1].replace(/\/$/, "") : m[1];
      const declared = sources.get(target);
      if (declared && declared !== rel) findings.push(`REDIRECTED-LINK ${rel}:${lineOf(code, m.index)} links ${target}, which only redirects (${declared}); link the destination`);
    }
    // INVENTED-NUMBER: page text only (app + components), never lib or scripts.
    if (/^(app|components)\//.test(rel) && /\.tsx$/.test(rel)) {
      for (const m of code.matchAll(/["'>]\s*((?:[$€£₦]\s?\d[\d,.]*\s?[KMB]?\+?)|(?:\d{1,3}(?:,\d{3})+\+|\d+[KMB]\+))\s*["'<]/g)) {
        if (!/[1-9]/.test(m[1])) continue; // a zero placeholder ("$0.00") invents nothing
        findings.push(`INVENTED-NUMBER ${rel}:${lineOf(code, m.index)} "${m[1]}" is typed into the page; print a real count from the API or nothing`);
      }
    }
  }

  // NAME-PATH: read the owning module and assert the counts agree (R47).
  const routes = join(ROOT, "lib", "routes.ts");
  if (existsSync(routes)) {
    const code = stripComments(readFileSync(routes, "utf8"));
    const NAME_HELPERS = ["playerPath", "teamPath", "adminPlayerPath", "adminTeamPath", "adminSponsorPath"];
    let found = 0;
    for (const name of NAME_HELPERS) {
      const m = code.match(new RegExp(`export function ${name}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`));
      if (!m) continue;
      found++;
      if (!/nameSegment\(/.test(m[1])) findings.push(`NAME-PATH lib/routes.ts ${name} builds a name address without nameSegment (space-ended addresses duplicate pages)`);
    }
    if (found !== NAME_HELPERS.length) findings.push(`NAME-PATH lib/routes.ts: ${found} of ${NAME_HELPERS.length} name helpers found; the checker cannot read the module`);
    const ns = code.match(/export function nameSegment\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
    if (!ns) findings.push("NAME-PATH lib/routes.ts has no nameSegment");
    else if (/\.trim\(\)|\.trimStart\(\)|\^\\s/.test(ns[1]) || !/\\s\+\$/.test(ns[1])) findings.push("NAME-PATH lib/routes.ts nameSegment must drop TRAILING whitespace only (leading spaces tell two usernames apart)");
  }

  // SITEMAP-RAW-NAME
  const sitemap = join(ROOT, "app", "sitemap.ts");
  if (existsSync(sitemap) && /encodeURIComponent\(/.test(stripComments(readFileSync(sitemap, "utf8")))) {
    findings.push("SITEMAP-RAW-NAME app/sitemap.ts encodes an address by hand; use teamPath / playerPath (lib/routes.ts) so the sitemap matches every link and canonical");
  }

  // ROBOTS-BLOCKS-ASSET
  const robots = join(ROOT, "app", "robots.ts");
  const seo = join(ROOT, "lib", "seo.ts");
  if (existsSync(robots) && existsSync(seo)) {
    const r = stripComments(readFileSync(robots, "utf8"));
    const listOf = (name) => {
      const m = r.match(new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
      return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
    };
    const disallow = listOf("DISALLOW");
    const allow = listOf("ALLOW");
    const assets = [...new Set([...stripComments(readFileSync(seo, "utf8")).matchAll(/["`](\/api\/[a-z0-9-]+)/g)].map((m) => m[1]))];
    for (const a of assets) {
      const d = disallow.filter((x) => !x.includes("*") && a.startsWith(x)).sort((x, y) => y.length - x.length)[0];
      const al = allow.filter((x) => a.startsWith(x)).sort((x, y) => y.length - x.length)[0];
      if (d && !(al && al.length > d.length)) findings.push(`ROBOTS-BLOCKS-ASSET app/robots.ts disallows "${d}", which blocks ${a} that lib/seo.ts gives crawlers as an image; add a longer ALLOW`);
    }
  }

  // SEARCH-ACTION
  if (existsSync(seo) && /SearchAction/.test(stripComments(readFileSync(seo, "utf8")))) {
    findings.push("SEARCH-ACTION lib/seo.ts emits the retired WebSite SearchAction; its template address gets crawled as a page");
  }

  // I18N-*: the public translation set (scripts/i18n-namespaces.mjs)
  if (existsSync(join(ROOT, "messages", "en"))) findings.push(...checkI18nPayload(ROOT).findings);

  return findings;
}

// ── the deployed site: Search Console, mirrored (owner 2026-10-16, inbox #263 #264 #266) ──
//
// Each rule is named after the Search Console report it keeps empty, and reads the site the way
// Googlebot does (its user agent, no redirect following, robots.txt honoured). Run every day by
// .github/workflows/seo-live.yml and by hand after a deploy.
//   BLOCKING
//   HOST-DUPLICATE      www.* and http:// must redirect to the https apex ("Alternative page with
//                       proper canonical", "Page with redirect" for a second copy of the site)
//   API-INDEXABLE       the API host must answer X-Robots-Tag noindex ("Crawled, not indexed")
//   SITEMAP-STATUS      every sitemap address answers 200 itself ("Not found (404)", "Page with
//                       redirect", "Soft 404")
//   SITEMAP-NOINDEX     no sitemap address says noindex ("Excluded by noindex tag")
//   SITEMAP-CANONICAL   every sitemap address names itself canonical ("Duplicate ...", "Google
//                       chose different canonical than user")
//   SITEMAP-SPACE       no sitemap address ends in a space (space-ended name addresses)
//   SITEMAP-BLOCKED     robots.txt blocks no sitemap address ("Blocked by robots.txt")
//   SOFT-404            a 200 page whose title or heading says not found
//   DUPLICATE-TITLE     two sitemap addresses share a <title> ("Google chose different canonical")
//   ASSET-BLOCKED       an og:image or JSON-LD image that robots.txt blocks ("Blocked by robots.txt")
//   PRODUCT-INCOMPLETE  Product JSON-LD without image or offers ("Merchant listings", "Product
//                       snippets"); review and rating are optional and are never invented
//   BROKEN-LINK         a same-site link in the served HTML answers 404
//   LINK-REDIRECT       a same-site link in the served HTML answers a redirect ("Page with redirect")
//   LEDGERED (scripts/seo-live-ledger.json: fail only when the count RISES, R32)
//   HEAVY-HTML          a page's HTML over HTML_BUDGET bytes (Core Web Vitals: LCP)
//   THIN-HTML           a page whose served HTML holds under THIN_CHARS characters of its own text
//                       ("Crawled / Discovered, currently not indexed", "Soft 404"): the entity
//                       pages still render in the browser, so this count is the remaining work.
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) afc-check-seo";
const HTML_BUDGET = 500 * 1024; // 2026-10-16: public pages 455 to 476 KB after the translation split; production was 850+
const THIN_CHARS = 200;
const LEDGER = join("scripts", "seo-live-ledger.json");

async function fetchRaw(url, method = "GET") {
  try {
    const res = await fetch(url, { method, redirect: "manual", headers: { "user-agent": GOOGLEBOT }, signal: AbortSignal.timeout(30000) });
    const ct = res.headers.get("content-type") || "";
    const html = method === "GET" && ct.includes("text/html") ? await res.text() : (await res.arrayBuffer().catch(() => null), "");
    return { status: res.status, location: res.headers.get("location"), xRobots: res.headers.get("x-robots-tag") || "", html };
  } catch (e) {
    return { status: 0, error: String(e.message || e), html: "", xRobots: "" };
  }
}

// robots.txt the way Google reads it: the most specific group for Googlebot (else "*"), the
// longest matching rule wins, a tie goes to Allow, "*" is any run and a final "$" anchors the end.
export function robotsMatcher(txt) {
  const groups = [];
  let cur = null;
  let agentRun = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const at = line.indexOf(":");
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const val = line.slice(at + 1).trim();
    if (key === "user-agent") {
      if (!agentRun) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      agentRun = true;
      continue;
    }
    agentRun = false;
    if (cur && (key === "allow" || key === "disallow") && val) cur.rules.push({ allow: key === "allow", pattern: val });
  }
  const group = groups.find((g) => g.agents.includes("googlebot")) || groups.find((g) => g.agents.includes("*")) || { rules: [] };
  const toRe = (p) => {
    const anchored = p.endsWith("$");
    const body = (anchored ? p.slice(0, -1) : p).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, (c) => BS + c)).join(".*");
    return new RegExp("^" + body + (anchored ? "$" : ""));
  };
  const rules = group.rules.map((r) => ({ ...r, re: toRe(r.pattern), len: r.pattern.length }));
  return (pathAndQuery) => {
    let best = null;
    for (const r of rules) {
      if (!r.re.test(pathAndQuery)) continue;
      if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = r;
    }
    return Boolean(best && !best.allow); // true = blocked
  };
}

const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const attr = (html, re) => (html.match(re) || [])[1] || null;

function readPage(html) {
  // The whole document, not the head: for Googlebot Next streams metadata, so the tags can sit at
  // the end of a long body (the first version read 400 KB and reported six canonicals missing).
  const head = html;
  const canonical = decodeEntities(attr(head, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || attr(head, /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/) || "") || null;
  const robots = attr(head, /<meta[^>]+name="robots"[^>]+content="([^"]+)"/) || "";
  const title = decodeEntities(attr(head, /<title>([^<]*)<\/title>/) || "").trim();
  const ogImage = attr(head, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  const h1 = decodeEntities((attr(html, /<h1[^>]*>([\s\S]*?)<\/h1>/) || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const ld = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { ld.push(JSON.parse(m[1])); } catch { /* a broken block is reported by the Product rule if it matters */ }
  }
  const body = html.split(/<body[^>]*>/)[1] || "";
  const own = body
    .replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<header[\s\S]*?<\/header>/g, " ").replace(/<footer[\s\S]*?<\/footer>/g, " ").replace(/<nav[\s\S]*?<\/nav>/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const links = [...body.matchAll(/<a[^>]+href="([^"#]+)"/g)].map((m) => decodeEntities(m[1]));
  return { canonical, robots, title, ogImage, h1, ld, textChars: own.length, links };
}

function imagesIn(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) { node.forEach((n) => imagesIn(n, out)); return out; }
  for (const [k, v] of Object.entries(node)) {
    if ((k === "image" || k === "logo") && typeof v === "string") out.push(v);
    else if ((k === "image" || k === "logo") && v && typeof v.url === "string") out.push(v.url);
    else if (v && typeof v === "object") imagesIn(v, out);
  }
  return out;
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const j = i++; out[j] = await fn(items[j]); }
  }));
  return out;
}

async function live(origin, { updateLedger = false } = {}) {
  const apex = new URL(origin).host;
  const blocking = [];
  const add = (rule, detail) => blocking.push(`${rule} ${detail}`);

  // ── hosts (skipped for a local build: localhost has no www twin and no API host) ──
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(apex);
  const hostCases = local ? [] : [
    [`http://${apex}/`, `https://${apex}/`],
    [`https://www.${apex}/`, `https://${apex}/`],
    [`http://www.${apex}/`, `https://${apex}/`],
    [`https://www.api.${apex}/`, `https://api.${apex}/`],
  ];
  for (const [from, want] of hostCases) {
    let url = from;
    let hops = 0;
    let r = await fetchRaw(url, "HEAD");
    while ([301, 302, 307, 308].includes(r.status) && r.location && hops < 3) {
      url = new URL(r.location, url).toString();
      hops++;
      if (url.startsWith(want)) break;
      r = await fetchRaw(url, "HEAD");
    }
    if (!url.startsWith(want)) add("HOST-DUPLICATE", `${from} does not redirect to ${want} (answered ${r.status}${r.error ? " " + r.error : ""})`);
  }
  for (const path of local ? [] : ["/", "/partner-apply/integration-guide/"]) {
    const r = await fetchRaw(`https://api.${apex}${path}`);
    if (!/noindex/i.test(r.xRobots)) add("API-INDEXABLE", `https://api.${apex}${path} answers ${r.status} without X-Robots-Tag noindex`);
  }

  // ── robots + sitemap ──
  const rb = await fetchRaw(`${origin}/robots.txt`);
  const robotsTxt = rb.status === 200 ? await (await fetch(`${origin}/robots.txt`)).text() : "";
  if (!robotsTxt) add("SITEMAP-STATUS", `${origin}/robots.txt answered ${rb.status}`);
  const blocked = robotsMatcher(robotsTxt);
  const smRes = await fetch(`${origin}/sitemap.xml`, { headers: { "user-agent": GOOGLEBOT } });
  if (smRes.status !== 200) { add("SITEMAP-STATUS", `${origin}/sitemap.xml answered ${smRes.status}`); }
  const locs = smRes.status === 200 ? [...(await smRes.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1])) : [];

  const pages = await pool(locs, 4, async (loc) => ({ loc, res: await fetchRaw(loc) }));
  const titles = new Map();
  const assets = new Set();
  const links = new Map(); // path -> first page that links it
  let heavy = 0, thin = 0;
  const heavyEx = [], thinEx = [];
  for (const { loc, res } of pages) {
    const u = new URL(loc);
    const decodedPath = (() => { try { return decodeURIComponent(u.pathname); } catch { return u.pathname; } })();
    if (/\s$/.test(decodedPath) || /%20$/.test(u.pathname)) add("SITEMAP-SPACE", loc);
    if (blocked(u.pathname + u.search)) add("SITEMAP-BLOCKED", loc);
    if (res.status !== 200) { add("SITEMAP-STATUS", `${loc} answered ${res.status}${res.location ? " -> " + res.location : ""}${res.error ? " " + res.error : ""}`); continue; }
    const p = readPage(res.html);
    if (/noindex/i.test(p.robots) || /noindex/i.test(res.xRobots)) add("SITEMAP-NOINDEX", loc);
    const same = (x, y) => x.replace(/\/$/, "") === y.replace(/\/$/, ""); // "/" and "" are one page
    if (p.canonical && !same(p.canonical, loc)) add("SITEMAP-CANONICAL", `${loc} names ${p.canonical}`);
    if (!p.canonical) add("SITEMAP-CANONICAL", `${loc} names no canonical`);
    // The site's own not-found page, not a team that happens to be called "SKILL NOT FOUND".
    if (/^404\b|page not found|could not be found/i.test(p.title) || /^(404|page not found)$/i.test(p.h1)) add("SOFT-404", `${loc} (title "${p.title}")`);
    if (p.title) titles.set(p.title, [...(titles.get(p.title) || []), loc]);
    if (res.html.length > HTML_BUDGET) { heavy++; if (heavyEx.length < 3) heavyEx.push(`${loc} ${Math.round(res.html.length / 1024)} KB`); }
    if (p.textChars < THIN_CHARS) { thin++; if (thinEx.length < 3) thinEx.push(`${loc} ${p.textChars} chars`); }
    for (const img of [p.ogImage, ...p.ld.flatMap((n) => imagesIn(n))].filter(Boolean)) assets.add(img);
    for (const node of p.ld.flat()) {
      if (node && node["@type"] === "Product") {
        const missing = ["image", "offers"].filter((k) => !node[k]);
        if (missing.length) add("PRODUCT-INCOMPLETE", `${loc} Product without ${missing.join(" and ")}`);
      }
    }
    for (const href of p.links) {
      let t;
      try { t = new URL(href, loc); } catch { continue; }
      if (t.host !== apex || t.pathname.startsWith("/_next") || t.pathname.startsWith("/api/")) continue;
      if (blocked(t.pathname + t.search)) continue; // a login link is meant to be closed to crawlers
      const key = t.pathname + t.search;
      if (!links.has(key)) links.set(key, loc);
    }
  }
  for (const [title, urls] of titles) if (urls.length > 1) add("DUPLICATE-TITLE", `"${title}" on ${urls.length} addresses, e.g. ${urls.slice(0, 2).join(" ")}`);
  for (const img of assets) {
    let t;
    try { t = new URL(img, origin); } catch { continue; }
    if (t.host === apex && blocked(t.pathname + t.search)) add("ASSET-BLOCKED", `${img} is declared to crawlers but robots.txt blocks it`);
  }
  const sitemapSet = new Set(locs.map((l) => new URL(l).pathname + new URL(l).search));
  const toProbe = [...links.keys()].filter((k) => !sitemapSet.has(k)).slice(0, 400);
  await pool(toProbe, 4, async (key) => {
    const r = await fetchRaw(origin + key, "HEAD");
    if (r.status === 404) add("BROKEN-LINK", `${key} (linked from ${links.get(key)})`);
    else if ([301, 302, 307, 308].includes(r.status)) add("LINK-REDIRECT", `${key} -> ${r.location} (linked from ${links.get(key)})`);
  });

  // ── ledger (R32): these two fail only when they rise ──
  const ledgerPath = join(process.cwd(), LEDGER);
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : {};
  const counts = { "HEAVY-HTML": heavy, "THIN-HTML": thin };
  const rose = [];
  for (const [k, v] of Object.entries(counts)) {
    if (ledger[k] !== undefined && v > ledger[k]) rose.push(`${k} rose from ${ledger[k]} to ${v}`);
  }
  if (updateLedger) {
    const next = { ...ledger, updated: new Date().toISOString().slice(0, 10) };
    for (const [k, v] of Object.entries(counts)) if (ledger[k] === undefined || v < ledger[k]) next[k] = v;
    writeFileSync(ledgerPath, JSON.stringify(next, null, 2) + NL);
  }

  // ── report ──
  const byRule = new Map();
  for (const b of blocking) { const rule = b.split(" ")[0]; byRule.set(rule, [...(byRule.get(rule) || []), b]); }
  console.log(`LIVE ${origin}: ${locs.length} sitemap addresses, ${toProbe.length} other same-site links, ${assets.size} declared images`);
  for (const [rule, list] of byRule) {
    console.log(`  ${rule}: ${list.length}`);
    for (const line of list.slice(0, 12)) console.log(`    ${line.slice(rule.length + 1)}`);
    if (list.length > 12) console.log(`    ... and ${list.length - 12} more`);
  }
  console.log(`  ledger HEAVY-HTML ${heavy} (over ${HTML_BUDGET / 1024} KB)${heavyEx.length ? ": " + heavyEx.join(", ") : ""}`);
  console.log(`  ledger THIN-HTML ${thin} (under ${THIN_CHARS} characters of their own in the served HTML)${thinEx.length ? ": " + thinEx.join(", ") : ""}`);
  for (const r of rose) console.log(`  LEDGER-ROSE ${r}`);
  const failed = blocking.length + rose.length;
  console.log(failed ? `${blocking.length} blocking finding(s), ${rose.length} ledger rise(s)` : "Search Console mirror: clean");
  return failed ? 1 : 0;
}

// ── Core Web Vitals in the lab (Lighthouse, phone profile) ──
// Field data (what Search Console shows) needs real visitors; the lab run is the daily early
// warning. Layout shift is BLOCKING over 0.1 (Google's "good" line; the footer jump measured 0.37
// on 2026-10-16). LCP is printed: a throttled lab phone reads 3 to 5 times the field number, so it
// is a trend to watch, not a pass mark.
async function lighthouse(origin) {
  const sm = await (await fetch(`${origin}/sitemap.xml`)).text();
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pick = (prefix) => locs.find((l) => new URL(l).pathname.startsWith(prefix) && new URL(l).pathname.length > prefix.length);
  const urls = [`${origin}/`, pick("/teams/"), pick("/tournaments/")].filter(Boolean);
  const dir = mkdtempSync(join(tmpdir(), "afc-lh-"));
  let failed = 0;
  for (const url of urls) {
    const out = join(dir, "lh.json");
    // NO shell (R61): the URL comes from the sitemap, i.e. from user-chosen team names. Run through
    // `pnpm seo:lighthouse`, pnpm sets npm_execpath to its own JS entry, which node runs directly
    // (this is also the only shell-free way to start pnpm on Windows, where it is a .cmd). Plain
    // `pnpm` is the fallback for Linux CI.
    const viaPnpmJs = /pnpm/i.test(process.env.npm_execpath || "");
    const [cmd, pre] = viaPnpmJs ? [process.execPath, [process.env.npm_execpath]] : ["pnpm", []];
    const r = spawnSync(cmd, [...pre, "dlx", "lighthouse@12.8.2", url, "--quiet", "--chrome-flags=--headless=new --no-sandbox", "--only-categories=performance", "--output=json", `--output-path=${out}`], { encoding: "utf8", timeout: 240000 });
    if (!existsSync(out)) { console.log(`  LIGHTHOUSE-ERROR ${url}: ${(r.stderr || r.error || "no report").toString().slice(-300)}`); failed++; continue; }
    const a = JSON.parse(readFileSync(out, "utf8")).audits;
    rmSync(out, { force: true });
    const cls = a["cumulative-layout-shift"].numericValue;
    const lcp = a["largest-contentful-paint"].numericValue;
    const bad = cls > 0.1;
    if (bad) failed++;
    console.log(`  ${bad ? "CWV-CLS" : "ok     "} ${url}  CLS ${cls.toFixed(3)}  LCP ${(lcp / 1000).toFixed(1)} s (lab phone)`);
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(failed ? `${failed} page(s) over the layout shift line or not measured` : "layout shift under 0.1 on every measured page");
  return failed ? 1 : 0;
}

// ── the rules against a fixture tree: each must fire on its offender and stay quiet otherwise ──
function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "afc-check-seo-"));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  put("app/sitemap.ts", ['const staticRoutes: { path: string }[] = [', '  { path: "/listed" },', '  { path: "/contradiction" },', '];'].join(NL));
  put("app/(user)/layout.tsx", 'export const metadata = generatePageMetadata({ title: "Site" });');
  put("app/(user)/listed/page.tsx", 'export const metadata = { title: "Listed", alternates: { canonical: "x/listed" } };'); // own canonical, listed: ok
  put("app/(user)/orphan/page.tsx", 'export const metadata = { title: "Orphan" };');            // not listed: NOT-IN-SITEMAP; canonical from the layout: CANONICAL-INHERITED
  put("app/(user)/private/page.tsx", 'export const metadata = privatePageMetadata("Private");'); // noindex, not listed: ok
  put("app/(user)/contradiction/page.tsx", 'export const metadata = privatePageMetadata("X");'); // noindex but listed: CONTRADICTION
  put("app/(user)/thing/[slug]/page.tsx", ['export async function generateMetadata() { return buildEntityMetadata({}); }', '<script {...jsonLd(schema)} />'].join(NL)); // entity with schema and its own canonical: ok
  put("app/(user)/bare/[id]/page.tsx", 'export async function generateMetadata() { return buildEntityMetadata({}); }'); // entity without schema: ledgered
  put("app/(root)/page.tsx", "export default function P() {}");                                    // no metadata anywhere: NO-METADATA
  // ── the Search Console rules (2026-10-16), each with an offender and a clean twin ──
  put("app/(user)/old/page.tsx", ['export const metadata = privatePageMetadata("Old");', 'export default function OldPage() {', '  permanentRedirect("/listed");', '}'].join(NL)); // a redirect-only page
  put("components/Links.tsx", ['<Link href="/old">bad</Link>', '<Link href="/listed">good</Link>', '// <Link href="/old"> in a comment is fine'].join(NL));
  put("components/Stats.tsx", ['<p>{"1,200+"}</p>', "<p>{count}</p>", '<span>"$500K+"</span>'].join(NL));
  put("lib/routes.ts", [
    "export function nameSegment(value) {", "  return segment(String(value).replace(/\\s+$/u, \"\"));", "}",
    "export function playerPath(u, rest = \"\") {", "  return `/players/${nameSegment(u)}${rest}`;", "}",
    "export function teamPath(t, rest = \"\") {", "  return `/teams/${segment(t)}${rest}`;", "}",
    "export function adminPlayerPath(u, rest = \"\") {", "  return `/a/players/${nameSegment(u)}${rest}`;", "}",
    "export function adminTeamPath(t, rest = \"\") {", "  return `/a/teams/${nameSegment(t)}${rest}`;", "}",
    "export function adminSponsorPath(u, rest = \"\") {", "  return `/a/sponsors/${nameSegment(u)}${rest}`;", "}",
  ].join(NL)); // teamPath skips nameSegment: NAME-PATH
  put("app/robots.ts", ['const DISALLOW: string[] = [', '  "/api/",', '];', 'const ALLOW: string[] = ["/"];'].join(NL));
  put("lib/seo.ts", ['const img = "/api/og-image?url=x";', 'const s = { "@type": "SearchAction" };'].join(NL));
  put("app/sitemap.ts", ['const staticRoutes: { path: string }[] = [', '  { path: "/listed" },', '  { path: "/contradiction" },', '];', "const u = `/teams/${encodeURIComponent(n)}`;"].join(NL));
  let r;
  try { r = scan(root); } finally { rmSync(root, { recursive: true, force: true }); }
  // robots.txt, read the way Google reads it (used by --live): longest rule wins, a tie goes to Allow.
  const blocked = robotsMatcher(["User-Agent: *", "Allow: /", "Allow: /api/og-image", "Disallow: /api/", "Disallow: /*/edit", "Disallow: /login"].join(NL));
  const robotsOk = blocked("/api/x") && !blocked("/api/og-image?url=a") && blocked("/teams/A/edit") && blocked("/login?redirect=/x") && !blocked("/teams/A") && !blocked("/");
  if (!robotsOk) console.log("  robotsMatcher: WRONG");
  const want = [
    "NOT-IN-SITEMAP /orphan", "CONTRADICTION /contradiction", "NO-METADATA app/(root)/page.tsx",
    "CANONICAL-INHERITED /orphan",
    "REDIRECTED-LINK components/Links.tsx:1 links /old",
    'INVENTED-NUMBER components/Stats.tsx:1 "1,200+"', 'INVENTED-NUMBER components/Stats.tsx:3 "$500K+"',
    "NAME-PATH lib/routes.ts teamPath",
    "SITEMAP-RAW-NAME", "ROBOTS-BLOCKS-ASSET", "SEARCH-ACTION",
  ];
  const fired = want.map((w) => r.blocking.some((b) => b.startsWith(w)));
  const ok = robotsOk && fired.every(Boolean) && r.blocking.length === want.length && r.noJsonLd.length === 1 && r.noJsonLd[0] === "/bare/[id]";
  console.log(`self-test: ${ok ? "OK" : "FAILED"} (${r.blocking.length} blocking of ${want.length} expected, ${r.noJsonLd.length} entity without JSON-LD of 1 expected)`);
  if (!ok) {
    want.forEach((w, i) => { if (!fired[i]) console.log("  DID NOT FIRE: " + w); });
    for (const b of r.blocking) console.log("  " + b);
  }
  return ok;
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) process.exit(selfTest() ? 0 : 1);
const originAfter = (flag) => (args[args.indexOf(flag) + 1]?.startsWith("http") ? args[args.indexOf(flag) + 1] : DEFAULT_ORIGIN).replace(/\/$/, "");
if (args.includes("--live")) process.exit(await live(originAfter("--live"), { updateLedger: args.includes("--update-ledger") }));
if (args.includes("--lighthouse")) process.exit(await lighthouse(originAfter("--lighthouse")));
const result = scan(process.cwd());
if (args.includes("--json")) {
  console.log(JSON.stringify({ blocking: result.blocking, noJsonLd: result.noJsonLd, pages: result.pages, indexable: result.indexable }));
  process.exit(0);
}
for (const b of result.blocking) console.log(b);
console.log(`${result.pages} public pages, ${result.indexable} indexable, ${result.blocking.length} blocking; entity pages without JSON-LD: ${result.noJsonLd.length}${result.noJsonLd.length ? " (" + result.noJsonLd.join(", ") + ")" : ""}`);
process.exit(result.blocking.length ? 1 : 0);
