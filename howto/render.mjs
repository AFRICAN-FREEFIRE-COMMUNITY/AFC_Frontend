#!/usr/bin/env node
// howto/render.mjs - record a how-to clip from the LOCAL site (owner brief 2026-10-10, inbox #227,
// #235, #236). Full instructions: howto/README.md.
//
//   node howto/render.mjs <clip> [--lang en] [--size desktop|phone|all] [--no-reset] [--no-lock] [--resume]
//
// --resume keeps a take whose four files are all newer than every file the clip is built from (its
// screens, this recorder, the overlay, the stack and seed), so a run cut short (the machine ran out of
// memory three times on 12 Oct 2026) carries on instead of starting the clip again. The lock is still
// written only when every language and size is present and fresh.
//
// What one run does, per language and size:
//   1. resets the clips database (howto/stack/stack.py reset), so the clip starts from the same state
//      every time and the player it creates does not exist yet
//   2. opens headless Chrome at 1440x900 (desktop) or 390x844 at 2x (phone), in the language's cookie
//   3. runs the clip script (howto/clips/<clip>.mjs), which presses the REAL site by element: every
//      element is found by its data-howto hook, never by screen coordinates
//   4. records the screen with Chrome's screencast and encodes MP4 + WebM (the site) and a GIF under
//      3 MB (sharing), plus a still for reduced motion: howto/out/<clip>/<clip>-<lang>-<size>.*
//   5. writes howto/clips.lock.json: the hash of every file the clip's screens are built from, which
//      scripts/check-howto-clips.mjs compares on every check-all (the clips rule, inbox #237)
//
// Needs: the clips stack running (backend on HOWTO_BACKEND_PORT 8094 through stack.py serve, the
// frontend on HOWTO_FRONTEND_PORT 3094 pointed at it), AFC_BACKEND_TREE + AFC_BACKEND_PYTHON for
// stack.py, ffmpeg on PATH, Chrome (CHROME_PATH or the default Windows install).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { installOverlay } from "./lib/overlay.mjs";
import { clipSources } from "./lib/sources.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const FRONTEND = `http://localhost:${process.env.HOWTO_FRONTEND_PORT || 3094}`;
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const GIF_LIMIT = 3 * 1024 * 1024; // owner brief: "GIF under 3 MB"

// The two screens every clip is made for (owner brief: "desktop (1440) and phone (390)").
const SIZES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// ── arguments ────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const clipId = argv.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);
if (!clipId) {
  console.error("usage: node howto/render.mjs <clip> [--lang en] [--size desktop|phone|all] [--no-reset] [--no-lock] [--resume]");
  process.exit(2);
}

const clipFile = join(HERE, "clips", `${clipId}.mjs`);
if (!existsSync(clipFile)) {
  console.error(`render: no clip script ${relative(REPO, clipFile)}`);
  process.exit(2);
}
const clip = await import(pathToFileURL(clipFile).href);
const meta = clip.meta;
const langs = (opt("lang", "") || meta.langs.join(",")).split(",");
const sizes = opt("size", "all") === "all" ? Object.keys(SIZES) : opt("size").split(",");

// ── the backend's part (stack.py) ────────────────────────────────────────────────────────────────
function stack(...args) {
  const py = process.env.AFC_BACKEND_PYTHON;
  if (!py || !process.env.AFC_BACKEND_TREE) {
    throw new Error("render: set AFC_BACKEND_PYTHON and AFC_BACKEND_TREE (howto/README.md)");
  }
  const out = spawnSync(py, [join(HERE, "stack", "stack.py"), ...args], {
    env: process.env, encoding: "utf8",
  });
  if (out.status !== 0) throw new Error(`stack.py ${args[0]} failed: ${out.stderr || out.stdout}`);
  return out.stdout.trim();
}

// ── caption text: messages/<lang>/howto.json, hand-written in en, fr and pt ──────────────────────
function captions(lang) {
  const all = JSON.parse(readFileSync(join(REPO, "messages", lang, "howto.json"), "utf8"));
  const steps = all?.clips?.[meta.messages]?.steps;
  if (!steps) throw new Error(`render: messages/${lang}/howto.json has no clips.${meta.messages}.steps`);
  return steps;
}

// ── one recording ────────────────────────────────────────────────────────────────────────────────
async function record(lang, sizeName) {
  const size = SIZES[sizeName];
  const text = captions(lang);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--no-first-run", "--no-default-browser-check", `--lang=${lang}`],
    defaultViewport: size,
  });
  const page = await browser.newPage();
  await page.setCookie({ name: "NEXT_LOCALE", value: lang, domain: "localhost", path: "/" });
  await page.evaluateOnNewDocument(installOverlay);
  // First-visit helpers that are not the clip's subject (the organizer portal's page tours, the
  // two-step sign-in reminder) count as already closed: meta.storage is written into localStorage
  // before any page script runs, the same flags their own Close buttons write.
  if (meta.storage) {
    await page.evaluateOnNewDocument((entries) => {
      try {
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      } catch {
        // storage can be unavailable; the clip then shows the helper, which a take would catch
      }
    }, meta.storage);
  }
  // Clips 2 to 4 start signed in (clip 1 shows signing up and logging in): a session from
  // stack.py token, in the same auth_token cookie the login form sets.
  async function signInAs(username) {
    const token = stack("token", username).split("\n").pop().trim();
    await page.setCookie({ name: "auth_token", value: token, domain: "localhost", path: "/" });
  }
  if (meta.signedInAs) await signInAs(meta.signedInAs);

  // Nothing leaves the machine: a navigation to an outside site (Discord's consent page) answers
  // 204, which keeps the browser on AFC's page. The clip SAYS what the player does there instead of
  // showing or imitating someone else's page (owner rule: no impersonation, no real data on frame).
  const outside = [];
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    const local = ["localhost", "127.0.0.1"].includes(url.hostname) || url.protocol === "data:" || url.protocol === "blob:";
    if (local) return req.continue();
    if (req.isNavigationRequest()) {
      outside.push(url.origin + url.pathname);
      return req.respond({ status: 204, body: "" });
    }
    // Fonts, images and scripts from other hosts load as they do for a visitor.
    return req.continue();
  });

  // Screencast: Chrome sends a frame each time the screen changes, with its own timestamp, so a
  // pause in the clip is a long frame rather than many identical ones.
  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp, data: Buffer.from(f.data, "base64") });
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
    } catch {
      // the session can close between the frame and the ack at the very end; nothing to do
    }
  });

  let stepNo = 0;
  const hook = (id, extra = "") => {
    if (!meta.hooks.includes(id)) throw new Error(`render: hook ${id} is used but not declared in meta.hooks`);
    return `[data-howto="${id}"]${extra}`;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const touch = size.hasTouch;
  // Loading time is not part of the lesson: every wait for a page or a server answer is recorded
  // here (epoch seconds, the clock Chrome stamps screencast frames with) and encode() plays it at
  // most WAIT_KEEP seconds long. The first page's load is dropped entirely (startAt).
  const waits = [];
  let startAt = null;
  async function waiting(fn) {
    const a = Date.now() / 1000;
    try {
      return await fn();
    } finally {
      waits.push([a, Date.now() / 1000]);
    }
  }

  async function settle() {
    await page.evaluate((t) => window.__howto && window.__howto.setTouch(t), touch);
    await page.evaluate(() => document.fonts && document.fonts.ready);
  }

  async function target(id, extra) {
    const sel = hook(id, extra);
    const el = await page.waitForSelector(sel, { visible: true, timeout: 30000 });
    // Wait until React has attached its handlers to the element. On a production build the button
    // is painted before it is live, and a press that early does nothing (the menu stayed shut on
    // the fourth recording). React marks a live node with a __reactProps$<id> key.
    await page.waitForFunction(
      (n) => Object.keys(n).some((k) => k.startsWith("__reactProps")),
      { timeout: 30000 }, el,
    );
    // Bring it into view the way a person scrolls, but only when it is not already comfortably on
    // screen (a scroll per field made the first recording drift for seconds), then measure it.
    const off = await el.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return r.top < 90 || r.bottom > window.innerHeight - 110;
    });
    if (off) {
      await el.evaluate((n) => n.scrollIntoView({ block: "center", behavior: "smooth" }));
      await sleep(380);
      // A long smooth scroll outlasts any fixed pause; measuring while it still moves sends the press
      // to whatever slides under the point. Clip 4 in Portuguese on a phone pressed "Upload / Edit
      // whole group" instead of "Edit Match Results" (12 Oct 2026). Wait until the element stops.
      await page.waitForFunction((n) => {
        const top = n.getBoundingClientRect().top;
        const still = n.__howtoTop !== undefined && Math.abs(n.__howtoTop - top) < 0.5;
        n.__howtoTop = top;
        return still;
      }, { polling: 100, timeout: 4000 }, el).catch(() => {});
    }
    const rect = await el.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    });
    return { el, rect };
  }

  const s = {
    lang,
    size: sizeName,
    stack,
    sleep,
    // Another player's screen (the teammate who accepts an invite): a cut, said by the caption.
    async signInAs(username) {
      await waiting(() => signInAs(username));
    },
    // Replace a box's value (the kills boxes start at 0): press it, select what is there, type.
    async fill(id, value, extra = "") {
      await s.click(id, extra);
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up("Control");
      await page.keyboard.type(String(value), { delay: 6 });
      await sleep(40);
    },
    // Whether a checkbox is ticked (Radix sets aria-checked), so a clip ticks only what is not.
    async checked(id, extra = "") {
      const el = await page.waitForSelector(hook(id, extra), { visible: true, timeout: 30000 });
      return el.evaluate((n) => n.getAttribute("aria-checked") === "true" || n.getAttribute("data-state") === "checked");
    },
    // Type into whatever has focus (a search box that opens already focused, like the teammate
    // picker), at the same pace as s.type.
    async keys(text) {
      await page.keyboard.type(text, { delay: 6 });
      await sleep(40);
    },
    async goto(path) {
      await waiting(async () => {
        await page.goto(FRONTEND + path, { waitUntil: "networkidle2", timeout: 120000 });
        await settle();
      });
      if (startAt === null) startAt = Date.now() / 1000;
    },
    async waitForPath(re, timeout = 60000) {
      // A new page means the last step is over: its caption goes before the page arrives, so a
      // caption never sits on a screen it was not written for (eighth recording: "Press Skip for
      // now" stayed on Home for two seconds).
      await page.evaluate(() => window.__howto && window.__howto.clearCaption()).catch(() => {});
      await waiting(async () => {
        await page.waitForFunction((src) => new RegExp(src).test(location.pathname + location.search), { timeout }, re.source);
        await page.waitForNetworkIdle({ idleTime: 300, timeout }).catch(() => {});
        await settle();
      });
    },
    async waitFor(id, extra = "") {
      await waiting(async () => {
        await page.waitForSelector(hook(id, extra), { visible: true, timeout: 60000 });
        await page.waitForNetworkIdle({ idleTime: 300, timeout: 60000 }).catch(() => {});
        await settle();
      });
    },
    // The backend's part, timed as a wait (it happens off screen).
    async backend(...args) {
      return waiting(async () => stack(...args));
    },
    async caption(key, id = null, opts = {}) {
      stepNo += 1;
      const words = String(text[key] || "").trim();
      if (!words) throw new Error(`render: no caption ${meta.messages}.steps.${key} in ${lang}`);
      let rect = null;
      if (id) rect = (await target(id, opts.extra || "")).rect;
      await page.evaluate((n, w, r, o) => window.__howto.caption(n, w, r, o), stepNo, words, rect, { scrim: !!opts.scrim, place: opts.place || "auto" });
      await sleep(opts.hold ?? 550);
    },
    async clear() {
      await page.evaluate(() => window.__howto.clearCaption());
    },
    // opts.opens: the hook this press must reveal (a menu item, a dialog field). The press waits
    // for that and, if the page re-rendered under it and closed it again (the menu on /home did,
    // while the page was still fetching the new account), presses once more. Waiting is timed as
    // a wait, so it costs nothing on screen.
    async click(id, extra = "", opts = {}) {
      for (let attempt = 1; ; attempt += 1) {
        const { el, rect } = await target(id, extra);
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        await page.evaluate((cx, cy, ms) => window.__howto.moveTo(cx, cy, ms), x, y, touch ? 0 : 180);
        await page.evaluate((cx, cy) => window.__howto.mark(cx, cy), x, y);
        await sleep(70);
        await el.click();
        await sleep(110);
        if (!opts.opens) return;
        const opened = await waiting(() => page
          .waitForSelector(hook(opts.opens), { visible: true, timeout: 2500 })
          .then(() => true, () => false));
        if (opened) return;
        if (attempt >= 3) throw new Error(`render: pressing ${id} never revealed ${opts.opens}`);
      }
    },
    // Let the page finish what it is fetching before the next press (timed as a wait).
    async quiet(ms = 900) {
      await waiting(() => page.waitForNetworkIdle({ idleTime: ms, timeout: 30000 }).catch(() => {}));
    },
    async type(id, value, extra = "") {
      await s.click(id, extra);
      await page.type(hook(id, extra), value, { delay: 6 });
      await sleep(40);
    },
    async hold(ms) {
      await sleep(ms);
    },
    outside,
  };

  // Start on a blank page so the first frame is the clip's own first page, not a load.
  await cdp.send("Page.startScreencast", {
    format: "jpeg", quality: 92,
    maxWidth: size.width * size.deviceScaleFactor, maxHeight: size.height * size.deviceScaleFactor,
  });
  const started = Date.now();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  try {
    await clip.default(s);
  } catch (err) {
    // Leave evidence: where the page was and what it said, next to the outputs.
    const fail = join(HERE, "out", clipId, `FAILED-${lang}-${sizeName}.png`);
    mkdirSync(dirname(fail), { recursive: true });
    await page.screenshot({ path: fail }).catch(() => {});
    console.error(`render: FAILED at ${page.url()} (screenshot ${relative(REPO, fail)})`);
    for (const e of consoleErrors.slice(-8)) console.error(`  console: ${e}`);
    throw err;
  } finally {
    await sleep(300);
    await cdp.send("Page.stopScreencast").catch(() => {});
    await browser.close();
  }
  return { frames, seconds: (Date.now() - started) / 1000, outside, waits, startAt };
}

// ── encoding ─────────────────────────────────────────────────────────────────────────────────────
function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

// How long a wait for a page or a server answer may last on screen: long enough to see that
// something happened, short enough that the clip is about the task and not the network.
const WAIT_KEEP = 0.22;

// On-screen length of the stretch [a, b] once every wait inside it is shortened to WAIT_KEEP.
function shown(a, b, waits) {
  let d = b - a;
  for (const [wa, wb] of waits) {
    const len = wb - wa;
    if (len <= WAIT_KEEP) continue;
    const overlap = Math.max(0, Math.min(b, wb) - Math.max(a, wa));
    d -= overlap * (1 - WAIT_KEEP / len);
  }
  return Math.max(0.001, d);
}

function encode(rec, base, sizeName) {
  // The clip starts on its first page, loaded: Chrome's blank start and the first load are dropped.
  const frames = rec.startAt ? rec.frames.filter((f, i, all) => (all[i + 1] ? all[i + 1].t : Infinity) > rec.startAt) : rec.frames;
  const work = mkdtempSync(join(tmpdir(), "howto-"));
  const list = [];
  frames.forEach((f, i) => {
    const name = join(work, `f${String(i).padStart(5, "0")}.jpg`);
    writeFileSync(name, f.data);
    const next = frames[i + 1];
    const from = i === 0 && rec.startAt ? Math.max(f.t, rec.startAt) : f.t;
    const dur = next ? shown(from, next.t, rec.waits) : 0.8;
    list.push(`file '${name.replace(/\\/g, "/")}'`, `duration ${dur.toFixed(4)}`);
  });
  list.push(`file '${join(work, `f${String(frames.length - 1).padStart(5, "0")}.jpg`).replace(/\\/g, "/")}'`);
  const listFile = join(work, "list.txt");
  writeFileSync(listFile, list.join("\n"));
  const even = "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-vf", `fps=30,${even},format=yuv420p`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", `${base}.mp4`]);
  ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-vf", `fps=30,${even}`,
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", `${base}.webm`]);
  // The still for reduced motion and the poster: the last frame, where the task is done.
  ffmpeg(["-sseof", "-0.5", "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "3", `${base}.jpg`]);
  // GIF: step the size down until it is under 3 MB (owner brief), and say what it took.
  const widths = sizeName === "phone" ? [390, 360, 320, 300] : [960, 860, 760, 680];
  let used = null;
  for (const fps of [12, 10, 8]) {
    for (const w of widths) {
      ffmpeg(["-i", `${base}.mp4`, "-vf",
        `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
        `${base}.gif`]);
      if (statSync(`${base}.gif`).size < GIF_LIMIT) {
        used = { fps, width: w };
        break;
      }
    }
    if (used) break;
  }
  rmSync(work, { recursive: true, force: true });
  if (!used) throw new Error(`render: ${base}.gif stays over 3 MB at the smallest setting`);
  return used;
}

function seconds(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Number(out.trim());
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────
const outDir = join(HERE, "out", clipId);
mkdirSync(outDir, { recursive: true });
const reportFile = join(outDir, "report.json");
const previous = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, "utf8")) : [];
const report = [];
// One row per take, written after every take so a run that is cut short keeps what it finished.
const saveReport = () => {
  const done = new Set(report.map((r) => r.file));
  writeFileSync(reportFile, JSON.stringify([...previous.filter((r) => !done.has(r.file)), ...report], null, 2) + "\n");
};

// ── --resume: a take newer than everything it is built from is kept, not recorded again ─────────
const builtFrom = [
  ...clipSources(REPO, meta, clipFile),
  ...readdirSync(join(HERE, "stack")).filter((f) => f.endsWith(".py")).map((f) => `howto/stack/${f}`),
];
const newestSource = Math.max(...builtFrom.map((f) => statSync(join(REPO, f)).mtimeMs));
const TAKE_FILES = ["mp4", "webm", "gif", "jpg"];
const freshTake = (base) => TAKE_FILES.every((e) => existsSync(`${base}.${e}`))
  && Math.min(...TAKE_FILES.map((e) => statSync(`${base}.${e}`).mtimeMs)) > newestSource;

for (const lang of langs) {
  for (const sizeName of sizes) {
    if (!SIZES[sizeName]) throw new Error(`render: unknown size ${sizeName}`);
    const kept = join(outDir, `${clipId}-${lang}-${sizeName}`);
    if (flag("resume") && freshTake(kept)) {
      const file = relative(REPO, kept).replace(/\\/g, "/");
      const row = previous.find((r) => r.file === file) || {
        file, seconds: Number(seconds(`${kept}.mp4`).toFixed(1)),
        mp4KB: Math.round(statSync(`${kept}.mp4`).size / 1024), webmKB: Math.round(statSync(`${kept}.webm`).size / 1024),
        gifKB: Math.round(statSync(`${kept}.gif`).size / 1024),
      };
      report.push(row);
      console.log(`render: ${clipId} ${lang} ${sizeName} kept (newer than every file it is built from)`);
      continue;
    }
    process.env.HOWTO_LANG = lang; // seed.py gives the invented players this language
    if (!flag("no-reset")) console.log(stack("reset", meta.seed || "").split("\n").pop());
    console.log(`render: ${clipId} ${lang} ${sizeName} ...`);
    const rec = await record(lang, sizeName);
    const { frames, outside } = rec;
    const base = join(outDir, `${clipId}-${lang}-${sizeName}`);
    const gif = encode(rec, base, sizeName);
    const row = {
      file: relative(REPO, base).replace(/\\/g, "/"),
      seconds: Number(seconds(`${base}.mp4`).toFixed(1)),
      mp4KB: Math.round(statSync(`${base}.mp4`).size / 1024),
      webmKB: Math.round(statSync(`${base}.webm`).size / 1024),
      gifKB: Math.round(statSync(`${base}.gif`).size / 1024),
      gif,
      frames: frames.length,
      kept_on_afc: outside,
    };
    report.push(row);
    saveReport();
    console.log(JSON.stringify(row));
    if (row.seconds < meta.seconds[0] || row.seconds > meta.seconds[1]) {
      console.log(`render: WARNING ${row.seconds}s is outside ${meta.seconds.join(" to ")} s`);
    }
  }
}

// ── the lock: what the clip's screens were built from when it was last rendered in full ─────────
const fullSet = langs.length === meta.langs.length && meta.langs.every((l) => langs.includes(l))
  && Object.keys(SIZES).every((z) => sizes.includes(z));
if (!flag("no-lock") && fullSet) {
  const lockFile = join(HERE, "clips.lock.json");
  const lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};
  const files = {};
  for (const f of clipSources(REPO, meta, clipFile)) {
    const body = readFileSync(join(REPO, f), "utf8").replace(/\r\n/g, "\n");
    files[f] = createHash("sha256").update(body).digest("hex").slice(0, 16);
  }
  lock[clipId] = { rendered: new Date().toISOString().slice(0, 10), langs: meta.langs, files };
  writeFileSync(lockFile, JSON.stringify(lock, null, 2) + "\n");
  console.log(`render: lock written for ${clipId} (${Object.keys(files).length} files)`);
} else if (!fullSet) {
  console.log("render: partial run (not every language and size), lock left as it was");
}
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
