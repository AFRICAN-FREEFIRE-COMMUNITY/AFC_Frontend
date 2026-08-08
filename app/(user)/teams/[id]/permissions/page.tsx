"use client";

/**
 * Team role permissions - the OWNER decides what each role may do with the team.
 *
 * Owner 2026-08-08: "a way for team owners to decide what controls the other roles in the team
 * have over the team." Before this, every answer was hard-coded in the backend: a captain could
 * take the team into a tournament but could not invite the sixth player, while a coach could
 * quietly kick anybody. This screen is where that gets changed.
 *
 * LAYOUT: one CARD PER ROLE, each holding the six capability switches, rather than a
 * roles x capabilities grid. A 6-column matrix cannot be read on a phone without horizontal
 * scrolling, and most AFC users are on phones. The switch-row shape (label + description on the
 * left, Switch on the right) is lifted from the stats-visibility panel on
 * app/(user)/teams/[id]/edit so this reads as the same surface.
 *
 * SAVING: instant per switch, optimistic with a revert on failure - the same idiom as
 * handleStatsVisibleToggle on the edit page. Each toggle POSTs only the one role+capability it
 * changed; the backend merges it into that role's row and leaves every other role untouched.
 *
 * CONNECTS TO:
 *   - Reads  GET  /team/role-permissions/?team_id=   (afc_team.views_permissions
 *            .get_team_role_permissions) -> {roles, capabilities, permissions, defaults,
 *            is_customised, can_edit}
 *   - Writes POST /team/set-role-permissions/        (afc_team.views_permissions
 *            .set_team_role_permissions), owner only.
 *   - The six capabilities are ENFORCED server-side in afc_team/views.py (invite_member,
 *     generate_invite_link, view_join_requests, review_join_request, manage_team_roster,
 *     kick_team_member, edit_team) and afc_tournament_and_scrims/views.py
 *     (_user_can_register_team, which also governs answering an event invitation). This screen
 *     never grants anything on its own - hiding a switch is not a permission check.
 *   - Reached from the "Team Owner Controls" card on app/(user)/teams/[id].
 *   - Copy lives in messages/{en,fr,pt}/team.json under "rolePermissions"; role labels come from
 *     the shared common.json -> teamRoles catalogue so they match the roster page.
 */

import { use, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FullLoader } from "@/components/Loader";
import { NothingFound } from "@/components/NothingFound";
import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";

type Params = Promise<{ id: string }>;

/** {role: {capability: bool}} - the same shape the backend sends and accepts. */
type PermissionMatrix = Record<string, Record<string, boolean>>;

type PermissionsResponse = {
  team_id: number;
  team_name: string;
  roles: string[];
  capabilities: string[];
  permissions: PermissionMatrix;
  defaults: PermissionMatrix;
  is_customised: boolean;
  can_edit: boolean;
};

export default function TeamRolePermissionsPage({ params }: { params: Params }) {
  const { id } = use(params);
  // Feature-scoped namespace (messages/*/team.json), the same file the stats-visibility and
  // letter-avatar panels use. Role LABELS come from common.teamRoles so this page and the roster
  // page never disagree about what "member" is called.
  const t = useTranslations("team");
  const tRoles = useTranslations("common");
  const { token } = useAuth();

  const [data, setData] = useState<PermissionsResponse>();
  const [loading, setLoading] = useState(true);
  // Which "role:capability" cells are mid-save, so only the switch being changed is disabled
  // rather than the whole page freezing on every toggle.
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/role-permissions/`,
        {
          // The [id] route segment is the team NAME, not the numeric id (the team routes are
          // /teams/<team_name>/...), so resolve by name exactly as the detail, roster and edit
          // pages do. The numeric team_id comes back in the response and is what the save calls
          // below send.
          params: { team_name: decodeURIComponent(id) },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setData(res.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("rolePermissions.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, token, t]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  /**
   * Flip one capability for one role. Optimistic: the switch moves immediately, and reverts to
   * server truth if the POST is refused (the most likely refusal being "you are not the owner",
   * which the disabled state should already have prevented).
   */
  const handleToggle = async (role: string, capability: string, next: boolean) => {
    if (!data) return;
    const cell = `${role}:${capability}`;
    setSaving((prev) => new Set(prev).add(cell));
    const previous = data.permissions[role][capability];
    setData({
      ...data,
      permissions: {
        ...data.permissions,
        [role]: { ...data.permissions[role], [capability]: next },
      },
    });

    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/set-role-permissions/`,
        { team_id: data.team_id, permissions: { [role]: { [capability]: next } } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Re-seed from the server's full matrix rather than trusting the optimistic write.
      setData((current) =>
        current
          ? { ...current, permissions: res.data.permissions, is_customised: true }
          : current,
      );
      toast.success(t("rolePermissions.saved"));
    } catch (error: any) {
      setData((current) =>
        current
          ? {
              ...current,
              permissions: {
                ...current.permissions,
                [role]: { ...current.permissions[role], [capability]: previous },
              },
            }
          : current,
      );
      toast.error(error?.response?.data?.message || t("rolePermissions.saveFailed"));
    } finally {
      setSaving((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(cell);
        return nextSet;
      });
    }
  };

  /** Put every role back to the stock AFC settings (the `defaults` matrix the API returned). */
  const handleReset = async () => {
    if (!data) return;
    setResetting(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/set-role-permissions/`,
        { team_id: data.team_id, permissions: data.defaults },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setData({ ...data, permissions: res.data.permissions });
      toast.success(t("rolePermissions.resetDone"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("rolePermissions.saveFailed"));
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <FullLoader />;
  if (!data) return <NothingFound text={t("rolePermissions.loadFailed")} />;

  const readOnly = !data.can_edit;

  return (
    <div>
      {/* NewBadge rides INSIDE the title (PageHeader takes a ReactNode title but no children), so
          it sits beside the heading rather than becoming a banner. It expires by itself 5 days
          after the date below. */}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("rolePermissions.pageTitle")}
            <NewBadge since="2026-08-08" />
          </span>
        }
        description={t("rolePermissions.pageDescription", { team: data.team_name })}
        back
      />

      {/* What the owner is actually deciding, said once in plain language. The team owner always
          keeps every control, so say so here rather than letting somebody discover it by trying. */}
      <Card className="mb-4">
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("rolePermissions.explainer")}</p>
          {/* Exactly one of these two. "You are the team owner" was briefly shown to everybody,
              which told a plain player they owned a team they do not. */}
          {readOnly ? (
            <p className="text-xs text-amber-600">{t("rolePermissions.readOnlyNote")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("rolePermissions.ownerNote")}</p>
          )}
        </CardContent>
      </Card>

      {/* One card per role. On a phone they stack; from md they sit two across. Deliberately NOT a
          roles x capabilities table, which would need horizontal scrolling on mobile. */}
      <div className="grid gap-4 md:grid-cols-2">
        {data.roles.map((role) => {
          const granted = data.capabilities.filter((c) => data.permissions[role][c]).length;
          return (
            <Card key={role}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span>{tRoles(`teamRoles.${role}`)}</span>
                  <Badge
                    variant="outline"
                    className="rounded-full px-2 py-0.5 text-xs font-normal"
                  >
                    {t("rolePermissions.grantedCount", {
                      count: granted,
                      total: data.capabilities.length,
                    })}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.capabilities.map((capability) => {
                  const cell = `${role}:${capability}`;
                  const inputId = `perm-${role}-${capability}`;
                  return (
                    <div
                      key={capability}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="space-y-0.5">
                        <Label htmlFor={inputId} className="text-sm font-medium">
                          {t(`rolePermissions.capability.${capability}.label`)}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t(`rolePermissions.capability.${capability}.description`)}
                        </p>
                      </div>
                      <Switch
                        id={inputId}
                        checked={data.permissions[role][capability]}
                        onCheckedChange={(next) => handleToggle(role, capability, next)}
                        disabled={readOnly || saving.has(cell)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleReset} disabled={resetting}>
            {resetting ? t("rolePermissions.resetting") : t("rolePermissions.reset")}
          </Button>
        </div>
      )}
    </div>
  );
}
