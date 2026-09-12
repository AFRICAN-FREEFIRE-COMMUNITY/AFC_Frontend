// lib/draws.ts - the GROUP DRAW API client (owner 2026-09-12, Phase 1).
//
// Backend: afc_draws/views.py, mounted at draws/. A stage's organizer deals a sealed set of cards
// (one per team), opens a window, and every captain turns one card over on the event page to learn
// their group. Whoever has not picked by the close time is dealt in automatically.
//
// Consumed by:
//   - app/(user)/tournaments/[slug]/_components/GroupDrawBoard.tsx   the public board + the pick
//   - app/(a)/a/events/[slug]/edit/_components/GroupDrawCard.tsx     the organizer/admin controls
//
// Reads are public; a Bearer token (authHeaders) adds `viewer`, what this person may pick for.
// Every write answers with the whole board so the caller renders the new state in one go.
import axios from "axios";

import { env } from "@/lib/env";
import { authHeaders, optionalAuthHeaders } from "@/lib/http";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/draws`;

export type DrawStatus = "draft" | "open" | "closed";

export interface DrawCard {
  number: number;
  taken: boolean;
  // Only revealed on a taken card while the draw is open; every card once closed.
  group_id: number | null;
  group_name: string | null;
  competitor: string | null;
  via: "pick" | "auto" | null;
  picked_at: string | null;
}

export interface DrawViewerCompetitor {
  tournament_team_id: number | null;
  player_id: number | null;
  name: string;
  card_number: number | null;
  group_name: string | null;
  // "pick" when they turned the card over, "auto" when the close dealt it to them.
  via: "pick" | "auto" | null;
}

export interface DrawBoard {
  draw_id: number;
  stage_id: number;
  stage_name: string;
  event_id: number;
  status: DrawStatus;
  opens_at: string | null;
  closes_at: string | null;
  closed_at: string | null;
  // The organizer's choice for whoever has not picked at close: dealt in (true) or left for
  // hand placement (false). Set at open, changeable while open (drawsApi.window).
  auto_place_at_close: boolean;
  // Who may see the board: "everyone" (default) or "participants" (members of a registered
  // club, registered solo players, and whoever runs the draw). The organizer's choice.
  visibility: "everyone" | "participants";
  // Present (true) ONLY on the stub a viewer gets for a participants-only board they may not
  // see: then cards, names, seal and mapping are absent. See DrawBoardHidden.
  hidden?: false;
  // The stage's "Teams per group" (competitors_per_group); null when no fixed size is set.
  per_group: number | null;
  // When the last "you have not picked" reminder went out. Reminders send only when the organizer
  // presses the button; the backend refuses a second press inside a minute (a double-send guard).
  last_reminder_at: string | null;
  // sha256(salt:mapping), shown before anyone picks; salt + mapping arrive once closed.
  commitment: string;
  groups: Array<{ group_id: number; group_name: string }>;
  cards_total: number;
  cards_taken: number;
  cards: DrawCard[];
  salt: string | null;
  mapping: Array<[number, number]> | null;
  // Names of the competitors with no card yet (open), or left for the organizer (closed
  // without placing the rest).
  unpicked: string[];
  viewer: {
    can_pick: boolean;
    competitors: DrawViewerCompetitor[];
    can_manage: boolean;
  } | null;
}

// Reads: a Bearer header when the viewer is signed in, nothing otherwise. The board is public
// and a logged-out visitor must still be able to watch it, so the header is optionalAuthHeaders
// (lib/http), which never constructs SessionExpiredError for a guest. The first cut wrapped
// authHeaders() in try/catch; the throw was swallowed but the error had already opened the
// "Session expired" modal from its constructor, for every guest on an event page (2026-09-12).
async function get<T>(path: string, auth: "optional" | "required" = "optional"): Promise<T> {
  const headers = auth === "required" ? authHeaders() : optionalAuthHeaders();
  return (await axios.get(`${BASE}/${path}`, { headers })).data;
}

async function post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return (await axios.post(`${BASE}/${path}`, body ?? {}, { headers: authHeaders() })).data;
}

export const drawsApi = {
  // GET draws/events/<event_id>/ -> every draw of the event, one board per stage that has one.
  forEvent: (eventId: number) => get<{ draws: DrawBoardOrHidden[] }>(`events/${eventId}/`),
  // GET draws/<id>/board/ -> the board (public; token adds viewer).
  board: (drawId: number) => get<DrawBoard>(`${drawId}/board/`),
  // Organizer / admin lifecycle (afc_draws.services.user_may_run_draw decides who).
  create: (stageId: number) => post<DrawBoard>(`stages/${stageId}/create/`),
  open: (drawId: number, closesAtIso: string, autoPlaceAtClose = true) =>
    post<DrawBoard>(`${drawId}/open/`, { closes_at: closesAtIso, auto_place_at_close: autoPlaceAtClose }),
  // POST draws/<id>/window/: a new close time and/or the straggler choice (while open), and/or
  // who may see the board (any state).
  window: (
    drawId: number,
    body: { closes_at?: string; auto_place_at_close?: boolean; visibility?: "everyone" | "participants" },
  ) => post<DrawBoard>(`${drawId}/window/`, body),
  // POST draws/<id>/close/ {place_rest}: undefined = the choice made at open.
  close: (drawId: number, placeRest?: boolean) =>
    post<DrawBoard>(`${drawId}/close/`, placeRest === undefined ? {} : { place_rest: placeRest }),
  // POST draws/<id>/remind/: in-app + email to everyone who has not picked, on the organizer's press
  // only (429 for a second press inside a minute).
  remind: (drawId: number) => post<DrawBoard & { reminded: number }>(`${drawId}/remind/`),
  reset: (drawId: number) => post<{ message: string }>(`${drawId}/reset/`),
  // The pick: a captain (or solo player) turns card `number` over. tournament_team_id only when
  // the viewer may act for more than one team in the stage.
  pick: (drawId: number, cardNumber: number, tournamentTeamId?: number | null) =>
    post<DrawBoard>(`${drawId}/pick/`, {
      card_number: cardNumber,
      ...(tournamentTeamId ? { tournament_team_id: tournamentTeamId } : {}),
    }),
};

// What a viewer who may not see a participants-only board receives instead of a DrawBoard.
export interface DrawBoardHidden {
  draw_id: number;
  stage_id: number;
  stage_name: string;
  event_id: number;
  status: DrawStatus;
  visibility: "participants";
  hidden: true;
}

export type DrawBoardOrHidden = DrawBoard | DrawBoardHidden;

export function isHiddenBoard(b: DrawBoardOrHidden): b is DrawBoardHidden {
  return (b as DrawBoardHidden).hidden === true;
}

// Pull a useful message off an axios error without inventing backend shapes.
export function drawErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message || data?.detail || fallback;
}
