/**
 * lib/csRoom.ts - typed client for CLASH SQUAD ROOM SETTINGS (owner 2026-08-12).
 *
 * WHAT THIS IS: the in-game custom-room configuration an organizer builds on AFC - rounds, map,
 * economy, the store, the long list of yes/no toggles, the per-round areas - plus the room ID and
 * password players need to get in. Spec: WEBSITE/tasks/cs-room-settings-spec.md.
 *
 * THE ONE IDEA: a configuration is attached to a SCOPE (event / stage / group / match) and a match
 * resolves the narrowest one that exists: match -> group -> stage -> event. "Apply to every match
 * in this stage" is ONE stage-scoped row; "except the grand final" is one extra match-scoped row.
 * Every read reports which scope the answer came from, so the UI can say "from Stage 1".
 *
 * NO OPTION LIST IS DUPLICATED HERE. The catalogue (every dropdown's values, the ~110-item store
 * with Free Fire's prices, the map/area table, the six built-in modes) is fetched from the backend,
 * which is the single source of truth and the only place a Garena patch has to be applied.
 *
 * Endpoints (backend: afc_tournament_and_scrims/cs_room_views.py, mounted under /events/):
 *   GET    /events/cs-room-catalogue/                        -> the option lists (public)
 *   GET    /events/cs-room-settings/<scope>/<id>/            -> own + effective config (public)
 *   PUT    /events/cs-room-settings/<scope>/<id>/            -> create or update (can_edit_events)
 *   DELETE /events/cs-room-settings/<scope>/<id>/            -> clear the override
 *   GET    /events/cs-room-presets/  POST /events/cs-room-presets/  DELETE .../<id>/
 *
 * CONSUMED BY: components/cs-room-settings.tsx (the four-tab editor, opened from the bracket card
 * for a stage and from a single match) and components/cs-room-card.tsx (what players read).
 */
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

function headers() {
  return { Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` };
}

// ── scopes ────────────────────────────────────────────────────────────────────

/** Where a configuration is attached. Narrowest first - this is also the resolution order. */
export type CSRoomScope = "match" | "group" | "stage" | "event";

// ── catalogue (fetched, never hardcoded) ──────────────────────────────────────

/** A value/label pair from one of the catalogue's dropdowns. */
export interface CSOption {
  value: string;
  label: string;
}

export interface CSToggleDef {
  key: string;
  label: string;
  default: boolean;
}

export interface CSStoreItemDef {
  code: string;
  label: string;
  default_price: number;
}

/** Everything the editor needs to draw itself. Fetched once per page and cached by the caller. */
export interface CSRoomCatalogue {
  rounds: number[];
  economy: CSOption[];
  special_mode: CSOption[];
  special_airdrop: CSOption[];
  hp: number[];
  ep: number[];
  movement_speed: number[];
  jump_height: number[];
  environment: CSOption[];
  maps: CSOption[];
  /** map value -> the areas that map offers. Bermuda is present but empty (Free Fire lists it as a
   *  special mode rather than a Clash Squad map), so the AREA tab hides itself for it. */
  map_areas: Record<string, CSOption[]>;
  toggles: CSToggleDef[];
  store_weapons: CSStoreItemDef[];
  store_items: CSStoreItemDef[];
  economy_events: Array<{ key: string; label: string; default: number }>;
  /** Free Fire's six one-tap modes. Applying one is a PARTIAL patch, exactly like in game.
   *  `config` is that patch, shipped so the create-event wizard - where the stage does not exist
   *  yet and there is nothing to save against - can apply a mode locally and still land on
   *  exactly the values the server would have produced. */
  presets: Array<{
    key: string;
    label: string;
    description: string;
    config: Partial<CSRoomSettings> & { toggles?: Record<string, boolean> };
  }>;
}

// ── a configuration ───────────────────────────────────────────────────────────

/** The settings themselves - shared by a scoped configuration and a reusable preset. */
export interface CSRoomSettings {
  rounds: number;
  economy: string;
  special_mode: string;
  special_airdrop: string;
  hp: number;
  ep: number;
  movement_speed: number;
  jump_height: number;
  environment: string;
  map_name: string;
  /** What this was last built from ("Esports Mode"). A label only: the values are already copied
   *  in, so clearing it changes nothing about how the room plays. */
  preset_key: string;
  toggles: Record<string, boolean>;
  store: Record<string, { enabled: boolean; price: number }>;
  /** Round number (as a string, because JSON has no integer keys) -> starting cash. */
  round_economy: Record<string, number>;
  economy_events: Record<string, number>;
  /** Round number -> the area of the map played that round. */
  areas: Record<string, string>;
}

/** A saved configuration, plus the bits only a SCOPED one has. */
export interface CSRoomConfig extends CSRoomSettings {
  cs_room_config_id: number;
  scope: CSRoomScope;
  scope_object_id: number;
  room_id: string;
  room_password: string;
  notes: string;
  /** Off until the organizer is ready. An unpublished room's ID and password are hidden from
   *  everyone who cannot manage the event, so they are not on a public page hours early. */
  is_published: boolean;
  /** True when a room ID or password exists, even when it is being withheld - lets the public card
   *  say "the organizer has not opened the room yet" instead of pretending there is nothing. */
  has_room_credentials: boolean;
  updated_at: string;
}

/** The short line a player reads before opening the full settings. Values are CODES; the labels
 *  come from the catalogue, so no English leaks out of the backend into a French player's screen. */
export interface CSRoomSummary {
  rounds: number;
  map_name: string;
  economy: string;
  hp: number;
  special_mode: string;
  environment: string;
  headshot: boolean;
  character_skill: boolean;
  loadout: boolean;
  gun_attributes: boolean;
  /** Round wins needed to take the set (13 rounds -> 7). Also the cap the backend enforces on a
   *  reported score. */
  wins_needed: number;
}

/** The GET / PUT response: this scope's OWN row, the one that actually applies, and where from. */
export interface CSRoomSettingsResponse {
  scope: CSRoomScope;
  object_id: number;
  /** null when this scope has no configuration of its own and simply inherits. */
  own: CSRoomConfig | null;
  effective: CSRoomConfig | null;
  effective_scope: CSRoomScope | null;
  summary: CSRoomSummary | null;
  can_manage: boolean;
}

export interface CSRoomPreset extends CSRoomSettings {
  cs_room_preset_id: number;
  name: string;
  description: string;
  /** null = an AFC-global preset (the six Free Fire modes, seeded read-only). */
  organization_id: number | null;
  is_builtin: boolean;
}

// ── api ───────────────────────────────────────────────────────────────────────

export const csRoomApi = {
  /** Every option the Free Fire room screen offers. Public and static: fetch once per page. */
  getCatalogue: async () =>
    (await axios.get<CSRoomCatalogue>(`${BASE}/cs-room-catalogue/`)).data,

  /** This scope's own configuration plus the one that applies. Public read; the room ID and
   *  password come back blank unless the caller manages the event or the room is published. */
  get: async (scope: CSRoomScope, objectId: number) =>
    (
      await axios.get<CSRoomSettingsResponse>(
        `${BASE}/cs-room-settings/${scope}/${objectId}/`,
        { headers: headers() },
      )
    ).data,

  /** Create or update THE configuration for a scope (idempotent - one row per scope).
   *  Anything omitted keeps its stored value, so one tab can save without wiping the others.
   *  apply_mode applies one of Free Fire's built-in modes first, and the body's own fields then
   *  win, so "Esports Mode, but 7 rounds" is a single request. */
  save: async (
    scope: CSRoomScope,
    objectId: number,
    patch: Partial<CSRoomSettings> & {
      room_id?: string;
      room_password?: string;
      notes?: string;
      is_published?: boolean;
      apply_mode?: string;
      apply_preset_id?: number;
    },
  ) =>
    (
      await axios.put<CSRoomSettingsResponse & { message: string }>(
        `${BASE}/cs-room-settings/${scope}/${objectId}/`,
        patch,
        { headers: headers() },
      )
    ).data,

  /** Drop the override at this scope so it inherits again. */
  clear: async (scope: CSRoomScope, objectId: number) =>
    (
      await axios.delete<CSRoomSettingsResponse & { message: string }>(
        `${BASE}/cs-room-settings/${scope}/${objectId}/`,
        { headers: headers() },
      )
    ).data,

  /** Presets the caller may apply: AFC-global, plus their own organizations'. */
  listPresets: async () =>
    (
      await axios.get<{ presets: CSRoomPreset[] }>(`${BASE}/cs-room-presets/`, {
        headers: headers(),
      })
    ).data.presets,

  /** Save a configuration as a reusable preset. `from` copies an existing scope's settings, which
   *  is the normal path out of the editor ("save these as a preset"). */
  savePreset: async (body: {
    name: string;
    description?: string;
    organization_id?: number | null;
    from?: { scope: CSRoomScope; object_id: number };
  }) =>
    (
      await axios.post<{ message: string; preset: CSRoomPreset }>(
        `${BASE}/cs-room-presets/`,
        body,
        { headers: headers() },
      )
    ).data,

  deletePreset: async (presetId: number) =>
    (
      await axios.delete<{ message: string }>(`${BASE}/cs-room-presets/${presetId}/`, {
        headers: headers(),
      })
    ).data,
};

// ── display helpers (shared by the editor and the player-facing card) ─────────

/** The catalogue label for a coded value, falling back to the code so a value the catalogue has
 *  not caught up with still renders as something rather than as blank. */
export function optionLabel(options: CSOption[] | undefined, value: string): string {
  return options?.find((o) => o.value === value)?.label ?? value;
}

/** Starting cash for each round of a `rounds`-round set: Free Fire's own curve for the first
 *  seven, then the last value repeats, which is what the game does for longer sets. Mirrors
 *  cs_room_catalogue.default_round_economy so a drafted room matches a saved one. */
function defaultRoundEconomy(rounds: number): Record<string, number> {
  const curve = [500, 900, 1100, 1700, 2100, 2400, 3000];
  const out: Record<string, number> = {};
  for (let n = 1; n <= rounds; n += 1) out[String(n)] = curve[Math.min(n, curve.length) - 1];
  return out;
}

/** One area per round, walking the map's list and wrapping - the order the game pre-fills. */
function defaultAreas(
  catalogue: CSRoomCatalogue, rounds: number, mapName: string,
): Record<string, string> {
  const areas = catalogue.map_areas[mapName] ?? [];
  if (areas.length === 0) return {};
  const out: Record<string, string> = {};
  for (let n = 1; n <= rounds; n += 1) out[String(n)] = areas[(n - 1) % areas.length].value;
  return out;
}

/** A fresh Free Fire room, built entirely from the catalogue. Mirrors cs_room.blank_settings()
 *  on the backend, and is what the create-event wizard starts from (there is no saved scope to
 *  read yet, so it cannot ask the server). */
export function blankSettings(catalogue: CSRoomCatalogue): CSRoomSettings {
  const rounds = 7;
  const map_name = catalogue.maps[0]?.value ?? "nexterra";
  return {
    rounds,
    economy: catalogue.economy[0]?.value ?? "500",
    special_mode: catalogue.special_mode[0]?.value ?? "no",
    special_airdrop: catalogue.special_airdrop[0]?.value ?? "no",
    hp: catalogue.hp[0] ?? 200,
    ep: catalogue.ep[0] ?? 0,
    movement_speed: catalogue.movement_speed[0] ?? 100,
    jump_height: catalogue.jump_height[0] ?? 100,
    environment: catalogue.environment[0]?.value ?? "day",
    map_name,
    preset_key: "",
    toggles: Object.fromEntries(catalogue.toggles.map((t) => [t.key, t.default])),
    store: Object.fromEntries(
      [...catalogue.store_weapons, ...catalogue.store_items].map((i) => [
        i.code, { enabled: true, price: i.default_price },
      ]),
    ),
    round_economy: defaultRoundEconomy(rounds),
    economy_events: Object.fromEntries(catalogue.economy_events.map((e) => [e.key, e.default])),
    areas: defaultAreas(catalogue, rounds, map_name),
  };
}

/** Apply one of Free Fire's built-in modes on top of `base`, client-side.
 *
 *  Used ONLY where there is no saved scope to PUT against - the create-event wizard. The scoped
 *  editor asks the server instead, so the modes stay defined in exactly one place
 *  (cs_room_catalogue.PRESET_MODES) and both paths land on the same values. Modes are PARTIAL,
 *  like the in-game buttons: toggles merge key by key rather than replacing the set, and the
 *  per-round documents are refilled because rounds may have moved. */
export function applyBuiltinMode(
  catalogue: CSRoomCatalogue,
  modeKey: string,
  base: CSRoomSettings,
): CSRoomSettings {
  const mode = catalogue.presets.find((p) => p.key === modeKey);
  // `config` was added to the catalogue payload after the presets themselves shipped, so a browser
  // holding an older response has presets with no patch at all. Returning `base` unchanged is the
  // honest outcome - nothing to apply - and it must never throw: crashing the editor over a stale
  // cache would lose everything the organizer had typed into it.
  if (!mode?.config) return base;
  const { toggles, ...patch } = mode.config;
  const next: CSRoomSettings = { ...base, ...patch };
  if (toggles) next.toggles = { ...base.toggles, ...toggles };
  next.round_economy = defaultRoundEconomy(next.rounds);
  next.areas = defaultAreas(catalogue, next.rounds, next.map_name);
  next.preset_key = mode.label.slice(0, 40);
  return next;
}
