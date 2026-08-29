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
// i18n: every user-facing string on this page comes from the `partners` namespace
// (messages/{en,fr,pt}/partners.json) under the "detail" group, plus a few generic verbs
// from the shared "common" group. Admin is in scope for i18n (owner override 2026-07-13);
// this page previously had no translations at all.
import { useTranslations } from "next-intl";
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
  // Opens the partner-facing guide (app/(root)/partners/api) in a new tab from the
  // Connection card. Added with that card; it was used without being imported, which is a
  // runtime ReferenceError that white-screened this whole page (caught in the browser
  // 2026-08-07, alongside the three missing detail.connection.guide* messages).
  IconExternalLink,
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
// Routed through lib/http authHeaders (owner bug 2026-08-29): building the header inline as
// `Bearer ${token ?? ""}` sent "Bearer " when the cookie had lapsed, which axios trims to
// "Bearer", so the backend reported a DEAD SESSION as a MALFORMED REQUEST (400) and nothing
// logged the user out. authHeaders throws SessionExpiredError instead, which opens the login
// modal in place.
import { authHeaders } from "@/lib/http";

// ── Toggle copy lives in the i18n catalogue, keyed by toggle id ──────────────
// Every toggle label is `partners.detail.toggles.<id>` and the few that need a helper
// line are `partners.detail.toggleHints.<id>`, using the SAME ids as the backend
// PARTNER_TOGGLE_FIELDS. So there is still exactly one source of truth: add a toggle to
// lib/partners.ts, then add its label under that key in messages/{en,fr,pt}/partners.json.
//
// Only the toggles whose effect is not obvious from the label carry a hint; the stat
// toggles (kills, damage, ...) are self-explanatory and are deliberately left out so the
// grid stays scannable. TOGGLE_HINT_IDS is the list that HAS one, so the render can ask
// for a hint without next-intl throwing MISSING_MESSAGE for the ones that do not.
const TOGGLE_HINT_IDS: PartnerToggle[] = [
  "can_read_designs",
  "include_media",
  "include_text",
];

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

// The PARTNER-facing integration guide (app/(root)/partners/api, a public page). This card
// is the staff summary; that page is the document the partner's engineers actually read.
// Built off NEXT_PUBLIC_URL (the frontend origin, lib/env) rather than hard-coded, so the
// URL an admin copies here points at the environment they are working in.
const PARTNER_GUIDE_URL = `${env.NEXT_PUBLIC_URL}/partners/api`;

// The eight GET endpoints the read API exposes (paths RELATIVE to PARTNER_API_BASE).
// <slug> = an event's slug (returned by events/). Each is additionally gated by this
// partner's resource toggles (Scope & Toggles tab), so a path 200s only if the matching
// can_read_* switch is on AND the event is published.
// `descKey` resolves under partners.detail.connection.endpoints.* - the PATH itself is a
// literal URL and is never translated.
//
// MUST stay in lock-step with afc_partner_api/partner_urls.py. It drifted once already:
// designs/ shipped on the backend but was never added here, so an admin reading this card
// would tell a partner the endpoint does not exist (audit 2026-08-06). Adding a route
// there means adding a row here AND its description under partners.detail.connection
// .endpoints.<descKey> in messages/{en,fr,pt}/partners.json.
const PARTNER_ENDPOINTS: { path: string; descKey: string }[] = [
  { path: "events/", descKey: "events" },
  { path: "events/<slug>/", descKey: "event" },
  { path: "events/<slug>/stages/", descKey: "stages" },
  { path: "events/<slug>/matches/", descKey: "matches" },
  { path: "events/<slug>/standings/", descKey: "standings" },
  { path: "events/<slug>/teams/", descKey: "teams" },
  { path: "events/<slug>/players/", descKey: "players" },
  { path: "events/<slug>/designs/", descKey: "designs" },
];

// The literal stand-in for the issued key, shown inside the auth-header field. It is
// passed INTO the "replace this" note as an ICU argument rather than being written into
// each locale's string: "<api key>" reads as a tag to the ICU parser, which made the
// message fail to compile in all three locales.
const API_KEY_PLACEHOLDER = "<api key>";

// The auth header every partner request must carry (placeholder for the issued key).
const PARTNER_AUTH_HEADER = `X-API-Key: ${API_KEY_PLACEHOLDER}`;

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
  // Own translator (partners.status.*), shared word-for-word with the list page's badge.
  // An unrecognised status prints raw: there is nothing to translate for a state the UI
  // does not know about, and showing it beats showing nothing.
  const t = useTranslations("partners");
  if (status === "active")
    return (
      <Badge variant="outline" className="border-green-600/60 text-green-400">
        {t("status.active")}
      </Badge>
    );
  if (status === "suspended")
    return (
      <Badge variant="outline" className="border-orange-500/40 text-orange-400">
        {t("status.suspended")}
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
  // Its own translator (partners.detail.*), so the several copy buttons on the page do
  // not each need one threaded in from the parent.
  const t = useTranslations("partners");
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      toast.error(t("detail.copyFailed"));
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={copy}
      className={className}
      aria-label={t("detail.copyAria")}
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

  // t  = this page's own copy (partners.detail.* plus the shared partners.status.*).
  // tc = shared generic verbs (common.cancel / common.delete / common.done).
  const t = useTranslations("partners");
  const tc = useTranslations("common");

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
  // Optional expiry, "" = never expires (the default, and what every key issued before
  // 2026-08-06 has). A <input type="date"> value, so always "YYYY-MM-DD"; the backend
  // reads a bare date as the END of that day so a key stays usable through it.
  const [keyExpiresAt, setKeyExpiresAt] = useState("");
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
      toast.error(err?.response?.data?.message || t("detail.loadFailed"));
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
        headers: authHeaders(),
      })
      .then((res) => setEventOptions(res.data?.events ?? []))
      .catch(() => toast.error(t("detail.eventsLoadFailed")));
    // organizations - pull a large first page; the picker is searchable client-side.
    organizersApi
      .adminListOrganizations({ limit: 100, offset: 0 })
      .then((res: any) => setOrgOptions(res?.results ?? []))
      .catch(() => toast.error(t("detail.orgsLoadFailed")));
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
      toast.success(t("detail.scope.saved"));
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("detail.scope.saveFailed"));
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
          ? t("detail.publish.published", { name: ev.event_name })
          : t("detail.publish.withdrawn", { name: ev.event_name }),
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("detail.publish.failed"),
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
      toast.success(isSuspended ? t("detail.profile.unsuspended") : t("detail.profile.suspended"));
      fetchDetail(true);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("detail.profile.suspendFailed"),
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
        // Left out entirely when blank, which is what makes the key non-expiring. The
        // backend 400s a past or malformed date, so the toast below carries its message.
        expires_at: keyExpiresAt || undefined,
      });
      // swap the form for the show-once plaintext panel (same dialog stays open)
      setIssuedKey(res.api_key);
      setCopied(false);
      toast.success(t("detail.issue.issuedToast"));
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("detail.issue.failed"));
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
      toast.error(t("detail.issue.copyFailed"));
    }
  };

  // Reset the issue-key dialog back to its empty form state on close.
  const closeIssueDialog = () => {
    setIssueOpen(false);
    setIssuedKey(null);
    setKeyLabel("");
    setKeyRateLimit("60");
    setKeyExpiresAt("");
    setCopied(false);
  };

  // ── Revoke a key (idempotent server-side) ─────────────────────────────────
  const handleRevokeKey = async (key: PartnerKey) => {
    setRevoking(true);
    try {
      await partnersApi.revokeKey(key.key_id);
      toast.success(t("detail.revoke.done"));
      setRevokeTarget(null);
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("detail.revoke.failed"));
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
      toast.success(t("detail.delete.done"));
      setDeleteTarget(null);
      fetchDetail(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("detail.delete.failed"));
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
        <PageHeader back title={t("detail.fallbackTitle")} />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {t("detail.notFound")}
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
          <span className="inline-flex flex-wrap items-center">
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
              {t("detail.tabs.profile")}
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
              {t("detail.tabs.scope")}
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
              {t("detail.tabs.keys")}
            </TabsTrigger>
            <InfoTip id="partners.keys._section" className="ml-1" />
          </span>
        </TabsList>

        {/* ── Profile tab - read-only identity + suspend kill-switch ── */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{t("detail.profile.cardTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">{t("detail.profile.name")}</Label>
                {/* Name/slug are set at creation and used as identifiers - shown
                    read-only here (editing them would break the partner's keys' scope). */}
                <Input id="profile-name" value={detail.name} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">
                  {t("detail.profile.email")}
                  <InfoTip id="partners.contact_email" className="ml-1" />
                </Label>
                <Input
                  id="profile-email"
                  value={detail.contact_email || "-"}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label>{t("detail.profile.status")}</Label>
                <div>
                  <StatusBadge status={detail.status} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Danger zone - suspend / unsuspend (freezes every key at once) ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{t("detail.profile.dangerZone")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {isSuspended
                    ? t("detail.profile.unsuspendTitle")
                    : t("detail.profile.suspendTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSuspended
                    ? t("detail.profile.unsuspendHint")
                    : t("detail.profile.suspendHint")}
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
                    ? t("working")
                    : isSuspended
                      ? t("detail.profile.unsuspend")
                      : t("detail.profile.suspend")}
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
          <p className="text-sm text-muted-foreground">{t("detail.scope.intro")}</p>

          {/* ── Scope: which events the partner may read ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex flex-wrap items-center">
                {t("detail.scope.cardTitle")}
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
                    {t("detail.scope.allNative")}
                    <InfoTip id="partners.allow_all_native_afc" className="ml-1" />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("detail.scope.allNativeHint")}
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
                <Label className="inline-flex flex-wrap items-center">
                  {t("detail.scope.allowedEvents")}
                  <InfoTip id="partners.allowed_events" className="ml-1" />
                  {allowedEventIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {t("detail.scope.selected", { count: allowedEventIds.length })}
                    </Badge>
                  )}
                </Label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder={t("detail.scope.searchEvents")}
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
                          ? t("detail.scope.noEvents")
                          : t("detail.scope.noEventsMatch")}
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
                <Label className="inline-flex flex-wrap items-center">
                  {t("detail.scope.allowedOrgs")}
                  <InfoTip id="partners.allowed_organizations" className="ml-1" />
                  {allowedOrgIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {t("detail.scope.selected", { count: allowedOrgIds.length })}
                    </Badge>
                  )}
                </Label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder={t("detail.scope.searchOrgs")}
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
                          ? t("detail.scope.noOrgs")
                          : t("detail.scope.noOrgsMatch")}
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
              <CardTitle>{t("detail.publish.cardTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              <p className="text-sm text-muted-foreground">{t("detail.publish.intro")}</p>
              {scopedEvents.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("detail.publish.empty")}
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
                              {t("detail.publish.publishedBadge")}
                            </Badge>
                          )}
                          {state === false && (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t("detail.publish.withdrawnBadge")}
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
                              {busy ? t("working") : t("detail.publish.withdraw")}
                            </Button>
                          ) : (
                            // Not published (or not acted on yet) → primary publish action.
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => handlePublishEvent(ev, true)}
                            >
                              {busy ? t("working") : t("detail.publish.action")}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    {t("detail.publish.note")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Resource toggles - which endpoints respond ── */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex flex-wrap items-center">
                {t("detail.toggleGroups.resource")}
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
                      {t(`detail.toggles.${key}`)}
                      {TOGGLE_HINT_IDS.includes(key) ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(`detail.toggleHints.${key}`)}
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
              <CardTitle className="inline-flex flex-wrap items-center">
                {t("detail.toggleGroups.field")}
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
                      {t(`detail.toggles.${key}`)}
                      {TOGGLE_HINT_IDS.includes(key) ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(`detail.toggleHints.${key}`)}
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
              {savingScope ? t("saving") : t("detail.scope.save")}
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
                {t("detail.connection.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-4">
              {/* t.rich so the header name keeps its <code> styling inside one translated
                  sentence, instead of being split across three keys per locale. */}
              <p className="text-sm text-muted-foreground">
                {t.rich("detail.connection.intro", {
                  code: (chunks) => (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      {chunks}
                    </code>
                  ),
                })}
              </p>

              {/* Base URL + copy */}
              <div className="space-y-2">
                <Label>{t("detail.connection.baseUrl")}</Label>
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
                <Label>{t("detail.connection.authHeader")}</Label>
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
                  {/* The literal stand-in is passed IN, never written into each locale:
                      "<api key>" reads as a tag to the ICU parser. */}
                  {t("detail.connection.authNote", { placeholder: API_KEY_PLACEHOLDER })}
                </p>
              </div>

              {/* Available endpoints (relative to the base URL) */}
              <div className="space-y-2">
                <Label>{t("detail.connection.endpointsTitle")}</Label>
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
                        {t(`detail.connection.endpoints.${ep.descKey}`)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("detail.connection.endpointsNote")}
                </p>
              </div>

              {/* Link out to the partner-facing guide (app/(root)/partners/api). This card
                  is the AFC-staff summary; the guide is the long version the PARTNER reads,
                  covering auth, paging, rate limits, the error model and media handling.
                  Surfacing it here means an admin handing over a key has a URL to send with
                  it instead of writing the explanation themselves. It is a public page, so
                  the partner can open it without an AFC account; opened in a new tab so the
                  admin does not lose this page mid-handover. */}
              <div className="space-y-2">
                <Label>{t("detail.connection.guideTitle")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={PARTNER_GUIDE_URL}
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <CopyButton value={PARTNER_GUIDE_URL} />
                  <Button asChild variant="outline" size="icon">
                    <a
                      href={PARTNER_GUIDE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("detail.connection.guideOpen")}
                    >
                      <IconExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("detail.connection.guideNote")}
                </p>
              </div>

              {/* Sample request (copy-paste curl) */}
              <div className="space-y-2">
                <Label>{t("detail.connection.sample")}</Label>
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
                <CardTitle className="inline-flex flex-wrap items-center">
                  {t("detail.keys.title")}
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
                    {t("detail.keys.issue")}
                  </Button>
                  <InfoTip id="partners.issue_key" />
                </div>
              </div>
              {/* Tie-in hint: connects this card to the Connection details above so the
                  admin knows the full hand-off (issue a key, pair it with the base URL). */}
              <p className="mt-1 text-sm text-muted-foreground">
                {t("detail.keys.intro")}
              </p>
            </CardHeader>
            <CardContent className="mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Prefix is the only safe handle for a key - the secret is
                        never stored, so it can never be shown after issue. */}
                    <TableHead>{t("detail.keys.colPrefix")}</TableHead>
                    <TableHead>{t("detail.keys.colLabel")}</TableHead>
                    <TableHead>{t("detail.keys.colStatus")}</TableHead>
                    <TableHead>{t("detail.keys.colRate")}</TableHead>
                    {/* Expiry is shown next to status because together they answer the
                        only question this table is really asked: is this key still going
                        to work tomorrow. */}
                    <TableHead>{t("detail.keys.colExpires")}</TableHead>
                    <TableHead>{t("detail.keys.colLastUsed")}</TableHead>
                    <TableHead className="text-right">{t("detail.keys.colActions")}</TableHead>
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
                              {t("detail.keys.active")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              {t("detail.keys.revoked")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{k.rate_limit_per_min}</TableCell>
                        {/* Expiry. Rendered with the same YYYY-MM-DD slice as "Last used"
                            next to it (one date idiom per table beats two). An expiry
                            already in the past is called out in amber, because the row
                            still says "Active" - status and expiry are separate reasons a
                            key stops working, and auth.py refuses an expired key whatever
                            its status says. */}
                        <TableCell
                          className={
                            k.expires_at && new Date(k.expires_at) < new Date()
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          }
                        >
                          {k.expires_at
                            ? k.expires_at.slice(0, 10)
                            : t("detail.keys.noExpiry")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {k.last_used_at ? k.last_used_at.slice(0, 10) : t("detail.keys.never")}
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
                                  {t("detail.keys.revoke")}
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
                              {tc("delete")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {t("detail.keys.empty")}
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
                  {t("detail.issue.successTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("detail.issue.successDescription")}
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
                <Button onClick={closeIssueDialog}>{tc("done")}</Button>
              </DialogFooter>
            </>
          ) : (
            // ── Issue form: optional label + per-key rate limit ──
            <>
              <DialogHeader>
                <DialogTitle>{t("detail.issue.title")}</DialogTitle>
                <DialogDescription>{t("detail.issue.description")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-label">
                    {t("detail.issue.label")}{" "}
                    <span className="text-muted-foreground">{t("optional")}</span>
                  </Label>
                  <Input
                    id="key-label"
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder={t("detail.issue.labelPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-rate" className="inline-flex flex-wrap items-center">
                    {t("detail.issue.rateLimit")}
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
                {/* Optional expiry. Blank = never expires, which is what every key issued
                    before this field existed does. A date input (not a datetime) because
                    the decision an admin actually makes is "through which day", and the
                    backend turns a bare date into the END of it. */}
                <div className="space-y-2">
                  <Label htmlFor="key-expires">
                    {t("detail.issue.expiresAt")}{" "}
                    <span className="text-muted-foreground">{t("optional")}</span>
                  </Label>
                  <Input
                    id="key-expires"
                    type="date"
                    value={keyExpiresAt}
                    onChange={(e) => setKeyExpiresAt(e.target.value)}
                    className="w-full sm:w-52"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("detail.issue.expiresAtHint")}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeIssueDialog}>
                  {tc("cancel")}
                </Button>
                <Button disabled={issuing} onClick={handleIssueKey}>
                  {issuing ? t("detail.issue.issuing") : t("detail.issue.action")}
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
              {t("detail.revoke.title")}
            </AlertDialogTitle>
            {/* t.rich keeps the key prefix styled inside one translated sentence, so no
                locale has to reason about where the mono span begins and ends. */}
            <AlertDialogDescription>
              {t.rich("detail.revoke.description", {
                prefix: `${revokeTarget?.key_prefix ?? ""}…`,
                key: (chunks) => (
                  <span className="font-mono font-semibold text-foreground">{chunks}</span>
                ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={revoking}
              onClick={() => revokeTarget && handleRevokeKey(revokeTarget)}
            >
              {revoking ? t("detail.revoke.working") : t("detail.revoke.action")}
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
              {t("detail.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("detail.delete.description", {
                prefix: `${deleteTarget?.key_prefix ?? ""}…`,
                key: (chunks) => (
                  <span className="font-mono font-semibold text-foreground">{chunks}</span>
                ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deletingKey}
              onClick={() => deleteTarget && handleDeleteKey(deleteTarget)}
            >
              {deletingKey ? t("detail.delete.working") : t("detail.delete.action")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
