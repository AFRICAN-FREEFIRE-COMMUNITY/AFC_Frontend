"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DiscordRegistrationGate — shared "Require Discord to register" control.
//
// PURPOSE: one source of truth for the per-event Discord registration gate so the
// CREATE wizard (Step1EventDetails) and the EDIT form (BasicInfoTab) render + behave
// identically. It owns the full invite → verify → require → invite-link flow:
//
//   1. "Discord server ID (Guild ID)" text input (form field discord_server_id).
//   2. "Invite AFC bot to your server" button → GET /auth/discord-bot-invite-url/
//      ?guild_id=<entered id> (Bearer) → window.open(invite_url, "_blank"). Disabled
//      while the guild id is blank.
//   3. "Verify bot is in server" button → POST /auth/verify-bot-in-guild/ {guild_id}
//      (Bearer) → sets botVerified; green "Bot is in your server" / red "Bot not found".
//      Disabled while the guild id is blank.
//   4. The "Require Discord to register" toggle (form field require_discord) is enabled
//      ONLY when the guild id is BLANK (= the main AFC server, where the bot already
//      lives, no verify needed) OR botVerified === true. A non-blank guild must be
//      invited + verified first; otherwise the toggle stays off with a "why" note.
//   5. When the toggle is ON, a REQUIRED "Discord invite link" text input
//      (form field discord_invite_link) appears. The save handlers block submitting
//      require_discord=true without a non-empty link (mirroring the backend 400).
//
// CONNECTS TO:
//   • Form: writes require_discord / discord_server_id / discord_invite_link on the
//     shared EventFormType (see create _components/types.ts + edit types.tsx). These
//     three keys are appended verbatim to the create-event / edit-event FormData by the
//     admin + organizer create/edit pages (alongside is_public).
//   • Backend: GET /auth/discord-bot-invite-url/ + POST /auth/verify-bot-in-guild/
//     (afc_auth, Bearer auth). When require_discord is ON, register-for-event/ rejects
//     non-Discord participants (403 code "discord_required", handled on the public
//     tournament page). discord_invite_link is what the public page links players to.
//   • Auth: Bearer token from AuthContext (Cookies "auth_token" via useAuth()).
//
// The organizer create/edit flows reuse this verbatim (the whole event wizard is
// English under (a)/, so labels here stay plain English — consistent with the rule).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { IconCheck, IconX, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { EventFormType } from "./types";

interface DiscordRegistrationGateProps {
  // The shared event form (create passes `form` directly; edit passes its
  // useFormContext() result). Typed loosely as the create EventFormType — the edit
  // form is structurally compatible for the three keys this control touches.
  form: UseFormReturn<EventFormType>;
  // On EDIT we want a pre-set guild that already has a saved invite link to count as
  // already-verified, so the admin isn't forced to re-verify just to keep the gate on.
  // The edit caller passes the fetched event's discord_invite_link here.
  initiallyVerified?: boolean;
}

export function DiscordRegistrationGate({
  form,
  initiallyVerified = false,
}: DiscordRegistrationGateProps) {
  const { token } = useAuth();
  // Per-session verification result for the CURRENTLY entered guild id. Seeded true on
  // edit when the event already had an invite link (treated as already-verified).
  const [botVerified, setBotVerified] = useState<boolean>(initiallyVerified);
  // Tri-state of the last verify attempt so we can show the green/red status line.
  const [verifyState, setVerifyState] = useState<"idle" | "found" | "missing">(
    initiallyVerified ? "found" : "idle",
  );
  const [inviting, setInviting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Watch the three form fields this control drives.
  const guildId =
    ((form.watch("discord_server_id" as never) as unknown as string) ?? "").trim();
  const requireDiscord =
    (form.watch("require_discord" as never) as unknown as boolean) ?? false;

  // Blank guild = the main AFC server (the bot is already there) → no verify needed.
  const isBlankGuild = guildId === "";
  // The toggle may be enabled only for the main AFC server OR a verified custom guild.
  const canEnableToggle = isBlankGuild || botVerified;

  // Step 2: open the bot-invite URL for the entered guild in a new tab.
  const handleInvite = async () => {
    if (!guildId) return;
    setInviting(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/discord-bot-invite-url/`,
        {
          params: { guild_id: guildId },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const url = res.data?.invite_url;
      if (url) {
        window.open(url, "_blank");
      } else {
        toast.error("Could not get the bot invite link. Try again.");
      }
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Failed to get the bot invite link.",
      );
    } finally {
      setInviting(false);
    }
  };

  // Step 3: ask the backend whether the AFC bot is a member of the entered guild.
  const handleVerify = async () => {
    if (!guildId) return;
    setVerifying(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/verify-bot-in-guild/`,
        { guild_id: guildId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const inGuild = Boolean(res.data?.in_guild);
      setBotVerified(inGuild);
      setVerifyState(inGuild ? "found" : "missing");
      if (!inGuild) {
        // Verification failed → the toggle must not stay on for an unverified guild.
        form.setValue("require_discord" as never, false as never);
      }
    } catch (e: any) {
      setBotVerified(false);
      setVerifyState("missing");
      toast.error(
        e.response?.data?.message || "Failed to verify the bot in the server.",
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {/* Guild ID input (form field discord_server_id). Editing it invalidates any prior
          verification for the OLD guild, so we reset botVerified unless it's now blank. */}
      <FormField
        // @ts-ignore - shared optional field on the event form
        control={form.control}
        name={"discord_server_id" as never}
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="discord-server-id">
              Discord server ID (Guild ID)
            </FormLabel>
            <FormControl>
              <Input
                id="discord-server-id"
                placeholder="e.g., 123456789012345678"
                value={(field.value as unknown as string) ?? ""}
                onChange={(e) => {
                  field.onChange(e);
                  // Any guild-id change drops the stale verification for the old guild.
                  setBotVerified(false);
                  setVerifyState("idle");
                }}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Leave blank to use the main AFC server (our bot is already there, no
              invite or verification needed). For your own server, paste its Guild ID,
              then invite the AFC bot and verify it below.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Invite + Verify actions — only meaningful for a custom (non-blank) guild.
          Both buttons are disabled while the guild id is blank. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleInvite}
          disabled={isBlankGuild || inviting}
        >
          {inviting && <IconLoader2 className="mr-1 size-4 animate-spin" />}
          Invite AFC bot to your server
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleVerify}
          disabled={isBlankGuild || verifying}
        >
          {verifying && <IconLoader2 className="mr-1 size-4 animate-spin" />}
          Verify bot is in server
        </Button>
      </div>

      {/* Verification status line (only for a custom guild that was verified/checked). */}
      {!isBlankGuild && verifyState === "found" && (
        <p className="flex items-center gap-1 text-xs font-medium text-green-600">
          <IconCheck className="size-4" /> Bot is in your server
        </p>
      )}
      {!isBlankGuild && verifyState === "missing" && (
        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
          <IconX className="size-4" /> Bot not found - invite it first
        </p>
      )}

      {/* Require-Discord toggle (form field require_discord). Enabled only for the main
          AFC server (blank guild) or a verified custom guild. */}
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-0.5">
          <Label htmlFor="require-discord">Require Discord to register</Label>
          <p className="text-xs text-muted-foreground">
            Players must be connected to Discord and a member of this server.
          </p>
        </div>
        <FormField
          // @ts-ignore - shared optional field on the event form
          control={form.control}
          name={"require_discord" as never}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Switch
                  id="require-discord"
                  checked={(field.value as unknown as boolean) ?? false}
                  // Only flippable when the gate may be enabled. When it can't, it stays off.
                  disabled={!canEnableToggle}
                  onCheckedChange={(v) => field.onChange(v && canEnableToggle)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* Why the toggle is disabled (custom guild not yet verified). */}
      {!canEnableToggle && (
        <p className="text-xs text-muted-foreground">
          Invite the AFC bot to your server and verify it before you can require
          Discord. Or leave the Guild ID blank to use the main AFC server.
        </p>
      )}

      {/* Required invite link — shown only while the gate is ON. The save handlers block
          submitting require_discord=true with an empty link (mirrors the backend 400). */}
      {requireDiscord && (
        <FormField
          // @ts-ignore - shared optional field on the event form
          control={form.control}
          name={"discord_invite_link" as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="discord-invite-link">
                Discord invite link (required)
              </FormLabel>
              <FormControl>
                <Input
                  id="discord-invite-link"
                  placeholder="https://discord.gg/..."
                  value={(field.value as unknown as string) ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Players will use this link to join the event&apos;s Discord. It is shown
                on the public event page.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
