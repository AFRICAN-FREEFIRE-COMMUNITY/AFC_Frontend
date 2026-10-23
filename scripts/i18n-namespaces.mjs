/**
 * scripts/i18n-namespaces.mjs - which translation namespaces a PUBLIC page can ever ask for.
 *
 * WHY (Search Console, 2026-10-16). app/layout.tsx handed the WHOLE message catalog (94 namespaces,
 * 877 KB of English, admin and organizer screens included) to NextIntlClientProvider, and Next
 * inlines a client provider's props into every page's HTML: each public page weighed 870 KB raw,
 * 247 KB compressed, never cached, and Google measured LCP 5.9 s on phones. A visitor reading a
 * team page has no use for the admin tour or the organizer help center.
 *
 * WHAT IT DOES. Reads the import graph from every route file OUTSIDE the four workspace groups
 * ((a), (organizer), (sponsor), (vendor)), follows "@/..." and relative imports (static, dynamic,
 * re-exports), and collects every namespace a reachable file asks for:
 *   useTranslations("ns") / getTranslations("ns") / useLocalizedToast("ns")   (literal only)
 *   a dotted namespace ("ns.sub") counts as its first segment.
 * The result is written to lib/i18n/publicNamespaces.generated.json, which app/layout.tsx reads to
 * hand public pages only those namespaces; each workspace group's own layout mounts a nested
 * provider with the full catalog (components/I18nProvider.tsx WorkspaceMessages).
 *
 * THE RULES (blocking, in scripts/check-all.mjs through scripts/check-seo.mjs):
 *   I18N-PUBLIC-STALE    the generated file does not match the code: run --write and commit it
 *   I18N-DYNAMIC         a reachable file calls useTranslations/getTranslations with a NON-literal
 *                        namespace (the reader cannot know it, so the page could render raw keys);
 *                        lib/i18n/toast.ts is the one allowed wrapper, its callers are read instead
 *   I18N-UNKNOWN         a reachable literal namespace with no messages/en/<ns>.json
 *
 * USAGE   node scripts/i18n-namespaces.mjs --write     regenerate the file
 *         node scripts/i18n-namespaces.mjs             check only (exit 1 on a finding)
 *         node scripts/i18n-namespaces.mjs --json      machine output for check-seo.mjs
 *         node scripts/i18n-namespaces.mjs --self-test the rules against a fixture tree (R28)
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

export const WORKSPACE_GROUPS = ["(a)", "(organizer)", "(sponsor)", "(vendor)"];
const ROUTE_FILES = new Set([
  "page.tsx", "page.ts", "layout.tsx", "layout.ts", "template.tsx", "loading.tsx", "error.tsx",
  "not-found.tsx", "global-error.tsx", "default.tsx",
]);
const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", ".mjs", "/index.tsx", "/index.ts", "/index.js"];
const OUT = join("lib", "i18n", "publicNamespaces.generated.json");
const ALLOWED_DYNAMIC = new Set(["lib/i18n/toast.ts"]);
const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);
const norm = (p) => p.split(BS).join("/");

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

// Comments out, so a namespace named in a comment is not a namespace asked for. A real scanner,
// not a regex: a string such as accept="image/*" or "https://..." must not open a comment (the
// first version did exactly that and silently dropped half a file's imports, so ShareButton's
// namespace went missing from the public set). Strings and template literals are kept verbatim.
export function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== NL) i++;
      continue;
    }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      // Keep the comment's line breaks, so a finding's line number still points at the real line.
      out += src.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === BS) j++;
        else if (c !== "`" && src[j] === NL) break; // an unterminated quote ends at the line
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function importsOf(src) {
  const specs = new Set();
  const res = [
    /\bimport\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^"'`;]*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of res) for (const m of src.matchAll(re)) specs.add(m[1]);
  return [...specs];
}

function resolveSpec(ROOT, fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dirname(fromFile), spec);
  else return null; // a package
  for (const ext of EXTS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return /\.(tsx?|jsx?|mjs)$/.test(p) ? p : null;
  }
  return null;
}

function namespacesIn(src) {
  const code = stripComments(src);
  const literal = new Set();
  for (const m of code.matchAll(/\b(?:useTranslations|getTranslations|useLocalizedToast)\(\s*["'`]([A-Za-z0-9_.-]+)["'`]\s*[,)]/g)) {
    literal.add(m[1].split(".")[0]);
  }
  // A call whose first argument is not a plain string literal (a variable, a template with ${}).
  const dynamic = [...code.matchAll(/\b(?:useTranslations|getTranslations)\(\s*([^)\s][^)]*)\)/g)]
    .map((m) => m[1].trim())
    .filter((arg) => !/^["'`][A-Za-z0-9_.-]+["'`]\s*$/.test(arg) && !/^["'`][A-Za-z0-9_.-]+["'`]\s*,/.test(arg));
  return { literal, dynamic };
}

export function analyse(ROOT) {
  const APP = join(ROOT, "app");
  const entries = walkFiles(APP).filter((p) => {
    const rel = norm(relative(APP, p));
    if (!ROUTE_FILES.has(rel.split("/").pop())) return false;
    return !WORKSPACE_GROUPS.some((g) => rel.startsWith(g + "/"));
  });
  const seen = new Set();
  const stack = [...entries];
  const namespaces = new Set();
  const findings = [];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const rel = norm(relative(ROOT, file));
    const { literal, dynamic } = namespacesIn(src);
    for (const ns of literal) namespaces.add(ns);
    if (dynamic.length && !ALLOWED_DYNAMIC.has(rel)) {
      findings.push(`I18N-DYNAMIC ${rel}: a namespace the reader cannot see (${dynamic[0].slice(0, 60)}); pass a string literal`);
    }
    for (const spec of importsOf(stripComments(src))) {
      const target = resolveSpec(ROOT, file, spec);
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  const enDir = join(ROOT, "messages", "en");
  const all = readdirSync(enDir).filter((f) => f.endsWith(".json") && !f.startsWith(".")).map((f) => f.slice(0, -5)).sort();
  for (const ns of namespaces) if (!all.includes(ns)) findings.push(`I18N-UNKNOWN namespace "${ns}" is asked for but messages/en/${ns}.json does not exist`);
  const publicNs = [...namespaces].filter((ns) => all.includes(ns)).sort();
  const size = (list) => list.reduce((n, ns) => n + statSync(join(enDir, ns + ".json")).size, 0);
  return { public: publicNs, all, files: seen.size, entries: entries.length, findings, bytes: { public: size(publicNs), all: size(all) } };
}

function generated(r) {
  return JSON.stringify({
    _comment: "GENERATED by scripts/i18n-namespaces.mjs --write. Namespaces a public page can ask for; app/layout.tsx sends only these to the browser. Do not edit by hand.",
    public: r.public,
  }, null, 2) + "\n";
}

export function check(ROOT) {
  const r = analyse(ROOT);
  const out = join(ROOT, OUT);
  const findings = [...r.findings];
  const want = generated(r);
  const have = existsSync(out) ? readFileSync(out, "utf8").split("\r\n").join("\n") : "";
  if (have !== want) findings.push(`I18N-PUBLIC-STALE ${norm(OUT)} does not match the code: run node scripts/i18n-namespaces.mjs --write`);
  return { ...r, findings };
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "afc-i18n-ns-"));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  for (const ns of ["common", "teams", "adminOnly", "toastNs"]) put(`messages/en/${ns}.json`, "{}");
  put("app/layout.tsx", 'import { Shell } from "@/components/Shell";');
  put("components/Shell.tsx", 'const t = useTranslations("common"); // useTranslations("adminOnly") in a comment is not a use');
  put("app/(user)/teams/page.tsx", 'import X from "./_c/X";\nconst t = useTranslations("teams.list");');
  put("app/(user)/teams/_c/X.tsx", 'const toast = useLocalizedToast("toastNs");');
  put("app/(a)/a/page.tsx", 'const t = useTranslations("adminOnly");');
  put("app/(user)/bad/page.tsx", "const t = useTranslations(someVar);");
  put("app/(user)/ghost/page.tsx", 'const t = useTranslations("ghost");');
  let r1, r2;
  try {
    r1 = check(root); // no generated file yet: STALE must fire
    put(OUT.split(BS).join("/"), generated(analyse(root)));
    r2 = check(root); // written: STALE must clear, the other two must still fire
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const has = (r, p) => r.findings.some((f) => f.startsWith(p));
  const ok =
    JSON.stringify(r2.public) === JSON.stringify(["common", "teams", "toastNs"]) && // adminOnly stays out, comment ignored
    has(r1, "I18N-PUBLIC-STALE") && !has(r2, "I18N-PUBLIC-STALE") &&            // stale fires, then clears
    has(r2, "I18N-DYNAMIC app/(user)/bad/page.tsx") &&                          // a variable namespace fires
    has(r2, 'I18N-UNKNOWN namespace "ghost"');                                   // an unknown namespace fires
  console.log(`self-test: ${ok ? "OK" : "FAILED"} (public ${JSON.stringify(r2.public)}, findings ${r2.findings.length})`);
  if (!ok) for (const f of [...r1.findings, ...r2.findings]) console.log("  " + f);
  return ok;
}

const isMain = process.argv[1] && norm(resolve(process.argv[1])) === norm(resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
if (isMain) {
  const args = process.argv.slice(2);
  const ROOT = process.cwd();
  if (args.includes("--self-test")) process.exit(selfTest() ? 0 : 1);
  if (args.includes("--write")) {
    const r = analyse(ROOT);
    mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
    writeFileSync(join(ROOT, OUT), generated(r));
    console.log(`wrote ${norm(OUT)}: ${r.public.length} of ${r.all.length} namespaces public (${Math.round(r.bytes.public / 1024)} of ${Math.round(r.bytes.all / 1024)} KB English), ${r.files} files read from ${r.entries} route files`);
    for (const f of r.findings) console.log(f);
    process.exit(r.findings.length ? 1 : 0);
  }
  const r = check(ROOT);
  if (args.includes("--json")) { console.log(JSON.stringify({ findings: r.findings, public: r.public.length, all: r.all.length, bytes: r.bytes })); process.exit(0); }
  for (const f of r.findings) console.log(f);
  console.log(`${r.public.length} of ${r.all.length} namespaces public (${Math.round(r.bytes.public / 1024)} of ${Math.round(r.bytes.all / 1024)} KB), ${r.findings.length} finding(s)`);
  process.exit(r.findings.length ? 1 : 0);
}
