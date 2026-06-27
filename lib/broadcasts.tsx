// lib/broadcasts.tsx
// ─────────────────────────────────────────────────────────────────────────────
// BROADCASTS API client + organizer rate-limit UI helpers (owner 2026-06-27)
//
// Two concerns live in this one domain file:
//
//  1. broadcastsApi — typed client for the two broadcast read surfaces:
//       • all()         GET /auth/all-broadcasts/             ADMIN audit of EVERY broadcast (any
//                       sender / scope / event) — powers the admin "Broadcasts" page
//                       (app/(a)/a/broadcasts/page.tsx). Server-gated to is_broadcast_admin.
//       • rateStatus()  GET /events/broadcast-rate-status/    the CURRENT user's organizer broadcast
//                       budget, read WITHOUT consuming a slot, so a composer can show "N of 5 left"
//                       the moment it opens. Any authenticated user (the numbers are self-scoped).
//     Bearer auth from the auth_token cookie — same pattern as lib/watchlist.ts / lib/eventLinks.ts.
//     Backend: afc_auth.get_all_broadcasts + afc_tournament_and_scrims.broadcast_rate_status.
//
//  2. useBroadcastRate() hook + <BroadcastRateNotice/> — the shared rate-limit UI that BOTH broadcast
//     composers reuse: app/(a)/a/events/_components/SendNotificationModal.tsx (per-group "Message
//     group") and the announcement dialog in
//     app/(a)/a/events/[slug]/edit/_components/ActionsTab.tsx. The hook fetches the budget when the
//     composer opens and exposes applySuccess()/apply429() so the send handlers keep the counter live
//     without a refetch; the component renders "N of 5 left this hour" + a live "send again at"
//     countdown ONLY when the sender is not exempt. Admins are exempt → it renders nothing, so the
//     admin composer UX is unchanged. Organizer-facing → every string comes from the `broadcast` i18n
//     namespace (messages/en/broadcast.json) and the time renders in the viewer's timezone (LocalTime).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { LocalTime } from "@/components/LocalTime";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
// Bearer header from the auth_token cookie (AuthContext writes the JWT there). Mirrors lib/watchlist.ts.
const auth = () => ({ Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` });

// The six broadcast scopes (afc_auth.SentBroadcast.SCOPE_CHOICES). Used by the admin audit scope filter.
export type BroadcastScope =
  | "general"
  | "event"
  | "stage"
  | "group"
  | "room_details"
  | "direct";

// One row from GET /auth/all-broadcasts/ (SentBroadcast.to_history_dict + sender_id). created_at is a
// UTC instant — render with <LocalTime>. Same shape as the per-event BroadcastHistory row, plus
// sender_id (so the audit can filter to one organizer) and event_name (which event it came from).
export interface AdminBroadcastRow {
  id: number;
  scope: BroadcastScope | string;
  scope_label: string;
  title: string;
  message: string;
  delivery: string;
  recipient_count: number;
  sender_username: string;
  sender_id: number | null;
  event_id: number | null;
  event_name: string;
  stage_id: number | null;
  stage_name: string;
  group_id: number | null;
  group_name: string;
  targets: { target_type: string; target_id: string }[];
  created_at: string;
}

export interface AllBroadcastsResponse {
  results: AdminBroadcastRow[];
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

// Snapshot from GET /events/broadcast-rate-status/. exempt=true for admins (no limits shown).
export interface BroadcastRateStatus {
  exempt: boolean;
  remaining: number;
  limit: number;
  cooldown_until: string | null; // ISO time the 5-min cooldown lifts, or null
}

// Extra fields the SEND endpoints add on success ({ ...rate_remaining, rate_limit }); used to keep the
// composer counter live without a refetch.
export interface BroadcastSendMeta {
  rate_remaining?: number;
  rate_limit?: number;
}

// Body of a 429 from a send endpoint (a non-admin organizer over the hourly cap or inside the cooldown).
export interface BroadcastRateLimitBody {
  message?: string;
  reason?: "cooldown" | "hourly";
  resets_at?: string; // ISO time sending re-opens
  remaining?: number;
  limit?: number;
}

export const broadcastsApi = {
  /** ADMIN audit list of every broadcast. All filters optional + AND-combined; paginated by limit/offset. */
  async all(
    params: {
      scope?: string;
      sender_id?: number;
      event_id?: number;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<AllBroadcastsResponse> {
    const res = await axios.get<AllBroadcastsResponse>(`${BASE}/auth/all-broadcasts/`, {
      headers: auth(),
      params,
    });
    return res.data;
  },

  /** The caller's own organizer broadcast budget (does NOT consume a slot). */
  async rateStatus(): Promise<BroadcastRateStatus> {
    const res = await axios.get<BroadcastRateStatus>(
      `${BASE}/events/broadcast-rate-status/`,
      { headers: auth() },
    );
    return res.data;
  },
};

// ── Shared rate-limit UI for the broadcast composers ──────────────────────────

/**
 * useBroadcastRate — owns the organizer rate-limit budget for ONE broadcast composer.
 *
 * @param open  the composer's open flag; the budget is (re)fetched each time it flips open so the
 *              counter is fresh the moment the dialog appears.
 * @returns
 *   rate          latest snapshot (null until first fetch; exempt=true for admins → notice hidden).
 *   refresh       force a re-fetch of the budget.
 *   applySuccess  pass the SEND response data to update remaining/limit after a successful send.
 *   apply429      pass the 429 response body to reflect the new block (sets cooldown_until + counts).
 *
 * Consumed by SendNotificationModal + ActionsTab. The send endpoints remain the real authority; this
 * is purely the live FE counter.
 */
export function useBroadcastRate(open: boolean) {
  const [rate, setRate] = useState<BroadcastRateStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRate(await broadcastsApi.rateStatus());
    } catch {
      // A failed budget read must never block sending; just hide the counter.
      setRate(null);
    }
  }, []);

  // Refetch whenever the composer opens (fresh "N left" + cooldown each time).
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // After a successful send: update remaining/limit from the response (admins stay exempt → hidden).
  const applySuccess = useCallback((meta?: BroadcastSendMeta) => {
    if (!meta) return;
    setRate((prev) =>
      prev && !prev.exempt
        ? {
            ...prev,
            remaining: meta.rate_remaining ?? prev.remaining,
            limit: meta.rate_limit ?? prev.limit,
          }
        : prev,
    );
  }, []);

  // After a 429: reflect the block so the counter + "send again at" update without a refetch.
  const apply429 = useCallback((body: BroadcastRateLimitBody) => {
    setRate((prev) => ({
      exempt: false,
      remaining: body.remaining ?? 0,
      limit: body.limit ?? prev?.limit ?? 5,
      // resets_at is the instant sending re-opens (cooldown end or next hour boundary).
      cooldown_until: body.resets_at ?? prev?.cooldown_until ?? null,
    }));
  }, []);

  return { rate, refresh, applySuccess, apply429 };
}

/**
 * BroadcastRateNotice — the small "N of {limit} broadcasts left this hour" line, plus a live
 * "you can send again at <local time> (mm:ss)" countdown while a cooldown is active.
 *
 * Renders NOTHING when the sender is exempt (admins) or the budget has not loaded, so admin composers
 * look exactly as before. Organizer-facing → strings come from the `broadcast` i18n namespace and the
 * time renders in the viewer's timezone via <LocalTime>.
 */
export function BroadcastRateNotice({ rate }: { rate: BroadcastRateStatus | null }) {
  const t = useTranslations("broadcast");
  // 1s tick so the mm:ss countdown stays live while the dialog is open.
  const [, setTick] = useState(0);
  const cooldownMs = rate?.cooldown_until ? new Date(rate.cooldown_until).getTime() : 0;
  const msLeft = cooldownMs ? cooldownMs - Date.now() : 0;
  const inCooldown = msLeft > 0;

  useEffect(() => {
    if (!inCooldown) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [inCooldown]);

  // Hidden for admins (exempt) or before the first fetch.
  if (!rate || rate.exempt) return null;

  // mm:ss remaining; only shown for sub-hour waits (a long hourly wait just shows the absolute time).
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, "0");
  const countdown = `${mm}:${ss}`;

  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <p className="text-muted-foreground">
        {t("rate.left", { remaining: rate.remaining, limit: rate.limit })}
      </p>
      {inCooldown && (
        <p className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-foreground">
          {t("rate.sendAgainAt")}{" "}
          <LocalTime value={rate.cooldown_until} mode="time" className="font-medium" />
          {totalSec < 3600 && <span className="text-muted-foreground">({countdown})</span>}
        </p>
      )}
    </div>
  );
}
