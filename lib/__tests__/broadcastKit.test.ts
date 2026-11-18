/**
 * lib/__tests__/broadcastKit.test.ts
 * ──────────────────────────────────
 * Unit tests for lib/broadcastKit.ts (AFC inbox #618): the Broadcast Kit card's preview of which
 * picked files the Free Fire client reads.
 *
 * Run with:  node --test lib/__tests__/broadcastKit.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { kitUploadBytes, matchKitFiles } from "../broadcastKit.ts";

const PANELS = ["KillFeedsBackground", "NationBg", "EPBackground", "hp1"];
const MISSPELT = { nationalbg: "NationBg" };

test("matches without capitals and gives back the game's spelling", () => {
  const m = matchKitFiles(["killfeedsbackground.PNG", "EpBackground.png", "HP1.png"], PANELS);
  assert.deepEqual(m.used.map((u) => u.name), ["KillFeedsBackground", "EPBackground", "hp1"]);
  assert.deepEqual(m.unknown, []);
});

test("a known misspelling names the panel the game does read", () => {
  const m = matchKitFiles(["NationalBg.png", "hp14.png"], PANELS, MISSPELT);
  assert.deepEqual(m.used, []);
  assert.deepEqual(m.unknown, [{ file: "NationalBg.png", hint: "NationBg" }, { file: "hp14.png" }]);
});

test("two files for one panel: the last one wins", () => {
  const m = matchKitFiles(["hp1.png", "HP1.png"], PANELS);
  assert.deepEqual(m.used, [{ file: "HP1.png", name: "hp1" }]);
});

test("the amphibian skin matches under its plain and its odd name", () => {
  const skins = ["Vehicle_Amphibian_Sponsor1_D"];
  assert.equal(matchKitFiles(["Vehicle_Amphibian_Sponsor1_D.png"], skins).used.length, 1);
  assert.equal(matchKitFiles(["Vehicle_Amphibian_Sponsor1_D.png .png"], skins).used.length, 1);
});

test("upload size adds every file and skips the empty slots", () => {
  assert.equal(kitUploadBytes([{ size: 10 }, null, { size: 5 }, undefined]), 15);
});
