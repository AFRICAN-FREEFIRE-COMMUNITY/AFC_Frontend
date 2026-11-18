/**
 * lib/broadcastKit.ts
 * ───────────────────
 * Pure helpers for components/overlay/BroadcastKitCard.tsx (AFC inbox #618, owner 18 Nov 2026): which
 * of the organizer's picked files the Free Fire client will actually read, and whether one download
 * fits the API's request limit.
 *
 * The game's own name lists come from the server, never from here: GET events/<id>/broadcast-kit/
 * answers `names.hud_panels`, `names.hud_misspelt` and `names.map_skins`, read from
 * afc_tournament_and_scrims/client_files.py (one list, matched the same way on both sides: without
 * capitals, ".png" optional). The server checks again on download and lists anything else in the zip's
 * HOW_TO_USE.txt, so this is the preview of that decision, not the guard.
 *
 * Tests: node --test lib/__tests__/broadcastKit.test.ts
 */

/** nginx takes 25 MB per request on the API host (deploy/vps/nginx-afc.conf); keep a margin. */
export const KIT_UPLOAD_LIMIT_BYTES = 24 * 1024 * 1024;

export type KitFileMatch = {
  /** Files the game reads, with the game's spelling of the name. One per name (the last one wins). */
  used: { file: string; name: string }[];
  /** Files the game never reads; `hint` is the name it does read when the file is a known misspelling. */
  unknown: { file: string; hint?: string }[];
};

/** "KillFeedsBackground.PNG" -> "killfeedsbackground"; the amphibian's "x.png .png" -> "x". */
function baseName(file: string): string {
  return file.trim().replace(/\.png\s*(\.png)?$/i, "").toLowerCase();
}

export function matchKitFiles(
  files: string[],
  names: string[],
  misspelt: Record<string, string> = {},
): KitFileMatch {
  const byLower = new Map(names.map((n) => [n.toLowerCase(), n]));
  const used = new Map<string, { file: string; name: string }>();
  const unknown: KitFileMatch["unknown"] = [];
  for (const file of files) {
    const base = baseName(file);
    const name = byLower.get(base);
    if (name) used.set(name, { file, name });
    else unknown.push(misspelt[base] ? { file, hint: misspelt[base] } : { file });
  }
  return { used: [...used.values()], unknown };
}

/** Total bytes of everything one download would send. */
export function kitUploadBytes(files: (File | { size: number } | null | undefined)[]): number {
  return files.reduce((sum, f) => sum + (f ? f.size : 0), 0);
}
