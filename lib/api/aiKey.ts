// lib/api/aiKey.ts - the organization's own AI key for OCR (owner 2026-09-12).
//
// Backend: afc_organizers/views_ai_key.py, mounted at organizers/. The key itself is sent ONCE
// (PUT / test) and never comes back: every read carries `last_four` only.
//
// Consumed by:
//   - app/(organizer)/organizer/ai-key/page.tsx      the connect page with the plain-text guides
//   - app/(a)/a/ocr-model/keys/page.tsx              the admin page (orgs, reads, allowance, switch)
//   - lib/api/ocrKeyGate.ts                           the 402 -> "connect a key" toast every OCR
//                                                     upload path uses
import axios from "axios";

import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/organizers`;

export type ProviderId =
  | "gemini" | "openai" | "anthropic" | "openrouter" | "groq" | "mistral" | "xai" | "custom";

// One entry of the registry (afc_ocr/services/providers/registry.py): what the page needs to
// explain a provider. `steps` are the plain-text guide lines in order.
export interface AiProvider {
  id: ProviderId;
  name: string;
  adapter: string;
  base_url?: string;
  recommended_model: string;
  keys_url: string;
  key_hint: string;
  free_tier: string;
  cost_per_image_usd: number;
  steps: string[];
  checked_on: string;
}

export interface AiKeyInfo {
  provider: ProviderId;
  provider_name: string;
  model: string;
  base_url: string;
  last_four: string;
  added_by: string | null;
  added_at: string | null;
  last_tested_at: string | null;
  last_test_ok: boolean;
  last_error: string;
  consecutive_failures: number;
}

export interface AiKeyUsage {
  month: { reads: number; ok: number; estimated_usd: number };
  all_time: { reads: number; ok: number; estimated_usd: number };
  last_read_at: string | null;
  last_read_ok: boolean | null;
  last_read_error: string;
  free_reads_left: number;
  ocr_disabled: boolean;
}

export interface AiKeyState {
  key: AiKeyInfo | null;
  providers: AiProvider[];
  usage: AiKeyUsage;
}

export interface AiKeyTestResult {
  ok: boolean;
  message: string;
  rows: number;
  ms: number;
  model?: string;
  key?: AiKeyInfo | null;
  usage?: AiKeyUsage;
}

export interface AiKeyEvent {
  action: "connected" | "changed" | "tested" | "disconnected" | "allowance" | "disabled" | "enabled";
  provider: string;
  last_four: string;
  detail: string;
  actor: string | null;
  at: string;
}

export interface AdminAiKeyRow {
  organization_id: number;
  slug: string;
  name: string;
  provider: ProviderId | null;
  model: string | null;
  last_four: string | null;
  last_test_ok: boolean | null;
  last_error: string;
  reads_month: number;
  estimated_usd_month: number;
  reads_all_time: number;
  free_reads_left: number;
  ocr_disabled: boolean;
}

const h = () => ({ headers: authHeaders() });

export const aiKeyApi = {
  // GET organizers/organization/<slug>/ai-key/
  get: async (slug: string) => (await axios.get<AiKeyState>(`${BASE}/organization/${slug}/ai-key/`, h())).data,
  // PUT: tests the key on the sample screenshot first; saves only when it works. A failing key
  // answers 400 with the provider's message, which the page shows in words.
  connect: async (slug: string, body: { provider: ProviderId; key: string; model?: string; base_url?: string }) =>
    (await axios.put<AiKeyTestResult>(`${BASE}/organization/${slug}/ai-key/`, body, h())).data,
  disconnect: async (slug: string) =>
    (await axios.delete<{ message: string; usage: AiKeyUsage }>(`${BASE}/organization/${slug}/ai-key/`, h())).data,
  // POST test/: a pasted key (body) or the saved one (empty body). Never stores anything.
  test: async (slug: string, body: { provider?: ProviderId; key?: string; model?: string; base_url?: string } = {}) =>
    (await axios.post<AiKeyTestResult>(`${BASE}/organization/${slug}/ai-key/test/`, body, h())).data,
  usage: async (slug: string) => (await axios.get<AiKeyUsage>(`${BASE}/organization/${slug}/ai-key/usage/`, h())).data,
  history: async (slug: string) =>
    (await axios.get<{ events: AiKeyEvent[] }>(`${BASE}/organization/${slug}/ai-key/history/`, h())).data,
  // admin
  adminList: async () =>
    (await axios.get<{ organizations: AdminAiKeyRow[]; afc_key_month: { reads: number; estimated_usd: number } }>(
      `${BASE}/admin/ai-keys/`, h())).data,
  adminSetAllowance: async (orgId: number, freeReadsLeft: number) =>
    (await axios.put<{ message: string; free_reads_left: number }>(
      `${BASE}/admin/ai-keys/${orgId}/allowance/`, { free_reads_left: freeReadsLeft }, h())).data,
  adminSetDisabled: async (orgId: number, disabled: boolean) =>
    (await axios.put<{ message: string; ocr_disabled: boolean }>(
      `${BASE}/admin/ai-keys/${orgId}/ocr-disabled/`, { disabled }, h())).data,
};

// Pull a useful message off an axios error without inventing backend shapes.
export function aiKeyErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || fallback;
}
