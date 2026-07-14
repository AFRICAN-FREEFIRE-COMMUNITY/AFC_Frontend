// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Members.
//
// A table of the organization's members (username, full name, role badge, status)
// plus the member-management surfaces:
//   • "Add sub-organizer" dialog - username input + a Switch per permission.
//   • Per-row permission toggles - only for sub_organizers; the owner row is
//     read-only (the owner implicitly has everything).
//   • Per-row remove - guarded by an AlertDialog destructive confirm.
//
// ALL of the add / edit / remove UI is OWNER-ONLY (owner, 2026-07-14): only the org owner
// (isOwner, which also covers an AFC god-mode admin_override) sees it. A sub_organizer -
// even one previously granted can_manage_members - sees the read-only roster (username /
// full name / role / status) and NEVER the permissions or actions columns, because letting
// a sub touch permissions would let them escalate their own access. Mirrors the backend
// org_is_owner gate on add/edit/remove_organization_member.
//
// Data + mutations go through organizersApi:
//   getOrganizationMembers(slug) · addOrganizationMember · editOrganizationMember ·
//   removeOrganizationMember.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IconLoader2, IconTrash, IconUserPlus } from "@tabler/icons-react";
// Search-as-you-type user picker (GET /auth/search-users) - replaces the old raw
// username <Input> so the caller picks a real account instead of guessing the spelling.
import { UserSearchSelect } from "@/components/ui/user-search-select";
import { organizersApi } from "@/lib/organizers";
import {
  OrgPermissions,
  useOrganizer,
} from "../_components/OrganizerContext";

// ── Permission catalogue ──────────────────────────────────────────────────────
// The grantable can_* keys, paired with human labels for the toggle UIs. Order is the
// catalogue order so the add-dialog and the per-row toggles stay consistent.
//
// NOTE (owner, 2026-07-14): can_manage_members is intentionally NOT listed here. Member +
// permission management is owner-only, so granting it to a sub_organizer would be inert and
// misleading. The field still exists on the model/type (kept for backward compat) but is no
// longer offered as a grant.
const PERMISSION_FIELDS: { key: keyof OrgPermissions; label: string }[] = [
  { key: "can_create_events", label: "Create events" },
  { key: "can_edit_events", label: "Edit events" },
  { key: "can_upload_results", label: "Upload results" },
  { key: "can_manage_registrations", label: "Manage registrations" },
  { key: "can_submit_designs", label: "Submit designs" },
  { key: "can_view_metrics", label: "View metrics" },
  { key: "can_view_reviews", label: "View reviews" },
];

// Every permission off - the starting state for a new sub-organizer.
const EMPTY_PERMISSIONS: OrgPermissions = {
  can_create_events: false,
  can_edit_events: false,
  can_upload_results: false,
  can_manage_registrations: false,
  can_submit_designs: false,
  can_view_metrics: false,
  can_view_reviews: false,
  can_manage_members: false,
};

// A single member row from getOrganizationMembers(slug).results[].
interface Member {
  user_id: number;
  username: string;
  full_name: string;
  role: "owner" | "sub_organizer" | string;
  status: string;
  permissions: OrgPermissions;
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const t = useTranslations("organizer");
  const isOwner = role === "owner";
  // Known roles get a translated label; any unknown role falls back to its raw value.
  const roleLabel =
    role === "owner"
      ? t("members.role.owner")
      : role === "sub_organizer"
        ? t("members.role.sub_organizer")
        : role.replace("_", " ");
  return (
    <Badge
      variant="outline"
      className={
        isOwner
          ? "border-primary text-primary capitalize"
          : "border-blue-500 text-blue-600 capitalize"
      }
    >
      {roleLabel}
    </Badge>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();
  const colour =
    normalized === "active"
      ? "border-green-500 text-green-600"
      : "border-yellow-500 text-yellow-600";
  return (
    <Badge variant="outline" className={`capitalize ${colour}`}>
      {status || "-"}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerMembersPage() {
  const t = useTranslations("organizer");
  const { slug, isOwner } = useOrganizer();

  // Member + permission management is OWNER-ONLY (owner, 2026-07-14). isOwner already covers
  // an AFC god-mode admin_override membership. A sub_organizer never manages members, so they
  // see only the read-only roster - matching the backend org_is_owner gate.
  const canManageMembers = isOwner;

  // ── F5 org lifecycle (owner 2026-06-19) ──
  // A sub-organizer can LEAVE; the OWNER can SUSPEND / UNSUSPEND / DELETE (soft) their own org.
  const router = useRouter();
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [orgStatus, setOrgStatus] = useState<string>("active");
  useEffect(() => {
    organizersApi
      .getOrganization(slug)
      .then((res: any) => setOrgStatus(res?.organization?.status ?? res?.status ?? "active"))
      .catch(() => {});
  }, [slug]);
  const orgSuspended = orgStatus === "suspended";

  const handleLeave = async () => {
    setLifecycleBusy(true);
    try {
      await organizersApi.leaveOrganization(slug);
      toast.success(t("members.toast.leftOrg"));
      router.push("/organizer");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("members.toast.leaveError"));
    } finally {
      setLifecycleBusy(false);
    }
  };
  const handleSuspendToggle = async () => {
    setLifecycleBusy(true);
    try {
      await organizersApi.suspendMyOrganization(slug, !orgSuspended);
      setOrgStatus(orgSuspended ? "active" : "suspended");
      toast.success(
        orgSuspended
          ? t("members.toast.orgReactivated")
          : t("members.toast.orgSuspended"),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("members.toast.updateOrgError"));
    } finally {
      setLifecycleBusy(false);
    }
  };
  const handleDeleteOrg = async () => {
    setLifecycleBusy(true);
    try {
      await organizersApi.deleteMyOrganization(slug);
      toast.success(t("members.toast.orgDeleted"));
      router.push("/organizer");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("members.toast.deleteOrgError"));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Tracks user_ids currently mid-mutation, to disable their controls.
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  // Add-sub-organizer dialog state.
  const [addOpen, setAddOpen] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [addPermissions, setAddPermissions] =
    useState<OrgPermissions>(EMPTY_PERMISSIONS);
  const [adding, setAdding] = useState(false);

  // ── Load members. ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await organizersApi.getOrganizationMembers(slug);
        setMembers(res?.results ?? []);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || t("members.toast.loadError"),
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  // Mark/unmark a user_id as busy (mutation in flight).
  const setBusy = (userId: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  // ── Add a sub-organizer. ──
  const handleAdd = async () => {
    if (!addUsername.trim()) {
      toast.error(t("members.toast.enterUsername"));
      return;
    }
    setAdding(true);
    try {
      await organizersApi.addOrganizationMember(slug, {
        username: addUsername.trim(),
        permissions: addPermissions,
      });
      toast.success(t("members.toast.added", { name: addUsername.trim() }));
      // Re-fetch so the new row (with its server-assigned user_id) appears.
      const res = await organizersApi.getOrganizationMembers(slug);
      setMembers(res?.results ?? []);
      // Reset the dialog.
      setAddUsername("");
      setAddPermissions(EMPTY_PERMISSIONS);
      setAddOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("members.toast.addError"));
    } finally {
      setAdding(false);
    }
  };

  // ── Toggle one permission on an existing sub-organizer. ──
  const handleTogglePermission = async (
    member: Member,
    key: keyof OrgPermissions,
    value: boolean,
  ) => {
    // Optimistic update so the Switch feels instant.
    const nextPermissions = { ...member.permissions, [key]: value };
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === member.user_id
          ? { ...m, permissions: nextPermissions }
          : m,
      ),
    );
    setBusy(member.user_id, true);
    try {
      await organizersApi.editOrganizationMember(slug, member.user_id, {
        permissions: nextPermissions,
      });
    } catch (err: any) {
      // Roll back on failure.
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id ? { ...m, permissions: member.permissions } : m,
        ),
      );
      toast.error(
        err?.response?.data?.message || t("members.toast.permissionsError"),
      );
    } finally {
      setBusy(member.user_id, false);
    }
  };

  // ── Remove a member. ──
  const handleRemove = async (member: Member) => {
    setBusy(member.user_id, true);
    try {
      await organizersApi.removeOrganizationMember(slug, member.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      toast.success(t("members.toast.removed", { name: member.username }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("members.toast.removeError"));
    } finally {
      setBusy(member.user_id, false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        <IconLoader2 className="size-5 animate-spin" />
        {t("members.loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="org-members-title">
      <PageHeader
        title={t("members.title")}
        description={t("members.memberCount", { count: members.length })}
        action={
          // Only members who can manage members see the add button.
          canManageMembers ? (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button data-tour="org-members-add">
                  <IconUserPlus className="size-4 mr-1.5" />
                  {t("members.addSubOrganizer")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("members.addSubOrganizer")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  {/* User - typeahead picker, not a raw username input, so the
                      caller sees matching accounts as they type and selects one. */}
                  <div className="space-y-2">
                    <Label>{t("members.userLabel")}</Label>
                    <UserSearchSelect
                      value={addUsername || null}
                      onChange={(username) => setAddUsername(username ?? "")}
                      placeholder={t("members.searchPlaceholder")}
                      disabled={adding}
                    />
                  </div>

                  {/* Permission switches. */}
                  <div className="space-y-2">
                    <Label>{t("members.permissionsLabel")}</Label>
                    <div className="flex flex-col gap-2.5 rounded-md border p-3">
                      {PERMISSION_FIELDS.map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-xs">
                            {t(`members.permissions.${field.key}`)}
                          </span>
                          <Switch
                            checked={addPermissions[field.key]}
                            onCheckedChange={(checked) =>
                              setAddPermissions((prev) => ({
                                ...prev,
                                [field.key]: checked,
                              }))
                            }
                            disabled={adding}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    disabled={adding}
                    onClick={() => setAddOpen(false)}
                  >
                    {t("members.cancel")}
                  </Button>
                  <Button disabled={adding} onClick={handleAdd}>
                    {adding && (
                      <IconLoader2 className="size-4 animate-spin mr-2" />
                    )}
                    {t("members.add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      </div>

      {/* Members table. */}
      <Card className="pt-2">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-tour="org-members-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("members.table.username")}</TableHead>
                  <TableHead>{t("members.table.fullName")}</TableHead>
                  <TableHead>{t("members.table.role")}</TableHead>
                  <TableHead>{t("members.table.status")}</TableHead>
                  {/* Permission + remove columns only matter to managers. */}
                  {canManageMembers && (
                    <TableHead>{t("members.table.permissions")}</TableHead>
                  )}
                  {canManageMembers && (
                    <TableHead className="text-right">
                      {t("members.table.actions")}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManageMembers ? 6 : 4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t("members.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => {
                    const isOwnerRow = m.role === "owner";
                    const isBusy = busyIds.has(m.user_id);
                    return (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-medium">
                          {m.username}
                        </TableCell>
                        <TableCell>{m.full_name || "-"}</TableCell>
                        <TableCell>
                          <RoleBadge role={m.role} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={m.status} />
                        </TableCell>

                        {/* Per-row permission toggles - sub_organizers only;
                            the owner row is read-only. */}
                        {canManageMembers && (
                          <TableCell>
                            {isOwnerRow ? (
                              <span className="text-xs text-muted-foreground">
                                {t("members.fullAccess")}
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                {PERMISSION_FIELDS.map((field) => (
                                  <label
                                    key={field.key}
                                    className="flex items-center gap-1.5"
                                  >
                                    <Switch
                                      checked={m.permissions?.[field.key]}
                                      onCheckedChange={(checked) =>
                                        handleTogglePermission(
                                          m,
                                          field.key,
                                          checked,
                                        )
                                      }
                                      disabled={isBusy}
                                    />
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                      {t(`members.permissions.${field.key}`)}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        )}

                        {/* Remove - destructive AlertDialog confirm; not the owner. */}
                        {canManageMembers && (
                          <TableCell className="text-right">
                            {isOwnerRow ? (
                              <span className="text-xs text-muted-foreground">
                                -
                              </span>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs"
                                    disabled={isBusy}
                                  >
                                    {isBusy ? (
                                      <IconLoader2 className="size-3 animate-spin" />
                                    ) : (
                                      <IconTrash className="size-3" />
                                    )}
                                    {t("members.remove.button")}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {t("members.remove.confirmTitle", {
                                        name: m.username,
                                      })}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("members.remove.confirmDesc", {
                                        name: m.username,
                                      })}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t("members.cancel")}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-white hover:bg-destructive/90"
                                      onClick={() => handleRemove(m)}
                                    >
                                      {t("members.remove.button")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── F5 danger zone (owner 2026-06-19) ──
          Sub-organizers can leave; the owner can suspend/unsuspend or soft-delete the org. */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {isOwner ? (
            <>
              <div>
                <p className="text-sm font-medium">{t("members.org.controlsTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {orgSuspended
                    ? t("members.org.suspendedDesc")
                    : t("members.org.activeDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSuspendToggle}
                  disabled={lifecycleBusy}
                >
                  {lifecycleBusy && <IconLoader2 className="size-4 animate-spin mr-1" />}
                  {orgSuspended ? t("members.org.reactivate") : t("members.org.suspend")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={lifecycleBusy}>
                      {t("members.org.deleteButton")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("members.org.deleteConfirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("members.org.deleteConfirmDesc")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("members.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={handleDeleteOrg}
                      >
                        {t("members.org.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">{t("members.leave.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("members.leave.desc")}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={lifecycleBusy}>
                    {lifecycleBusy && <IconLoader2 className="size-4 animate-spin mr-1" />}
                    {t("members.leave.button")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("members.leave.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("members.leave.confirmDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("members.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLeave}>{t("members.leave.confirm")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
