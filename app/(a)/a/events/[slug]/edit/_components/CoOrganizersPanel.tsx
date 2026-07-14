"use client";

// ── CoOrganizersPanel (F6, owner 2026-06-19) ────────────────────────────────────────────────
// Manage which OTHER organizations co-own this event. Only the creating (primary) org's OWNER (or
// an AFC admin) can invite; the invited org's owner accepts/declines (mutual consent). Accepted
// co-owners gain scoped access to the event (backend permissions.org_can_event) and the event shows
// "Organized by A & B" publicly + counts in both orgs' stats.
//
// API (lib/organizers.ts): listEventCoOrganizers / inviteCoOrganizer / respondCoOrganizer /
// revokeCoOrganizer + getOrganizationsDirectory (the org picker). Mounted on the event-edit page.
// Admin surface → English copy.

import { useCallback, useEffect, useState } from "react";
// i18n: this co-organizers panel is mounted on the admin + organizer event-edit pages. All copy is
// internationalized via the "evEditTabs" namespace (messages/{en,fr,pt}/evEditTabs.json).
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { organizersApi } from "@/lib/organizers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2, IconUsersGroup, IconTrash } from "@tabler/icons-react";

// The scoped grant toggles (mirror the backend can_* + OrganizationMember names). i18n: labelKey
// resolves into the "evEditTabs" namespace at render (fully enumerated: every one of these keys
// exists in messages/{en,fr,pt}/evEditTabs.json).
const GRANTS: { key: string; labelKey: string }[] = [
  { key: "can_edit_events", labelKey: "coOrganizers.grantEditEvents" },
  { key: "can_upload_results", labelKey: "coOrganizers.grantUploadResults" },
  { key: "can_manage_registrations", labelKey: "coOrganizers.grantManageRegistrations" },
  { key: "can_submit_designs", labelKey: "coOrganizers.grantSubmitDesigns" },
  { key: "can_view_metrics", labelKey: "coOrganizers.grantViewMetrics" },
  { key: "can_view_reviews", labelKey: "coOrganizers.grantViewReviews" },
  { key: "can_manage_members", labelKey: "coOrganizers.grantManageMembers" },
];

interface CoOrg {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  status: "pending" | "accepted" | "declined";
  payout_percent: number;
  permissions: Record<string, boolean>;
}

const statusVariant: Record<string, string> = {
  accepted: "border-green-600/60 text-green-400",
  pending: "border-amber-500/60 text-amber-400",
  declined: "border-red-600/50 text-red-400",
};

export default function CoOrganizersPanel({
  eventId,
  primaryOrgSlug,
}: {
  eventId: number;
  primaryOrgSlug?: string | null;
}) {
  const t = useTranslations("evEditTabs");
  // Guarded translate for the grant labels + co-org status (keys built from variables): falls back
  // to the English key stem if a key is ever missing so a dynamic lookup can never throw.
  const tg = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
  const [coOrgs, setCoOrgs] = useState<CoOrg[]>([]);
  const [orgs, setOrgs] = useState<Array<{ slug: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [targetSlug, setTargetSlug] = useState("");
  const [grant, setGrant] = useState<Record<string, boolean>>({ can_view_metrics: true });
  const [payout, setPayout] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await organizersApi.listEventCoOrganizers(eventId);
      setCoOrgs(res?.co_organizers ?? []);
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchList();
    // Public org directory powers the invite picker (name → slug).
    organizersApi
      .getOrganizationsDirectory()
      .then((res: any) => setOrgs(res?.organizations ?? []))
      .catch(() => {});
  }, [fetchList]);

  const invite = async () => {
    if (!targetSlug) {
      toast.error(t("coOrganizers.toastPickOrg"));
      return;
    }
    setBusy(true);
    try {
      await organizersApi.inviteCoOrganizer({
        event_id: eventId,
        organization_slug: targetSlug,
        permissions: grant,
        payout_percent: payout ? Number(payout) : 0,
      });
      toast.success(t("coOrganizers.toastInvited"));
      setTargetSlug("");
      setGrant({ can_view_metrics: true });
      setPayout("");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("coOrganizers.toastInviteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (co: CoOrg, action: "accept" | "decline") => {
    setBusy(true);
    try {
      await organizersApi.respondCoOrganizer(co.id, action);
      // action is a fixed enum ("accept" | "decline"); both success keys are enumerated in evEditTabs.
      toast.success(
        action === "accept"
          ? t("coOrganizers.toastRespondedAccept")
          : t("coOrganizers.toastRespondedDecline"),
      );
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("coOrganizers.toastRespondFailed"));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (co: CoOrg) => {
    setBusy(true);
    try {
      await organizersApi.revokeCoOrganizer(co.id);
      toast.success(t("coOrganizers.toastRemoved"));
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("coOrganizers.toastRemoveFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Orgs already invited/co-owning are filtered out of the picker - AND the event's own PRIMARY org
  // (it already owns the event; selecting it would just 400). (Adversarial-review fix, owner 2026-06-19.)
  const existingSlugs = new Set(coOrgs.map((c) => c.slug));
  if (primaryOrgSlug) existingSlugs.add(primaryOrgSlug);
  const pickable = orgs.filter((o) => !existingSlugs.has(o.slug));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconUsersGroup size={18} className="text-primary" />
          {t("coOrganizers.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("coOrganizers.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Invite form */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("coOrganizers.organization")}</Label>
              <Select value={targetSlug} onValueChange={setTargetSlug}>
                <SelectTrigger>
                  <SelectValue placeholder={t("coOrganizers.pickOrganization")} />
                </SelectTrigger>
                <SelectContent>
                  {pickable.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("coOrganizers.payoutShare")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder={t("coOrganizers.payoutPlaceholder")}
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t("coOrganizers.whatCanTheyDo")}</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GRANTS.map((g) => (
                <label key={g.key} className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={!!grant[g.key]}
                    onCheckedChange={(v) => setGrant((p) => ({ ...p, [g.key]: v }))}
                  />
                  {tg(g.labelKey, g.labelKey)}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={invite} disabled={busy || !targetSlug}>
              {busy && <IconLoader2 className="size-4 animate-spin mr-1" />}
              {t("coOrganizers.invite")}
            </Button>
          </div>
        </div>

        {/* Current co-organizers */}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> {t("coOrganizers.loading")}
          </p>
        ) : coOrgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("coOrganizers.empty")}</p>
        ) : (
          <div className="space-y-2">
            {coOrgs.map((co) => (
              <div
                key={co.id}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm capitalize">{co.name}</span>
                  {/* co.status is a fixed enum (pending | accepted | declined); all three status
                      keys are enumerated in evEditTabs. tg guards the variable-built key. */}
                  <Badge variant="outline" className={statusVariant[co.status]}>
                    {tg(
                      `coOrganizers.status${co.status.charAt(0).toUpperCase()}${co.status.slice(1)}`,
                      co.status,
                    )}
                  </Badge>
                  {co.payout_percent > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t("coOrganizers.payoutPercent", { percent: co.payout_percent })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {co.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => respond(co, "accept")}>
                        {t("coOrganizers.accept")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => respond(co, "decline")}>
                        {t("coOrganizers.decline")}
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    disabled={busy}
                    onClick={() => revoke(co)}
                    aria-label={t("coOrganizers.removeAria")}
                  >
                    <IconTrash size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
