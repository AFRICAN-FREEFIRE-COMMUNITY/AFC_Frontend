// scripts/i18n-translate.mjs
//
// Purpose: machine-translate the English source message catalog into the other
// supported locales (fr, pt) using the Gemini REST API. For every namespace
// file under messages/en/*.json it produces messages/<locale>/*.json with the
// same keys and the same {placeholder} tokens, only the string VALUES change.
//
// How it connects to the rest of the system:
//  - Reads the locale list (LOCALES, DEFAULT_LOCALE) from i18n/config.ts so the
//    script and the runtime stay in sync.
//  - Writes files that i18n/request.ts reads + deep-merges at request time. Any
//    key it leaves untranslated (or any whole missing file) falls back to the
//    English base there, so a partial run never breaks the UI.
//  - GEMINI_API_KEY is read from process.env first, then from ../backend/.env
//    (same key the backend OCR teacher uses). Never hardcoded.
//
// Idempotent: an existing target value is only (re)written when the English
// source for that key has CHANGED or the target is missing. Run it again after
// editing English copy and it only re-translates what actually changed.
//
// Run it with:
//   pnpm i18n:translate            # all non-English locales (fr, pt)
//   pnpm i18n:translate -- fr      # only the listed locale(s)
//   GEMINI_API_KEY=... pnpm i18n:translate
//
// Flags:
//   --force   re-translate every key, ignoring the change cache.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.join(__dirname, "..");
const MESSAGES_DIR = path.join(FRONTEND_ROOT, "messages");

// Gemini model: matches the backend OCR teacher (gemini-2.5-flash). Override
// with GEMINI_MODEL if needed.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ── locale config: imported from the single source of truth ──────────────────
async function loadLocaleConfig() {
  // i18n/config.ts is TypeScript; import it as a URL. Node 22+ can import .ts
  // via --experimental-strip-types, but to stay portable we parse the small
  // constant arrays out of the file directly instead of importing it.
  const cfgPath = path.join(FRONTEND_ROOT, "i18n", "config.ts");
  const src = await readFile(cfgPath, "utf8");
  const localesMatch = src.match(/LOCALES\s*=\s*\[([^\]]*)\]/);
  const defaultMatch = src.match(/DEFAULT_LOCALE\s*:\s*Locale\s*=\s*["']([^"']+)["']/);
  if (!localesMatch) throw new Error("Could not parse LOCALES from i18n/config.ts");
  const locales = localesMatch[1]
    .split(",")
    .map((s) => s.trim().replace(/["']/g, ""))
    .filter(Boolean);
  const defaultLocale = defaultMatch ? defaultMatch[1] : "en";
  return { locales, defaultLocale };
}

// ── GEMINI_API_KEY resolution: env first, then backend/.env ──────────────────
async function resolveApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(FRONTEND_ROOT, "..", "backend", ".env");
  if (existsSync(envPath)) {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(
    "GEMINI_API_KEY not found in process.env or ../backend/.env. Set it and retry.",
  );
}

// Human-readable language names for the prompt (keyed by locale code).
const LANGUAGE_NAMES = {
  fr: "French",
  pt: "Portuguese",
  es: "Spanish",
  de: "German",
};

// ── deep walk: collect every leaf string with its dotted path ────────────────
// Returns a flat map { "actions.save": "Save", "nav.home": "Home", ... } so we
// can diff against a cache and batch all strings of a file into one API call.
function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out[full] = value;
    }
  }
  return out;
}

// Rebuild a nested object from a flat { "a.b": v } map (inverse of flatten).
function unflatten(flat) {
  const root = {};
  for (const [dotted, value] of Object.entries(flat)) {
    const parts = dotted.split(".");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  return root;
}

// Max strings sent to Gemini in a single request. Large namespaces (e.g.
// tournaments has ~440 strings) overflow the response and surface as a generic
// "fetch failed", so we split into chunks of this size and merge the results.
const CHUNK_SIZE = Number(process.env.I18N_CHUNK_SIZE) || 60;
// How many times to retry a single chunk on a transient network failure
// (e.g. "fetch failed", 429, 503) with exponential backoff.
const MAX_RETRIES = 3;

// Sleep helper for retry backoff.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Gemini REST call: translate a batch of strings, chunked ──────────────────
// Input: { "actions.save": "Save", ... }. Output: same keys, translated values.
// Splits into CHUNK_SIZE-sized requests so big namespaces don't overflow a
// single call, retries transient failures, and merges every chunk back.
async function translateBatch(apiKey, languageName, entries) {
  const keys = Object.keys(entries);
  if (keys.length === 0) return {};

  // Split the flat entry map into CHUNK_SIZE-key slices.
  const chunks = [];
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const slice = {};
    for (const k of keys.slice(i, i + CHUNK_SIZE)) slice[k] = entries[k];
    chunks.push(slice);
  }

  const merged = {};
  for (let c = 0; c < chunks.length; c++) {
    if (chunks.length > 1) {
      console.log(`    chunk ${c + 1}/${chunks.length} (${Object.keys(chunks[c]).length} keys)`);
    }
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        Object.assign(merged, await translateChunk(apiKey, languageName, chunks[c]));
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < MAX_RETRIES) {
          const backoff = 1000 * 2 ** (attempt - 1);
          console.log(`    chunk ${c + 1} attempt ${attempt} failed (${e.message}); retrying in ${backoff}ms`);
          await sleep(backoff);
        }
      }
    }
    if (lastErr) throw lastErr;
  }
  return merged;
}

// ── single Gemini REST request for one chunk of strings ──────────────────────
// The model is instructed to keep keys + {placeholders} verbatim and return JSON.
async function translateChunk(apiKey, languageName, entries) {
  const keys = Object.keys(entries);
  if (keys.length === 0) return {};

  const prompt = [
    `You are a professional UI localizer for a gaming/esports web app.`,
    `Translate the VALUES of the following JSON object from English into ${languageName}.`,
    `STRICT RULES:`,
    `1. Keep every JSON key EXACTLY as given. Do not add, remove, or reorder keys.`,
    `2. Preserve ALL placeholder tokens like {name}, {count}, {date} verbatim, including the braces.`,
    `3. Preserve HTML-like tags and markup if present.`,
    `4. Do NOT translate brand names, product names, or proper nouns.`,
    `5. Keep the tone concise and natural for buttons, labels, and short UI copy.`,
    `6. Return ONLY a valid JSON object, no markdown fences, no commentary.`,
    ``,
    `JSON to translate:`,
    JSON.stringify(entries, null, 2),
  ].join("\n");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";

  let parsed;
  try {
    // responseMimeType=application/json should give clean JSON, but strip any
    // stray code fence just in case the model wraps it.
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Failed to parse Gemini JSON response: ${e.message}\nRaw: ${text.slice(0, 500)}`,
    );
  }

  // Only keep keys we asked for; ignore anything the model hallucinated.
  const result = {};
  for (const k of keys) {
    if (typeof parsed[k] === "string") result[k] = parsed[k];
  }
  return result;
}

// ── per-locale, per-namespace processing ─────────────────────────────────────
async function run() {
  const { locales, defaultLocale } = await loadLocaleConfig();
  const apiKey = await resolveApiKey();

  // Optional CLI args: explicit locales to run, and --force.
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const force = args.includes("--force");
  const requested = args.filter((a) => !a.startsWith("--"));
  const targetLocales = (requested.length ? requested : locales).filter(
    (l) => l !== defaultLocale,
  );

  const enDir = path.join(MESSAGES_DIR, defaultLocale);
  const nsFiles = (await readdir(enDir)).filter((f) => f.endsWith(".json"));

  let totalTranslated = 0;
  let totalSkipped = 0;

  for (const locale of targetLocales) {
    const languageName = LANGUAGE_NAMES[locale] || locale;
    const outDir = path.join(MESSAGES_DIR, locale);
    await mkdir(outDir, { recursive: true });

    for (const file of nsFiles) {
      const ns = file.replace(/\.json$/, "");
      const enFlat = flatten(JSON.parse(await readFile(path.join(enDir, file), "utf8")));

      // Load the existing target file (if any) so we can keep good translations.
      const outPath = path.join(outDir, file);
      let existingFlat = {};
      if (existsSync(outPath)) {
        try {
          existingFlat = flatten(JSON.parse(await readFile(outPath, "utf8")));
        } catch {
          existingFlat = {};
        }
      }

      // Sidecar cache records which English source produced each existing value,
      // so we only re-translate keys whose English text changed. Stored as a
      // hidden ._source.json next to the locale file.
      const cachePath = path.join(outDir, `.${ns}.source.json`);
      let sourceCache = {};
      if (!force && existsSync(cachePath)) {
        try {
          sourceCache = JSON.parse(await readFile(cachePath, "utf8"));
        } catch {
          sourceCache = {};
        }
      }

      // Decide which keys need (re)translation.
      const toTranslate = {};
      for (const [key, enValue] of Object.entries(enFlat)) {
        const haveTarget = typeof existingFlat[key] === "string";
        const sourceChanged = sourceCache[key] !== enValue;
        if (force || !haveTarget || sourceChanged) {
          toTranslate[key] = enValue;
        }
      }

      const needed = Object.keys(toTranslate).length;
      if (needed === 0) {
        totalSkipped += Object.keys(enFlat).length;
        console.log(`[${locale}/${ns}] up to date (${Object.keys(enFlat).length} keys).`);
        continue;
      }

      console.log(`[${locale}/${ns}] translating ${needed} key(s)...`);
      const translated = await translateBatch(apiKey, languageName, toTranslate);

      // Merge: start from existing, overlay new translations. Drop any keys that
      // no longer exist in English so stale entries do not linger.
      const mergedFlat = {};
      const newCache = {};
      for (const key of Object.keys(enFlat)) {
        mergedFlat[key] =
          translated[key] ?? existingFlat[key] ?? enFlat[key];
        newCache[key] = enFlat[key];
      }

      await writeFile(
        outPath,
        JSON.stringify(unflatten(mergedFlat), null, 2) + "\n",
        "utf8",
      );
      await writeFile(cachePath, JSON.stringify(newCache, null, 2) + "\n", "utf8");

      totalTranslated += needed;
    }
  }

  console.log(
    `\nDone. Translated ${totalTranslated} key(s), ${totalSkipped} already current.`,
  );
}

run().catch((err) => {
  console.error("\ni18n:translate failed:", err.message);
  process.exit(1);
});
