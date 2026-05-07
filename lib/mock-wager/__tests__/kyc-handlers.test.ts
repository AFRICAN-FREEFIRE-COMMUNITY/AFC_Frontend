import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import { teardownPubsub } from "../pubsub";
import {
  startWhatsAppOTP,
  confirmWhatsAppOTP,
  startDiscordLink,
  completeDiscordOAuth,
  getKYCStatus,
  unlinkDiscord,
  WhatsAppOTPInvalid,
} from "../handlers/kyc";

async function bootstrap() {
  const db = await getDB();
  await db.put("users", {
    id: "u1",
    username: "u1",
    display_name: "u1",
    role: "user",
    created_at: new Date().toISOString(),
  });
  await db.put("kyc_tiers", {
    id: "kyc_u1",
    user_id: "u1",
    tier: "TIER_0",
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  });
}

describe("kyc handlers", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
  });

  it("startWhatsAppOTP saves number and returns ack", async () => {
    await bootstrap();
    const res = await startWhatsAppOTP("u1", "+2348012345678");
    expect(res.otp_sent).toBe(true);
    const status = await getKYCStatus("u1");
    expect(status.whatsapp_number).toBe("+2348012345678");
    expect(status.whatsapp_verified_at).toBeNull();
  });

  it("confirmWhatsAppOTP rejects bad code", async () => {
    await bootstrap();
    await startWhatsAppOTP("u1", "+2348012345678");
    await expect(confirmWhatsAppOTP("u1", "999999")).rejects.toBeInstanceOf(
      WhatsAppOTPInvalid,
    );
  });

  it("confirmWhatsAppOTP accepts only 000000", async () => {
    await bootstrap();
    await startWhatsAppOTP("u1", "+2348012345678");
    await confirmWhatsAppOTP("u1", "000000");
    const status = await getKYCStatus("u1");
    expect(status.whatsapp_verified_at).not.toBeNull();
    // Tier still TIER_0 (no discord yet)
    expect(status.tier).toBe("TIER_0");
  });

  it("startDiscordLink returns mock OAuth redirect URL", async () => {
    await bootstrap();
    const r = await startDiscordLink("u1");
    expect(r.redirect_url).toContain("/_/mock-discord-oauth");
    expect(r.redirect_url).toContain("user_id=u1");
  });

  it("tier promotes to TIER_LITE when both whatsapp + discord set", async () => {
    await bootstrap();
    await startWhatsAppOTP("u1", "+2348012345678");
    await confirmWhatsAppOTP("u1", "000000");
    await completeDiscordOAuth("u1", "discord_id_xyz");
    const status = await getKYCStatus("u1");
    expect(status.tier).toBe("TIER_LITE");
    expect(status.discord_user_id).toBe("discord_id_xyz");
    expect(status.discord_linked_at).not.toBeNull();
  });

  it("tier remains TIER_0 if discord linked but whatsapp not", async () => {
    await bootstrap();
    await completeDiscordOAuth("u1", "discord_id_xyz");
    const status = await getKYCStatus("u1");
    expect(status.tier).toBe("TIER_0");
  });

  it("unlinkDiscord clears discord fields and demotes tier to TIER_0", async () => {
    await bootstrap();
    await startWhatsAppOTP("u1", "+2348012345678");
    await confirmWhatsAppOTP("u1", "000000");
    await completeDiscordOAuth("u1", "discord_id_xyz");
    expect((await getKYCStatus("u1")).tier).toBe("TIER_LITE");
    await unlinkDiscord("u1");
    const status = await getKYCStatus("u1");
    expect(status.discord_user_id).toBeNull();
    expect(status.discord_linked_at).toBeNull();
    expect(status.tier).toBe("TIER_0");
    // WhatsApp record preserved
    expect(status.whatsapp_verified_at).not.toBeNull();
  });
});
