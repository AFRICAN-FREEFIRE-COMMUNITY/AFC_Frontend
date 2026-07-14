"use client";

// ── AutoSeedCard (owner 2026-07-04) ──────────────────────────────────────────────
// Fully-automatic events: when ON, the moment the event's start time passes, the system auto-seeds
// the AVAILABLE teams (registered + not waitlisted; and if check-in is on, only checked-in-eligible
// squads) into the entry stage's groups, so the organizer only has to enter each group's room ID +
// PASS. Self-contained (own save via edit-event; "Seed now" via auto-seed/now) so it doesn't thread
// through the edit page's form. Mounted by WaitlistTab (shared admin + organizer). Backend:
// afc_tournament_and_scrims/views_autoseed.py + the flag on Event (auto_seed_on_start / auto_seeded_at).

import { useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconLoader2, IconWand } from "@tabler/icons-react";

export default function AutoSeedCard({
  eventId,
  initialEnabled,
}: {
  eventId?: number;
  initialEnabled?: boolean;
}) {
  // Shared admin + organizer edit-flow card -> keys live in evEditTabs.autoSeed (en/fr/pt).
  const t = useTranslations("evEditTabs");
  const [enabled, setEnabled] = useState(!!initialEnabled);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

  const save = async (next: boolean) => {
    if (!eventId) return;
    setEnabled(next);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("event_id", String(eventId));
      fd.append("auto_seed_on_start", next ? "True" : "False");
      await axios.post(`${base}/edit-event/`, fd, { headers: authHeaders() });
      toast.success(next ? t("autoSeed.toastOn") : t("autoSeed.toastOff"));
    } catch (err: any) {
      setEnabled(!next); // revert on failure
      toast.error(err?.response?.data?.message || t("autoSeed.toastSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const seedNow = async () => {
    if (!eventId) return;
    setSeeding(true);
    try {
      const res = await axios.post(`${base}/auto-seed/now/`, { event_id: eventId }, { headers: authHeaders() });
      toast.success(res?.data?.message || t("autoSeed.toastSeeded"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("autoSeed.toastSeedFailed"));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconWand className="text-primary size-5" /> {t("autoSeed.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {t("autoSeed.desc")}
        </p>
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="auto-seed" className="text-sm">{t("autoSeed.toggleLabel")}</Label>
          <Switch id="auto-seed" checked={enabled} onCheckedChange={save} disabled={saving} />
        </div>
        <div>
          <Button size="sm" variant="outline" onClick={seedNow} disabled={seeding}>
            {seeding ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : <IconWand className="mr-1 size-4" />}
            {t("autoSeed.seedNow")}
          </Button>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("autoSeed.seedNowHelp")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
