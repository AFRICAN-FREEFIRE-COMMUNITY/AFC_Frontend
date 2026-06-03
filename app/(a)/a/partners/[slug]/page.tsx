"use client";

// ── Admin · Partner detail ───────────────────────────────────────────────────
// Head-admin / partner-admin detail view for one data-API partner (afc_partner_api
// admin API, via partnersApi.getPartner(slug)). Everything the read API later
// ENFORCES is configured here: the partner's scope, its 14 resource/field toggles,
// and its rotatable API keys. Mirrors the tabbed admin-detail idiom from the
// Organizations detail page (app/(a)/a/organizations/[slug]/page.tsx): a PageHeader
// with `back`, then shadcn pill Tabs.
//
//   Profile        — name / contact email (read-only summary + status) plus the
//                    reversible Suspend / Unsuspend kill-switch (suspendPartner).
//   Scope+Toggles  — the native-AFC switch + two multiselects (allowed events /
//                    organizations) + a Switch per resource toggle (6) and field
//                    toggle (8). One "Save scope & toggles" → editPartner.
//   Keys           — the partner's keys (metadata only — prefix + last-used, NEVER
//                    the secret), an issue-key dialog that shows the plaintext ONCE
//                    with a copy button, and a per-key revoke.
//
// TAB-BOUNCE FIX (the bug Organizations had): the active tab is CONTROLLED state and
// every in-tab action refetches with fetchDetail(silent=true), which skips the
// full-page loader — so a background refresh after Save/Issue/Revoke never unmounts
// the page and bounces the admin back to the first tab.
//
// Next 16 route params arrive as a Promise → unwrapped with React.use(params),
// matching the Organizations / Events detail pages.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";

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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  IconCheck,
  IconCopy,
  IconKey,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import { organizersApi } from "@/lib/organizers";
import {
  partnersApi,
  RESOURCE_TOGGLES,
  FIELD_TOGGLES,
  PARTNER_TOGGLE_FIELDS,
  type PartnerDetail,
  type PartnerKey,
  type PartnerToggle,
  type EditPartnerBody,
} from "@/lib/partners";

// ── Human-readable labels for every toggle (the Switch grid binds these) ──────
// Keyed by the SAME ids as the backend PARTNER_TOGGLE_FIELDS so there is exactly one
// source of truth: add a toggle to lib/partners.ts and give it a label here.
const TOGGLE_LABELS: Record<PartnerToggle, string> = {
  // resource toggles — which endpoints respond
  can_read_events: "Events",
  can_read_stages: "Stages & groups",
  can_read_matches: "Matches",
  can_read_standings: "Standings",
  can_read_teams: "Teams & rosters",
  can_read_players: "Players",
  // field toggles — which fields appear
  include_placements: "Placements",
  include_kills: "Kills",
  include_damage: "Damage",
  include_assists: "Assists",
  include_rosters: "Rosters",
  include_maps: "Maps played",
  include_prize: "Prize pool",
  include_mvp: "MVP",
};

// Options for the two scope multiselects (events / organizations).
interface EventOption {
  event_id: number;
  event_name: string;
  event_status: string;
}
interface OrgOption {
  organization_id: number;
  name: string;
  slug: string;
}

// Status pill — same green/orange idiom as the list page + Organizations detail.
function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <Badge variant="outline" className="border-green-600/60 text-green-400">
        Active
      </Badge>
    );
  if (status === "suspended")
    return (
      <Badge variant="outline" className="border-orange-500/40 text-orange-400">
        Suspended
      </Badge>
    );
  return (
    <Badge variant="outline" className="capitalize">
      {status || "—"}
    </Badge>
  );
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = use(params);
  const slug = decodeURIComponent(rawSlug);
  const router = useRouter();

  const [detail, setDetail] = useState<PartnerDetail | null>(null);
  const [keys, setKeys] = useState<PartnerKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Controlled active tab — so a background refetch never bounces the admin back to
  // the first (Profile) tab after an in-tab action (Save toggles / Issue / Revoke).
  const [tab, setTab] = useState("profile");

  // ── Scope + toggles working state (seeded from the fetched partner) ────────
  // Kept as local state so the admin can flip several switches / pick several events
  // before a single "Save scope & toggles" PATCH. toggles is a map keyed by toggle id.
  const [toggles, setToggles] = useState<Record<PartnerToggle, boolean>>(
    () =>
      PARTNER_TOGGLE_FIELDS.reduce(
        (acc, k) => ({ ...acc, [k]: false }),
        {} as Record<PartnerToggle, boolean>,
      ),
  );
  const [allowAllNative, setAllowAllNative] = useState(false);
  const [allowedEventIds, setAllowedEventIds] = useState<number[]>([]);
  const [allowedOrgIds, setAllowedOrgIds] = useState<number[]>([]);
  const [savingScope, setSavingScope] = useState(false);

  // ── Scope-option catalogues (all events + all orgs to choose from) ─────────
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");

  // ── Suspend / unsuspend state ─────────────────────────────────────────────
  const [suspending, setSuspending] = useState(false);

  // ── Issue-key dialog state ─────────────────────────────────────────────────
  const [issueOpen, setIssueOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [keyRateLimit, setKeyRateLimit] = useState("60");
  const [issuing, setIssuing] = useState(false);
  // The plaintext key — present ONLY in the issue response and shown exactly once.
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Revoke-key state ───────────────────────────────────────────────────────
  const [revokeTarget, setRevokeTarget] = useState<PartnerKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ── Fetch + seed the scope/toggle working state ───────────────────────────
  // silent=true does a background refetch (after Save / Issue / Revoke) WITHOUT
  // flipping the full-page loader — so the page doesn't unmount + bounce back to the
  // first tab. The initial mount load passes silent=false to show the loader.
  const fetchDetail = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await partnersApi.getPartner(slug);
      setDetail(res.partner);
      setKeys(res.keys ?? []);

      const p = res.partner;
      // seed the toggle map from the partner row (one boolean per toggle id)
      setToggles(
        PARTNER_TOGGLE_FIELDS.reduce(
          (acc, k) => ({ ...acc, [k]: Boolean(p[k]) }),
          {} as Record<PartnerToggle, boolean>,
        ),
      );
      setAllowAllNative(Boolean(p.allow_all_native_afc));
      setAllowedEventIds(p.allowed_events ?? []);
      setAllowedOrgIds(p.allowed_organizations ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load partner.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Load the scope-option catalogues once (all events + all orgs) ──────────
  // These populate the two multiselects. Events come from the same /events/get-all-
  // events/ endpoint the sponsors create wizard uses; orgs from the partner-admin-
  // shared organizations admin list (a single big page is enough for a picker).
  useEffect(() => {
    const token = Cookies.get("auth_token");
    // events
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      })
      .then((res) => setEventOptions(res.data?.events ?? []))
      .catch(() => toast.error("Failed to load events for scope picker."));
    // organizations — pull a large first page; the picker is searchable client-side.
    organizersApi
      .adminListOrganizations({ limit: 100, offset: 0 })
      .then((res: any) => setOrgOptions(res?.results ?? []))
      .catch(() => toast.error("Failed to load organizations for scope picker."));
  }, []);

  const filteredEvents = useMemo(
    () =>
      eventOptions.filter((e) =>
        e.event_name.toLowerCase().includes(eventSearch.toLowerCase().trim()),
      ),
    [eventOptions, eventSearch],
  );
  const filteredOrgs = useMemo(
    () =>
      orgOptions.filter((o) =>
        o.name.toLowerCase().includes(orgSearch.toLowerCase().trim()),
      ),
    [orgOptions, orgSearch],
  );

  // ── Scope + toggles save (one whitelist-validated PATCH) ──────────────────
  // Sends ALL 14 toggles + the native switch + both id-lists. The backend whitelist
  // rejects anything else, so this body is exactly the set it accepts.
  const handleSaveScope = async () => {
    if (savingScope) return;
    setSavingScope(true);
    try {
      const body: EditPartnerBody = {
        ...(toggles as Record<PartnerToggle, boolean>),
        allow_all_native_afc: allowAllNative,
        allowed_events: allowedEventIds,
        allowed_organizations: allowedOrgIds,
      };
      await partnersApi.editPartner(slug, body);
      toast.success("Scope & toggles saved.");
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save scope & toggles.");
    } finally {
      setSavingScope(false);
    }
  };

  // ── Suspend / unsuspend ───────────────────────────────────────────────────
  const isSuspended = detail?.status === "suspended";

  const handleToggleSuspend = async () => {
    if (suspending) return;
    setSuspending(true);
    try {
      await partnersApi.suspendPartner(slug, { suspend: !isSuspended });
      toast.success(isSuspended ? "Partner unsuspended." : "Partner suspended.");
      fetchDetail(true);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update suspension state.",
      );
    } finally {
      setSuspending(false);
    }
  };

  // ── Issue a key — the plaintext comes back ONCE and is held in issuedKey ───
  const handleIssueKey = async () => {
    if (issuing) return;
    setIssuing(true);
    try {
      const rate = parseInt(keyRateLimit, 10);
      const res = await partnersApi.issueKey(slug, {
        label: keyLabel.trim() || undefined,
        rate_limit_per_min: Number.isFinite(rate) && rate > 0 ? rate : undefined,
      });
      // swap the form for the show-once plaintext panel (same dialog stays open)
      setIssuedKey(res.api_key);
      setCopied(false);
      toast.success("API key issued. Copy it now — it won't be shown again.");
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to issue key.");
    } finally {
      setIssuing(false);
    }
  };

  // Copy the show-once plaintext to the clipboard with a brief "copied" affordance.
  const handleCopyKey = async () => {
    if (!issuedKey) return;
    try {
      await navigator.clipboard.writeText(issuedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the key manually.");
    }
  };

  // Reset the issue-key dialog back to its empty form state on close.
  const closeIssueDialog = () => {
    setIssueOpen(false);
    setIssuedKey(null);
    setKeyLabel("");
    setKeyRateLimit("60");
    setCopied(false);
  };

  // ── Revoke a key (idempotent server-side) ─────────────────────────────────
  const handleRevokeKey = async (key: PartnerKey) => {
    setRevoking(true);
    try {
      await partnersApi.revokeKey(key.key_id);
      toast.success("API key revoked.");
      setRevokeTarget(null);
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to revoke key.");
    } finally {
      setRevoking(false);
    }
  };

  // toggle one switch in the working toggle map
  const flipToggle = (key: PartnerToggle) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  // add/remove one id from a scope multiselect list
  const toggleId = (
    id: number,
    list: number[],
    setList: (v: number[]) => void,
  ) =>
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );

  if (loading) return <FullLoader />;

  if (!detail)
    return (
      <div className="flex flex-col gap-3">
        <PageHeader back title="Partner" />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Partner not found.
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after the partner name.
        title={
          <span className="inline-flex items-center">
            {detail.name}
            <InfoTip id="partners.detail._page" className="ml-1.5" />
          </span>
        }
        description={`/${detail.slug}`}
      />

      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        {/* Each section ⓘ is a SIBLING of its tab trigger (never nested in a button). */}
        <TabsList className="w-full">
          <span className="inline-flex flex-1 items-center justify-center">
            <TabsTrigger value="profile" className="w-full">Profile</TabsTrigger>
            <InfoTip id="partners.profile._section" className="ml-1" />
          </span>
          <span className="inline-flex flex-1 items-center justify-center">
            <TabsTrigger value="scope" className="w-full">Scope &amp; Toggles</TabsTrigger>
            <InfoTip id="partners.scope._section" className="ml-1" />
          </span>
          <span className="inline-flex flex-1 items-center justify-center">
            <TabsTrigger value="keys" className="w-full">Keys</TabsTrigger>
            <InfoTip id="partners.keys._section" className="ml-1" />
          </span>
        </TabsList>

        {/* ── Profile tab — read-only identity + suspend kill-switch ── */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Partner profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                {/* Name/slug are set at creation and used as identifiers — shown
                    read-only here (editing them would break the partner's keys' scope). */}
                <Input id="profile-name" value={detail.name} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">
                  Contact email
                  <InfoTip id="partners.contact_email" className="ml-1" />
                </Label>
                <Input
                  id="profile-email"
                  value={detail.contact_email || "—"}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div>
                  <StatusBadge status={detail.status} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Danger zone — suspend / unsuspend (freezes every key at once) ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {isSuspended ? "Unsuspend partner" : "Suspend partner"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSuspended
                    ? "Restore the partner — its keys authenticate again."
                    : "Block every key at once without revoking them individually."}
                </p>
              </div>
              {/* ⓘ is a SIBLING of the button (not nested). */}
              <div className="flex items-center gap-2">
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
                <InfoTip id="partners.suspend" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Scope + Toggles tab — the grant config ── */}
        <TabsContent value="scope" className="mt-4 space-y-4">
          {/* ── Scope: which events the partner may read ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex items-center">
                Scope
                <InfoTip id="partners.scope_grants._section" className="ml-1" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              {/* allow_all_native_afc — every organization-less AFC event at once */}
              <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                <span className="flex flex-col">
                  <span className="inline-flex items-center text-sm font-medium">
                    All native AFC events
                    <InfoTip id="partners.allow_all_native_afc" className="ml-1" />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Grants every AFC-run event (no organizer) in one switch.
                  </span>
                </span>
                <Switch
                  checked={allowAllNative}
                  onCheckedChange={() => setAllowAllNative((v) => !v)}
                />
              </label>

              {/* allowed_events multiselect — checkbox list inside a scroll area
                  (same idiom as the sponsors create-wizard event picker). */}
              <div className="space-y-2">
                <Label className="inline-flex items-center">
                  Allowed events
                  <InfoTip id="partners.allowed_events" className="ml-1" />
                  {allowedEventIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {allowedEventIds.length} selected
                    </Badge>
                  )}
                </Label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-1">
                    {filteredEvents.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {eventOptions.length === 0
                          ? "No events found."
                          : "No events match your search."}
                      </p>
                    ) : (
                      filteredEvents.map((e) => (
                        <label
                          key={e.event_id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted cursor-pointer select-none"
                        >
                          <Checkbox
                            checked={allowedEventIds.includes(e.event_id)}
                            onCheckedChange={() =>
                              toggleId(e.event_id, allowedEventIds, setAllowedEventIds)
                            }
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">
                              {e.event_name}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {e.event_status}
                            </span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* allowed_organizations multiselect — grants ALL of an org's events */}
              <div className="space-y-2">
                <Label className="inline-flex items-center">
                  Allowed organizations
                  <InfoTip id="partners.allowed_organizations" className="ml-1" />
                  {allowedOrgIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {allowedOrgIds.length} selected
                    </Badge>
                  )}
                </Label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-1">
                    {filteredOrgs.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {orgOptions.length === 0
                          ? "No organizations found."
                          : "No organizations match your search."}
                      </p>
                    ) : (
                      filteredOrgs.map((o) => (
                        <label
                          key={o.organization_id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted cursor-pointer select-none"
                        >
                          <Checkbox
                            checked={allowedOrgIds.includes(o.organization_id)}
                            onCheckedChange={() =>
                              toggleId(o.organization_id, allowedOrgIds, setAllowedOrgIds)
                            }
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">
                              {o.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {o.slug}
                            </span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* ── Resource toggles — which endpoints respond ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex items-center">
                Resource toggles
                <InfoTip id="partners.resource_toggles._section" className="ml-1" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {RESOURCE_TOGGLES.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{TOGGLE_LABELS[key]}</span>
                    <Switch
                      checked={toggles[key]}
                      onCheckedChange={() => flipToggle(key)}
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Field toggles — which fields appear inside a readable resource ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex items-center">
                Field toggles
                <InfoTip id="partners.field_toggles._section" className="ml-1" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FIELD_TOGGLES.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{TOGGLE_LABELS[key]}</span>
                    <Switch
                      checked={toggles[key]}
                      onCheckedChange={() => flipToggle(key)}
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveScope} disabled={savingScope}>
              {savingScope ? "Saving..." : "Save scope & toggles"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Keys tab — issue (show-once) + revoke; never display stored secrets ── */}
        <TabsContent value="keys" className="mt-4 space-y-4">
          <Card className="gap-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="inline-flex items-center">
                  API keys
                  <InfoTip id="partners.keys_table._section" className="ml-1" />
                </CardTitle>
                {/* ⓘ sits beside the issue-key button (sibling, not nested). */}
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIssueOpen(true)}
                  >
                    <IconKey className="size-4" />
                    Issue key
                  </Button>
                  <InfoTip id="partners.issue_key" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Prefix is the only safe handle for a key — the secret is
                        never stored, so it can never be shown after issue. */}
                    <TableHead>Prefix</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rate / min</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.length > 0 ? (
                    keys.map((k) => (
                      <TableRow key={k.key_id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {k.key_prefix}…
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {k.label || "—"}
                        </TableCell>
                        <TableCell>
                          {k.status === "active" ? (
                            <Badge
                              variant="outline"
                              className="border-green-600/60 text-green-400"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              Revoked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{k.rate_limit_per_min}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {k.last_used_at ? k.last_used_at.slice(0, 10) : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          {k.status === "active" ? (
                            <div className="inline-flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setRevokeTarget(k)}
                              >
                                <IconTrash className="size-4" />
                                Revoke
                              </Button>
                              <InfoTip id="partners.revoke_key" />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No keys yet. Issue one to give this partner API access.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Issue-key dialog — form, then the show-once plaintext panel ── */}
      <Dialog
        open={issueOpen}
        onOpenChange={(v) => {
          if (!v) closeIssueDialog();
        }}
      >
        <DialogContent>
          {issuedKey ? (
            // ── Show-once panel: the plaintext key + copy + "you won't see this again" ──
            <>
              <DialogHeader>
                <DialogTitle className="inline-flex items-center gap-2">
                  <IconCheck className="size-5 text-green-500" />
                  API key issued
                </DialogTitle>
                <DialogDescription>
                  Copy this key now and store it securely. For your security it is
                  shown only once — you won&apos;t be able to see it again.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={issuedKey}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" size="icon" onClick={handleCopyKey}>
                  {copied ? (
                    <IconCheck className="size-4 text-green-500" />
                  ) : (
                    <IconCopy className="size-4" />
                  )}
                </Button>
              </div>

              <DialogFooter>
                <Button onClick={closeIssueDialog}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            // ── Issue form: optional label + per-key rate limit ──
            <>
              <DialogHeader>
                <DialogTitle>Issue API key</DialogTitle>
                <DialogDescription>
                  Mint a new key for this partner. The full key is shown only once,
                  immediately after issuing.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-label">
                    Label <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="key-label"
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="e.g. Production key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-rate" className="inline-flex items-center">
                    Rate limit (requests / min)
                    <InfoTip id="partners.rate_limit" className="ml-1" />
                  </Label>
                  <Input
                    id="key-rate"
                    type="number"
                    min={1}
                    value={keyRateLimit}
                    onChange={(e) => setKeyRateLimit(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeIssueDialog}>
                  Cancel
                </Button>
                <Button disabled={issuing} onClick={handleIssueKey}>
                  {issuing ? "Issuing..." : "Issue key"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Revoke key confirm ── */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(v) => {
          if (!v) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Revoke API key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently disables{" "}
              <span className="font-mono font-semibold text-foreground">
                {revokeTarget?.key_prefix}…
              </span>
              . Any integration using it stops working immediately. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revoking}
              onClick={() => revokeTarget && handleRevokeKey(revokeTarget)}
            >
              {revoking ? "Revoking..." : "Revoke key"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
