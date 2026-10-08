"use client";

/**
 * app/(a)/a/support/page.tsx - AFC's support desk: every message anybody has sent AFC, by PERSON.
 *
 * WHY THIS PAGE EXISTS (owner 2026-09-14)
 *   "i want there to now be a support dashboard and role that can access and reply to it ... the
 *   suport page should see all contact us sent also and they should be able to reply from there and
 *   also see replies from people there also."
 *
 * THE DESK ITSELF is components/support/desk/SupportDesk.tsx (by person, inbox #169 / #174), shared
 * with the organizer portal's Support page. This page decides who may open it and which desk.
 *
 * WHICH DESK (inbox #175, owner 2026-10-08: "Only head admin and super admins can see stuff of
 * organizer")
 *   AFC's own desk by default. support/access/ also lists `organizer_desks`, the organizations whose
 *   questions the caller may read: every organization that has been asked something for a head /
 *   super admin, nothing for ordinary support staff. When that list is not empty a desk picker sits
 *   in the header; picking an organization re-mounts the desk scoped to it. The choice rides in
 *   ?desk=<slug> so a reload or a shared link keeps it. Such a desk is READ ONLY for AFC
 *   (`can_reply` false): only the organizer's own team answers its questions.
 *
 * WHO MAY OPEN IT
 *   The backend decides, not this file: GET support/access/ answers {can_work_tickets,
 *   can_read_audit, organizer_desks} and the page renders the refusal state when the caller has no
 *   desk at all (R26: a control nobody can use is never drawn). The sidebar entry is gated by the
 *   same roles in constants/nav-links.ts.
 *
 * A reply from this page is an admin mutation, so afc_auth.middleware.AuditLogMiddleware records
 * it on the sitewide History page automatically. The support-only audit (every message, every
 * file) is the sibling page at /a/support/audit, head admins only.
 */
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconShieldLock } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";
import { SupportDesk } from "@/components/support/desk/SupportDesk";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getSupportAccess, type SupportAccess } from "@/lib/api/support";

const AFC_DESK = "afc";

/**
 * The page itself is only the Suspense boundary. The desk reads the ?ticket= query with
 * useSearchParams, which SUSPENDS, and a suspending client component with no boundary above it
 * leaves the whole segment showing a placeholder for ever (which is exactly what happened to the
 * public ticket page on the day this shipped).
 */
export default function SupportDeskPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <AdminSupport />
    </Suspense>
  );
}

function AdminSupport() {
  const t = useTranslations("support");
  const { token } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<SupportAccess | null>(null);

  useEffect(() => {
    if (!token) return;
    getSupportAccess(token)
      .then(setAccess)
      .catch(() => setAccess({ can_work_tickets: false, can_read_audit: false, organizer_desks: [] }));
  }, [token]);

  if (!token || access === null) return <FullLoader />;

  const desks = access.organizer_desks;
  const wanted = params.get("desk") || "";
  const orgDesk = desks.find((d) => d.slug === wanted);
  // AFC's desk when the caller works it; otherwise the organizer desk they asked for, or their first.
  const current = orgDesk ?? (access.can_work_tickets ? null : desks[0] ?? null);

  if (!access.can_work_tickets && !desks.length) {
    return (
      <div>
        <PageHeader title={t("title")} />
        <Card>
          <CardContent className="py-10 text-center">
            <IconShieldLock className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="text-sm">{t("noAccess")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pickDesk = (value: string) => {
    const next = new URLSearchParams();
    if (value !== AFC_DESK) next.set("desk", value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const picker = desks.length ? (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{t("desk.picker.label")}</span>
      <Select value={current?.slug ?? AFC_DESK} onValueChange={pickDesk}>
        <SelectTrigger className="w-full sm:w-[260px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {access.can_work_tickets ? <SelectItem value={AFC_DESK}>{t("desk.picker.afc")}</SelectItem> : null}
          {desks.map((d) => (
            <SelectItem key={d.slug} value={d.slug}>
              {d.open_count ? t("desk.picker.orgWaiting", { name: d.name, count: d.open_count }) : d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : undefined;

  return (
    <SupportDesk
      // A different desk is a different list, selection and filter set: start it fresh.
      key={current?.slug ?? AFC_DESK}
      token={token}
      organization={current ? { slug: current.slug, name: current.name } : undefined}
      readOnly={current ? !current.can_reply : false}
      header={
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              {current ? t("desk.orgTitle", { name: current.name }) : t("title")} <NewBadge since="2026-10-08" />
            </span>
          }
          description={current ? t("desk.orgSubtitleAdmin") : t("desk.subtitle")}
          action={picker}
        />
      }
    />
  );
}
