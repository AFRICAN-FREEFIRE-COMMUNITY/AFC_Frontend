"use client";

// ── "You have been invited", on the event page itself ────────────────────────
//
// Owner 2026-09-02, looking at an event page that showed only "Private event, invite required":
//   "if a team was invited to an event, this option should be open to the team and all of those in
//    that team who can register the team."
//
// WHAT WAS ACTUALLY WRONG. `get_event_details` has returned `my_invitation` since 2026-08-26, and
// the backend docstring names EventDetailsWrapper as its consumer. A grep of the whole frontend for
// that key returned NOTHING. The feature shipped on one side only, so:
//
//   - an invited TEAM opening the event page saw a dead button and a message telling them they
//     needed the very thing they already had, and
//   - an invited SOLO player had nowhere at all to answer, because the only Accept control lived on
//     the team page and a solo player has no team.
//
// This is the missing half. It does not widen who may answer: the backend scopes `my_invitation` to
// the viewer's own teams, and the accept endpoint still enforces WHO may answer for a team (owner,
// captain, vice-captain, manager, coach), so a plain member sees the invitation and is refused by
// the same rule that has always applied.
//
// ACCEPTING IS REGISTERING, so this hands off to the page's ordinary registration flow rather than
// posting on its own: an invitation moves a team to the front of the queue, it is never a way
// around the door. Declining is terminal and posts directly.
//
// CONNECTS TO
//   events/team-invitations/<id>/decline/  and  .../accept/   (afc_tournament_and_scrims
//   .event_invites), the same endpoints the team page card uses.
//   Rendered by app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { IconLoader2, IconMail } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export interface MyEventInvitation {
  id: number;
  status: string;
  message?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  is_solo?: boolean;
  invited_by?: string | null;
}

export function EventInvitationBanner({
  invitation,
  token,
  onAccept,
  onAnswered,
}: {
  invitation: MyEventInvitation;
  token: string | null;
  /** Opens the page's normal registration flow. Accepting IS registering, so the invitation must
   *  not take a shortcut past the gates every other entrant passes. */
  onAccept: () => void;
  /** Re-read the event after a decline, so the banner goes away. */
  onAnswered: () => void;
}) {
  const t = useTranslations("eventInvites");
  const [busy, setBusy] = useState(false);

  const handleDecline = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/${invitation.id}/decline/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("team.toastDeclined"));
      onAnswered();
    } catch (err) {
      toast.error(
        (axios.isAxiosError<{ message?: string }>(err) && err.response?.data?.message) ||
          t("team.toastDeclineFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    // Filled surface, no stroke, per the house rule. The invitation is good news, so it reads in
    // the brand hue rather than as a warning.
    <div className="flex flex-col gap-3 rounded-md bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <IconMail className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-base font-semibold text-primary">
            {invitation.is_solo
              ? t("event.bannerTitleSolo")
              : t("event.bannerTitleTeam", { team: invitation.team_name ?? "" })}
          </p>
          <p className="text-sm text-muted-foreground">
            {invitation.invited_by
              ? t("event.bannerByline", { inviter: invitation.invited_by })
              : t("event.bannerBylineUnknown")}
          </p>
          {/* The inviter's own words, on their own surface so they read as THEIRS. Up to 2000
              characters since 2026-09-01, and the line breaks they typed are preserved. */}
          {invitation.message ? (
            <div className="mt-2 rounded-md bg-muted/40 px-3 py-2">
              <p className="whitespace-pre-line break-words text-xs text-muted-foreground">
                {invitation.message}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onAccept} disabled={busy} className="flex-1">
          {t("event.bannerAccept")}
        </Button>
        <Button onClick={handleDecline} disabled={busy} variant="outline" className="flex-1">
          {busy && <IconLoader2 className="mr-2 size-4 animate-spin" />}
          {t("event.bannerDecline")}
        </Button>
      </div>
      {/* Said plainly, because "Accept" on its own reads like a one-click confirmation and it is
          not: it opens the ordinary registration flow, gates and all. */}
      <p className="text-xs text-muted-foreground">{t("event.bannerNote")}</p>
    </div>
  );
}
