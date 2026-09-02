#!/usr/bin/env node
// tools/check-dashboard.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Static checks for the admin dashboard, written as a script rather than as a pile of grep
// pipelines in GATES.md.
//
// WHY A SCRIPT. The gate checks were originally shell one-liners, and half of them failed on
// Windows for shell-quoting reasons rather than for anything to do with the code, which makes a
// ledger that cannot be trusted: a red gate that is red because of a pipe character teaches you to
// ignore red gates. Node runs the same way from bash, cmd and CI.
//
// Every check prints OK or FAIL with the offending lines, and exits non-zero on any failure.
//
// Usage:  node tools/check-dashboard.mjs [check ...]     (no args = all)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DASH = join(ROOT, "app/(a)/a/dashboard/page.tsx");
const DETAIL = join(ROOT, "app/(a)/a/dashboard/[metric]/page.tsx");
const ORGANIZER = join(ROOT, "app/(organizer)/organizer/events/page.tsx");

const read = (p) => readFileSync(p, "utf8");

/** Lines matching `re`, EXCLUDING comment lines: this file's whole subject is code that lies, and
 *  a comment explaining a fixed bug must not be reported as the bug. */
function offenders(path, re) {
  return read(path)
    .split(/\r?\n/)
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => {
      const t = line.trim();
      // JSX comments open with `{/*`, and this file's whole subject is code that lies about
      // itself, so a comment DESCRIBING a fixed bug must not be reported as the bug.
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*"))
        return false;
      return re.test(line);
    })
    .map(([n, line]) => `  ${n}: ${line.trim().slice(0, 100)}`);
}

const CHECKS = {
  // A1 - no number typed into the markup.
  "fabricated-numbers": () =>
    offenders(DASH, />0 active|Top: 0|₦0|"₦0"/),

  // A2 - the mock generator and its unused state.
  "mock-data": () => offenders(DASH, /fetchWebsiteMetrics|setMetrics|ComingSoon/),

  // A3 - a control that names something it cannot reach.
  "disabled-controls": () => offenders(DASH, /\bdisabled\b/),

  // A4 - the request that reads admin data must be authed. The page must not hand-roll a header
  // either; it goes through lib/dashboard.ts, which uses the shared authHeaders().
  "authed-fetch": () => {
    const s = read(DASH);
    const bad = [];
    if (!/dashboardApi/.test(s)) bad.push("  page does not use dashboardApi (lib/dashboard.ts)");
    if (/axios\s*\(/.test(s) || /axios\.get\(/.test(s))
      bad.push("  page calls axios directly instead of going through the typed client");
    return bad;
  },

  // A5 - a swallowed failure that renders as a zero.
  "swallowed-errors": () => offenders(DASH, /catch\(\(\)\s*=>\s*null\)/),

  // A6 - an anchor inside a button. <Button> needs asChild to render AS the link.
  "nested-anchor": () => {
    const bad = [];
    for (const path of [DASH, DETAIL]) {
      const s = read(path);
      // A <Button ...> whose opening tag lacks asChild but whose body opens a <Link>.
      const re = /<Button(?![^>]*asChild)[^>]*>\s*(?:\{[^}]*\}\s*)?<Link/g;
      for (const m of s.matchAll(re)) {
        const line = s.slice(0, m.index).split(/\r?\n/).length;
        bad.push(`  ${path.split(/[\\/]/).pop()}:${line}: <Button> wraps <Link> without asChild`);
      }
    }
    return bad;
  },

  // Every card must link into a drill-down, and every link must name a metric the backend serves.
  "drilldowns-wired": () => {
    const s = read(DASH);
    // Two ways a card reaches a breakdown: the StatCard `metric` prop, and a plain <Link> for
    // the Recent Activities heading, which is a section rather than a stat card. Both count.
    const linked = [
      ...[...s.matchAll(/metric="([a-z-]+)"/g)].map((m) => m[1]),
      ...[...s.matchAll(/\/a\/dashboard\/([a-z-]+)"/g)].map((m) => m[1]),
    ];
    const unique = [...new Set(linked)];
    const registry = [...read(join(ROOT, "lib/dashboard.ts"))
      .matchAll(/^\s*"([a-z-]+)",$/gm)].map((m) => m[1]);
    const bad = [];
    for (const metric of unique) {
      if (!registry.includes(metric)) bad.push(`  links to "${metric}", not in DASHBOARD_METRICS`);
    }
    // Eleven metrics in the registry, and every one of them must be reachable from this page.
    for (const metric of registry) {
      if (!unique.includes(metric)) bad.push(`  metric "${metric}" has no link on the dashboard`);
    }
    return bad;
  },

  // The enum that started all of this. "scrim" is not a value the model declares.
  "scrims-enum": () => offenders(ORGANIZER, /===\s*"scrim"/),
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(CHECKS);
let failed = 0;

for (const name of names) {
  const check = CHECKS[name];
  if (!check) {
    console.log(`FAIL ${name}: no such check. Available: ${Object.keys(CHECKS).join(", ")}`);
    failed++;
    continue;
  }
  const bad = check();
  if (bad.length) {
    failed++;
    console.log(`FAIL ${name}`);
    bad.forEach((b) => console.log(b));
  } else {
    console.log(`OK ${name}`);
  }
}

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nOK all ${names.length} checks passed`);
