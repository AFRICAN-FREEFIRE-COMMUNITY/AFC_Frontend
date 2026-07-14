// scripts/i18n-translate.mjs
//
// Purpose: machine-translate the English source message catalog into the other
// supported locales (fr, pt) using the DeepL REST API. For every namespace file
// under messages/en/*.json it produces messages/<locale>/*.json with the same
// keys and the same {placeholder} tokens + <rich> tags, only the string VALUES
// change.
//
// Why DeepL (owner 2026-06-20): the site moved off Gemini for translations after
// an expired Gemini key stalled the backend. Gemini is now OCR-only; ALL
// translation (this build-time script AND the backend translate-on-read layer)
// goes through DeepL. See backend/afc_auth/translation.py for the runtime side.
//
// How it connects to the rest of the system:
//  - Reads the locale list (LOCALES, DEFAULT_LOCALE) from i18n/config.ts so the
//    script and the runtime stay in sync.
//  - Writes files that i18n/request.ts reads + deep-merges at request time. Any
//    key it leaves untranslated (or any whole missing file) falls back to the
//    English base there, so a partial run never breaks the UI.
//  - DEEPL_API_KEY is read from process.env first, then from ../backend/.env
//    (the same key the backend translation layer uses). Never hardcoded. A free
//    key ends in ":fx" and is auto-routed to the free host.
//
// Placeholder / rich-tag safety:
//  next-intl strings carry two kinds of non-translatable tokens that MUST survive
//  verbatim: ICU placeholders like {name}/{count} and rich-text tags like
//  <bold>..</bold> or <player></player>. Before sending a string to DeepL every
//  such token is masked into a uniform self-closing XML sentinel <m id="N"/> and
//  the request uses tag_handling=xml, so DeepL keeps the sentinels (repositioning
//  them grammatically) and only translates the human text. The sentinels are then
//  restored to the EXACT original tokens. If any sentinel goes missing in DeepL's
//  output we keep the English source for that one key (safe fallback) rather than
//  writing a corrupted string.
//
// Idempotent: an existing target value is only (re)written when the English
// source for that key has CHANGED or the target is missing. Run it again after
// editing English copy and it only re-translates what actually changed.
//
// Run it with:
//   pnpm i18n:translate            # all non-English locales (fr, pt)
//   pnpm i18n:translate -- fr      # only the listed locale(s)
//   DEEPL_API_KEY=... pnpm i18n:translate
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

// ── DeepL language codes (target) keyed by our locale code ───────────────────
// DeepL wants region-qualified Portuguese; FR is fine unqualified.
const DEEPL_LANG = {
  fr: "FR",
  pt: "PT-PT",
  es: "ES",
  de: "DE",
};

// DeepL native batch limit is 50 texts per request.
const DEEPL_MAX_BATCH = Number(process.env.I18N_CHUNK_SIZE) || 50;
// How many times to retry a single batch on a transient failure (429/5xx/network).
const MAX_RETRIES = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── locale config: imported from the single source of truth ──────────────────
async function loadLocaleConfig() {
  // i18n/config.ts is TypeScript; parse the small constant arrays out of it
  // directly instead of importing (keeps the script dependency-free).
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

// ── DEEPL_API_KEY resolution: env first, then backend/.env ───────────────────
async function resolveApiKey() {
  if (process.env.DEEPL_API_KEY) return process.env.DEEPL_API_KEY.trim();
  const envPath = path.join(FRONTEND_ROOT, "..", "backend", ".env");
  if (existsSync(envPath)) {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*DEEPL_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  }
  throw new Error(
    "DEEPL_API_KEY not found in process.env or ../backend/.env. Set it and retry.",
  );
}

// A DeepL Free key ends in ":fx" and must hit the free host.
function deeplHost(apiKey) {
  return apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

// ── deep walk: collect every leaf string with its dotted path ────────────────
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

// ── ICU apostrophe-before-placeholder guard ──────────────────────────────────
// A machine translation (esp. French elision: "de {x}" -> "d'{x}") can leave a lone
// apostrophe immediately before a placeholder brace. In ICU MessageFormat a single '
// before { starts a quoted literal, so {x} would render as the LITERAL text "{x}" instead
// of the argument value. Doubling the apostrophe ('' = one literal ') keeps the placeholder
// active. Only a SINGLE-brace placeholder trap is touched; an intentional '{{ literal-brace
// escape (e.g. "Step '{{'current'}}'") is deliberately left alone. Applied to freshly
// translated strings only, never to the English source/fallback.
function fixIcuApostrophe(s) {
  return typeof s === "string" ? s.replace(/(?<!')'(\{)(?!\{)/g, "''$1") : s;
}

// ── token masking: protect placeholders + ICU control syntax + markers ────────
// Non-translatable tokens are masked into uniform self-closing sentinels
// <m id="N"/> so DeepL keeps them inline and in place. Three classes:
//   1. Simple ICU placeholders:  {name}, {count}, {price, number}, ...
//   2. EMPTY / self-closing marker tags with no inner text:
//      <player></player>, <menu></menu>, <date></date>, <x/>
//   3. ICU MessageFormat CONTROL syntax of complex args (plural/select/
//      selectordinal): the "{arg, plural," opener, every "one {" / "other {" /
//      "=0 {" / "offset:1" / select-value category boundary, and the closing
//      braces. Only the human sub-message TEXT inside each category stays
//      translatable. (Root-cause fix, owner 2026-07-14: the old flat regex only
//      matched non-nested {..}, so it exposed "count, plural, one"/"other" to
//      DeepL, which translated those ICU keywords into French/PT prose -> invalid
//      ICU -> next-intl fell back to printing the raw key. See maskTokens below.)
// NON-empty paired rich tags (<bold>{x}</bold>, <strong>text</strong>) are LEFT
// as real XML so DeepL's tag_handling=xml keeps each pair around its translated
// inner text. (Masking a content pair as two independent sentinels - or leaving
// an empty marker as a real empty tag - both let DeepL reorder/corrupt it; tested
// 2026-06-20.)
//
// Empty paired tag (<player></player>) or self-closing (<x/>) marker.
const TAG_MASK_RE = /<([a-zA-Z][\w-]*)\s*>\s*<\/\1\s*>|<[a-zA-Z][^<>]*\/>/g;

// Is the inside of a {...} block an ICU complex arg (plural/select/selectordinal)?
function isComplexArg(inner) {
  return /^\s*[\w.]+\s*,\s*(?:plural|selectordinal|select)\s*,/s.test(inner);
}

// Index of the '}' matching the '{' at openIdx (brace-balanced). -1 if unbalanced.
function matchBrace(str, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Escape only & in the bare text so the rich tags stay valid XML for DeepL.
// We deliberately do NOT escape < / > because every one of them is a legitimate
// rich tag in our source strings; escaping would turn tags into literal text.
function escapeAmp(s) {
  return s.replace(/&/g, "&amp;");
}
function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Mask every non-translatable token into an <m id="N"/> sentinel, remembering the
// EXACT original substrings in order, and return { masked, tokens }. ICU-aware:
// it recurses through plural/select/selectordinal args so the control skeleton is
// masked while each category's human sub-message text stays translatable. Proven by
// the round-trip unit cases in scripts (mask -> DeepL keeps <m/> -> restore == input).
function maskTokens(text) {
  const tokens = [];
  const push = (s) => {
    tokens.push(s);
    return `<m id="${tokens.length - 1}"/>`;
  };

  // Translatable free text: escape & and mask empty/self-closing MARKER tags. Non-empty
  // paired rich tags (<b>..</b>) stay as real XML (only & escaped) for tag_handling=xml.
  function emitText(slice) {
    let out = "";
    let last = 0;
    for (const m of slice.matchAll(TAG_MASK_RE)) {
      out += escapeAmp(slice.slice(last, m.index));
      out += push(m[0]);
      last = m.index + m[0].length;
    }
    return out + escapeAmp(slice.slice(last));
  }

  // rest = " offset:1 one {..} other {..}" : repeated  KEY { submessage }
  function walkCategories(rest) {
    let out = "";
    let i = 0;
    while (i < rest.length) {
      const brace = rest.indexOf("{", i);
      if (brace === -1) {
        const tail = rest.slice(i);
        if (tail.trim()) out += push(tail); // trailing ICU control (e.g. lone offset)
        break;
      }
      out += push(rest.slice(i, brace + 1)); // mask "  KEY {" (one/other/=0/offset:N/select-value)
      const close = matchBrace(rest, brace);
      if (close === -1) {
        out += emitText(rest.slice(brace + 1));
        break;
      }
      out += walk(rest.slice(brace + 1, close)); // recurse: text translatable, nested tokens masked
      out += push("}"); // mask this category's closing brace
      i = close + 1;
    }
    return out;
  }

  function walk(str) {
    let out = "";
    let i = 0;
    while (i < str.length) {
      const brace = str.indexOf("{", i);
      if (brace === -1) {
        out += emitText(str.slice(i));
        break;
      }
      out += emitText(str.slice(i, brace));
      const close = matchBrace(str, brace);
      if (close === -1) {
        out += emitText(str.slice(brace)); // unbalanced -> treat as literal text
        break;
      }
      const whole = str.slice(brace, close + 1);
      const inner = str.slice(brace + 1, close);
      if (isComplexArg(inner)) {
        const header = inner.match(
          /^(\s*[\w.]+\s*,\s*(?:plural|selectordinal|select)\s*,)/s,
        )[1];
        out += push("{" + header); // mask "{arg, type,"
        out += walkCategories(inner.slice(header.length));
        out += push("}"); // mask the complex arg's closing brace
      } else {
        out += push(whole); // simple placeholder -> mask whole
      }
      i = close + 1;
    }
    return out;
  }

  return { masked: walk(text), tokens };
}

// Restore the original tokens. DeepL may emit the sentinel as <m id="0"/>,
// <m id="0" />, <m id='0'/> or even the paired <m id="0"></m>; match all.
// Returns null if any sentinel is missing (caller falls back to English).
function restoreTokens(translated, tokens) {
  const seen = new Set();
  const out = translated.replace(
    /<m\s+id=["']?(\d+)["']?\s*\/?>(?:<\/m>)?/g,
    (_full, idx) => {
      const i = Number(idx);
      seen.add(i);
      return tokens[i] ?? "";
    },
  );
  if (seen.size !== tokens.length) return null; // a token was dropped -> unsafe
  return unescapeXml(out);
}

// ── DeepL REST call: translate an ordered array of texts ─────────────────────
// Input: string[] (English). Output: string[] (translated, same order). Splits
// into DEEPL_MAX_BATCH slices, retries transient failures, merges in order.
async function translateTexts(apiKey, host, targetLang, texts) {
  if (texts.length === 0) return [];
  const result = new Array(texts.length);

  for (let start = 0; start < texts.length; start += DEEPL_MAX_BATCH) {
    const slice = texts.slice(start, start + DEEPL_MAX_BATCH);
    const masks = slice.map(maskTokens);

    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const body = {
          text: masks.map((m) => m.masked),
          source_lang: "EN",
          target_lang: targetLang,
          tag_handling: "xml",
          // Our sentinels carry no inner text, but be explicit that <m> is
          // structural and must never be translated or split on.
          ignore_tags: ["m"],
          preserve_formatting: true,
        };
        const res = await fetch(host, {
          method: "POST",
          headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text();
          // 456 = quota exhausted: fatal, do not retry.
          if (res.status === 456) {
            throw Object.assign(new Error(`DeepL quota exhausted (456): ${t.slice(0, 200)}`), { fatal: true });
          }
          throw new Error(`DeepL ${res.status}: ${t.slice(0, 300)}`);
        }
        const json = await res.json();
        const translations = json?.translations ?? [];
        for (let i = 0; i < slice.length; i++) {
          const raw = translations[i]?.text ?? "";
          const restored = restoreTokens(raw, masks[i].tokens);
          // null restore -> a token was lost; keep the English source for safety.
          result[start + i] = restored ?? slice[i];
        }
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (e.fatal || attempt === MAX_RETRIES) break;
        const backoff = 1000 * 2 ** (attempt - 1);
        console.log(`    batch @${start} attempt ${attempt} failed (${e.message}); retrying in ${backoff}ms`);
        await sleep(backoff);
      }
    }
    if (lastErr) throw lastErr;
  }
  return result;
}

// ── per-locale, per-namespace processing ─────────────────────────────────────
async function run() {
  const { locales, defaultLocale } = await loadLocaleConfig();
  const apiKey = await resolveApiKey();
  const host = deeplHost(apiKey);
  console.log(`DeepL host: ${host} (${apiKey.endsWith(":fx") ? "free" : "pro"} key)`);

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
    const targetLang = DEEPL_LANG[locale];
    if (!targetLang) {
      console.warn(`[${locale}] no DeepL language mapping; skipping.`);
      continue;
    }
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
      // so we only re-translate keys whose English text changed.
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
      const toTranslateKeys = [];
      for (const [key, enValue] of Object.entries(enFlat)) {
        const haveTarget = typeof existingFlat[key] === "string";
        const sourceChanged = sourceCache[key] !== enValue;
        // Only translate non-empty string leaves; copy through empties/non-strings.
        const translatable = typeof enValue === "string" && enValue.trim() !== "";
        if (translatable && (force || !haveTarget || sourceChanged)) {
          toTranslateKeys.push(key);
        }
      }

      const needed = toTranslateKeys.length;
      if (needed === 0) {
        totalSkipped += Object.keys(enFlat).length;
        console.log(`[${locale}/${ns}] up to date (${Object.keys(enFlat).length} keys).`);
        continue;
      }

      console.log(`[${locale}/${ns}] translating ${needed} key(s)...`);
      const texts = toTranslateKeys.map((k) => enFlat[k]);
      const translatedArr = await translateTexts(apiKey, host, targetLang, texts);
      const translated = {};
      // fixIcuApostrophe: guard against the French-elision "d'{x}" ICU trap (see helper above).
      toTranslateKeys.forEach((k, i) => (translated[k] = fixIcuApostrophe(translatedArr[i])));

      // Merge: start from existing, overlay new translations, fall back to the
      // English source. Drop any keys that no longer exist in English.
      const mergedFlat = {};
      const newCache = {};
      for (const key of Object.keys(enFlat)) {
        mergedFlat[key] = translated[key] ?? existingFlat[key] ?? enFlat[key];
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
