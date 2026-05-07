// KYC handler — WhatsApp OTP + Discord OAuth (mocked).
//
// Mock OTP: only "000000" is accepted. Tier promotes to TIER_LITE when both
// whatsapp_verified_at and discord_linked_at are set. unlinkDiscord demotes.

import { getDB } from "../store";
import { mockNow } from "../clock";
import type { KYCStatus } from "../types";

export class KYCRecordMissing extends Error {
  constructor(user_id: string) {
    super(`KYC record missing for ${user_id}`);
    this.name = "KYCRecordMissing";
  }
}

export class WhatsAppOTPInvalid extends Error {
  constructor() {
    super("Invalid OTP code");
    this.name = "WhatsAppOTPInvalid";
  }
}

const VALID_MOCK_OTP = "000000";

async function getOrCreateRow(user_id: string) {
  const db = await getDB();
  const existing = await db.getFromIndex("kyc_tiers", "by-user", user_id);
  if (existing) return existing;
  const fresh = {
    id: `kyc_${user_id}`,
    user_id,
    tier: "TIER_0" as const,
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  };
  await db.put("kyc_tiers", fresh);
  return fresh;
}

function recomputeTier(row: {
  whatsapp_verified_at: string | null;
  discord_linked_at: string | null;
  tier: "TIER_0" | "TIER_LITE";
}) {
  if (row.whatsapp_verified_at && row.discord_linked_at) {
    row.tier = "TIER_LITE";
  } else {
    row.tier = "TIER_0";
  }
}

export async function startWhatsAppOTP(
  user_id: string,
  number: string,
): Promise<{ otp_sent: true }> {
  const db = await getDB();
  const row = await getOrCreateRow(user_id);
  row.whatsapp_number = number;
  await db.put("kyc_tiers", row);
  return { otp_sent: true };
}

export async function confirmWhatsAppOTP(
  user_id: string,
  otp: string,
): Promise<KYCStatus> {
  if (otp !== VALID_MOCK_OTP) {
    throw new WhatsAppOTPInvalid();
  }
  const db = await getDB();
  const row = await db.getFromIndex("kyc_tiers", "by-user", user_id);
  if (!row) throw new KYCRecordMissing(user_id);
  row.whatsapp_verified_at = new Date(mockNow()).toISOString();
  recomputeTier(row);
  await db.put("kyc_tiers", row);
  return statusFromRow(row);
}

export async function startDiscordLink(
  user_id: string,
): Promise<{ redirect_url: string }> {
  return {
    redirect_url: `/_/mock-discord-oauth?user_id=${encodeURIComponent(user_id)}`,
  };
}

export async function completeDiscordOAuth(
  user_id: string,
  mock_discord_id?: string,
): Promise<KYCStatus> {
  const db = await getDB();
  const row = await getOrCreateRow(user_id);
  row.discord_user_id =
    mock_discord_id ?? `discord_${user_id}_${Math.random().toString(36).slice(2, 8)}`;
  row.discord_linked_at = new Date(mockNow()).toISOString();
  recomputeTier(row);
  await db.put("kyc_tiers", row);
  return statusFromRow(row);
}

export async function getKYCStatus(user_id: string): Promise<KYCStatus> {
  const db = await getDB();
  const row = await db.getFromIndex("kyc_tiers", "by-user", user_id);
  if (!row) {
    return {
      tier: "TIER_0",
      whatsapp_number: null,
      whatsapp_verified_at: null,
      discord_user_id: null,
      discord_linked_at: null,
    };
  }
  return statusFromRow(row);
}

export async function unlinkDiscord(user_id: string): Promise<KYCStatus> {
  const db = await getDB();
  const row = await db.getFromIndex("kyc_tiers", "by-user", user_id);
  if (!row) throw new KYCRecordMissing(user_id);
  row.discord_user_id = null;
  row.discord_linked_at = null;
  recomputeTier(row);
  await db.put("kyc_tiers", row);
  return statusFromRow(row);
}

function statusFromRow(row: KYCStatus): KYCStatus {
  return {
    tier: row.tier,
    whatsapp_number: row.whatsapp_number,
    whatsapp_verified_at: row.whatsapp_verified_at,
    discord_user_id: row.discord_user_id,
    discord_linked_at: row.discord_linked_at,
  };
}
