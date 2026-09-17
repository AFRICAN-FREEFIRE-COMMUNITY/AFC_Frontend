"use client";

/**
 * DiscordRemindersCard - the organizer's Discord reminder cadence, on the shared Actions tab.
 *
 * Owner 2026-09-14 (inbox #22): "organizers should be able to set it on the website, where they
 * pick frequency of how the reminders send (this option is for discord only)."
 *
 * WHAT IT DOES
 *   One select (the cadence), one optional note that rides on every DM, Save. Under it, the plan:
 *   each moment of the cadence with when it is due (viewer's zone), and once the sweep has been
 *   there, sent (to how many, how many delivered) or skipped (its moment had already passed when
 *   the cadence was set). The recipient count says how many rostered players have Discord
 *   connected right now, so an organizer setting reminders for a roster nobody linked is told
 *   before they expect anything.
 *
 * HOW IT CONNECTS
 *   lib/discordReminders.ts -> GET/POST events/<id>/discord-reminders/. The bot's DMs are sent by
 *   the backend sweep (afc_tournament_and_scrims/discord_reminders.py) every 10 minutes. Mounted
 *   by ActionsTab.tsx, which both the admin and the organizer edit pages render, so both see it.
 *
 * DESIGN: the same Card idiom as GroupDrawCard beside it; filled surfaces, no strokes; NEW tag
 * dated the day it went live, self-expiring.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Loader } from "@/components/Loader";
import {
  getDiscordReminders, saveDiscordReminders,
  type DiscordReminderSettings, type ReminderFrequencyKey,
} from "@/lib/discordReminders";

const SINCE = "2026-09-17";

export function DiscordRemindersCard({ eventId }: { eventId: number }) {
  const t = useTranslations("evEditTabs");
  const [settings, setSettings] = useState<DiscordReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [frequency, setFrequency] = useState<ReminderFrequencyKey>("off");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await getDiscordReminders(eventId);
      setSettings(data);
      setFrequency(data.frequency);
      setNote(data.note);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const dirty = !!settings && (frequency !== settings.frequency || note !== settings.note);

  const save = async () => {
    setSaving(true);
    try {
      const data = await saveDiscordReminders(eventId, { frequency, note: note.trim() });
      setSettings(data);
      setFrequency(data.frequency);
      setNote(data.note);
      toast.success(t("discordReminders.saved"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("discordReminders.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // The cadence label is ours in every language; the backend's English label is the fallback
  // for a key this build does not know yet.
  const label = (key: string, fallback: string) =>
    t.has(`discordReminders.freq.${key}`) ? t(`discordReminders.freq.${key}`) : fallback;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <BellRing className="h-4 w-4" />
          {t("discordReminders.title")}
          <NewBadge since={SINCE} />
        </CardTitle>
        <CardDescription>{t("discordReminders.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : failed || !settings ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("discordReminders.loadFailed")}</p>
            <Button size="sm" variant="outline" onClick={load}>{t("discordReminders.retry")}</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="discord-reminder-frequency">{t("discordReminders.frequencyLabel")}</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as ReminderFrequencyKey)}>
                  <SelectTrigger id="discord-reminder-frequency" data-testid="discord-reminder-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.frequencies.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{label(f.key, f.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("discordReminders.recipientsNow", { count: settings.recipients_now })}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discord-reminder-note">{t("discordReminders.noteLabel")}</Label>
                <Textarea id="discord-reminder-note" rows={3} maxLength={settings.note_max} value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, settings.note_max))}
                  placeholder={t("discordReminders.notePlaceholder")} />
                <p className="text-right text-xs tabular-nums text-muted-foreground">
                  {note.length} / {settings.note_max}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={save} disabled={!dirty || saving} data-testid="discord-reminders-save">
                {saving ? t("discordReminders.saving") : t("discordReminders.save")}
              </Button>
              {!settings.start_at && (
                <span className="text-xs text-muted-foreground">{t("discordReminders.noStart")}</span>
              )}
            </div>

            {settings.plan.length > 0 && (
              <div className="rounded-md bg-muted/50 p-3" data-testid="discord-reminders-plan">
                <p className="mb-2 text-xs font-medium">{t("discordReminders.planTitle")}</p>
                <ul className="space-y-1.5 text-xs">
                  {settings.plan.map((m) => (
                    <li key={m.offset_hours} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium tabular-nums">
                        {t("discordReminders.before", { hours: m.offset_hours })}
                      </span>
                      {m.due_at && <LocalTime value={m.due_at} mode="datetime" className="text-muted-foreground" />}
                      {m.state === "sent" && (
                        <span className="text-primary">
                          {t("discordReminders.sent", { delivered: m.delivered ?? 0, recipients: m.recipients ?? 0 })}
                        </span>
                      )}
                      {m.state === "skipped" && (
                        <span className="text-orange-500">{t("discordReminders.skipped")}</span>
                      )}
                      {m.state === "planned" && (
                        <span className="text-muted-foreground">{t("discordReminders.planned")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
