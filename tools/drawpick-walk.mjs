/**
 * Headless walk of the group draw pick animation (inbox #411), over CDP with no dependencies.
 *
 * WHAT IT PROVES: the board deals, a captain picks a card, the pick stage plays (lift, turn, one
 * flash, shake, confetti, fly home), and none of it holds the main thread. With --throttle 4 the
 * CPU is slowed 4x (Emulation.setCPUThrottlingRate) and a PerformanceObserver "longtask" records
 * every task over 50 ms in two windows: the deal (from the first card in the DOM) and the pick (from
 * the tap on "Turn it over"). The script prints the longest task in each window.
 *
 * Usage:
 *   node tools/drawpick-walk.mjs --url http://localhost:3206/tournaments/<slug> --out <dir> --tag <name>
 *        [--token <auth_token>]  signed in as that captain; omit for a signed-out viewer
 *        [--width 390 --height 844 --mobile 1]  [--throttle 4]  [--reduced 1]  [--pick 5]  [--port 9336]
 *
 * Connects to: the website dev server (the board is app/(user)/tournaments/[slug]/_components/
 * GroupDrawBoard.tsx) and, through it, afc_draws. Screenshots go to <out>/<tag>-*.png.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const WIDTH = Number(args.width || 390);
const HEIGHT = Number(args.height || 844);
const MOBILE = (args.mobile ?? "1") === "1";
const THROTTLE = Number(args.throttle || 1);
const PICK = Number(args.pick || 5);
const PORT = Number(args.port || 9336);
const OUT = args.out;
const TAG = args.tag || "walk";
mkdirSync(OUT, { recursive: true });
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
// A board card: the new data attribute, or (on the pre-change board, for the before measurement) the grid buttons.
const CARD = "[data-draw-card], section .grid > button[aria-pressed]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "afc-drawpick-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
  `--window-size=${WIDTH},${HEIGHT}`, "about:blank",
], { stdio: "ignore" });

let page;
for (let i = 0; i < 60 && !page; i++) {
  try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* not up */ }
  if (!page) await sleep(250);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const consoleErrors = [];
const failed = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  } else if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 300));
  } else if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
    failed.push(`${msg.params.response.status} ${msg.params.response.url}`);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${TAG}-${name}.png`), Buffer.from(r.data, "base64"));
};

await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE });
if (MOBILE) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
if (args.reduced === "1") await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
if (args.token) {
  await send("Network.setCookie", { name: "auth_token", value: args.token, domain: "localhost", path: "/", sameSite: "Strict" });
}
// Long tasks, from before the page's own scripts: every one with its start time, plus marks the
// script sets itself so a window can be cut out afterwards.
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.__lt = []; window.__mark = {};
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true });
  new MutationObserver(() => {
    if (!window.__mark.stageSeen && document.querySelector("body > div.fixed.inset-0.z-50")) window.__mark.stageSeen = true;
    if (!window.__mark.deal && document.querySelector(${JSON.stringify(CARD)})) window.__mark.deal = performance.now();
  }).observe(document, { childList: true, subtree: true });
` });

// Warm the dev compile first at full speed, then measure with the throttle on.
await send("Page.navigate", { url: args.url });
await sleep(THROTTLE > 1 ? 12000 : 6000);
if (THROTTLE > 1) {
  await send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await send("Page.reload");
  await sleep(9000);
}
await ev(`document.querySelector(${JSON.stringify(CARD)})?.scrollIntoView({ block: "center" })`);
await sleep(600);
await shot("1-board");
const cards = await ev(`document.querySelectorAll(${JSON.stringify(CARD)}).length`);
const overflow = await ev(`document.documentElement.scrollWidth > window.innerWidth + 1`);
const dealWin = await ev(`(() => { const m = window.__mark.deal || 0; return window.__lt.filter(([s]) => s >= m && s < m + 2500).map(([s, d]) => Math.round(d)); })()`);
console.log(`cards=${cards} overflowX=${overflow} dealLongTasks=${JSON.stringify(dealWin)}`);

if (args.idle === "1") {
  // No pick: what does the page cost on its own (the 8 s poll, the dev server)? Long tasks over 16 s.
  await sleep(16000);
  const idle = await ev(`(() => { const m = window.__mark.deal || 0; return window.__lt.filter(([s]) => s >= m + 2500).map(([s, d]) => [Math.round(s - m), Math.round(d)]); })()`);
  console.log("IDLE long tasks after the deal window (offset from first card, ms): " + JSON.stringify(idle));
  ws.close(); chrome.kill(); process.exit(0);
}
let result = { picked: false };
if (args.token) {
  const selectable = await ev(`(() => { const b = document.querySelectorAll(${JSON.stringify(CARD)})[${PICK - 1}]; return !!b && !b.disabled; })()`);
  if (!selectable) { console.log("card not selectable"); }
  else {
    await ev(`document.querySelectorAll(${JSON.stringify(CARD)})[${PICK - 1}].click()`);
    await sleep(900);
    await shot("2-selected");
    if (args.profile === "1") { await send("Profiler.enable"); await send("Profiler.setSamplingInterval", { interval: 1000 }); await send("Profiler.start"); }
    const t0 = await ev(`(() => { window.__mark.pick = performance.now(); const b = [...document.querySelectorAll("button")].find((x) => /^Turn it over$/.test(x.textContent.trim())); b.click(); return window.__mark.pick; })()`);
    const times = [450, 700, 1000, 1300, 1600, 2000];
    let last = 0;
    for (const [i, at] of times.entries()) {
      await sleep(Math.max(0, at - last) * Math.max(1, THROTTLE / 2));
      last = at;
      if (args.noshots !== "1") await shot(`3-stage-${i}`);
    }
    await sleep(5000);
    // The long tasks are read BEFORE any screenshot of the finished state: a screenshot is itself a long task.
    if (args.profile === "1") {
      // Self time per function over the pick: where the main thread went.
      const { profile } = await send("Profiler.stop");
      const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      profile.samples.forEach((sid, i) => { const n = byId.get(sid); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").slice(-2).join("/")}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });
      console.log("PROFILE top self ms: " + JSON.stringify([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${Math.round(v)} ${k}`), null, 1));
    }
    const stageGone = await ev(`!document.querySelector("body > div.fixed.inset-0.z-50")`);
    const banner = await ev(`document.querySelector('[role="status"]')?.textContent ?? null`);
    const pickWin = await ev(`(() => { const m = window.__mark.pick; return window.__lt.filter(([s]) => s >= m && s < m + 6000).map(([s, d]) => [Math.round(s - m), Math.round(d)]); })()`);
    await ev(`document.querySelector(${JSON.stringify(CARD)})?.scrollIntoView({ block: "center" })`);
    await sleep(500);
    await shot("4-done");
    const stageSeen = await ev(`!!window.__mark.stageSeen`);
    result = { picked: true, stageSeen, stageGone, banner, pickLongTasks: pickWin };
  }
}
console.log("RESULT " + JSON.stringify(result));
console.log("consoleErrors " + JSON.stringify(consoleErrors));
console.log("http>=400 " + JSON.stringify(failed));
ws.close(); chrome.kill(); process.exit(0);
