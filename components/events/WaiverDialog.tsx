"use client";

// WaiverDialog (owner 2026-08-26)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// The admin control for excusing ONE team from named event requirements.
//
// WHERE IT IS USED: the event Registered Teams tab (a "Waive requirements" action per team). The
// same component takes `preselected` so the bulk-add refusal panel can hand it exactly the codes
// the backend reported as blocking.
//
// TWO DELIBERATE FRICTIONS, both asked for at design time:
//   1. The reason field is REQUIRED and Save stays disabled until it is filled. The automatic audit
//      log (afc_auth.AuditLogMiddleware) records who and when but NOT request bodies, so this field
//      is the only place the "why" survives.
//   2. Two codes carry an on-screen warning, because their consequences are downstream and
//      invisible here: waiving capacity puts an extra team into an event whose stages and groups
//      were sized for a fixed count, and waiving roster size admits a team that cannot field a full
//      squad.
//
// Bans and payment are not in the list at all, and the backend refuses them too
// (waivers.NEVER_WAIVABLE), so a hand-crafted request cannot get past either.
//
// STYLE: filled surfaces, no rings or outlines (the house rule bans building structure from
// hairlines). A ticked row is a stronger fill, not a border.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { NewBadge } from "@/components/NewBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { grantWaiver } from "@/lib/waivers";

/** Mirrors waivers.WAIVABLE_CODES on the backend, element for element, in dialog order. */
const CODES = [
  "team_logo_required",
  "registration_requirements_unmet",
  "letter_avatars_required",
  "discord_required",
  "roster_size",
  "country_restricted",
  "capacity_full",
  "sponsor_submission_invalid",
] as const;

/** Codes whose consequences are not visible on this screen. */
const WARNED = new Set<string>(["capacity_full", "roster_size"]);

/** The day this control went live. NewBadge removes itself 5 days later. */
const SHIPPED_ON = "2026-08-26";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  /** The team being excused, for a duo/squad event. Exactly one of teamId / userId is set. */
  teamId?: number | null;
  /** The player being excused, for a SOLO event (owner 2026-08-26). */
  userId?: number | null;
  /** What to call the invitee in the title: a team name or a username. */
  teamName: string;
  /** Codes to tick on open, e.g. the ones a bulk-add refusal reported. */
  preselected?: string[];
  onSaved?: () => void;
};

export function WaiverDialog({
  open,
  onOpenChange,
  eventId,
  teamId = null,
  userId = null,
  teamName,
  preselected = [],
  onSaved,
}: Props) {
  const t = useTranslations("waivers");
  const { token } = useAuth();
  const [codes, setCodes] = useState<string[]>(preselected);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (code: string) =>
    setCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const save = async () => {
    if (!token) return;
    if (!reason.trim()) {
      toast.error(t("reasonMissing"));
      return;
    }
    setSaving(true);
    try {
      // Exactly one of these is sent. The backend refuses a waiver naming neither, and naming both
      // would be ambiguous about who was actually excused.
      await grantWaiver(token, {
        event_id: eventId,
        ...(userId ? { user_id: userId } : { team_id: teamId }),
        codes,
        reason: reason.trim(),
      });
      toast.success(t("saved"));
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      // The backend names the offending code or the missing reason, so show that rather than a
      // generic failure the admin cannot act on.
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("title", { team: teamName })}
            <NewBadge since={SHIPPED_ON} />
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-start gap-3 rounded-md bg-muted p-3"
            >
              <Checkbox
                checked={codes.includes(code)}
                onCheckedChange={() => toggle(code)}
              />
              <span className="text-sm">
                {t(`codes.${code}` as never)}
                {WARNED.has(code) && codes.includes(code) ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(`warning.${code}` as never)}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="waiver-reason">
            {t("reasonLabel")}
          </label>
          <Textarea
            id="waiver-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !reason.trim() || codes.length === 0}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
