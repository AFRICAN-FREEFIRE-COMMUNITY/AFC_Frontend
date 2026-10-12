#!/usr/bin/env node
// scripts/check-howto-clips.mjs - holds the how-to clips rule (owner 2026-10-12, inbox #237):
//
//   "after you create a new feature or you make changes to an existing interface and that
//    interface is in the clips you automatically update the clips too"
//
// A rule written in a document is remembered on a good day. This makes it a red run instead. For
// every clip in howto/clips/*.mjs it asks three questions:
//
//   HOWTO-STALE    has any file the clip's screens are built from changed since the clip was last
//                  rendered in full? The file set is computed, not listed (howto/lib/sources.mjs:
//                  the pages of the clip's routes, everything they import, their message files);
//                  the hashes from the last full render live in howto/clips.lock.json. Changed,
//                  added or removed, the clip is stale until `node howto/render.mjs <clip>` runs.
//   HOWTO-HOOK     does every element the clip presses still exist? A clip finds elements by their
//                  data-howto="<id>" attribute (meta.hooks); one that left the code would make the
//                  next render fail, so it fails here first (owner brief: "a check that fails when
//                  a scripted button or field no longer exists").
//   HOWTO-CAPTION  does every caption exist in en, fr and pt, at most 8 words (owner, 2026-10-12)?
//   HOWTO-MONEY    does the clips' own invented data carry an amount of money? Owner, 2026-10-12:
//                  "i dont want fake money to be showing on the website" (the clips are shown on the
//                  site, so an invented prize reads as a real offer). Read: the seed and stack
//                  (howto/stack/*.py), the clip scripts and every locale's howto.json. A prize is
//                  "Trophy"; a currency sign or code next to a number is a hit, comments included.
//
// Blocking in scripts/check-all.mjs (step "howto-clips"), so it runs on every commit through the
// pre-commit hook, on every PR in checks.yml and before every production build.
//
//   node scripts/check-howto-clips.mjs              human output, exit 1 on any hit
//   node scripts/check-howto-clips.mjs --json       one JSON line: {fails, list: [...]}
//   node scripts/check-howto-clips.mjs --self-test  proves each rule fires, and stays quiet when clean
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clipSources } from "../howto/lib/sources.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["en", "fr", "pt"];
const MAX_WORDS = 8;
const SOURCE_DIRS = ["app", "components"];

const hashOf = (repo, f) =>
  createHash("sha256").update(readFileSync(join(repo, f), "utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(p);
  }
  return out;
}

export async function checkClips(repo) {
  const hits = [];
  const clipDir = join(repo, "howto", "clips");
  const clips = existsSync(clipDir) ? readdirSync(clipDir).filter((f) => f.endsWith(".mjs")).sort() : [];
  if (!clips.length) return hits;
  const lockFile = join(repo, "howto", "clips.lock.json");
  const lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};
  const code = SOURCE_DIRS.flatMap((d) => walk(join(repo, d))).map((f) => readFileSync(f, "utf8")).join("\n");
  const messages = Object.fromEntries(LOCALES.map((l) => {
    const f = join(repo, "messages", l, "howto.json");
    return [l, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}];
  }));

  for (const file of clips) {
    const path = join(clipDir, file);
    const { meta } = await import(pathToFileURL(path).href);
    const id = meta.id;

    // ── HOWTO-HOOK ──
    for (const hook of meta.hooks) {
      if (!code.includes(`data-howto="${hook}"`)) {
        hits.push({ rule: "HOWTO-HOOK", clip: id, what: `no element carries data-howto="${hook}" any more; the clip presses it (put the hook back on the element, or change howto/clips/${file})` });
      }
    }

    // ── HOWTO-CAPTION ──
    const en = messages.en?.clips?.[meta.messages]?.steps || {};
    if (!Object.keys(en).length) hits.push({ rule: "HOWTO-CAPTION", clip: id, what: `messages/en/howto.json has no clips.${meta.messages}.steps` });
    for (const loc of LOCALES) {
      const steps = messages[loc]?.clips?.[meta.messages]?.steps || {};
      for (const key of Object.keys(en)) {
        const text = String(steps[key] || "").trim();
        if (!text) hits.push({ rule: "HOWTO-CAPTION", clip: id, what: `${loc}: caption ${key} is missing (hand-write it, owner rule)` });
        else if (text.split(/\s+/).length > MAX_WORDS) hits.push({ rule: "HOWTO-CAPTION", clip: id, what: `${loc}: caption ${key} has ${text.split(/\s+/).length} words, at most ${MAX_WORDS}` });
      }
    }

    // ── HOWTO-STALE ──
    const fix = `re-render it: node howto/render.mjs ${id} (howto/README.md), then commit howto/clips.lock.json`;
    const entry = lock[id];
    if (!entry) {
      hits.push({ rule: "HOWTO-STALE", clip: id, what: `never rendered in full (no entry in howto/clips.lock.json); ${fix}` });
      continue;
    }
    const missingLangs = meta.langs.filter((l) => !(entry.langs || []).includes(l));
    if (missingLangs.length) {
      hits.push({ rule: "HOWTO-STALE", clip: id, what: `not rendered in ${missingLangs.join(", ")} yet; ${fix}` });
    }
    let now;
    try {
      now = clipSources(repo, meta, path);
    } catch (err) {
      hits.push({ rule: "HOWTO-STALE", clip: id, what: `${err.message}; fix meta.routes in howto/clips/${file}` });
      continue;
    }
    const was = entry.files || {};
    const changed = now.filter((f) => was[f] && was[f] !== hashOf(repo, f));
    const added = now.filter((f) => !was[f]);
    const removed = Object.keys(was).filter((f) => !now.includes(f));
    if (changed.length || added.length || removed.length) {
      const named = [...changed.map((f) => `changed ${f}`), ...added.map((f) => `new ${f}`), ...removed.map((f) => `gone ${f}`)];
      hits.push({
        rule: "HOWTO-STALE", clip: id,
        what: `the screens it shows changed since it was rendered on ${entry.rendered}: ${named.slice(0, 6).join(", ")}${named.length > 6 ? ` and ${named.length - 6} more` : ""}; ${fix}`,
      });
    }
  }

  // ── HOWTO-MONEY: no invented amount in what the clips put on screen ──
  const moneyFiles = [
    ...readdirSync(clipDir).filter((f) => f.endsWith(".mjs")).map((f) => join("howto", "clips", f)),
    ...(existsSync(join(repo, "howto", "stack")) ? readdirSync(join(repo, "howto", "stack")).filter((f) => f.endsWith(".py")).map((f) => join("howto", "stack", f)) : []),
    ...LOCALES.map((l) => join("messages", l, "howto.json")).filter((f) => existsSync(join(repo, f))),
  ];
  for (const rel of moneyFiles) {
    readFileSync(join(repo, rel), "utf8").split(/\r?\n/).forEach((line, i) => {
      if (MONEY.some((re) => re.test(line))) {
        hits.push({ rule: "HOWTO-MONEY", clip: rel.replace(/\\/g, "/"), what: `line ${i + 1} holds an amount of money ("${line.trim().slice(0, 80)}"); no fake money on the website (owner 2026-10-12): a prize is "Trophy"` });
      }
    });
  }
  return hits;
}

// A currency sign or code beside a number, either way round: "$500", "GH₵ 0.00", "0,00 GH₵", "500 USD",
// "1,000 naira".
const MONEY = [
  /(?:[$€£₦₵]|\b(?:USD|NGN|GHS|KES|ZAR|XOF|XAF)\b)\s?\d/,
  /\d[\d,.]*\s?(?:[€£₦₵]|GH₵|GH¢|\b(?:USD|NGN|GHS|KES|ZAR|XOF|XAF|naira|cedis?|dollars?)\b)/i,
];

// ── self-test: each rule fires on a fixture made to break it, and a clean fixture is quiet ─────
async function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), "howto-check-"));
  const put = (f, body) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), body);
  };
  const results = [];
  try {
    put("app/(g)/thing/page.tsx", 'import { Part } from "@/components/Part";\nexport default function P() { return <Part />; }\n');
    put("components/Part.tsx", 'import { useTranslations } from "next-intl";\nexport function Part() { const t = useTranslations("thing"); return <button data-howto="press-me">{t("go")}</button>; }\n');
    for (const l of LOCALES) {
      put(`messages/${l}/thing.json`, '{"go":"Go"}\n');
      put(`messages/${l}/howto.json`, JSON.stringify({ clips: { demo: { steps: { one: "Press the button" } } } }));
    }
    put("howto/render.mjs", "// recorder stand-in\n");
    put("howto/lib/overlay.mjs", "// overlay stand-in\n");
    put("howto/clips/demo.mjs",
      'export const meta = { id: "demo", messages: "demo", langs: ["en"], seconds: [8, 20], routes: ["/thing"], hooks: ["press-me"] };\nexport default async function () {}\n');
    const meta = { id: "demo", routes: ["/thing"] };
    const files = Object.fromEntries(clipSources(dir, meta, join(dir, "howto/clips/demo.mjs")).map((f) => [f, hashOf(dir, f)]));
    put("howto/clips.lock.json", JSON.stringify({ demo: { rendered: "2026-10-12", langs: ["en"], files } }));

    let hits = await checkClips(dir);
    results.push(["clean fixture is quiet", hits.length === 0, hits]);
    const followed = Object.keys(files);
    results.push(["the file set follows the page's import and its namespace",
      followed.includes("components/Part.tsx") && followed.includes("messages/fr/thing.json"), followed]);

    put("components/Part.tsx", readFileSync(join(dir, "components/Part.tsx"), "utf8").replace("{t(\"go\")}", "{t(\"go\")}!"));
    hits = await checkClips(dir);
    results.push(["a changed screen is HOWTO-STALE", hits.some((h) => h.rule === "HOWTO-STALE" && h.what.includes("components/Part.tsx")), hits]);

    put("components/Part.tsx", 'export function Part() { return <button>Go</button>; }\n');
    hits = await checkClips(dir);
    results.push(["a hook that left the code is HOWTO-HOOK", hits.some((h) => h.rule === "HOWTO-HOOK" && h.what.includes("press-me")), hits]);

    put("messages/pt/howto.json", JSON.stringify({ clips: { demo: { steps: { one: "um dois tres quatro cinco seis sete oito nove" } } } }));
    put("messages/fr/howto.json", JSON.stringify({ clips: { demo: { steps: {} } } }));
    hits = await checkClips(dir);
    results.push(["a caption over 8 words and a missing one are HOWTO-CAPTION",
      hits.some((h) => h.rule === "HOWTO-CAPTION" && h.what.startsWith("pt:")) && hits.some((h) => h.rule === "HOWTO-CAPTION" && h.what.startsWith("fr:")), hits]);

    rmSync(join(dir, "howto/clips.lock.json"));
    hits = await checkClips(dir);
    results.push(["a clip never rendered is HOWTO-STALE", hits.some((h) => h.rule === "HOWTO-STALE" && h.what.startsWith("never rendered")), hits]);

    put("howto/stack/seed.py", 'prizepool="Trophy", max_teams_or_players=16, uid="2104567311"\nbanner(e, "SQUADS   REGISTRATION OPEN")\n');
    hits = await checkClips(dir);
    results.push(["a seed with a trophy, team counts and UIDs is not HOWTO-MONEY", !hits.some((h) => h.rule === "HOWTO-MONEY"), hits]);
    put("howto/stack/seed.py", 'prizepool="$500"\nbanner(e, "SQUADS   PRIZE 1,000 NGN")\nstat = "0,00 GH₵"\n');
    hits = await checkClips(dir);
    results.push(["an invented amount, sign first or code after, is HOWTO-MONEY",
      hits.filter((h) => h.rule === "HOWTO-MONEY").length === 3, hits]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  let ok = true;
  for (const [name, pass, detail] of results) {
    console.log(`${pass ? "ok  " : "FAIL"} ${name}`);
    if (!pass) {
      ok = false;
      console.log(JSON.stringify(detail, null, 1).slice(0, 1200));
    }
  }
  console.log(ok ? `self-test OK (${results.length} cases)` : "self-test FAILED");
  process.exit(ok ? 0 : 1);
}

if (process.argv.includes("--self-test")) {
  await selfTest();
} else {
  const hits = await checkClips(ROOT);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ fails: hits.length, list: hits }));
  } else {
    for (const h of hits) console.log(`${h.rule} ${h.clip}  ${h.what}`);
    console.log(hits.length ? `${hits.length} how-to clip problem(s)` : "how-to clips: up to date");
  }
  process.exit(hits.length ? 1 : 0);
}
