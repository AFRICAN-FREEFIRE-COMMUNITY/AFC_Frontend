// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Members.
//
// A table of the organization's members (username, full name, role badge, status)
// plus the member-management surfaces:
//   • "Add sub-organizer" dialog — username input + a Switch per permission.
//   • Per-row permission toggles — only for sub_organizers; the owner row is
//     read-only (the owner implicitly has everything).
//   • Per-row remove — guarded by an AlertDialog destructive confirm.
//
// ALL of the add / edit / remove UI is gated on the caller being able to manage
// members: either role "owner", or my_permissions.can_manage_members. A viewer
// without that permission sees the table only.
//
// Data + mutations go through organizersApi:
//   getOrganizationMembers(slug) · addOrganizationMember · editOrganizationMember ·
//   removeOrganizationMember.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { organizersApi } from "@/lib/organizers";
import {
  OrgPermissions,
  useOrganizer,
} from "../_components/OrganizerContext";

// ── Permission catalogue ──────────────────────────────────────────────────────
// The 8 can_* keys, paired with human labels for the toggle UIs. Order is the
// catalogue order so the add-dialog and the per-row toggles stay consistent.

const PERMISSION_FIELDS: { key: keyof OrgPermissions; label: string }[] = [
  { key: "can_create_events", label: "Create events" },
  { key: "can_edit_events", label: "Edit events" },
  { key: "can_upload_results", label: "Upload results" },
  { key: "can_manage_registrations", label: "Manage registrations" },
  { key: "can_submit_designs", label: "Submit designs" },
  { key: "can_view_metrics", label: "View metrics" },
  { key: "can_view_reviews", label: "View reviews" },
  { key: "can_manage_members", label: "Manage members" },
];

// Every permission off — the starting state for a new sub-organizer.
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
  const isOwner = role === "owner";
  return (
    <Badge
      variant="outline"
      className={
        isOwner
          ? "border-primary text-primary capitalize"
          : "border-blue-500 text-blue-600 capitalize"
      }
    >
      {role.replace("_", " ")}
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
      {status || "—"}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerMembersPage() {
  const { slug, membership, isOwner } = useOrganizer();

  // The caller may manage members if they own the org or hold can_manage_members.
  const canManageMembers =
    isOwner || membership.permissions.can_manage_members === true;

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
          err?.response?.data?.message || "Failed to load members.",
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
      toast.error("Enter a username.");
      return;
    }
    setAdding(true);
    try {
      await organizersApi.addOrganizationMember(slug, {
        username: addUsername.trim(),
        permissions: addPermissions,
      });
      toast.success(`${addUsername.trim()} added.`);
      // Re-fetch so the new row (with its server-assigned user_id) appears.
      const res = await organizersApi.getOrganizationMembers(slug);
      setMembers(res?.results ?? []);
      // Reset the dialog.
      setAddUsername("");
      setAddPermissions(EMPTY_PERMISSIONS);
      setAddOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add member.");
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
        err?.response?.data?.message || "Failed to update permissions.",
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
      toast.success(`${member.username} removed.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove member.");
    } finally {
      setBusy(member.user_id, false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        <IconLoader2 className="size-5 animate-spin" />
        Loading members...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Members"
        description={`${members.length} member${members.length !== 1 ? "s" : ""}`}
        action={
          // Only members who can manage members see the add button.
          canManageMembers ? (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <IconUserPlus className="size-4 mr-1.5" />
                  Add sub-organizer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add sub-organizer</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  {/* Username. */}
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      placeholder="Enter username"
                      value={addUsername}
                      onChange={(e) => setAddUsername(e.target.value)}
                      disabled={adding}
                    />
                  </div>

                  {/* Permission switches. */}
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="flex flex-col gap-2.5 rounded-md border p-3">
                      {PERMISSION_FIELDS.map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-xs">{field.label}</span>
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
                    Cancel
                  </Button>
                  <Button disabled={adding} onClick={handleAdd}>
                    {adding && (
                      <IconLoader2 className="size-4 animate-spin mr-2" />
                    )}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {/* Members table. */}
      <Card className="pt-2">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Full name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {/* Permission + remove columns only matter to managers. */}
                  {canManageMembers && <TableHead>Permissions</TableHead>}
                  {canManageMembers && (
                    <TableHead className="text-right">Actions</TableHead>
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
                      No members yet.
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
                        <TableCell>{m.full_name || "—"}</TableCell>
                        <TableCell>
                          <RoleBadge role={m.role} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={m.status} />
                        </TableCell>

                        {/* Per-row permission toggles — sub_organizers only;
                            the owner row is read-only. */}
                        {canManageMembers && (
                          <TableCell>
                            {isOwnerRow ? (
                              <span className="text-xs text-muted-foreground">
                                Full access
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
                                      {field.label}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        )}

                        {/* Remove — destructive AlertDialog confirm; not the owner. */}
                        {canManageMembers && (
                          <TableCell className="text-right">
                            {isOwnerRow ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                                    disabled={isBusy}
                                  >
                                    {isBusy ? (
                                      <IconLoader2 className="size-3 animate-spin" />
                                    ) : (
                                      <IconTrash className="size-3" />
                                    )}
                                    Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Remove {m.username}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This removes {m.username} from the
                                      organization. They will lose all access.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-white hover:bg-destructive/90"
                                      onClick={() => handleRemove(m)}
                                    >
                                      Remove
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
    </div>
  );
}
