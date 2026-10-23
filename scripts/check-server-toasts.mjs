/**
 * scripts/check-server-toasts.mjs - toasts that print a raw server sentence, counted so the number
 * can only fall (owner rule R32).
 *
 * WHY (inbox #257, 2026-10-16). The backend answers in English, so `toast.success(res.data.message)`
 * shows English on the French and Portuguese site: "Login successful", "Team successfully
 * registered (squad). Discord roles queued." The fix is a stable `code` on the answer and
 * lib/i18n/serverMessage.ts (useServerMessage), which prints our own en/fr/pt sentence for the code
 * and falls back to the server's. On 2026-10-16 the sign-in, sign-up, verification, password-reset
 * and event-registration toasts moved over; about 75 other screens still print a raw sentence. This
 * counts them; scripts/check-all.mjs ledgers the count as `toasts.raw_server_message`.
 *
 * WHAT IT COUNTS: a toast.success / toast.info / toast.message whose WHOLE argument is a server
 * sentence (`x.data.message`, `data?.message`, `res.data.message || ...`). An error toast is not
 * counted here: refusals are R35's job (codes on 4xx, ledgered as refusals.uncoded in AFC-B).
 *
 * USAGE   node scripts/check-server-toasts.mjs [--json]
 *         node scripts/check-server-toasts.mjs --self-test
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);

// Comments out (keeping their line breaks, so line numbers stay true), strings kept verbatim. A
// scanner rather than a regex: "image/*" or "https://..." inside a string must not open a comment.
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== NL) i++; continue; }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === BS) j++;
        else if (c !== "`" && src[j] === NL) break;
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
const norm = (p) => p.split(BS).join("/");
const RAW = /toast\.(?:success|info|message)\(\s*(?:[A-Za-z_$][\w$]*\??\.)*data\??\.message\b\s*(?:\|\||,|\))/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

export function scan(ROOT) {
  const hits = [];
  for (const d of ["app", "components", "lib", "contexts"]) {
    let files = [];
    try { files = walk(join(ROOT, d)); } catch { continue; }
    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8"));
      for (const m of code.matchAll(RAW)) {
        hits.push({ file: norm(relative(ROOT, f)), line: code.slice(0, m.index).split(NL).length });
      }
    }
  }
  return hits;
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "afc-server-toasts-"));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  put("app/a.tsx", [
    "toast.success(res.data.message);",                       // counted
    "toast.success(response.data?.message || t('x'));",         // counted
    "toast.info(data.message);",                              // counted
    "toast.success(serverMessage(res.data));",                // translated: not counted
    "toast.error(err.response.data.message);",                // a refusal: not this checker's job
    "// toast.success(res.data.message) in a comment",        // comment: not counted
  ].join(NL));
  let hits;
  try { hits = scan(root); } finally { rmSync(root, { recursive: true, force: true }); }
  const ok = hits.length === 3 && hits.map((h) => h.line).join(",") === "1,2,3";
  console.log(`self-test: ${ok ? "OK" : "FAILED"} (${hits.length} of 3 expected: lines ${hits.map((h) => h.line).join(",")})`);
  return ok;
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) process.exit(selfTest() ? 0 : 1);
const hits = scan(process.cwd());
if (args.includes("--json")) {
  console.log(JSON.stringify({ count: hits.length, hits }));
} else {
  for (const h of hits) console.log(`RAW-SERVER-TOAST ${h.file}:${h.line}`);
  console.log(`${hits.length} toast(s) print a raw server sentence (ledgered as toasts.raw_server_message)`);
}
