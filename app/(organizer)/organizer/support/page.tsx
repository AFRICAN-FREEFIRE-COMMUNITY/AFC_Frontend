// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Support (inbox #167 / #175).
//
// Owner 2026-10-08: "We want to give organizers their own support feature, how can that work?
// people will be able to ask them questions and they should be able to answer and view things
// sent to them, including attachments."
//
// WHAT IT IS: the questions signed-in players sent THIS organization with "Ask the organizer"
// (components/support/AskOrganizerDialog.tsx on the event page and the organization page), on the
// same desk AFC's support team uses (components/support/desk/SupportDesk.tsx), scoped to the
// selected organization. Everything one player sent is in one place with their files; a reply
// answers all their open questions or one of them, and is signed with the organization's name.
// The player reads it on their ticket page and on /support (My tickets), and gets an email.
//
// GATING: mirrors the rest of the portal. The page opens for the owner and for members the owner
// gave "Answer support" (membership.permissions.can_answer_support, set on the Members page). A
// member without it gets the lock notice and nothing is fetched. The backend enforces the same
// rule (AFC-B afc_support/org_scope.py) and also lets AFC head / super admins read it; ordinary AFC
// support staff never see an organizer's questions.
//
// A super admin acting as the organization from AFC's side (membership role "admin_override") reads
// the desk but does not answer: only the organization's own team does (server code
// org_support_read_only).
//
// The heads-up notification and email link here with ?ticket=<number>, which opens that player.
// The selected org comes from the OrganizerContext the portal layout provides; switching orgs
// re-mounts this subtree, which starts the desk over for the new organization.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { IconLock } from "@tabler/icons-react";

import { FullLoader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { SupportDesk } from "@/components/support/desk/SupportDesk";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

import { useOrganizer } from "../_components/OrganizerContext";

// The desk reads ?ticket= with useSearchParams, which suspends: the page is the boundary.
export default function OrganizerSupportPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <OrganizerSupport />
    </Suspense>
  );
}

function OrganizerSupport() {
  const t = useTranslations("support");
  const { token } = useAuth();
  const { slug, membership, isOwner } = useOrganizer();
  const allowed = isOwner || !!membership.permissions?.can_answer_support;

  const title = (
    <span className="flex items-center gap-2">
      {t("desk.organizer.title")} <NewBadge since="2026-10-08" />
    </span>
  );

  if (!allowed) {
    return (
      <div>
        <PageHeader title={title} description={t("desk.organizer.subtitle", { name: membership.organization.name })} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="text-muted-foreground size-8" />
            <p className="text-muted-foreground max-w-sm text-sm">{t("desk.organizer.noPermission")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) return <FullLoader />;

  return (
    <SupportDesk
      key={slug}
      token={token}
      organization={{ slug, name: membership.organization.name }}
      readOnly={membership.role === "admin_override"}
      header={
        <PageHeader title={title} description={t("desk.organizer.subtitle", { name: membership.organization.name })} />
      }
    />
  );
}
