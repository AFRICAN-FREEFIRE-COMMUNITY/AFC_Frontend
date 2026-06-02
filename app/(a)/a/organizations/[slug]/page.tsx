"use client";

// ── Admin · Organization detail ──────────────────────────────────────────────
// Head-admin detail/edit view for a single organization (afc_organizers admin
// API, fetched via organizersApi.adminGetOrganization(slug)). Mirrors the
// tabbed admin-detail idiom from app/(a)/a/events/[slug]/page.tsx: a PageHeader
// with `back`, then shadcn pill Tabs.
//
//   Profile  — editable form (name / email / description / socials / status) →
//              adminEditOrganization. Suspend/Unsuspend → adminSuspendOrganization.
//              Delete (AlertDialog confirm) → adminDeleteOrganization → back to list.
//   Members  — table (username / role / status / permission summary) plus
//              add-member (username + role + 8 permission switches), remove, and
//              set_owner, all via adminManageMember({ action, ... }).
//   Events   — read-only list of the org's events (event_name + status + draft).
//   Reports  — Phase-4 placeholder; reports[] is currently always empty.
//
// Next 16 route params arrive as a Promise → unwrapped with React.use(params),
// matching the events detail page.

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { organizersApi } from "@/lib/organizers";

// ── Types (mirror the adminGetOrganization payload) ──────────────────────────

// The 8 granular organizer permission keys. Kept as a const array so the add-
// member switch grid, the per-member summary, and the default-permissions seed
// all iterate the same source of truth.
const PERMISSION_KEYS = [
  "can_create_events",
  "can_edit_events",
  "can_upload_results",
  "can_manage_registrations",
  "can_submit_designs",
  "can_view_metrics",
  "can_view_reviews",
  "can_manage_members",
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];
type Permissions = Record<PermissionKey, boolean>;

// human-readable labels for each permission key (used in the switch grid).
const PERMISSION_LABELS: Record<PermissionKey, string> = {
  can_create_events: "Create events",
  can_edit_events: "Edit events",
  can_upload_results: "Upload results",
  can_manage_registrations: "Manage registrations",
  can_submit_designs: "Submit designs",
  can_view_metrics: "View metrics",
  can_view_reviews: "View reviews",
  can_manage_members: "Manage members",
};

interface OrgSocials {
  x?: string;
  instagram?: string;
  youtube?: string;
  discord?: string;
}

interface OrgFull {
  organization_id: number;
  slug: string;
  name: string;
  logo: string | null;
  default_banner: string | null;
  email: string | null;
  description: string | null;
  socials: OrgSocials | null;
  status: string;
}

interface OrgMember {
  user_id: number;
  username: string;
  full_name?: string;
  role: string;
  status: string;
  permissions: Permissions;
}

interface OrgEvent {
  event_id: number;
  event_name: string;
  status: string;
  is_draft: boolean;
}

interface OrgDetail {
  organization: OrgFull;
  members: OrgMember[];
  events: OrgEvent[];
  reports: any[];
}

// a fresh all-false permission map — seeds the add-member form.
const emptyPermissions = (): Permissions =>
  PERMISSION_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: false }),
    {} as Permissions,
  );

// count of granted permissions, for the compact per-member summary cell.
const grantedCount = (perms?: Permissions) =>
  perms ? PERMISSION_KEYS.filter((k) => perms[k]).length : 0;

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = use(params);
  const slug = decodeURIComponent(rawSlug);
  const router = useRouter();

  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Profile form state (seeded from the fetched org) ──────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [socialX, setSocialX] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialDiscord, setSocialDiscord] = useState("");
  const [status, setStatus] = useState("active");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Suspend / delete state ────────────────────────────────────────────────
  const [suspending, setSuspending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Add-member dialog state ───────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [memberUsername, setMemberUsername] = useState("");
  const [memberRole, setMemberRole] = useState("sub_organizer");
  const [memberPermissions, setMemberPermissions] =
    useState<Permissions>(emptyPermissions);
  const [addingMember, setAddingMember] = useState(false);

  // ── Per-member action state (remove / set_owner) ──────────────────────────
  const [memberBusy, setMemberBusy] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);

  // ── Fetch + seed the profile form ─────────────────────────────────────────
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res: OrgDetail = await organizersApi.adminGetOrganization(slug);
      setDetail(res);

      const org = res.organization;
      const socials = org.socials ?? {};
      setName(org.name ?? "");
      setEmail(org.email ?? "");
      setDescription(org.description ?? "");
      setSocialX(socials.x ?? "");
      setSocialInstagram(socials.instagram ?? "");
      setSocialYoutube(socials.youtube ?? "");
      setSocialDiscord(socials.discord ?? "");
      setStatus(org.status ?? "active");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load organization.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await organizersApi.adminEditOrganization(slug, {
        name: name.trim(),
        email: email.trim(),
        description: description.trim(),
        socials: {
          x: socialX.trim(),
          instagram: socialInstagram.trim(),
          youtube: socialYoutube.trim(),
          discord: socialDiscord.trim(),
        },
        status,
      });
      toast.success("Organization updated.");
      fetchDetail();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update organization.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Suspend / unsuspend ───────────────────────────────────────────────────
  // status drives the toggle: anything other than "active" is treated as
  // suspended, so the button offers the opposite action.
  const isSuspended = detail?.organization.status === "suspended";

  const handleToggleSuspend = async () => {
    if (suspending) return;
    setSuspending(true);
    try {
      await organizersApi.adminSuspendOrganization(slug, {
        suspend: !isSuspended,
      });
      toast.success(isSuspended ? "Organization unsuspended." : "Organization suspended.");
      fetchDetail();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update suspension state.",
      );
    } finally {
      setSuspending(false);
    }
  };

  // ── Delete (soft-delete; events re-home to AFC) ───────────────────────────
  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await organizersApi.adminDeleteOrganization(slug);
      toast.success("Organization deleted.");
      setDeleteOpen(false);
      router.push("/a/organizations");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to delete organization.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Members: add / remove / set_owner via adminManageMember ───────────────
  const handleAddMember = async () => {
    if (memberUsername.trim().length === 0 || addingMember) return;
    setAddingMember(true);
    try {
      await organizersApi.adminManageMember(slug, {
        action: "add",
        username: memberUsername.trim(),
        role: memberRole,
        permissions: memberPermissions,
      });
      toast.success("Member added.");
      // reset the add-member form and refresh
      setMemberUsername("");
      setMemberRole("sub_organizer");
      setMemberPermissions(emptyPermissions());
      setAddOpen(false);
      fetchDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (member: OrgMember) => {
    setMemberBusy(member.user_id);
    try {
      await organizersApi.adminManageMember(slug, {
        action: "remove",
        username: member.username,
      });
      toast.success("Member removed.");
      setRemoveTarget(null);
      fetchDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove member.");
    } finally {
      setMemberBusy(null);
    }
  };

  const handleSetOwner = async (member: OrgMember) => {
    setMemberBusy(member.user_id);
    try {
      await organizersApi.adminManageMember(slug, {
        action: "set_owner",
        username: member.username,
      });
      toast.success(`${member.username} is now the owner.`);
      fetchDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to set owner.");
    } finally {
      setMemberBusy(null);
    }
  };

  // toggle a single permission switch in the add-member form
  const togglePermission = (key: PermissionKey) =>
    setMemberPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <FullLoader />;

  if (!detail)
    return (
      <div className="flex flex-col gap-3">
        <PageHeader back title="Organization" />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Organization not found.
          </CardContent>
        </Card>
      </div>
    );

  const { organization, members, events, reports } = detail;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        back
        title={organization.name}
        description={`/${organization.slug}`}
      />

      <Tabs defaultValue="profile" className="mt-2">
        <TabsList className="w-full">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* ── Profile tab — editable form + suspend / delete ── */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Organization profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Organization name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@org.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-description">Description</Label>
                <Textarea
                  id="profile-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of the organization"
                  rows={3}
                />
              </div>

              {/* ── Socials (x / instagram / youtube / discord) ── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="social-x">X (Twitter)</Label>
                  <Input
                    id="social-x"
                    value={socialX}
                    onChange={(e) => setSocialX(e.target.value)}
                    placeholder="https://x.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-instagram">Instagram</Label>
                  <Input
                    id="social-instagram"
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-youtube">YouTube</Label>
                  <Input
                    id="social-youtube"
                    value={socialYoutube}
                    onChange={(e) => setSocialYoutube(e.target.value)}
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-discord">Discord</Label>
                  <Input
                    id="social-discord"
                    value={socialDiscord}
                    onChange={(e) => setSocialDiscord(e.target.value)}
                    placeholder="https://discord.gg/..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="profile-status" className="w-full sm:w-60">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Danger zone — suspend / delete ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {isSuspended ? "Unsuspend organization" : "Suspend organization"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSuspended
                    ? "Restore the organization and its access."
                    : "Temporarily block the organization's access."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleToggleSuspend}
                  disabled={suspending}
                >
                  {suspending
                    ? "Working..."
                    : isSuspended
                      ? "Unsuspend"
                      : "Suspend"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Members tab — table + add / remove / set_owner ── */}
        <TabsContent value="members" className="mt-4 space-y-4">
          <Card className="gap-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>Members</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setAddOpen(true)}
                >
                  <IconPlus className="size-4" />
                  Add member
                </Button>
              </div>
            </CardHeader>
            <CardContent className="mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length > 0 ? (
                    members.map((m) => (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-medium">
                          {m.username}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              m.role === "owner"
                                ? "border-green-600/60 text-green-400 capitalize"
                                : "capitalize"
                            }
                          >
                            {m.role === "sub_organizer"
                              ? "Sub-organizer"
                              : m.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {m.status || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {/* owners implicitly hold everything; members show a
                              count of granted permissions out of the 8 keys */}
                          {m.role === "owner"
                            ? "All permissions"
                            : `${grantedCount(m.permissions)} / ${PERMISSION_KEYS.length}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {m.role !== "owner" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={memberBusy === m.user_id}
                                onClick={() => handleSetOwner(m)}
                              >
                                Set owner
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={memberBusy === m.user_id}
                              onClick={() => setRemoveTarget(m)}
                            >
                              <IconTrash className="size-4" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No members yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Events tab — read-only list of the org's events ── */}
        <TabsContent value="events" className="mt-4 space-y-4">
          <Card className="gap-0">
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent className="mt-2">
              {events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Draft</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow key={ev.event_id}>
                        <TableCell className="font-medium">
                          {ev.event_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {ev.status || "—"}
                        </TableCell>
                        <TableCell>
                          {ev.is_draft ? (
                            <Badge
                              variant="outline"
                              className="border-orange-500/40 text-orange-400"
                            >
                              Draft
                            </Badge>
                          ) : (
                            <Badge variant="outline">Published</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  This organization has no events yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reports tab — Phase-4 placeholder (reports[] always empty) ── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <Card className="gap-0">
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent className="mt-2">
              <p className="py-8 text-center text-sm text-muted-foreground">
                {reports.length === 0
                  ? "No reports yet."
                  : `${reports.length} report(s).`}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add member dialog (username + role + 8 permission switches) ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Add an existing user to this organization and choose what they can
              do.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-username">Username</Label>
              <Input
                id="member-username"
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                placeholder="Existing user to add"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub_organizer">Sub-organizer</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* permission switch grid — one switch per can_* key */}
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PERMISSION_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-xs">{PERMISSION_LABELS[key]}</span>
                    <Switch
                      checked={memberPermissions[key]}
                      onCheckedChange={() => togglePermission(key)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={memberUsername.trim().length === 0 || addingMember}
              onClick={handleAddMember}
            >
              {addingMember ? "Adding..." : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove member confirm ── */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(v) => {
          if (!v) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Remove member?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-semibold text-foreground">
                {removeTarget?.username}
              </span>{" "}
              from this organization. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={memberBusy === removeTarget?.user_id}
              onClick={() => removeTarget && handleRemoveMember(removeTarget)}
            >
              {memberBusy === removeTarget?.user_id ? "Removing..." : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete org confirm — soft-delete; events re-home to AFC ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete organization?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes{" "}
              <span className="font-semibold text-foreground">
                {organization.name}
              </span>
              . Its events re-home to AFC. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete organization"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
