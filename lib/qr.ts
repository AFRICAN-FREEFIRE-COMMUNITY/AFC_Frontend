// lib/qr.ts
// ─────────────────────────────────────────────────────────────────────────────
// QR CODES API client (inbox #46, owner 2026-09-26)
//
// Anyone viewing an event, team, player profile or news article can make a QR for it. The QR
// never encodes the page address: it encodes a short link, /q/<token>, so a scan is counted before
// the visitor is forwarded (app/q/[token]/route.ts). There is one short link per page, shared by
// everyone, so every poster and card printed for a page adds to the same count.
//
// Backend: afc_qr/views.py (prefix qr/).
//   POST qr/link/          getQrLink   public, get-or-create, rate limited
//   GET  qr/stats/<token>/ getQrStats  Bearer, page owner only (403 not_page_owner otherwise)
// The card image (app/qr/[token]/card) and poster (app/qr/[token]/poster) read qr/info/<token>/
// server side, and the redirect reads qr/scan/<token>/; neither goes through this file.
// Caller: components/qr/QrShareButton.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";
import { env } from "@/lib/env";
import { optionalAuthHeaders } from "@/lib/http";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

export type QrTargetType = "event" | "team" | "player" | "news";

export interface QrLink {
  token: string;
  /** "/q/<token>", relative to the site */
  url_path: string;
  target_type: QrTargetType;
  name: string;
}

export interface QrStats {
  scan_count: number;
  /** ISO instant, or null when never scanned */
  last_scanned_at: string | null;
}

/** The full short link a QR encodes, on the site's own origin. */
export function shortUrl(token: string): string {
  return `${env.NEXT_PUBLIC_URL.replace(/\/$/, "")}/q/${token}`;
}

/**
 * The page's short link, made on first request. `ref` is what the page URL carries: an event or
 * news slug, a team name, a player username. The Bearer is optional and only records who asked.
 */
export async function getQrLink(targetType: QrTargetType, ref: string): Promise<QrLink> {
  const res = await axios.post<QrLink>(
    `${BASE}/qr/link/`,
    { target_type: targetType, ref },
    { headers: optionalAuthHeaders() },
  );
  return res.data;
}

/** The scan count, for the page's owner. Null for anyone else, and when signed out. */
export async function getQrStats(token: string): Promise<QrStats | null> {
  const headers = optionalAuthHeaders();
  if (!("Authorization" in headers)) return null;
  try {
    const res = await axios.get<QrStats>(`${BASE}/qr/stats/${token}/`, { headers });
    return res.data;
  } catch {
    // 403 not_page_owner is the ordinary answer for everyone but the page's owner: the dialog asks
    // on behalf of any signed-in viewer and the server decides. The count simply stays hidden.
    return null;
  }
}
