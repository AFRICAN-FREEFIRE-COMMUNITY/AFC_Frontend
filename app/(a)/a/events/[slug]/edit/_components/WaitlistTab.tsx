"use client";

import { useState } from "react";
import axios from "axios";
// i18n: this Waitlist tab is shared by the admin + organizer event-edit wizards. All copy is
// internationalized via the "evEditTabs" namespace (messages/{en,fr,pt}/evEditTabs.json).
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { IconLoader2 } from "@tabler/icons-react";
// Team country flag shown beside each waitlisted team name (owner 2026-07-03). team_country rides
// on each waitlist_competitors[] row (get_event_details). Blank/solo -> CountryFlag renders nothing.
import { CountryFlag } from "@/lib/countryFlag";
import CheckinSettingsCard from "./CheckinSettingsCard";
import AutoSeedCard from "./AutoSeedCard";

export interface WaitlistForm {
  is_waitlist_enabled: boolean;
  waitlist_capacity: string;
  waitlist_discord_role_id: string;
  // Slot-assignment mode (owner 2026-06-17): how a no-show's slot is filled.
  waitlist_mode: string;
  // F3 registration requirements (owner 2026-06-19): per-event gates enforced at registration.
  require_team_logo?: boolean;
  require_esport_images?: boolean;
  require_player_uid?: boolean;
  require_player_profile_image?: boolean;
  // Event.require_whatsapp (owner 2026-08-03): rendered on the Basic Info tab like the flags above,
  // but held in this same waitlistForm state and persisted by saveWaitlistSettings.
  require_whatsapp?: boolean;
  // Letter-avatars gate (feature #7, owner 2026-06-29): NUMBER gate (0 = off, 1-26 = required min).
  // Like the require_* fields above it is edited on Basic Info and persisted by the waitlist save.
  min_letter_avatars?: number;
}

// NOTE (owner correction 2026-06-22): the registration-requirement toggles (team logo /
// esport image / profile image / Free Fire UID) MOVED off this tab to Basic Info
// (BasicInfoTab), where ALL registration requirements now sit together. They are still
// stored in the edit page's waitlistForm + persisted by saveWaitlistSettings (so the save
// is unchanged); only the rendering location moved. This tab is now waitlist-only.

// One waitlist roster row from get_event_details.waitlist_competitors (owner 2026-06-17).
interface WaitlistEntry {
  position?: number;
  name?: string;
  // The team's auto-derived country (squad rows only); drives the flag beside the name.
  team_country?: string | null;
  registration_date?: string | null;
  // ids used to promote: solo carries registered_competitor_id, squad carries tournament_team_id
  registered_competitor_id?: number;
  tournament_team_id?: number;
}

// The 3 slot-assignment modes. i18n: labelKey/helpKey resolve into the "evEditTabs" namespace at
// render (fully enumerated: every one of these keys exists in messages/{en,fr,pt}/evEditTabs.json).
const MODE_OPTIONS: { value: string; labelKey: string; helpKey: string }[] = [
  {
    value: "first_registered",
    labelKey: "waitlist.modeFirstRegisteredLabel",
    helpKey: "waitlist.modeFirstRegisteredHelp",
  },
  {
    value: "fcfs_room",
    labelKey: "waitlist.modeFcfsRoomLabel",
    helpKey: "waitlist.modeFcfsRoomHelp",
  },
  {
    value: "manual_admin",
    labelKey: "waitlist.modeManualAdminLabel",
    helpKey: "waitlist.modeManualAdminHelp",
  },
];

interface WaitlistTabProps {
  waitlistForm: WaitlistForm;
  setWaitlistForm: React.Dispatch<React.SetStateAction<WaitlistForm>>;
  onSave: () => void;
  saving: boolean;
  // event id + a refetch callback so the promote actions can refresh the roster.
  eventId?: number;
  onRefresh?: () => void;
  eventDetails?: {
    participant_type: string;
    // The waitlist roster (positions + ids) the backend now returns. Falls back to deriving from
    // registered_competitors / tournament_teams for older payloads.
    waitlist_competitors?: WaitlistEntry[];
    registered_competitors: Array<{
      player_id: number;
      username: string;
      is_waitlisted?: boolean;
      registered_at?: string;
    }>;
    tournament_teams: any[];
  };
  hideDiscord?: boolean;
}

export default function WaitlistTab({
  waitlistForm,
  setWaitlistForm,
  onSave,
  saving,
  eventId,
  onRefresh,
  eventDetails,
  hideDiscord = false,
}: WaitlistTabProps) {
  const { token } = useAuth();
  const t = useTranslations("evEditTabs");
  // Guarded translate for the mode label/help keys (built from the MODE_OPTIONS list): falls back to
  // the key stem if a key is ever missing so a dynamic lookup can never throw a MISSING_MESSAGE.
  const tg = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
  const [busyId, setBusyId] = useState<string | null>(null);

  const mode = waitlistForm.waitlist_mode || "first_registered";
  const roster: WaitlistEntry[] = eventDetails?.waitlist_competitors ?? [];
  const isSquad = eventDetails?.participant_type === "squad";

  // Promote a specific waitlist entry (manual_admin pick + fcfs_room confirm).
  const promote = async (entry: WaitlistEntry) => {
    if (!eventId || !token) return;
    const key = String(entry.tournament_team_id ?? entry.registered_competitor_id);
    setBusyId(key);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/promote-from-waitlist/`,
        {
          event_id: eventId,
          ...(entry.tournament_team_id
            ? { tournament_team_id: entry.tournament_team_id }
            : { competitor_id: entry.registered_competitor_id }),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        t("waitlist.toastPromoted", {
          name: entry.name ?? t("waitlist.toastCompetitorFallback"),
        }),
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t("waitlist.toastPromoteFailed"));
    } finally {
      setBusyId(null);
    }
  };

  // Promote the earliest-registered waitlist entry (first_registered convenience).
  const promoteNext = async () => {
    if (!eventId || !token) return;
    setBusyId("next");
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/promote-next-waitlist/`,
        { event_id: eventId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(res.data?.message || t("waitlist.toastNextPromoted"));
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t("waitlist.toastPromoteNextFailed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Registration requirements moved to Basic Info (owner 2026-06-22) - see the note at
          the top of this file. This tab is waitlist-only now. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("waitlist.cardTitle")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t("waitlist.cardSubtitle")}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="waitlist-toggle">{t("waitlist.enableWaitlist")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("waitlist.enableWaitlistHelp")}
              </p>
            </div>
            <Switch
              id="waitlist-toggle"
              checked={waitlistForm.is_waitlist_enabled}
              onCheckedChange={(v) =>
                setWaitlistForm((p) => ({ ...p, is_waitlist_enabled: v }))
              }
            />
          </div>

          {waitlistForm.is_waitlist_enabled && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-capacity">{t("waitlist.capacity")}</Label>
                <Input
                  id="waitlist-capacity"
                  type="number"
                  min={1}
                  placeholder={t("waitlist.capacityPlaceholder")}
                  value={waitlistForm.waitlist_capacity}
                  onChange={(e) =>
                    setWaitlistForm((p) => ({
                      ...p,
                      waitlist_capacity: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("waitlist.capacityHelp")}
                </p>
              </div>

              {/* Slot-assignment MODE (owner 2026-06-17): how a no-show's slot is filled. Shown to
                  players on the event page so they know the rule. */}
              <div className="space-y-2">
                <Label>{t("waitlist.howSlotsFilled")}</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() =>
                        setWaitlistForm((p) => ({ ...p, waitlist_mode: opt.value }))
                      }
                      className={cn(
                        "rounded-md border p-3 text-left text-xs transition-colors",
                        mode === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="block font-medium">{tg(opt.labelKey, opt.labelKey)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    // The active mode's help. helpKey is enumerated in MODE_OPTIONS; tg guards the
                    // lookup so an unknown mode can never throw at render.
                    const helpKey = MODE_OPTIONS.find((o) => o.value === mode)?.helpKey;
                    return helpKey ? tg(helpKey, helpKey) : "";
                  })()}
                </p>
              </div>

              {/* Waitlist Discord Role ID - hidden in the organizer flow (hideDiscord). */}
              {!hideDiscord && (
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-discord-role">
                    {t("waitlist.discordRole")}
                  </Label>
                  <Input
                    id="waitlist-discord-role"
                    placeholder={t("waitlist.discordRolePlaceholder")}
                    value={waitlistForm.waitlist_discord_role_id}
                    onChange={(e) =>
                      setWaitlistForm((p) => ({
                        ...p,
                        waitlist_discord_role_id: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("waitlist.discordRoleHelp")}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving && <IconLoader2 className="size-4 animate-spin mr-2" />}
          {saving ? t("waitlist.saving") : t("waitlist.saveSettings")}
        </Button>
      </div>

      {eventDetails && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{t("waitlist.peopleOnWaitlist", { count: roster.length })}</CardTitle>
            {/* first_registered convenience: promote the earliest-registered in one click. */}
            {eventId && roster.length > 0 && mode === "first_registered" && (
              <Button
                size="sm"
                variant="outline"
                onClick={promoteNext}
                disabled={busyId === "next"}
              >
                {busyId === "next" && (
                  <IconLoader2 className="size-4 animate-spin mr-1" />
                )}
                {t("waitlist.promoteNext")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
            {mode === "fcfs_room" && roster.length > 0 && (
              <p className="mb-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                {t("waitlist.fcfsNotice")}
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t("waitlist.colNumber")}</TableHead>
                  <TableHead>{isSquad ? t("waitlist.colTeam") : t("waitlist.colPlayer")}</TableHead>
                  <TableHead>{t("waitlist.colRegisteredAt")}</TableHead>
                  {eventId && <TableHead className="text-right">{t("waitlist.colAction")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((entry, i) => {
                  const key = String(
                    entry.tournament_team_id ?? entry.registered_competitor_id ?? i,
                  );
                  return (
                    <TableRow key={key}>
                      <TableCell className="text-muted-foreground">
                        {entry.position ?? i + 1}
                      </TableCell>
                      <TableCell className="font-medium capitalize">
                        <span className="inline-flex items-center gap-1.5">
                          {/* Flag beside the waitlisted team name (team's country). */}
                          <CountryFlag country={entry.team_country} />
                          {entry.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.registration_date
                          ? formatDate(entry.registration_date)
                          : "-"}
                      </TableCell>
                      {eventId && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => promote(entry)}
                            disabled={busyId === key}
                          >
                            {busyId === key && (
                              <IconLoader2 className="size-4 animate-spin mr-1" />
                            )}
                            {t("waitlist.promote")}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {roster.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={eventId ? 4 : 3}
                      className="text-center text-muted-foreground py-8"
                    >
                      {t("waitlist.emptyWaitlist")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Check-in (owner 2026-07-04): sits with the waitlist settings because non-checked-in
          competitors are relegated to the waitlist. Self-contained (own state + endpoints). */}
      <CheckinSettingsCard eventId={eventId} />

      {/* Fully-automatic event (owner 2026-07-04): auto-seed available teams into groups at start. */}
      <AutoSeedCard
        eventId={eventId}
        initialEnabled={(eventDetails as any)?.auto_seed_on_start}
        initialTrigger={(eventDetails as any)?.auto_seed_trigger}
      />
    </div>
  );
}
