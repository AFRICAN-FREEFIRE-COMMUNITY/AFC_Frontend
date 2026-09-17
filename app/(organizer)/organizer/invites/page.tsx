// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Invitations (owner 2026-09-13, inbox #8)
//
// Where the INVITED organization answers a co-organizer invite. Another org's owner invites
// this org to co-organize one of their events from that event's edit page (CoOrganizersPanel);
// until this page existed the invited owner had nowhere to press Accept: the portal refused
// another org's event, the events list omitted co-owned events and the notification opened the
// public event page. The invite notification now links here.
//
// WHO: the owner of the selected org (the backend's respond gate is "owner of the invited
// org"); everyone else sees the list read-only with a note. WHAT: each pending invite shows the
// event, who invited, the dates, what would be granted (in plain words) and the payout share,
// with Accept / Decline; answered ones sit below as history.
//
// HOW IT CONNECTS
//   GET  organizers/co-organizers/mine/      organizersApi.myCoOrganizerInvites()
//   POST organizers/co-organizers/respond/   organizersApi.respondCoOrganizer(id, action)
//   After accepting, the event appears in /organizer/events with a "Co-organizing" badge and
//   every page scopes itself to the grant through eventPermissions (OrganizerContext).
//   The overview page's invitations card counts the pending rows and links here.
//
// i18n: messages/*/organizer.json -> "invites" (hand-written en/fr/pt).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconCheck, IconExternalLink, IconX } from "@tabler/icons-react";
import { LocalTime } from "@/components/LocalTime";
import { organizersApi, type CoOrganizerInvite } from "@/lib/organizers";
import { PERMISSION_KEYS, useOrganizer } from "../_components/OrganizerContext";

// Status badge colours: the same outline idiom the rest of the portal uses.
const STATUS_CLASS: Record<CoOrganizerInvite["status"], string> = {
  pending: "border-yellow-500 text-yellow-600",
  accepted: "border-green-500 text-green-600",
  declined: "border-muted-foreground text-muted-foreground",
};

function InviteCard({
  invite,
  canAnswer,
  busy,
  onRespond,
}: {
  invite: CoOrganizerInvite;
  canAnswer: boolean;
  busy: boolean;
  onRespond: (invite: CoOrganizerInvite, action: "accept" | "decline") => void;
}) {
  const t = useTranslations("organizer");
  // The flags the inviting org switched on, in plain words. can_create_events and
  // can_manage_members are org-level toggles that mean nothing on one event, so they are not
  // listed even when set.
  const granted = PERMISSION_KEYS.filter(
    (k) => k !== "can_create_events" && k !== "can_manage_members" && invite.permissions[k],
  );
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{invite.event.event_name}</h3>
              <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[invite.status]}`}>
                {t(`invites.status.${invite.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("invites.invitedBy", { name: invite.invited_by.name })}
              {" · "}
              {t("invites.forOrg", { name: invite.organization.name })}
            </p>
            <p className="text-xs text-muted-foreground">
              <LocalTime value={invite.event.start_date} mode="date" />
              {" - "}
              <LocalTime value={invite.event.end_date} mode="date" />
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/tournaments/${invite.event.slug}`} target="_blank">
              <IconExternalLink className="size-4" />
              {t("invites.openEvent")}
            </Link>
          </Button>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{t("invites.grantedTitle")}</p>
          {granted.length === 0 ? (
            <p className="text-sm">{t("invites.grantedNothing")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {granted.map((k) => (
                <Badge key={k} variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                  {t(`invites.perms.${k}`)}
                </Badge>
              ))}
            </div>
          )}
          {invite.payout_percent > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {t("invites.payout", { percent: invite.payout_percent })}
            </p>
          )}
        </div>

        {invite.status === "pending" && canAnswer && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => onRespond(invite, "accept")}>
              <IconCheck className="size-4" />
              {t("invites.accept")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onRespond(invite, "decline")}>
              <IconX className="size-4" />
              {t("invites.decline")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrganizerInvitesPage() {
  const t = useTranslations("organizer");
  const { slug, isOwner } = useOrganizer();
  const [invites, setInvites] = useState<CoOrganizerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = await organizersApi.myCoOrganizerInvites();
      setInvites(res?.invites ?? []);
    } catch (e: any) {
      if (!background) toast.error(e?.response?.data?.message || t("invites.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (invite: CoOrganizerInvite, action: "accept" | "decline") => {
    setBusy(true);
    try {
      await organizersApi.respondCoOrganizer(invite.id, action);
      toast.success(action === "accept" ? t("invites.accepted") : t("invites.declined"));
      await load(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("invites.respondFailed"));
    } finally {
      setBusy(false);
    }
  };

  // mine/ answers every org the caller owns; this page is about the SELECTED org.
  const forThisOrg = invites.filter((i) => i.organization.slug === slug);
  const pending = forThisOrg.filter((i) => i.status === "pending");
  const answered = forThisOrg.filter((i) => i.status !== "pending");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("invites.title")} description={t("invites.description")} />

      {!isOwner && (
        <p className="text-sm text-muted-foreground">{t("invites.ownerOnly")}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          {t("invites.loading")}
        </div>
      ) : forThisOrg.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t("invites.empty")}</CardContent>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t("invites.pendingTitle")}</h2>
              {pending.map((invite) => (
                <InviteCard key={invite.id} invite={invite} canAnswer={isOwner} busy={busy} onRespond={respond} />
              ))}
            </section>
          )}
          {answered.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t("invites.historyTitle")}</h2>
              {answered.map((invite) => (
                <InviteCard key={invite.id} invite={invite} canAnswer={false} busy={busy} onRespond={respond} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
