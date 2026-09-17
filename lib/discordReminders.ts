/**
 * lib/discordReminders.ts - the organizer's Discord reminder cadence on an event.
 *
 * Owner 2026-09-14 (inbox #22): "discord automated reminders, organizers should be able to set it
 * on the website, where they pick frequency of how the reminders send (this option is for discord
 * only)."
 *
 * Backed by afc_tournament_and_scrims/views_discord_reminders.py:
 *   GET  events/<event_id>/discord-reminders/   settings + the plan (each moment's state) + history
 *   POST events/<event_id>/discord-reminders/   {frequency, note}
 * The bot DMs every rostered player with Discord connected at each moment of the cadence
 * (afc_tournament_and_scrims/discord_reminders.py). Consumed by
 * app/(a)/a/events/[slug]/edit/_components/DiscordRemindersCard.tsx on the shared Actions tab.
 */
import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

export type ReminderFrequencyKey = "off" | "once_24h" | "daily_3d" | "every_12h_2d" | "every_6h_1d";

export type ReminderMoment = {
  offset_hours: number;
  due_at: string | null;
  state: "planned" | "sent" | "skipped";
  sent_at: string | null;
  recipients: number | null;
  delivered: number | null;
  reason: string;
};

export type DiscordReminderSettings = {
  frequency: ReminderFrequencyKey;
  note: string;
  frequencies: Array<{ key: ReminderFrequencyKey; label: string; offsets: number[] }>;
  note_max: number;
  start_at: string | null;
  recipients_now: number;
  plan: ReminderMoment[];
  message?: string;
};

export async function getDiscordReminders(eventId: number): Promise<DiscordReminderSettings> {
  const res = await axios.get<DiscordReminderSettings>(`${BASE}/${eventId}/discord-reminders/`, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function saveDiscordReminders(
  eventId: number,
  body: { frequency: ReminderFrequencyKey; note: string },
): Promise<DiscordReminderSettings> {
  const res = await axios.post<DiscordReminderSettings>(`${BASE}/${eventId}/discord-reminders/`, body, {
    headers: authHeaders(),
  });
  return res.data;
}
