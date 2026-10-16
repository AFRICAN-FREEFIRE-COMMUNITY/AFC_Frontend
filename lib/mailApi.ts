// lib/mailApi.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed client for EMAIL NEWS, AFC's own bulk email (backend app afc_mail, prefix /mail/, every
// endpoint documented at the top of afc_mail/views.py). Owner asks: inbox #259 (bulk email via
// Amazon SES, "plus a proper tracker too"), the composer mockup approved 2026-10-16 (#270 #281
// #284-#288, built under #290).
//
// WHAT TRAVELS: an email is a document per language (the Tiptap editor's own JSON, never HTML),
// one style for every language, subjects and preview lines per language, and the audience spec of
// afc_auth/audience.py (the broadcast picker's). Pictures and fonts are uploaded first (assets) and
// named in documents by token; the server builds every address itself.
//
// CALLERS: app/(a)/a/email-news/ (campaigns list, composer, tracker), components/mail/ (the composer's
// parts), the account settings consent toggle and the one-time question (components/mail/
// EmailNewsToggle.tsx, EmailNewsPrompt.tsx), and app/(root)/email/unsubscribe/[token] (public, no session).
// ─────────────────────────────────────────────────────────────────────────────
import type { JSONContent } from "@tiptap/core";
import axios from "axios";

import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/mail`;

/** The day email news appears in the admin menu; its NEW badge runs 5 days from here. */
export const EMAIL_NEWS_LAUNCH_DATE = "2026-10-17";

export type Lang = "en" | "fr" | "pt";
export const LANGS: Lang[] = ["en", "fr", "pt"];

/** A Tiptap document. The server keeps only the node types afc_mail/document.py lists. */
export type EmailDoc = JSONContent & { type: "doc" };

export type EmailStyle = {
  theme: string;
  page: string;
  mail: string;
  text: string;
  head: string;
  link: string;
  btn: string;
  btnText: string;
  bodyFont: string;
  headFont: string;
  size: number;
  /** Uploaded fonts, each with the listed font an app shows when it cannot show the upload. */
  fonts: { asset: string; family: string; fallback: string }[];
};

export type Asset = {
  token: string;
  kind: "image" | "font";
  url: string;
  content_type: string;
  width?: number | null;
  height?: number | null;
  family?: string;
};

export type DesignReport = {
  removed: number;
  handlers: number;
  packed: number;
  web_pictures: number;
  dropped_pictures: number;
  links: number;
  size_kb: number;
  gmail_clip_kb: number;
};

export type Design = { name: string; size: number; html: string; report: DesignReport };

export type AudienceSpec = {
  everyone?: boolean;
  user_ids?: number[];
  team_ids?: number[];
  tiers?: string[];
  countries?: string[];
  roles?: string[];
  languages?: string[];
};

export type Stats = {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  skipped: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
};

export type CampaignStatus = "draft" | "queued" | "sending" | "sent" | "cancelled";

export type CampaignRow = {
  token: string;
  name: string;
  subject_en: string;
  mode: "write" | "design";
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
  queued_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  stats: Stats;
};

export type Campaign = CampaignRow & {
  subject_fr: string;
  subject_pt: string;
  preheader_en: string;
  preheader_fr: string;
  preheader_pt: string;
  docs: Partial<Record<Lang, EmailDoc | null>>;
  style: EmailStyle;
  designs: Partial<Record<Lang, Design>>;
  assets: Record<string, Asset>;
  audience: AudienceSpec & Record<string, unknown>;
  links: { index: number; url: string; clicks: number; people: number }[];
};

/** The fields a draft save may send (afc_mail/views.py _apply_fields). */
export type CampaignInput = Partial<{
  subject_en: string;
  subject_fr: string;
  subject_pt: string;
  preheader_en: string;
  preheader_fr: string;
  preheader_pt: string;
  mode: "write" | "design";
  docs: Partial<Record<Lang, EmailDoc | null>>;
  style: Partial<EmailStyle>;
  designs: Partial<Record<Lang, null>>;
  audience: AudienceSpec;
}>;

export type LeftOut =
  | { kind: "player"; id: number; name: string; reason: "inactive" | "no_address" | "bounced" | "unsubscribed" | "no_consent" }
  | { kind: "team"; id: number; name: string; left: number; total: number };

export type Picked = { kind: "team" | "player"; id: number; name: string };

export type AudienceAnswer = { selected: number; recipients: number; left_out: LeftOut[]; picked: Picked[] };

export type Template = {
  token: string;
  name: string;
  mode: "write" | "design";
  subject_en: string;
  source_campaign: string | null;
  created_by: string | null;
  created_at: string;
};

export type Page<T> = { results: T[]; total_count: number; has_more: boolean; next_offset: number | null };

/** The refusal code of a failed call ("error" when the server sent none). */
export function errorCode(err: unknown): string {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? "error";
}

const h = () => ({ headers: authHeaders() });

export const mailAdmin = {
  /** GET mail/campaigns/ */
  async list(offset = 0, limit = 20): Promise<Page<CampaignRow>> {
    return (await axios.get(`${BASE}/campaigns/`, { ...h(), params: { offset, limit } })).data;
  },
  /** POST mail/campaigns/ */
  async create(input: CampaignInput = {}): Promise<Campaign> {
    return (await axios.post(`${BASE}/campaigns/`, input, h())).data;
  },
  /** GET mail/campaigns/<token>/ */
  async get(token: string): Promise<Campaign> {
    return (await axios.get(`${BASE}/campaigns/${token}/`, h())).data;
  },
  /** PATCH mail/campaigns/<token>/ (drafts only) */
  async save(token: string, input: CampaignInput): Promise<Campaign> {
    return (await axios.patch(`${BASE}/campaigns/${token}/`, input, h())).data;
  },
  /** DELETE mail/campaigns/<token>/ (drafts only) */
  async discard(token: string): Promise<void> {
    await axios.delete(`${BASE}/campaigns/${token}/`, h());
  },
  /** POST mail/campaigns/<token>/start-from/ */
  async startFrom(token: string, from: { template: string } | { campaign: string } | { blank: true }): Promise<Campaign> {
    return (await axios.post(`${BASE}/campaigns/${token}/start-from/`, from, h())).data;
  },
  /** POST mail/campaigns/<token>/design/ (multipart) */
  async uploadDesign(token: string, language: Lang, file: File): Promise<Campaign> {
    const form = new FormData();
    form.append("language", language);
    form.append("file", file);
    return (await axios.post(`${BASE}/campaigns/${token}/design/`, form, h())).data;
  },
  /** DELETE mail/campaigns/<token>/design/?language= */
  async removeDesign(token: string, language: Lang): Promise<Campaign> {
    return (await axios.delete(`${BASE}/campaigns/${token}/design/`, { ...h(), params: { language } })).data;
  },
  /** GET mail/campaigns/<token>/preview/?language= */
  async preview(token: string, language: Lang): Promise<{ subject: string; html: string; size_kb: number }> {
    return (await axios.get(`${BASE}/campaigns/${token}/preview/`, { ...h(), params: { language } })).data;
  },
  /** POST mail/campaigns/<token>/test/ */
  async test(token: string, language: Lang): Promise<{ to: string }> {
    return (await axios.post(`${BASE}/campaigns/${token}/test/`, { language }, h())).data;
  },
  /** POST mail/campaigns/<token>/send/ */
  async send(token: string): Promise<{ recipients: number }> {
    return (await axios.post(`${BASE}/campaigns/${token}/send/`, {}, h())).data;
  },
  /** POST mail/campaigns/<token>/cancel/ */
  async cancel(token: string): Promise<void> {
    await axios.post(`${BASE}/campaigns/${token}/cancel/`, {}, h());
  },
  /** POST mail/audience/ : counts and the picked players and teams left out, with the reason */
  async audience(spec: AudienceSpec): Promise<AudienceAnswer> {
    return (await axios.post(`${BASE}/audience/`, { audience: spec }, h())).data;
  },
  /** POST mail/assets/ (multipart): a picture or a font */
  async upload(kind: "image" | "font", file: Blob, name: string): Promise<Asset> {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file, name);
    return (await axios.post(`${BASE}/assets/`, form, h())).data;
  },
  /** GET mail/assets/<token>/ : the bytes, for a font to show or a picture to draw on a canvas */
  async assetBytes(token: string): Promise<ArrayBuffer> {
    return (await axios.get(`${BASE}/assets/${token}/`, { ...h(), responseType: "arraybuffer" })).data;
  },
  /** GET mail/templates/ */
  async templates(offset = 0, limit = 50): Promise<Page<Template>> {
    return (await axios.get(`${BASE}/templates/`, { ...h(), params: { offset, limit } })).data;
  },
  /** POST mail/templates/ : save a campaign's content (a draft or a sent email) as a template */
  async saveTemplate(campaign: string, name?: string): Promise<Template> {
    return (await axios.post(`${BASE}/templates/`, { campaign, name }, h())).data;
  },
  /** DELETE mail/templates/<token>/ */
  async deleteTemplate(token: string): Promise<void> {
    await axios.delete(`${BASE}/templates/${token}/`, h());
  },
};

/** The signed-in player's own answer (mail/preferences/). */
export const mailPreferences = {
  /** answered: has this person ever said yes or no (the home page asks once, until they do) */
  async get(): Promise<{ marketing_opt_in: boolean; opted_in_at: string | null; answered: boolean }> {
    return (await axios.get(`${BASE}/preferences/`, h())).data;
  },
  async set(value: boolean, source: "settings" | "prompt"): Promise<{ marketing_opt_in: boolean }> {
    return (await axios.post(`${BASE}/preferences/`, { marketing_opt_in: value, source }, h())).data;
  },
};

/** The unsubscribe page: no session, the recipient token in the address is the key. */
export const mailUnsubscribe = {
  async state(token: string): Promise<{ email: string; subscribed: boolean }> {
    return (await axios.get(`${BASE}/unsubscribe/${token}/`)).data;
  },
  async unsubscribe(token: string): Promise<{ subscribed: boolean }> {
    return (await axios.post(`${BASE}/unsubscribe/${token}/`, {})).data;
  },
  async resubscribe(token: string): Promise<{ subscribed: boolean }> {
    return (await axios.post(`${BASE}/resubscribe/${token}/`, {})).data;
  },
};
