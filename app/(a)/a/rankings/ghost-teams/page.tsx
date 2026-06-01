"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FullLoader } from "@/components/Loader";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import {
  IconGhost2, IconPlus, IconSearch, IconAlertTriangle, IconUsersGroup,
  IconClock, IconCircleCheck, IconExternalLink, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Backend (afc_rankings/admin_ghost.py serialize_ghost) can return any of these four;
// `revoked` is reset to `unclaimed` server-side on revoke, so it's rare but handled.
type ClaimStatus = "unclaimed" | "pending" | "claimed" | "revoked";
type GhostPlayer = { id: number; ign: string; slot?: number };
interface GhostTeam {
  id: string;                       // ghost_team_id (uuid string)
  team_name: string;
  country: string | null;
  external_id: string | null;
  is_active: boolean;
  claim_status: ClaimStatus;
  claim_requested_by: number | null; // User id (or null)
  claimed_by: number | null;          // afc_team.Team id (or null)
  created_by: number | null;          // User id (or null)
  created_at: string;
  // provisional roster — results attribute to these slots until a real team claims the ghost
  players: GhostPlayer[];
}

// Map one backend serialize_ghost dict → page row state.
function toRow(g: any): GhostTeam {
  return {
    id: String(g.ghost_team_id),
    team_name: g.team_name,
    country: g.country ?? null,
    external_id: g.external_id ?? null,
    is_active: !!g.is_active,
    claim_status: (g.claim_status ?? "unclaimed") as ClaimStatus,
    claim_requested_by: g.claim_requested_by ?? null,
    claimed_by: g.claimed_by ?? null,
    created_by: g.created_by ?? null,
    created_at: g.created_at ? String(g.created_at).slice(0, 10) : "",
    players: Array.isArray(g.players)
      ? g.players.map((p: any) => ({ id: p.id, ign: p.ign, slot: p.slot }))
      : [],
  };
}

// blank roster the create dialog seeds — a standard 4-player Free Fire squad
const emptyRoster = (): GhostPlayer[] =>
  Array.from({ length: 4 }, (_, i) => ({ id: i + 1, ign: "" }));

const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "Egypt", "Morocco",
  "Tanzania", "Uganda", "Algeria", "Senegal", "Cameroon", "Côte d'Ivoire",
  "Ethiopia", "Tunisia", "Zambia", "Rwanda",
];

const statusMeta: Record<ClaimStatus, { label: string; cls: string }> = {
  unclaimed: { label: "Unclaimed", cls: "border-muted-foreground/30 text-muted-foreground" },
  pending: { label: "Pending claim", cls: "border-orange-500/40 text-orange-400" },
  claimed: { label: "Claimed", cls: "border-green-600/50 text-green-400" },
  revoked: { label: "Unclaimed", cls: "border-muted-foreground/30 text-muted-foreground" },
};

function StatusBadge({ status }: { status: ClaimStatus }) {
  const m = statusMeta[status] ?? statusMeta.unclaimed;
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", m.cls)}>
      {m.label}
    </Badge>
  );
}

function StatCard({ icon, title, value, sub, tone }: any) {
  return (
    <Card className="gap-1 transition-shadow hover:shadow-lg">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("text-muted-foreground", tone)}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const MIN_REASON = 10;

/** Mandatory-reason confirm dialog (approve / revoke / delete). */
function ReasonDialog({
  open, onOpenChange, title, description, warning, confirmLabel, confirmVariant, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  warning?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = reason.trim().length >= MIN_REASON;

  function handleOpenChange(v: boolean) {
    if (!v) { setReason(""); setSubmitting(false); }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {warning && (
          <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">
            Reason <span className="text-orange-400">(required, logged)</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why, at least 10 characters. This is written to the audit log."
            className="min-h-24"
          />
          <p className="text-[11px] text-muted-foreground">
            {reason.trim().length}/{MIN_REASON} characters minimum
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Go back</Button>
          <Button
            variant={confirmVariant ?? "default"}
            disabled={!valid || submitting}
            onClick={async () => {
              setSubmitting(true);
              try { await onConfirm(reason.trim()); }
              finally { setSubmitting(false); }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Editable ghost-team roster (in-game names). Shared by the create + edit dialogs. */
function RosterEditor({
  players, onChange,
}: {
  players: GhostPlayer[];
  onChange: (next: GhostPlayer[]) => void;
}) {
  const setIgn = (id: number, ign: string) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ign } : p)));
  const add = () =>
    onChange([...players, { id: players.reduce((m, p) => Math.max(m, p.id), 0) + 1, ign: "" }]);
  const remove = (id: number) =>
    onChange(players.length <= 1 ? players : players.filter((p) => p.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          Ghost players <span className="text-orange-400">(at least one)</span>
        </Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={add}>
          <IconPlus className="mr-1 size-3.5" /> Add player
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        In-game names for the provisional roster. Match results attribute to these slots
        until a real team claims the ghost.
      </p>
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <Input
              value={p.ign}
              onChange={(e) => setIgn(p.id, e.target.value)}
              placeholder={`Player ${i + 1} in-game name`}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={players.length <= 1}
              onClick={() => remove(p.id)}
              aria-label={`Remove player ${i + 1}`}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GhostTeamsAdminPage() {
  const [rows, setRows] = useState<GhostTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "pending">("all");
  const [q, setQ] = useState("");

  // create form (+ mandatory audit reason)
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ team_name: "", country: "", external_id: "", reason: "", players: emptyRoster() });
  const [creating, setCreating] = useState(false);

  // edit form (+ mandatory audit reason)
  const [edit, setEdit] = useState<GhostTeam | null>(null);
  const [editForm, setEditForm] = useState({ team_name: "", country: "", external_id: "", reason: "", players: [] as GhostPlayer[] });
  const [savingEdit, setSavingEdit] = useState(false);

  // reason dialogs, keyed by the target row + action
  const [approve, setApprove] = useState<GhostTeam | null>(null);
  const [revoke, setRevoke] = useState<GhostTeam | null>(null);
  const [revokeClaimed, setRevokeClaimed] = useState<GhostTeam | null>(null);
  const [del, setDel] = useState<GhostTeam | null>(null);

  // ── load (on mount + when the tab filter changes) ────────────────────────
  function load() {
    setLoading(true);
    const params: Record<string, any> = {};
    if (tab === "pending") params.claim_status = "pending";
    rankingsAdminApi.ghostList(params)
      .then((r: any) => setRows((r.results ?? []).map(toRow)))
      .catch((err: any) =>
        toast.error(err?.response?.data?.message || "Failed to load ghost teams."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const counts = useMemo(() => ({
    active: rows.filter((r) => r.is_active).length,
    pending: rows.filter((r) => r.claim_status === "pending").length,
    claimed: rows.filter((r) => r.claim_status === "claimed").length,
    total: rows.length,
  }), [rows]);

  // server already filters by tab (claim_status); the search box stays client-side.
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.team_name.toLowerCase().includes(needle) ||
      (r.country ?? "").toLowerCase().includes(needle) ||
      (r.external_id ?? "").toLowerCase().includes(needle));
  }, [rows, q]);

  // ---- live writes ----
  async function createGhost() {
    const named = form.players.map((p) => p.ign.trim()).filter(Boolean);
    if (!form.team_name.trim() || !form.country.trim()) {
      toast.error("Team name and country are required.");
      return;
    }
    if (named.length === 0) {
      toast.error("Add at least one ghost player.");
      return;
    }
    if (form.reason.trim().length < MIN_REASON) {
      toast.error(`Reason must be at least ${MIN_REASON} characters.`);
      return;
    }
    setCreating(true);
    try {
      await rankingsAdminApi.createGhost({
        team_name: form.team_name.trim(),
        country: form.country.trim(),
        external_id: form.external_id.trim() || undefined,
        players: named.map((ign) => ({ ign })),
        reason: form.reason.trim(),
      });
      toast.success(`Ghost team "${form.team_name.trim()}" created with ${named.length} player${named.length > 1 ? "s" : ""}.`);
      setForm({ team_name: "", country: "", external_id: "", reason: "", players: emptyRoster() });
      setCreateOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create ghost team.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(r: GhostTeam) {
    setEditForm({
      team_name: r.team_name,
      country: r.country ?? "",
      external_id: r.external_id ?? "",
      reason: "",
      players: r.players.length ? r.players.map((p) => ({ ...p })) : emptyRoster(),
    });
    setEdit(r);
  }
  async function saveEdit() {
    if (!edit) return;
    const named = editForm.players.map((p) => p.ign.trim()).filter(Boolean);
    if (!editForm.team_name.trim() || !editForm.country.trim()) {
      toast.error("Team name and country are required.");
      return;
    }
    if (named.length === 0) {
      toast.error("A ghost team needs at least one player.");
      return;
    }
    if (editForm.reason.trim().length < MIN_REASON) {
      toast.error(`Reason must be at least ${MIN_REASON} characters.`);
      return;
    }
    setSavingEdit(true);
    try {
      await rankingsAdminApi.updateGhost(edit.id, {
        team_name: editForm.team_name.trim(),
        country: editForm.country.trim(),
        external_id: editForm.external_id.trim() || "",
        players: named.map((ign) => ({ ign })),
        reason: editForm.reason.trim(),
      });
      toast.success(`"${editForm.team_name.trim()}" updated (${named.length} player${named.length > 1 ? "s" : ""}).`);
      setEdit(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update ghost team.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function doApprove(reason: string) {
    if (!approve) return;
    try {
      await rankingsAdminApi.approveClaim(approve.id, { reason });
      toast.success(`Claim approved, "${approve.team_name}" transferred. Scores recalculating.`);
      setApprove(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve claim.");
    }
  }
  async function doRevokePending(reason: string) {
    if (!revoke) return;
    try {
      await rankingsAdminApi.revokeClaim(revoke.id, { reason });
      toast.success(`Claim request on "${revoke.team_name}" revoked.`);
      setRevoke(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to revoke claim.");
    }
  }
  async function doRevokeClaimed(reason: string) {
    if (!revokeClaimed) return;
    try {
      await rankingsAdminApi.revokeClaim(revokeClaimed.id, { reason });
      toast.success(`Claim on "${revokeClaimed.team_name}" revoked and history detached.`);
      setRevokeClaimed(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to revoke claim.");
    }
  }
  async function doDelete(reason: string) {
    if (!del) return;
    try {
      await rankingsAdminApi.deleteGhost(del.id, { reason });
      toast.success(`Ghost team "${del.team_name}" deleted.`);
      setDel(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete ghost team.");
    }
  }

  function renderTable() {
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Claimed by</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {tab === "pending"
                      ? "No claims awaiting review."
                      : q ? `No ghost teams match “${q}”.` : "No ghost teams yet."}
                  </TableCell>
                </TableRow>
              ) : visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <IconGhost2 className="size-4 text-muted-foreground" />
                      {r.team_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.country ?? "None"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="rounded-full tabular-nums"
                      title={r.players.map((p) => p.ign).join(", ") || "No players"}
                    >
                      <IconUsersGroup className="size-3" /> {r.players.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.external_id
                      ? <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{r.external_id}</code>
                      : <span className="text-muted-foreground">None</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={r.claim_status} /></TableCell>
                  <TableCell>
                    {r.claim_status === "pending" && r.claim_requested_by ? (
                      <span className="text-muted-foreground">
                        User #{r.claim_requested_by}
                        {r.claimed_by != null && <> → <span className="text-foreground">Team #{r.claimed_by}</span></>}
                      </span>
                    ) : r.claim_status === "claimed" && r.claimed_by != null ? (
                      <span className="font-medium text-green-400">Team #{r.claimed_by}</span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.created_by != null ? `User #${r.created_by}` : "System"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{r.created_at}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(r.claim_status === "unclaimed" || r.claim_status === "revoked") && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDel(r)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                      {r.claim_status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => setApprove(r)}>Approve claim</Button>
                          <Button size="sm" variant="outline" onClick={() => setRevoke(r)}>Revoke</Button>
                        </>
                      )}
                      {r.claim_status === "claimed" && (
                        <Button size="sm" variant="outline" onClick={() => setRevokeClaimed(r)}>
                          Revoke claim
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (loading && rows.length === 0) return <FullLoader text="Loading ghost teams" />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Ghost Teams"
        description="Provisional off-platform teams used to record results before a real team registers and claims them."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="mr-1.5 size-4" /> Create ghost team
          </Button>
        }
      />

      {/* stat strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={<IconUsersGroup className="size-4" />} title="Active ghost teams"
          value={counts.active} sub="Holding results off-platform" />
        <StatCard icon={<IconClock className="size-4" />} title="Pending claims"
          value={counts.pending} sub="Awaiting review"
          tone={counts.pending > 0 ? "text-orange-500" : undefined} />
        <StatCard icon={<IconCircleCheck className="size-4" />} title="Claimed"
          value={counts.claimed} sub="Transferred to real teams" tone="text-green-500" />
        <StatCard icon={<IconGhost2 className="size-4" />} title="Total records"
          value={counts.total} sub="Never deleted (audit)" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "pending")} className="gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">
              Pending claims
              {counts.pending > 0 && (
                <Badge variant="outline" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px] text-orange-400 border-orange-500/40">
                  {counts.pending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" className="h-9 pl-8" />
          </div>
        </div>

        <TabsContent value="all">{renderTable()}</TabsContent>
        <TabsContent value="pending">{renderTable()}</TabsContent>
      </Tabs>

      {/* create ghost team */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm({ team_name: "", country: "", external_id: "", reason: "", players: emptyRoster() }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create ghost team</DialogTitle>
            <DialogDescription>
              A provisional placeholder that can hold off-platform results until a registered team claims it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g-name">Team name <span className="text-orange-400">(required)</span></Label>
              <Input id="g-name" value={form.team_name}
                onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))}
                placeholder="e.g. Accra Titans" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-country">Country <span className="text-orange-400">(required)</span></Label>
              <Select value={form.country || undefined} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                <SelectTrigger id="g-country" className="w-full"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-ext">
                External ID <span className="text-muted-foreground normal-case">(optional)</span>
              </Label>
              <div className="relative">
                <IconExternalLink className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="g-ext" value={form.external_id}
                  onChange={(e) => setForm((f) => ({ ...f, external_id: e.target.value }))}
                  placeholder="discord:team#0000 or bracket:XX-00" className="pl-8" />
              </div>
            </div>

            <RosterEditor players={form.players} onChange={(players) => setForm((f) => ({ ...f, players }))} />

            <div className="space-y-2">
              <Label htmlFor="g-reason">
                Reason <span className="text-orange-400">(required, logged)</span>
              </Label>
              <Textarea
                id="g-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Explain why, at least 10 characters. This is written to the audit log."
                className="min-h-20"
              />
              <p className="text-[11px] text-muted-foreground">
                {form.reason.trim().length}/{MIN_REASON} characters minimum
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={createGhost}
              disabled={
                creating ||
                !form.team_name.trim() ||
                !form.country.trim() ||
                form.players.every((p) => !p.ign.trim()) ||
                form.reason.trim().length < MIN_REASON
              }
            >
              Create ghost team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit (unclaimed) */}
      <Dialog open={!!edit} onOpenChange={(v) => { if (!v) setEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit ghost team</DialogTitle>
            <DialogDescription>Update the placeholder details. Only available while unclaimed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="e-name">Team name</Label>
              <Input id="e-name" value={editForm.team_name}
                onChange={(e) => setEditForm((f) => ({ ...f, team_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-country">Country</Label>
              <Select value={editForm.country || undefined} onValueChange={(v) => setEditForm((f) => ({ ...f, country: v }))}>
                <SelectTrigger id="e-country" className="w-full"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-ext">External ID <span className="text-muted-foreground normal-case">(optional)</span></Label>
              <Input id="e-ext" value={editForm.external_id}
                onChange={(e) => setEditForm((f) => ({ ...f, external_id: e.target.value }))} />
            </div>

            <RosterEditor players={editForm.players} onChange={(players) => setEditForm((f) => ({ ...f, players }))} />

            <div className="space-y-2">
              <Label htmlFor="e-reason">
                Reason <span className="text-orange-400">(required, logged)</span>
              </Label>
              <Textarea
                id="e-reason"
                value={editForm.reason}
                onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Explain why, at least 10 characters. This is written to the audit log."
                className="min-h-20"
              />
              <p className="text-[11px] text-muted-foreground">
                {editForm.reason.trim().length}/{MIN_REASON} characters minimum
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button
              onClick={saveEdit}
              disabled={
                savingEdit ||
                !editForm.team_name.trim() ||
                !editForm.country.trim() ||
                editForm.players.every((p) => !p.ign.trim()) ||
                editForm.reason.trim().length < MIN_REASON
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* approve claim (mandatory reason) */}
      <ReasonDialog
        open={!!approve}
        onOpenChange={(v) => { if (!v) setApprove(null); }}
        title={`Approve claim, ${approve?.team_name ?? ""}`}
        description={approve ? `${approve.claim_requested_by ? `User #${approve.claim_requested_by}` : "A captain"} is claiming this ghost team${approve.claimed_by ? ` for Team #${approve.claimed_by}` : ""}.` : undefined}
        warning="Approving transfers ALL historical results, stats and prize money to the claiming team and retroactively recalculates the current-quarter scores. This can only be undone with a head-admin revoke."
        confirmLabel="Approve & transfer"
        onConfirm={doApprove}
      />

      {/* revoke pending request (mandatory reason) */}
      <ReasonDialog
        open={!!revoke}
        onOpenChange={(v) => { if (!v) setRevoke(null); }}
        title={`Revoke claim request, ${revoke?.team_name ?? ""}`}
        description={revoke ? `Reject the pending request${revoke.claim_requested_by ? ` from User #${revoke.claim_requested_by}` : ""}. The ghost team returns to unclaimed.` : undefined}
        confirmLabel="Revoke request"
        confirmVariant="destructive"
        onConfirm={doRevokePending}
      />

      {/* revoke an approved claim, head admin (mandatory reason) */}
      <ReasonDialog
        open={!!revokeClaimed}
        onOpenChange={(v) => { if (!v) setRevokeClaimed(null); }}
        title={`Revoke claim, ${revokeClaimed?.team_name ?? ""}`}
        description={revokeClaimed ? `Detach this ghost team${revokeClaimed.claimed_by ? ` from Team #${revokeClaimed.claimed_by}` : ""}. Head Admin only.` : undefined}
        warning="This removes the previously transferred history and prize money from the team and recalculates scores. Head-admin action, logged permanently."
        confirmLabel="Revoke claim"
        confirmVariant="destructive"
        onConfirm={doRevokeClaimed}
      />

      {/* delete ghost team (mandatory reason) */}
      <ReasonDialog
        open={!!del}
        onOpenChange={(v) => { if (!v) setDel(null); }}
        title={`Delete ghost team, ${del?.team_name ?? ""}`}
        description="Permanently remove this provisional placeholder and its roster. Only available while unclaimed."
        warning="This deletes the ghost team and all of its ghost players. A claimed ghost team cannot be deleted, revoke its claim first."
        confirmLabel="Delete ghost team"
        confirmVariant="destructive"
        onConfirm={doDelete}
      />
    </div>
  );
}
