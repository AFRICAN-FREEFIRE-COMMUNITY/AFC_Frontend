"use client";

// ── Admin · Partner detail ───────────────────────────────────────────────────
// Head-admin / partner-admin detail view for one data-API partner (afc_partner_api
// admin API, via partnersApi.getPartner(slug)). Everything the read API later
// ENFORCES is configured here: the partner's scope, its 14 resource/field toggles,
// and its rotatable API keys. Mirrors the tabbed admin-detail idiom from the
// Organizations detail page (app/(a)/a/organizations/[slug]/page.tsx): a PageHeader
// with `back`, then shadcn pill Tabs.
//
//   Profile        - name / contact email (read-only summary + status) plus the
//                    reversible Suspend / Unsuspend kill-switch (suspendPartner).
//   Scope+Toggles  - the native-AFC switch + two multiselects (allowed events /
//                    organizations) + a Switch per resource toggle (6) and field
//                    toggle (8). One "Save scope & toggles" → editPartner.
//   Keys           - the partner's keys (metadata only - prefix + last-used, NEVER
//                    the secret), an issue-key dialog that shows the plaintext ONCE
//                    with a copy button, and a per-key revoke.
//
// TAB-BOUNCE FIX (the bug Organizations had): the active tab is CONTROLLED state and
// every in-tab action refetches with fetchDetail(silent=true), which skips the
// full-page loader - so a background refresh after Save/Issue/Revoke never unmounts
// the page and bounces the admin back to the first tab.
//
// Next 16 route params arrive as a Promise → unwrapped with React.use(params),
// matching the Organizations / Events detail pages.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";

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
  IconWorld,
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
  // resource toggles - which endpoints respond
  can_read_events: "Events",
  can_read_stages: "Stages & groups",
  can_read_matches: "Matches",
  can_read_standings: "Standings",
  can_read_teams: "Teams & rosters",
  can_read_players: "Players",
  can_read_designs: "Leaderboard designs",
  // field toggles - which fields appear
  include_placements: "Placements",
  include_kills: "Kills",
  include_damage: "Damage",
  include_assists: "Assists",
  include_rosters: "Rosters",
  include_maps: "Maps played",
  include_prize: "Prize pool",
  include_mvp: "MVP",
  include_media: "Images & files",
  include_text: "Descriptions & rules text",
};

// ── What each toggle actually hands the partner (the helper line under each Switch) ──
// Only the toggles whose effect is not obvious from the label carry a hint; the stat
// toggles (kills, damage, ...) are self-explanatory and are deliberately left out so the
// grid stays scannable.
const TOGGLE_HINTS: Partial<Record<PartnerToggle, string>> = {
  can_read_designs: "Background art, placed logos and brand colours for this event.",
  include_media: "Event banners, team logos and player esport images, as full URLs.",
  include_text: "Event rules text and team descriptions.",
};

// ── Partner read-API connection facts (the "Connection details" card on the Keys tab) ──
// What an AFC admin hands a partner so the partner can call the public read API. The
// base URL is the same one the partner firewall is mounted at in the backend
// (afc/urls.py → path("api/v1/partner/", ...)). NEXT_PUBLIC_BACKEND_API_URL is the AFC
// Django origin (lib/env), so this resolves to e.g.
// https://api.africanfreefirecommunity.com/api/v1/partner/ . Endpoints + auth header
// mirror afc_partner_api/partner_urls.py + the X-API-Key header the partner middleware
// reads. NONE of this is partner-specific config: it is the same for every partner;
// only the issued key (Keys tab) and the published events (Scope tab) differ.
const PARTNER_API_BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/api/v1/partner/`;

// The seven GET endpoints the read API exposes (paths RELATIVE to PARTNER_API_BASE).
// <slug> = an event's slug (returned by events/). Each is additionally gated by this
// partner's resource toggles (Scope & Toggles tab), so a path 200s only if the matching
// can_read_* switch is on AND the event is published.
const PARTNER_ENDPOINTS: { path: string; desc: string }[] = [
  { path: "events/", desc: "List published events in scope" },
  { path: "events/<slug>/", desc: "One event's details" },
  { path: "events/<slug>/stages/", desc: "Stages & groups" },
  { path: "events/<slug>/matches/", desc: "Matches" },
  { path: "events/<slug>/standings/", desc: "Standings" },
  { path: "events/<slug>/teams/", desc: "Teams & rosters" },
  { path: "events/<slug>/players/", desc: "Players" },
];

// The auth header every partner request must carry (placeholder for the issued key).
const PARTNER_AUTH_HEADER = "X-API-Key: <api key>";

// A copy-paste sample request, so the admin can hand the partner a working example.
const SAMPLE_CURL = `curl -H "${PARTNER_AUTH_HEADER}" \\\n  ${PARTNER_API_BASE}events/`;

// Options for the two scope multiselects (events / organizations). `slug` comes from the
// /events/get-all-events/ payload and is what the per-event publish control (Scope tab)
// passes to partnersApi.publishEvent (the read API addresses events by slug, never pk).
interface EventOption {
  event_id: number;
  event_name: string;
  event_status: string;
  slug: string;
  // LIVE partner-API published state (owner 2026-06-27): get-all-events now returns this so the
  // publish control shows the REAL current state on load, not just actions taken this session.
  partner_published?: boolean;
}
interface OrgOption {
  organization_id: number;
  name: string;
  slug: string;
}

// Status pill - same green/orange idiom as the list page + Organizations detail.
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
      {status || "-"}
    </Badge>
  );
}

// ── Reusable copy-to-clipboard button (Connection details card) ───────────────
// Mirrors the show-once issued-key copy affordance (IconCopy → IconCheck for 2s) but
// holds its OWN copied state, so the several copy buttons on the page (base URL, auth
// header, sample curl) never share one flag. Used only by the Connection details card.
function CopyButton({ value, className }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select and copy the text manually.");
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={copy}
      className={className}
      aria-label="Copy to clipboard"
    >
      {done ? (
        <IconCheck className="size-4 text-green-500" />
      ) : (
        <IconCopy className="size-4" />
      )}
    </Button>
  );
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = use(params);
  const slug = decodeURIComponent(rawSlug);

  const [detail, setDetail] = useState<PartnerDetail | null>(null);
  const [keys, setKeys] = useState<PartnerKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Controlled active tab - so a background refetch never bounces the admin back to
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

  // ── Per-event publish state (the "Publish to partner API" card on the Scope tab) ──
  // partner_published is a GLOBAL flag on the Event (Event.partner_published) that the
  // read API checks FIRST: a partner reads NO event until it is published, however broad
  // its scope. The admin detail/list payloads don't carry that flag (it is stripped from
  // everything the partner firewall touches), so we can't preload each event's true
  // state here. Instead we track only what the admin sets THIS session, keyed by event
  // pk: undefined = not acted on yet (show the "Publish" action), true = published,
  // false = withdrawn. publishingId disables the row's buttons while its call is in flight.
  const [publishState, setPublishState] = useState<Record<number, boolean>>({});
  const [publishingId, setPublishingId] = useState<number | null>(null);

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
  // The plaintext key - present ONLY in the issue response and shown exactly once.
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Revoke-key state ───────────────────────────────────────────────────────
  const [revokeTarget, setRevokeTarget] = useState<PartnerKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ── Delete-key state (owner 2026-06-27) ─────────────────────────────────────
  // Hard-delete a key row (vs revoke = soft-disable). Confirmed via dialog since it's irreversible.
  const [deleteTarget, setDeleteTarget] = useState<PartnerKey | null>(null);
  const [deletingKey, setDeletingKey] = useState(false);

  // ── Fetch + seed the scope/toggle working state ───────────────────────────
  // silent=true does a background refetch (after Save / Issue / Revoke) WITHOUT
  // flipping the full-page loader - so the page doesn't unmount + bounce back to the
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
    // organizations - pull a large first page; the picker is searchable client-side.
    organizersApi
      .adminListOrganizations({ limit: 100, offset: 0 })
      .then((res: any) => setOrgOptions(res?.results ?? []))
      .catch(() => toast.error("Failed to load organizations for scope picker."));
  }, []);

  // matchesSearch (the shared lib/search helper) so this picker matches the same
  // way every "Search ..." box does: punctuation / accent / fancy-font insensitive.
  const filteredEvents = useMemo(
    () =>
      eventOptions.filter((e) => matchesSearch(e.event_name, eventSearch)),
    [eventOptions, eventSearch],
  );
  // Same shared matcher for the org picker (punctuation / font-insensitive search).
  const filteredOrgs = useMemo(
    () => orgOptions.filter((o) => matchesSearch(o.name, orgSearch)),
    [orgOptions, orgSearch],
  );

  // ── Events currently in this partner's allowed_events scope, resolved to full options ──
  // The publish card lists exactly the events the admin has picked under "Allowed events"
  // (working state `allowedEventIds`, so it stays in sync as they tick boxes, even before
  // Save). We resolve each id to its EventOption to get the name + slug; ids we don't have
  // an option for (e.g. a draft hidden from the picker) are dropped. publishEvent needs
  // the slug, which is why EventOption now carries it.
  const scopedEvents = useMemo(() => {
    const byId = new Map(eventOptions.map((e) => [e.event_id, e]));
    return allowedEventIds
      .map((id) => byId.get(id))
      .filter((e): e is EventOption => Boolean(e));
  }, [allowedEventIds, eventOptions]);

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

  // ── Publish / withdraw one event to/from the partner API ──────────────────
  // Flips Event.partner_published via partnersApi.publishEvent(slug, {published}). Unlike
  // the scope/toggle switches (which batch into "Save scope & toggles"), this fires
  // IMMEDIATELY (partner_published is a per-event global gate, not part of the partner's
  // edit body). On success we record the new state in publishState so the row reflects it.
  const handlePublishEvent = async (ev: EventOption, published: boolean) => {
    if (publishingId !== null) return;
    setPublishingId(ev.event_id);
    try {
      await partnersApi.publishEvent(ev.slug, { published });
      setPublishState((prev) => ({ ...prev, [ev.event_id]: published }));
      toast.success(
        published
          ? `"${ev.event_name}" is now readable through the partner API.`
          : `"${ev.event_name}" was withdrawn from the partner API.`,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update publish state.",
      );
    } finally {
      setPublishingId(null);
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

  // ── Issue a key - the plaintext comes back ONCE and is held in issuedKey ───
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
      toast.success("API key issued. Copy it now - it won't be shown again.");
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
      toast.error("Couldn't copy - select and copy the key manually.");
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

  // ── Delete a key (HARD remove the row, owner 2026-06-27) ────────────────────
  // Distinct from revoke: this calls partnersApi.deleteKey -> the row is gone from the list.
  // Works on active OR already-revoked keys. On success refetch so the table drops the row.
  const handleDeleteKey = async (key: PartnerKey) => {
    setDeletingKey(true);
    try {
      await partnersApi.deleteKey(key.key_id);
      toast.success("API key deleted.");
      setDeleteTarget(null);
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete key.");
    } finally {
      setDeletingKey(false);
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
            {/* data-tour="orgs-misc-partners-profile-tab": admin-tour anchor (orgs-misc area). */}
            <TabsTrigger
              data-tour="orgs-misc-partners-profile-tab"
              value="profile"
              className="w-full"
            >
              Profile
            </TabsTrigger>
            <InfoTip id="partners.profile._section" className="ml-1" />
          </span>
          <span className="inline-flex flex-1 items-center justify-center">
            {/* data-tour="orgs-misc-partners-scope-tab": admin-tour anchor (orgs-misc area). */}
            <TabsTrigger
              data-tour="orgs-misc-partners-scope-tab"
              value="scope"
              className="w-full"
            >
              Scope &amp; Toggles
            </TabsTrigger>
            <InfoTip id="partners.scope._section" className="ml-1" />
          </span>
          <span className="inline-flex flex-1 items-center justify-center">
            {/* data-tour="orgs-misc-partners-keys-tab": admin-tour anchor (orgs-misc area). */}
            <TabsTrigger
              data-tour="orgs-misc-partners-keys-tab"
              value="keys"
              className="w-full"
            >
              Keys
            </TabsTrigger>
            <InfoTip id="partners.keys._section" className="ml-1" />
          </span>
        </TabsList>

        {/* ── Profile tab - read-only identity + suspend kill-switch ── */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Partner profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                {/* Name/slug are set at creation and used as identifiers - shown
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
                  value={detail.contact_email || "-"}
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

          {/* ── Danger zone - suspend / unsuspend (freezes every key at once) ── */}
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
                    ? "Restore the partner - its keys authenticate again."
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

        {/* ── Scope + Toggles tab - the grant config ── */}
        <TabsContent value="scope" className="mt-4 space-y-4">
          {/* Orientation hint: spells out the three things that decide what this partner
              can actually read, so the admin knows the full flow (the owner's "control
              what data they had access to" gap). All of it is enforced by the read API. */}
          <p className="text-sm text-muted-foreground">
            Control exactly what this partner can read: pick the events (or whole
            organizations) in scope, publish those events so the API will return them,
            then choose which resources and fields are exposed. Everything on this tab is
            enforced by the partner API.
          </p>

          {/* ── Scope: which events the partner may read ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex items-center">
                Scope
                <InfoTip id="partners.scope_grants._section" className="ml-1" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              {/* allow_all_native_afc - every organization-less AFC event at once */}
              {/* data-tour="orgs-misc-partners-native-afc": admin-tour anchor (orgs-misc area). */}
              <label
                data-tour="orgs-misc-partners-native-afc"
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5"
              >
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

              {/* allowed_events multiselect - checkbox list inside a scroll area
                  (same idiom as the sponsors create-wizard event picker). */}
              {/* data-tour="orgs-misc-partners-allowed-events": admin-tour anchor (orgs-misc area). */}
              <div data-tour="orgs-misc-partners-allowed-events" className="space-y-2">
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

              {/* allowed_organizations multiselect - grants ALL of an org's events */}
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

          {/* ── Publish to partner API - flip Event.partner_published per event ── */}
          {/* The gate the read API applies FIRST: a configured key returns NO events until
              they are published here. We list the events currently in this partner's
              "Allowed events" scope (above) and let the admin publish/withdraw each one.
              These actions fire IMMEDIATELY (they are NOT part of "Save scope & toggles")
              because partner_published is a global per-event flag, not partner config. */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Publish to partner API</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Publishing makes an event readable through the partner API. A configured
                key returns no events until they are published. This applies immediately
                and globally for the event, separately from Save scope &amp; toggles.
              </p>
              {scopedEvents.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Add events under &quot;Allowed events&quot; above, then publish them here
                  so this partner can read them.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {scopedEvents.map((ev) => {
                    // Live state seeded from the event's real partner_published flag (get-all-events),
                    // with any action taken THIS session (publishState) overriding it. So the row shows
                    // the true Published/Withdrawn state on load, then updates instantly on click.
                    const state = publishState[ev.event_id] ?? ev.partner_published ?? false;
                    const busy = publishingId === ev.event_id;
                    return (
                      <div
                        key={ev.event_id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {ev.event_name}
                          </span>
                          <span className="text-xs capitalize text-muted-foreground">
                            {ev.event_status}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {state === true && (
                            <Badge
                              variant="outline"
                              className="border-green-600/60 text-green-400"
                            >
                              Published
                            </Badge>
                          )}
                          {state === false && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Withdrawn
                            </Badge>
                          )}
                          {state ? (
                            // Already published this session → offer to withdraw it.
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => handlePublishEvent(ev, false)}
                            >
                              {busy ? "Working..." : "Withdraw"}
                            </Button>
                          ) : (
                            // Not published (or not acted on yet) → primary publish action.
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => handlePublishEvent(ev, true)}
                            >
                              {busy ? "Working..." : "Publish to partner API"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    This panel does not preload each event&apos;s current publish state, so
                    a button reflects what you set here. Publishing again is harmless if the
                    event is already published.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Resource toggles - which endpoints respond ── */}
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
                    <span className="min-w-0 text-sm">
                      {TOGGLE_LABELS[key]}
                      {TOGGLE_HINTS[key] ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {TOGGLE_HINTS[key]}
                        </span>
                      ) : null}
                    </span>
                    <Switch
                      checked={toggles[key]}
                      onCheckedChange={() => flipToggle(key)}
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Field toggles - which fields appear inside a readable resource ── */}
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
                    <span className="min-w-0 text-sm">
                      {TOGGLE_LABELS[key]}
                      {TOGGLE_HINTS[key] ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {TOGGLE_HINTS[key]}
                        </span>
                      ) : null}
                    </span>
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

        {/* ── Keys tab - connection details + issue (show-once) + revoke ── */}
        <TabsContent value="keys" className="mt-4 space-y-4">
          {/* ── Connection details - everything the partner needs to call the read API ──
              The owner's complaint: after creating a key there was "nowhere to copy the
              link or api code". This card is that surface. It shows the base URL, the
              X-API-Key auth header, the available endpoints, and a copy-paste curl sample.
              All values come from module-scope constants (PARTNER_API_BASE etc.) that
              mirror the backend (afc/urls.py + partner_urls.py). The actual secret key is
              issued + copied in the "API keys" card below (shown only once at issue time). */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex items-center gap-2">
                <IconWorld className="size-5 text-primary" />
                Connection details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-4">
              <p className="text-sm text-muted-foreground">
                Hand the partner the base URL below plus an API key (issue one under
                &quot;API keys&quot;). Every request must send the key in the{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  X-API-Key
                </code>{" "}
                header. Note: an event only appears here once you publish it on the Scope
                &amp; Toggles tab.
              </p>

              {/* Base URL + copy */}
              <div className="space-y-2">
                <Label>Base URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={PARTNER_API_BASE}
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <CopyButton value={PARTNER_API_BASE} />
                </div>
              </div>

              {/* Auth header */}
              <div className="space-y-2">
                <Label>Auth header</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={PARTNER_AUTH_HEADER}
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <CopyButton value={PARTNER_AUTH_HEADER} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Replace &lt;api key&gt; with a key issued below. The full key is shown
                  only once, immediately after issuing.
                </p>
              </div>

              {/* Available endpoints (relative to the base URL) */}
              <div className="space-y-2">
                <Label>Available endpoints</Label>
                <div className="divide-y rounded-md border">
                  {PARTNER_ENDPOINTS.map((ep) => (
                    <div
                      key={ep.path}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <code className="font-mono text-xs text-foreground">
                        GET {ep.path}
                      </code>
                      <span className="text-right text-xs text-muted-foreground">
                        {ep.desc}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Paths are relative to the base URL. Each one also obeys this partner&apos;s
                  resource and field toggles.
                </p>
              </div>

              {/* Sample request (copy-paste curl) */}
              <div className="space-y-2">
                <Label>Sample request</Label>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
                    {SAMPLE_CURL}
                  </pre>
                  <CopyButton value={SAMPLE_CURL} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="inline-flex items-center">
                  API keys
                  <InfoTip id="partners.keys_table._section" className="ml-1" />
                </CardTitle>
                {/* ⓘ sits beside the issue-key button (sibling, not nested). */}
                <div className="flex shrink-0 items-center gap-1">
                  {/* data-tour="orgs-misc-partners-issue-key": admin-tour anchor (orgs-misc area). */}
                  <Button
                    data-tour="orgs-misc-partners-issue-key"
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
              {/* Tie-in hint: connects this card to the Connection details above so the
                  admin knows the full hand-off (issue a key, pair it with the base URL). */}
              <p className="mt-1 text-sm text-muted-foreground">
                Issue a key here, then give it to the partner along with the connection
                details above. The full key is shown only once, so copy it immediately.
              </p>
            </CardHeader>
            <CardContent className="mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Prefix is the only safe handle for a key - the secret is
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
                          {k.label || "-"}
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
                          <div className="inline-flex items-center justify-end gap-1">
                            {/* Revoke = soft-disable (active keys only). Reversible-style action that
                                keeps the row for audit. */}
                            {k.status === "active" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                                  onClick={() => setRevokeTarget(k)}
                                >
                                  Revoke
                                </Button>
                                <InfoTip id="partners.revoke_key" />
                              </>
                            )}
                            {/* Delete = HARD remove the key row (owner 2026-06-27). Available for any
                                key (active or already revoked) so old keys can be cleaned up. */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(k)}
                            >
                              <IconTrash className="size-4" />
                              Delete
                            </Button>
                          </div>
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

      {/* ── Issue-key dialog - form, then the show-once plaintext panel ── */}
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
                  shown only once - you won&apos;t be able to see it again.
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

      {/* ── Delete key confirm (owner 2026-06-27) ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete API key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-mono font-semibold text-foreground">
                {deleteTarget?.key_prefix}…
              </span>{" "}
              and removes it from the list. Any integration using it stops working
              immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingKey}
              onClick={() => deleteTarget && handleDeleteKey(deleteTarget)}
            >
              {deletingKey ? "Deleting..." : "Delete key"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
