"use client";

// ── SponsorProfilesContent ────────────────────────────────────────────────────
// The NEW "Sponsor profiles" tab on /a/sponsors (sponsor-system redesign P1, owner-approved
// mockup: public/_sponsor_system_preview.html view 2). Sponsor ENTITIES (ydpay, ...) with
// admin-assigned MEMBERS (a ydpay member sees only ydpay in the portal) and attached EVENTS.
//
// HOW IT CONNECTS
//  - API: lib/sponsors.ts -> backend afc_sponsors (create/list/edit, members add/remove,
//    events attach/detach). Member add fires the backend "sponsor_access" notification, which
//    also triggers the one-time Sponsor Dashboard coachmark on the member's next login.
//  - Event picker: GET /events/get-all-events/ (the same list the admin events page reads),
//    filtered client-side with the shared matchesSearch helper.
//  - Sits beside the LEGACY "Sponsor accounts" tab (the old user-keyed sponsor system) inside
//    app/(a)/a/sponsors/page.tsx until the P2 cutover.
//
// Design: house admin idioms - Card p-0 table, outline rounded-full badges, dialogs, toasts.

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  UserSearchSelect,
  type PickedUser,
} from "@/components/ui/user-search-select";
import { IconLoader2, IconPlus, IconTrash, IconUsers, IconX } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
import { sponsorsApi, type SponsorRow } from "@/lib/sponsors";
import Cookies from "js-cookie";

// Minimal event shape for the attach picker (from GET /events/get-all-events/).
interface PickableEvent {
  event_id: number;
  event_name: string;
  event_status: string;
}

export function SponsorProfilesContent() {
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cWebsite, setCWebsite] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Manage dialog state (members + attached events of ONE sponsor).
  const [manage, setManage] = useState<SponsorRow | null>(null);
  const [manageEvents, setManageEvents] = useState<
    { event_id: number; event_name: string }[]
  >([]);
  const [allEvents, setAllEvents] = useState<PickableEvent[]>([]);
  const [eventQuery, setEventQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await sponsorsApi.list({ limit: 100 });
      setSponsors(res.results);
    } catch {
      toast.error("Failed to load sponsor profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!cName.trim()) {
      toast.error("Give the sponsor a name.");
      return;
    }
    setCreating(true);
    try {
      await sponsorsApi.create({
        name: cName.trim(),
        website: cWebsite.trim(),
        description: cDesc.trim(),
      });
      toast.success("Sponsor created.");
      setCreateOpen(false);
      setCName(""); setCWebsite(""); setCDesc("");
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create the sponsor.");
    } finally {
      setCreating(false);
    }
  };

  // ── Manage dialog: open with fresh detail + the sponsor's events + the event pool. ──
  const openManage = async (s: SponsorRow) => {
    setManage(s);
    setEventQuery("");
    try {
      const [detail, events] = await Promise.all([
        sponsorsApi.detail(s.id),
        sponsorsApi.events(s.id),
      ]);
      setManage(detail.sponsor);
      setManageEvents(events.results.map((e) => ({ event_id: e.event_id, event_name: e.event_name })));
    } catch {
      toast.error("Failed to load the sponsor's details.");
    }
    // The attach picker's pool: fetched once per dialog open (same endpoint the admin
    // events page lists from), filtered client-side below.
    if (allEvents.length === 0) {
      try {
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`, {
          headers: { Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` },
        });
        // get-all-events wraps the list: {events: [...]}.
        setAllEvents(
          (res.data?.events ?? []).map((e: any) => ({
            event_id: e.event_id,
            event_name: e.event_name,
            event_status: e.event_status,
          })),
        );
      } catch {
        /* picker just stays empty; attach by id is still possible server-side */
      }
    }
  };

  const reloadManage = async () => {
    if (!manage) return;
    const [detail, events] = await Promise.all([
      sponsorsApi.detail(manage.id),
      sponsorsApi.events(manage.id),
    ]);
    setManage(detail.sponsor);
    setManageEvents(events.results.map((e) => ({ event_id: e.event_id, event_name: e.event_name })));
    refresh();
  };

  const handleAddMember = async (_u: string | null, user?: PickedUser) => {
    if (!manage || !user) return;
    setBusy(true);
    try {
      await sponsorsApi.addMember(manage.id, { user_id: user.user_id });
      toast.success(`${user.username} added. They get the dashboard pointer on next login.`);
      await reloadManage();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add the member.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberId: number, username: string) => {
    if (!manage) return;
    setBusy(true);
    try {
      await sponsorsApi.removeMember(manage.id, memberId);
      toast.success(`${username} removed.`);
      await reloadManage();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove the member.");
    } finally {
      setBusy(false);
    }
  };

  const handleAttach = async (e: PickableEvent) => {
    if (!manage) return;
    setBusy(true);
    try {
      await sponsorsApi.attachEvent(manage.id, e.event_id);
      toast.success(`${e.event_name} attached.`);
      setEventQuery("");
      await reloadManage();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to attach the event.");
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async (eventId: number, name: string) => {
    if (!manage) return;
    setBusy(true);
    try {
      await sponsorsApi.detachEvent(manage.id, eventId);
      toast.success(`${name} detached.`);
      await reloadManage();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to detach the event.");
    } finally {
      setBusy(false);
    }
  };

  // Attach picker results: events matching the query that are not already attached.
  const pickerResults = useMemo(() => {
    if (eventQuery.trim().length < 2) return [];
    const attached = new Set(manageEvents.map((e) => e.event_id));
    return allEvents
      .filter((e) => !attached.has(e.event_id) && matchesSearch([e.event_name], eventQuery))
      .slice(0, 8);
  }, [eventQuery, allEvents, manageEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
        <IconLoader2 className="size-5 animate-spin" /> Loading sponsor profiles...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Sponsor profiles with admin-assigned members. A member sees ONLY their own sponsor's
          dashboard and data.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus /> Create sponsor
        </Button>
      </div>

      {sponsors.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No sponsor profiles yet. Create one (e.g. ydpay), assign its members, then attach
            its events.
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sponsor</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsors.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.members_count}</TableCell>
                      <TableCell>{s.events_count}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            s.status === "active"
                              ? "rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                              : "rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openManage(s)}>
                          <IconUsers className="size-4" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => !creating && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create sponsor</DialogTitle>
            <DialogDescription>
              The brand profile events attach to and members belong to.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. ydpay" />
            </div>
            <div className="space-y-1.5">
              <Label>Website (optional)</Label>
              <Input value={cWebsite} onChange={(e) => setCWebsite(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea rows={3} value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={creating} onClick={handleCreate}>
              {creating && <IconLoader2 className="size-4 animate-spin mr-1" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage dialog (members + events of one sponsor) ── */}
      <Dialog open={!!manage} onOpenChange={(o) => !o && !busy && setManage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage {manage?.name}</DialogTitle>
            <DialogDescription>
              Members open this sponsor's dashboard; attached events feed it data.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* members */}
            <div className="space-y-2">
              <Label>Members ({manage?.members?.length ?? 0})</Label>
              <UserSearchSelect
                value={null}
                onChange={handleAddMember}
                disabled={busy}
                placeholder="Add a member by username..."
              />
              {(manage?.members ?? []).length > 0 && (
                <div className="divide-y rounded-md border">
                  {(manage?.members ?? []).map((m) => (
                    <div key={m.member_id} className="flex items-center justify-between gap-2 p-2">
                      <span className="text-sm font-medium">{m.username}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => handleRemoveMember(m.member_id, m.username)}
                        aria-label={`Remove ${m.username}`}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* attached events */}
            <div className="space-y-2">
              <Label>Attached events ({manageEvents.length})</Label>
              <div className="relative">
                <Input
                  value={eventQuery}
                  onChange={(e) => setEventQuery(e.target.value)}
                  placeholder="Search an event to attach..."
                  disabled={busy}
                />
                {pickerResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {pickerResults.map((e) => (
                      <button
                        key={e.event_id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => handleAttach(e)}
                      >
                        <span className="truncate">{e.event_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{e.event_status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {manageEvents.length > 0 && (
                <div className="divide-y rounded-md border">
                  {manageEvents.map((e) => (
                    <div key={e.event_id} className="flex items-center justify-between gap-2 p-2">
                      <span className="text-sm">{e.event_name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => handleDetach(e.event_id, e.event_name)}
                        aria-label={`Detach ${e.event_name}`}
                      >
                        <IconX className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setManage(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
