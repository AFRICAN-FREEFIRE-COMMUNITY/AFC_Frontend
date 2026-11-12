// howto/lib/publish.mjs - put a clip's takes where the site serves them (inbox #255, 2026-10-16).
//
// The site shows the clips on /help, in the event page's "Watch how" tip and in the organizer Help
// Center (lib/howto-guides.ts). It serves them from public/howto/<clip>/<lang>-<size>.{webm,mp4,jpg}
// (the WebM first, the MP4 for browsers without WebM, the still for reduced motion and as the poster)
// and reads each take's length from lib/howto-clips.generated.json. Both are written HERE and only
// here, from the takes in howto/out/<clip>/ (git-ignored), so the site can never show a take the lock
// does not describe.
//
// Called by: howto/render.mjs right after it writes a clip's lock (a full render publishes itself),
// and by hand: node howto/lib/publish.mjs <clip> [<clip> ...]. The GIFs are not published: they are
// for the delivery folder (howto/deliver.mjs), the site plays video.
// Held by: scripts/check-howto-clips.mjs HOWTO-PUBLIC (every locked take is in public/howto and
// in the lengths file).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PUBLIC_EXTS = ["webm", "mp4", "jpg"];
export const PUBLIC_SIZES = ["desktop", "phone"];
export const SECONDS_FILE = "lib/howto-clips.generated.json";

// A full range (color_range=pc) WebM decodes in ffmpeg and fails in Chrome with
// PIPELINE_ERROR_DECODE, so a take must say tv before the site may play it (16 Oct 2026, render.mjs).
function colorRange(file) {
  return execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_range", "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
}

function seconds(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Number(Number(out.trim()).toFixed(1));
}

export function publishClip(repo, clipId, langs) {
  const table = existsSync(join(repo, SECONDS_FILE)) ? JSON.parse(readFileSync(join(repo, SECONDS_FILE), "utf8")) : {};
  const row = {};
  for (const lang of langs) {
    for (const size of PUBLIC_SIZES) {
      const from = join(repo, "howto", "out", clipId, `${clipId}-${lang}-${size}`);
      const missing = PUBLIC_EXTS.filter((e) => !existsSync(`${from}.${e}`));
      if (missing.length) throw new Error(`publish: ${clipId} ${lang} ${size} has no ${missing.join(", ")} in howto/out`);
      for (const e of ["webm", "mp4"]) {
        const range = colorRange(`${from}.${e}`);
        if (range !== "tv") throw new Error(`publish: ${clipId} ${lang} ${size}.${e} is color_range=${range}, Chrome will not play it; re-render with the current howto/render.mjs`);
      }
      const to = join(repo, "public", "howto", clipId);
      mkdirSync(to, { recursive: true });
      for (const e of PUBLIC_EXTS) copyFileSync(`${from}.${e}`, join(to, `${lang}-${size}.${e}`));
      (row[lang] ||= {})[size] = seconds(`${from}.mp4`);
    }
  }
  table[clipId] = row;
  const sorted = Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]]));
  writeFileSync(join(repo, SECONDS_FILE), JSON.stringify(sorted, null, 2) + "\n");
  console.log(`publish: ${clipId} -> public/howto/${clipId}/ (${langs.length * PUBLIC_SIZES.length} takes)`);
}

// ── by hand ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error("usage: node howto/lib/publish.mjs <clip> [<clip> ...]");
    process.exit(2);
  }
  for (const id of ids) {
    const { meta } = await import(pathToFileURL(join(repo, "howto", "clips", `${id}.mjs`)).href);
    publishClip(repo, id, meta.langs);
  }
}
