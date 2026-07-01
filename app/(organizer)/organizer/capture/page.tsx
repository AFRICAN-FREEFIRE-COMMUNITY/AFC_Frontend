// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Live Capture — download the AFC Capture desktop client + directions.
//
// PURPOSE
//   The on-site home for the AFC Capture Windows app (the afc-capture/ tray client that watches the
//   Free Fire client's MatchResult_*.log and auto-posts each round to AFC, and tails the debugger log
//   to push in-round LIVE standings). Three cards: (1) DOWNLOAD the signed .exe, (2) generate the
//   event-scoped CAPTURE KEY the app authenticates with, (3) step-by-step HOW-TO.
//
// HOW IT CONNECTS
//   • Download URL = env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL (owner drops in the hosted signed release;
//     unset => the button is disabled with a "coming soon" note so the page ships early).
//   • Capture key = uploadTokenApi.ensure(eventId) -> POST events/<id>/upload/token/ (Bearer,
//     org-scoped; creates-or-returns an EventUploadToken; regenerate rotates). The desktop app sends
//     this as the X-Upload-Token header to events/upload-team-match-result/ and events/live/push/.
//   • Events for the picker = GET events/get-all-events/?organization_id=<org> (same org-scoping the
//     sibling organizer Leaderboards/Events pages use). Org comes from OrganizerContext.
//   • The live overlay link the how-to references is produced by components/overlay/CopyOverlayLinkDialog
//     on the event leaderboard page.
//
// DESIGN: mirrors the sibling organizer pages (PageHeader green title, bg-card rounded-md border
// cards, shadcn Select/Button/Input, sonner toasts, DM Sans). i18n namespace "capture" (en +
// generated fr/pt). No em/en dashes per the AFC hard rule.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import axios from "axios";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  IconDownload,
  IconKey,
  IconCopy,
  IconRefresh,
  IconBroadcast,
  IconShieldLock,
  IconHelp,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../_components/OrganizerContext";
import { uploadTokenApi } from "@/lib/overlay";

// FAQ item keys (order shown). Each maps to capture.faq.items.<key>.q / .a in the messages.
const FAQ_KEYS = [
  "what", "need", "setup", "key", "nowindow", "relaunch", "notuploading",
  "livenotupdating", "editstats", "safe", "software", "multiple", "solo",
  "leaked", "warning", "osupport",
] as const;

// Minimal event row off get-all-events (only what the picker needs).
interface OrgEvent {
  event_id: number | string;
  event_name: string;
}

export default function OrganizerCapturePage() {
  const t = useTranslations("capture");
  const { membership } = useOrganizer();
  const { token } = useAuth();
  const organizationId = membership.organization.organization_id;

  // The AFC Capture installer is served by THIS frontend from public/downloads/AFC-Capture.exe
  // (committed to the repo, so it ships inside the prod image at /downloads/AFC-Capture.exe -> no
  // separate host needed). NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL is an optional override (e.g. a CDN/signed
  // release URL); when unset the button points at the bundled copy, so the download always works.
  const downloadUrl =
    env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL || "/downloads/AFC-Capture.exe";

  // ── The org's events (for the capture-key picker). Same fetch shape as the organizer Leaderboards
  //    page: get-all-events scoped by organization_id, Bearer from AuthContext. ──
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [captureKey, setCaptureKey] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ events: OrgEvent[] }>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          {
            params: { organization_id: organizationId },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!cancelled) setEvents(res.data?.events ?? []);
      } catch {
        if (!cancelled) toast.error(t("key.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, token, t]);

  // Switching the selected event clears any key shown for the previous one.
  const onSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setCaptureKey("");
  };

  const generate = async (regenerate: boolean) => {
    if (!selectedEventId) return;
    setBusy(true);
    try {
      const key = await uploadTokenApi.ensure(selectedEventId, { regenerate });
      setCaptureKey(key);
      toast.success(t("key.generated"));
    } catch {
      toast.error(t("key.error"));
    } finally {
      setBusy(false);
    }
  };

  const copyKey = () => {
    if (!captureKey) return;
    navigator.clipboard
      ?.writeText(captureKey)
      .then(() => toast.success(t("key.copied")))
      .catch(() => toast.error(t("key.error")));
  };

  const steps = useMemo(
    () => [t("steps.s1"), t("steps.s2"), t("steps.s3"), t("steps.s4"), t("steps.s5")],
    [t],
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-2">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* ── 1. Download ── */}
      <Card className="bg-card rounded-md border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconDownload className="size-5 text-primary" />
            {t("download.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{t("download.body")}</p>
          {downloadUrl ? (
            <Button asChild>
              <a href={downloadUrl} download>
                <IconDownload className="size-4" />
                {t("download.button")}
              </a>
            </Button>
          ) : (
            <div className="space-y-1">
              <Button disabled>
                <IconDownload className="size-4" />
                {t("download.button")}
              </Button>
              <p className="text-muted-foreground text-xs">{t("download.comingSoon")}</p>
            </div>
          )}
          <p className="text-muted-foreground text-xs">{t("download.requirement")}</p>
        </CardContent>
      </Card>

      {/* ── 2. Capture key ── */}
      <Card className="bg-card rounded-md border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconKey className="size-5 text-primary" />
            {t("key.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t("key.body")}</p>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t("key.eventLabel")}
            </label>
            {events.length ? (
              <Select value={selectedEventId} onValueChange={onSelectEvent}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("key.eventPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.event_id} value={String(e.event_id)}>
                      {e.event_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-sm">{t("key.noEvents")}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => generate(false)} disabled={!selectedEventId || busy}>
              {t("key.generate")}
            </Button>
          </div>

          {captureKey ? (
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {t("key.keyLabel")}
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={captureKey}
                  className="font-mono text-xs"
                  onFocus={(ev) => ev.currentTarget.select()}
                />
                <Button type="button" variant="secondary" onClick={copyKey}>
                  <IconCopy className="size-4" />
                  {t("key.copy")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => generate(true)}
                  disabled={busy}
                >
                  <IconRefresh className="size-4" />
                  {t("key.regenerate")}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{t("key.regenerateWarn")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── 3. How to use ── */}
      <Card className="bg-card rounded-md border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconBroadcast className="size-5 text-primary" />
            {t("steps.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-foreground list-decimal space-y-2 pl-5 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="pl-1">
                {s}
              </li>
            ))}
          </ol>
          {/* Reassurance: the live feed is provisional; the organizer stays in control via the
              normal leaderboard edit UI, and the overlay reflects edits on the next poll. */}
          <div className="border-primary/40 bg-primary/5 text-muted-foreground mt-4 rounded-md border-l-2 px-3 py-2 text-sm">
            <span className="text-foreground font-medium">{t("editNote.title")} </span>
            {t("editNote.body")}
          </div>
        </CardContent>
      </Card>

      {/* ── 4. FAQ / troubleshooting (owner 2026-07-01: cover how-tos + what-ifs) ── */}
      <Card className="bg-card rounded-md border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconHelp className="size-5 text-primary" />
            {t("faq.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_KEYS.map((k) => (
              <AccordionItem key={k} value={k}>
                <AccordionTrigger className="text-left text-sm">
                  {t(`faq.items.${k}.q`)}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm">
                  {t(`faq.items.${k}.a`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* ── Privacy / requirements note ── */}
      <div className="text-muted-foreground flex items-start gap-2 text-xs">
        <IconShieldLock className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="text-foreground font-medium">{t("privacy.title")}: </span>
          {t("privacy.body")}
        </span>
      </div>
    </div>
  );
}
