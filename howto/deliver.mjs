#!/usr/bin/env node
// howto/deliver.mjs - copy finished how-to clips into the next dated revision folder (owner rules:
// deliverables live in "<Set> <date first asked>/Revision N, <date of the note>/", a sent revision is
// never written into again, filenames inside a revision are plain). Step 6 of howto/README.md.
//
//   node howto/deliver.mjs --revision 2 --date "12 October 2026" [--set "<set folder>"] [clip ...]
//
// Reads what howto/render.mjs left in howto/out/<clip>/ (<clip>-<lang>-<size>.mp4/.webm/.gif/.jpg) and
// writes, per language that was rendered:
//   <set>/Revision N, <date>/<Language>/<English title>, <size>.mp4 | .webm | .gif
//   <set>/Revision N, <date>/<Language>/<English title>, <size>, still.jpg
// The title comes from messages/en/howto.json (clips.<meta.messages>.title), the language list from the
// clip's meta.langs. With no clip named, every clip in howto/clips/ is delivered. Refuses to write into
// a revision folder that already holds files, and refuses a clip with any file missing, so a delivery
// is always the full set or nothing. The Read me first.txt and the work-log row stay hand-written.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const LANGUAGE = { en: "English", fr: "French", pt: "Portuguese" };
const SIZES = ["desktop", "phone"];

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const valued = new Set(["--revision", "--date", "--set"]);
const named = argv.filter((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1]));
const revision = opt("revision");
const date = opt("date");
if (!/^\d+$/.test(revision || "") || !/^\d{1,2} [A-Z][a-z]+ \d{4}$/.test(date || "")) {
  console.error('usage: node howto/deliver.mjs --revision <N> --date "12 October 2026" [--set <folder>] [clip ...]');
  process.exit(2);
}
// The set is dated the day the clips were first asked for (the brief, 10 October 2026). The default
// path is the WEBSITE folder above this checkout, where every AFC delivery set lives.
const setDir = resolve(opt("set", join(REPO, "..", "How-to Clips 10 October 2026")));
const revDir = join(setDir, `Revision ${revision}, ${date}`);
if (existsSync(revDir) && readdirSync(revDir).length) {
  console.error(`deliver: ${revDir} already holds files; a sent revision is never written into again. Use the next number.`);
  process.exit(1);
}

const titles = JSON.parse(readFileSync(join(REPO, "messages", "en", "howto.json"), "utf8")).clips;
const clipIds = named.length ? named : readdirSync(join(HERE, "clips")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort();

// Plan every copy first, so a missing file stops the run before anything is written.
const plan = [];
const missing = [];
for (const id of clipIds) {
  const { meta } = await import(pathToFileURL(join(HERE, "clips", `${id}.mjs`)).href);
  const title = titles[meta.messages]?.title;
  if (!title) missing.push(`${id}: no title at messages/en/howto.json clips.${meta.messages}.title`);
  for (const lang of meta.langs) {
    for (const size of SIZES) {
      const base = join(HERE, "out", id, `${id}-${lang}-${size}`);
      for (const [ext, name] of [["mp4", `${title}, ${size}.mp4`], ["webm", `${title}, ${size}.webm`],
        ["gif", `${title}, ${size}.gif`], ["jpg", `${title}, ${size}, still.jpg`]]) {
        const from = `${base}.${ext}`;
        if (!existsSync(from)) missing.push(from);
        else plan.push({ from, to: join(revDir, LANGUAGE[lang] || lang, name) });
      }
    }
  }
}
if (missing.length) {
  console.error(`deliver: ${missing.length} file(s) missing, nothing written:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

for (const { from, to } of plan) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
const mb = plan.reduce((n, p) => n + statSync(p.to).size, 0) / 1024 / 1024;
console.log(`deliver: ${plan.length} files (${mb.toFixed(1)} MB) for ${clipIds.length} clip(s) -> ${revDir}`);
