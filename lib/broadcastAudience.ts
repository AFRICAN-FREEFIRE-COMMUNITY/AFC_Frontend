// ─────────────────────────────────────────────────────────────────────────────
// lib/broadcastAudience.ts
//
// Typed client for the BROADCAST AUDIENCE API (backend prefix
// /auth/admin/broadcast-audience/, afc_auth/views_broadcast_audience.py).
//
// WHAT THIS IS FOR (owner backlog item 15, 2026-08-03): admins pick WHO a notification or bulk
// mail goes to. Explicit teams and players, or a category filter (tier, country, role, language),
// or the entire site. The DELIVERY half already existed on the backend; this is the recipient
// selection half.
//
// THE TWO RULES THIS CLIENT EXISTS TO ENFORCE, both mirrored on the server so neither can be
// bypassed by calling the API directly:
//
//   1. COUNT BEFORE SEND. There is no undo on a broadcast. `preview` returns the recipient count,
//      and `send` REQUIRES that number back as confirmed_count. A 409 means the audience changed
//      size between preview and send, and carries the new number to re-confirm.
//
//   2. EMAIL VOLUME IS REAL. AFC's transactional mail goes through Microsoft 365, roughly 30
//      messages a minute and 1,000 a day to people who have never received AFC mail. A send to
//      all ~6,800 users cannot deliver as email. Every preview carries an `email_volume` verdict:
//      "ok", "slow" (needs confirm_large_email), or "blocked" (the email channel is refused).
//      Large audiences are steered to in-app push, which delivers instantly at any size.
//
// WHY a dedicated client (not inline axios): mirrors lib/connectedApps.ts and
// lib/deliveryProfiles.ts. The base URL and the Bearer header live in one place, and the caller
// passes the session token explicitly (useAuth().token) rather than the helper reaching for a
// cookie.
//
// SOLE CALLER: app/(a)/a/settings/_components/AudienceBuilder.tsx, rendered in the
// admin Settings > Notifications tab.
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/auth/admin/broadcast-audience/${path}`;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── The audience spec ─────────────────────────────────────────────────────────
// How the pieces combine (the UI states this in words, so it must not drift from
// afc_auth/audience.py, which is the authority):
//   - `everyone` wins outright: the audience is every eligible user.
//   - Otherwise the audience is the UNION of: explicitly picked players + members and owners of
//     explicitly picked teams + everyone matching the category filters.
//   - WITHIN the category block the filters INTERSECT: tiers AND countries AND roles AND
//     languages. "Tier 1" plus "Ghana" means Tier 1 players in Ghana, not the two added together.
//   - Nothing selected at all is an EMPTY audience, never an accidental send to all.
// Suspended and deactivated accounts are excluded unless include_suspended is set.
export type AudienceSpec = {
  everyone?: boolean;
  user_ids?: number[];
  team_ids?: number[];
  tiers?: string[];
  countries?: string[];
  roles?: string[];
  languages?: string[];
  include_suspended?: boolean;
};

// ── Volume verdict (afc_auth/audience.py :: email_volume_assessment) ──────────
export type EmailVolume = {
  /** "ok" = send freely. "slow" = needs confirm_large_email. "blocked" = email refused. */
  level: "ok" | "slow" | "blocked";
  email_recipient_count: number;
  /** Honest arithmetic: count / per_minute, rounded up. */
  estimated_minutes: number;
  per_minute: number;
  daily_cap: number;
  comfortable_max: number;
  requires_confirmation: boolean;
  blocked: boolean;
  /** A ready-to-render sentence. Shown verbatim so the warning cannot drift from the rule. */
  message: string;
};

/** One row of the preview sample. `has_email`, never the address: the admin only needs to know
 *  the channel can reach this person, and preview responses should not spread PII. */
export type AudienceRecipient = {
  user_id: number;
  username: string;
  has_email: boolean;
  country: string;
  role: string;
  language: string;
};

/** WhatsApp verdict (afc_auth/broadcast_whatsapp.py :: whatsapp_volume_assessment).
 *
 *  Shaped like EmailVolume but judged on a different rule: WhatsApp is capped per SEND
 *  (WHATSAPP_BROADCAST_MAX_RECIPIENTS, 500 by default) rather than throttled per minute, because
 *  every template message costs money and Meta rates a number on how people react to it. */
export type WhatsappVolume = {
  level: "ok" | "blocked";
  max_recipients: number;
  blocked: boolean;
  /** Ready-to-render sentence, shown verbatim so the warning cannot drift from the rule. */
  message: string;
};

export type AudiencePreview = {
  /** In-app reach. THIS is the number the admin confirms. */
  recipient_count: number;
  /** Of those, how many have an email address. What the volume verdict is judged on. */
  email_recipient_count: number;
  push_recipient_count: number;
  email_volume: EmailVolume;
  /** Of the audience, how many have a WhatsApp number AND have not opted out. Usually far
   *  smaller than recipient_count - about 2% of AFC had a number in August 2026 - which is why
   *  the composer shows this next to the checkbox rather than letting an admin assume parity. */
  whatsapp_recipient_count?: number;
  whatsapp_volume?: WhatsappVolume;
  /** Whether THIS admin may use the WhatsApp channel. Head admins only (owner 2026-08-05):
   *  WhatsApp is billed per message, so it is a spending control rather than an ordinary
   *  permission. Reported by the preview so the composer can grey the option out with a reason
   *  instead of letting somebody write a broadcast and be refused at the send. */
  whatsapp_allowed?: boolean;
  /** Whether the WhatsApp channel is switched on at all on this deployment. False until
   *  WHATSAPP_BROADCAST_TEMPLATE is set on the server, which is deliberately empty by default so
   *  a deploy could never start messaging players before somebody chose to. The composer shows a
   *  "not available yet" notice on false; because it is derived from the real setting rather than
   *  hardcoded, the notice disappears by itself once the value lands. */
  whatsapp_configured?: boolean;
  /** The channel the composer should default to for this size ("push" for large audiences). */
  recommended_delivery: "push" | "both";
  sample: AudienceRecipient[];
  sample_total_count: number;
  has_more: boolean;
};

/** One filter value plus how many people it selects, so the dropdowns show real numbers. */
// `label` is present on the COUNTRY options only. The same country is stored under
// several spellings ('Nigeria' and 'NG'), so the backend folds them into one option:
// `value` is the stable canonical key the filter sends back, `label` is the spelling
// to show. Everything else has no such split and sends `value` alone, hence optional.
export type AudienceOption = { value: string; count: number; label?: string };

export type AudienceOptions = {
  /** The eligible population: what "Everyone on AFC" actually means today. */
  total_users: number;
  countries: AudienceOption[];
  countries_total_count: number;
  countries_has_more: boolean;
  tiers: AudienceOption[];
  roles: AudienceOption[];
  languages: AudienceOption[];
  email_limits: { per_minute: number; daily_cap: number; comfortable_max: number };
};

export type AudienceSendResult = {
  message: string;
  recipient_count: number;
  pushed: number;
  emailed: number;
  delivery: "push" | "email" | "both";
  email_volume: EmailVolume;
};

export const broadcastAudienceApi = {
  /** GET options/ - the filter values that exist, with counts. Called once on mount. */
  options: async (token: string): Promise<AudienceOptions> => {
    const res = await axios.get(url("options/"), { headers: bearer(token) });
    return res.data;
  },

  /**
   * POST preview/ - resolve a spec to a COUNT plus a paged sample. Sends nothing.
   * Called on every filter change; its recipient_count is what `send` must be given back.
   * 400 when the spec selects nothing at all.
   */
  preview: async (
    token: string,
    spec: AudienceSpec,
    paging?: { limit?: number; offset?: number },
  ): Promise<AudiencePreview> => {
    const res = await axios.post(
      url("preview/"),
      { ...spec, ...(paging ?? {}) },
      { headers: bearer(token) },
    );
    return res.data;
  },

  /**
   * POST send/ - deliver to the resolved audience.
   *
   * `confirmed_count` is REQUIRED and must equal the current audience size: a 409 means the
   * audience changed and carries the new recipient_count to re-confirm. `confirm_large_email` is
   * required when a preview reported email_volume.requires_confirmation; a "blocked" verdict
   * refuses the email channel outright (400) no matter what is confirmed.
   */
  send: async (
    token: string,
    body: {
      audience: AudienceSpec;
      title?: string;
      message: string;
      delivery: "push" | "email" | "both";
      confirmed_count: number;
      confirm_large_email?: boolean;
      target_type?: string;
      target_id?: string;
      targets?: { target_type: string; target_id: string }[];
    },
  ): Promise<AudienceSendResult> => {
    const res = await axios.post(url("send/"), body, { headers: bearer(token) });
    return res.data;
  },
};
