// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › [slug] (event detail DASHBOARD - organizer parity, owner 2026-07-02).
//
// The organizer-side EVENT DETAIL surface. Started life (event linking P2) as a
// thin hub: header + task-page quick links + LinkedEventsCard + Clash-Squad
// brackets. This build expands it into the SAME tabbed dashboard the admin event
// view page has (app/(a)/a/events/[slug]/page.tsx), scoped to the org's own event:
//
//   • Overview      - stat cards (registered/prize/days/stages), Event
//                     Configuration + Registration Restrictions + Streams cards,
//                     Event Timeline, plus the pre-existing LinkedEventsCard and
//                     per-CS-stage H2H bracket cards.
//   • Details       - the full info card (type/dates/prizes/rules).
//   • Registrations - registration analytics cards, the PRIVATE EVENT INVITES
//                     panel (single/shared/bulk generate, list, copy, download),
//                     and the registrations table.
//   • Engagement    - pageviews / unique visitors / conversion / social shares.
//
// Header actions: Edit / Groups & Rosters / Leaderboard / Review Sponsors / OCR
// Results quick links (kept), Round-Robin standings modal per "br - round robin"
// stage, Export participants (CSV/XLSX), Cancel event (confirm dialog), Delete
// event. MediaAuditCard sits at the bottom, mirroring the admin view page.
//
// DELIBERATELY OMITTED vs the admin page (platform-admin-only surfaces): the
// tournament-tier override control, Discord Tools, sponsor-requirement config,
// and the AddTeamsModal force-adds.
//
// ── DATA SOURCE ──
//   1. GET  /events/get-all-events/?organization_id=<id>  - ownership guard (the
//      slug must belong to THIS org, mirroring the sibling groups/leaderboard
//      pages; an organizer can never open another org's event here).
//   2. POST /events/get-event-details/ { slug }           - the public detail
//      payload (banner, dates, prizes, rules, competitors, teams, stages).
//   3. POST /events/get-event-details-for-admin/ { slug } - the staff metrics
//      payload (registration analytics, timeline stages, engagement). The
//      backend's organizer branch admits org members holding can_view_metrics OR
//      can_edit_events on the event's owning org (owner 2026-07-02).
//   4. POST /events/get-all-invite-links-for-private-event/ { event_id } - the
//      invite list for a private event; generate endpoints below. All four invite
//      endpoints admit organizers holding can_manage_registrations.
//
// ── CONNECTS TO ──
//   components/event-links.tsx (LinkedEventsCard) -> lib/eventLinks.ts,
//   components/h2h-bracket.tsx (H2HBracketCard),
//   app/(a)/a/events/_components/RoundRobinResultsModal.tsx (shared standings modal),
//   app/(a)/a/events/_components/DeleteEventModal.tsx (shared delete confirm ->
//     POST /events/delete-event/, org branch: can_edit_events),
//   components/overlay/MediaAuditCard.tsx (broadcast media hygiene),
//   POST /events/cancel-event/ + GET /events/export-participants/ (org-opened by
//     the same backend parity pass). Linked from the organizer events list
//   (app/(organizer)/organizer/events/page.tsx row click/action).
//
// ── PERMISSION GATES (mirror the backend, per surface) ──
//   page access      -> can_edit_events OR can_view_metrics OR isOwner
//   links + brackets + cancel + delete + media audit  -> can_edit_events
//   invites panel + Groups quick link                 -> can_manage_registrations
//   leaderboard link + round-robin standings          -> can_upload_results (or edit)
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
// One rule for "is this Clash Squad?" (lib/eventFormats).
import { isClashSquadFormat } from "@/lib/eventFormats";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
// Raw Radix TabsContent (unstyled), exactly like the admin event view page - the
// per-tab spacing classes below assume it.
import { TabsContent } from "@radix-ui/react-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconCircleX,
  IconCopy,
  IconCurrencyDollar,
  IconDownload,
  IconExternalLink,
  IconLink,
  IconLock,
  IconLockFilled,
  IconPencil,
  IconScan,
  IconTrophy,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { DEFAULT_IMAGE } from "@/constants";
import { env } from "@/lib/env";
// Team country flag beside team names in the organizer registered-teams table (owner 2026-07-03).
// team_country rides on each tournament_teams[] row (get_event_details). CountryFlag renders nothing
// when the value is blank/unresolvable.
import { CountryFlag } from "@/lib/countryFlag";
import { useAuth } from "@/contexts/AuthContext";
// Viewer-timezone instant rendering (i18n hard rule): invite created/used/expiry
// stamps are real UTC instants -> formatLocalTime; calendar-only fields
// (start/end/registration dates) stay on the shared formatDate like the list page.
import { formatLocalTime } from "@/lib/i18n/time";
import { cn, formatDate, formatMoneyInput, formattedWord } from "@/lib/utils";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
// The shared qualification-chains card (same component the admin event page mounts).
import { LinkedEventsCard } from "@/components/event-links";
// Clash-Squad bracket card (sub-project C/E): generate/tree/results per CS stage.
// One card per bracket: a stage split into groups shows several, an ordinary
// stage shows exactly one (owner backlog item 21, 2026-08-13).
import { H2HStageBrackets } from "@/components/h2h-bracket";
// Broadcast media hygiene (owner 2026-07-02): same card the admin view page mounts.
import { MediaAuditCard } from "@/components/overlay/MediaAuditCard";
// Ratings + anonymous feedback card (organizer parity E1): same component the admin
// event page mounts on its Engagement tab. Reads GET events/<id>/rating/ (public) +
// event-comments/<id>/ (org_can_event(can_view_reviews) - the owning org passes for its
// OWN event), so an organizer finally SEES the ratings players leave on their events.
import { EventReviewsCard } from "@/components/event-reviews-admin";
// "Download media" ZIP button (organizer parity E2): every registered team's logo +
// every rostered/solo player's esport image. Backend events/download-esport-media/
// already admits the platform organizer role, so no BE change was needed.
import { DownloadEventMediaButton } from "@/components/esport-media";
// Round-Robin stage standings (shared with the admin Stages & Groups tab).
import { RoundRobinResultsModal } from "@/app/(a)/a/events/_components/RoundRobinResultsModal";
// Shared delete confirm -> POST /events/delete-event/ (org branch: can_edit_events).
import { DeleteEventModal } from "@/app/(a)/a/events/_components/DeleteEventModal";
// Live refresh heartbeat: re-pulls this page's read-only data while the tab is visible.
import { useLiveTick } from "@/hooks/useLiveTick";
import { useOrganizer } from "../../_components/OrganizerContext";

type Params = { slug: string };

// ── get-event-details slice ──────────────────────────────────────────────────
// The fields this dashboard reads off the public detail payload (the payload is
// larger; see the admin event view page for the reference shape).
interface EventDetails {
  event_id: number;
  event_name: string;
  event_status: string;
  event_type: string;
  event_mode: string;
  participant_type: string;
  competition_type: string;
  max_teams_or_players: number;
  start_date: string;
  end_date: string;
  registration_open_date: string;
  registration_end_date: string;
  prizepool: string;
  prize_distribution: { [key: string]: number };
  event_rules: string;
  registration_link: string | null;
  tournament_tier: string;
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  is_public: boolean;
  // Country gating echo (allow_only / block_selected + the country list).
  restriction_mode?: string;
  restricted_countries?: string[];
  stream_channels: string[];
  registered_competitors: Array<{
    player_id: number;
    username: string;
    status: string;
    registered_at?: string;
    is_waitlisted?: boolean;
  }>;
  tournament_teams: any[];
  stages?: Array<{ stage_id: number; stage_name: string; stage_format?: string }>;
}

// ── get-event-details-for-admin slice ────────────────────────────────────────
// Same shape the admin view page declares; the backend's organizer branch returns
// the identical payload for the org's own event (owner 2026-07-02).
interface AdminEventDetails {
  overview: {
    event_id: number;
    event_name: string;
    total_registered: number;
    max_competitors: number;
    registration_percentage: number;
    days_until_start: number;
    event_duration_days: number;
    registration_close_date: string;
    days_until_registration_close: number;
    average_registrations_per_day: number;
    prizepool: number;
    prize_distribution: { [key: string]: number };
  };
  registration_timeline: {
    registration_start_date: string;
    registration_end_date: string;
    registration_window_days: number;
    days_left_for_registration: number;
    registration_timeseries: Array<{ date: string; count: number }>;
    peak_registration: number;
  };
  team_status: {
    active: number;
    disqualified: number;
    withdrawn: number;
  };
  stage_progress: {
    total_stages: number;
    completed: number;
    ongoing: number;
    upcoming: number;
  };
  stages: Array<{
    stage_id: number;
    stage_name: string;
    stage_format?: string;
    start_date: string;
    end_date: string;
    number_of_groups: number;
    groups: Array<{
      group_id: number;
      group_name: string;
      playing_date: string;
      playing_time: string;
      teams_qualifying: number;
    }>;
  }>;
  engagement: {
    pageviews: number;
    unique_visitors: number;
    conversion_rate: number;
    social_shares: number;
    stream_links: string[];
  };
}

// One invite link row, as returned by get-all-invite-links-for-private-event.
// is_shared marks the ONE reusable first-come-first-serve link (never consumed);
// expires_at is when the link stops registering anyone (null = never expires).
interface InviteLink {
  invite_link: string;
  created_at: string;
  created_by: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  is_shared?: boolean;
  expires_at?: string | null;
}

export default function OrganizerEventDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = use(params);
  const { token } = useAuth();
  const { membership, isOwner } = useOrganizer();
  // i18n: organizer-facing surface, namespace "organizer" (matches layout/tour);
  // English values live in messages/en/organizer.json -> fr/pt via pnpm i18n:translate.
  const t = useTranslations("organizer");
  const API = env.NEXT_PUBLIC_BACKEND_API_URL;

  // ── permission gates (mirror the backend per surface; see header comment) ──
  const canEdit = membership.permissions.can_edit_events || isOwner;
  const canViewMetrics = membership.permissions.can_view_metrics || isOwner;
  const canManageRegs = membership.permissions.can_manage_registrations || isOwner;
  const canUploadResults = membership.permissions.can_upload_results || isOwner;
  // Page access matches the get-event-details-for-admin organizer gate.
  const canAccess = canEdit || canViewMetrics;
  const organizationId = membership.organization.organization_id;

  const [details, setDetails] = useState<EventDetails | null>(null);
  const [adminDetails, setAdminDetails] = useState<AdminEventDetails | null>(null);
  const [notMine, setNotMine] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Private Event Invites state (mirrors the admin view page) ──
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set());
  const [bulkCount, setBulkCount] = useState("5");
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Export participants (CSV/XLSX) + Cancel event action state.
  const [loadingExport, setLoadingExport] = useState<"csv" | "xlsx" | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);

  // Live refresh: tick advances while the tab is visible; each tick re-pulls the
  // read-only data in place (background=true so nothing flashes).
  const tick = useLiveTick();
  // The get-all-events ownership guard only needs to pass once per slug; ticks skip it.
  const ownedRef = useRef(false);

  // Pull the invite list for a private event. Gated on can_manage_registrations
  // (the backend gate on get-all-invite-links-for-private-event); background=true
  // skips the spinner so a tick-driven refresh never flashes the list.
  const fetchInviteLinks = useCallback(
    async (eventId: number, background = false) => {
      if (!token || !canManageRegs) return;
      if (!background) setLoadingInvites(true);
      try {
        const res = await axios.post(
          `${API}/events/get-all-invite-links-for-private-event/`,
          { event_id: eventId.toString() },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setInviteLinks(res.data.invite_links || []);
      } catch (error: any) {
        // Log (don't toast): the panel simply shows its empty state if this fails.
        console.error("Failed to fetch invite links:", error);
      } finally {
        if (!background) setLoadingInvites(false);
      }
    },
    [API, token, canManageRegs],
  );

  // Reusable refetch: ownership guard (first load only) then both detail payloads
  // in parallel; any action that mutates the event calls this to re-render in
  // place. `background` = a tick-driven refresh (no loader flip, no error state).
  const refetchEvent = useCallback(
    async (background = false) => {
      if (!slug || !token) return;
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        // 1. Ownership guard: the slug must be one of THIS org's events.
        if (!ownedRef.current) {
          const mine = await axios.get(`${API}/events/get-all-events/`, {
            ...config,
            params: { organization_id: organizationId },
          });
          const owned = (mine.data?.events ?? []).some((e: any) => e.slug === slug);
          if (!owned) {
            setNotMine(true);
            return;
          }
          ownedRef.current = true;
        }
        // 2. Both payloads in parallel (public detail + staff metrics).
        const [res, resAdmin] = await Promise.all([
          axios.post(`${API}/events/get-event-details/`, { slug }, config),
          axios.post(`${API}/events/get-event-details-for-admin/`, { slug }, config),
        ]);
        const ed: EventDetails = res.data.event_details;
        setDetails(ed);
        setAdminDetails(resAdmin.data);
        // 3. Private event -> pull the invite list (permission-gated inside).
        if (ed && ed.is_public === false) {
          fetchInviteLinks(ed.event_id, background);
        }
      } catch {
        // A background blip must not nuke an already-rendered page.
        if (!background) setNotMine(true);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [API, slug, token, organizationId, fetchInviteLinks],
  );

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    if (!token) return;
    // tick 0 = the initial load (full loader); tick > 0 = silent background refresh.
    refetchEvent(tick > 0);
  }, [tick, token, canAccess, refetchEvent]);

  // ── invite handlers (same endpoints as the admin view page; org branch =
  //    can_manage_registrations on the event's owning org) ──────────────────────

  const copyToClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinks((prev) => new Set(prev).add(link));
      toast.success(t("eventDetail.invites.copied"));
      // Reset the per-link check icon after 2 seconds.
      setTimeout(() => {
        setCopiedLinks((prev) => {
          const next = new Set(prev);
          next.delete(link);
          return next;
        });
      }, 2000);
    } catch {
      toast.error(t("eventDetail.invites.copyFailed"));
    }
  };

  const generateSingleInvite = async () => {
    if (!details || !token) return;
    setGeneratingInvite(true);
    try {
      await axios.post(
        `${API}/events/generate-single-use-invite-link-for-private-event/`,
        { event_id: details.event_id.toString() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("eventDetail.invites.generatedSingle"));
      await fetchInviteLinks(details.event_id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("eventDetail.invites.generateFailed"));
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Mint ONE shared first-come-first-serve link (is_shared:true -> reusable token
  // that is never consumed; the event's capacity cap closes it once full).
  const generateSharedInvite = async () => {
    if (!details || !token) return;
    setGeneratingInvite(true);
    try {
      const res = await axios.post(
        `${API}/events/generate-single-use-invite-link-for-private-event/`,
        { event_id: details.event_id.toString(), is_shared: true },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("eventDetail.invites.generatedShared"));
      // Copy the new shared link to the clipboard right away for convenience.
      if (res.data?.invite_link) copyToClipboard(res.data.invite_link);
      await fetchInviteLinks(details.event_id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("eventDetail.invites.generateFailed"));
    } finally {
      setGeneratingInvite(false);
    }
  };

  const generateBulkInvites = async () => {
    if (!details || !token) return;
    const count = parseInt(bulkCount);
    if (isNaN(count) || count < 1 || count > 100) {
      toast.error(t("eventDetail.invites.bulkInvalid"));
      return;
    }
    setGeneratingInvite(true);
    try {
      await axios.post(
        `${API}/events/generate-multiple-single-use-invite-links-for-private-event/`,
        { event_id: details.event_id.toString(), count },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("eventDetail.invites.generatedBulk", { count }));
      setShowBulkDialog(false);
      setBulkCount("5");
      await fetchInviteLinks(details.event_id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("eventDetail.invites.generateFailed"));
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Download the invite list as a spreadsheet (client-side; same rows the admin
  // page exports). Timestamps render in the viewer's timezone via formatLocalTime.
  const downloadInvites = (format: "xlsx" | "csv") => {
    if (!details || inviteLinks.length === 0) {
      toast.error(t("eventDetail.invites.nothingToDownload"));
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    const baseName = `${details.event_name}_invite_links_${dateStr}`;
    const rows = inviteLinks.map((invite) => ({
      [t("eventDetail.invites.colLink")]: invite.invite_link,
      [t("eventDetail.invites.colType")]: invite.is_shared
        ? t("eventDetail.invites.typeShared")
        : t("eventDetail.invites.typeSingle"),
      [t("eventDetail.invites.colCreatedBy")]: invite.created_by,
      [t("eventDetail.invites.colCreatedAt")]: formatLocalTime(invite.created_at, "datetime"),
      [t("eventDetail.invites.colStatus")]: invite.is_shared
        ? t("eventDetail.invites.statusReusable")
        : invite.is_used
          ? t("eventDetail.invites.statusUsed")
          : t("eventDetail.invites.statusActive"),
      [t("eventDetail.invites.colUsedBy")]: invite.used_by || t("eventDetail.invites.na"),
      [t("eventDetail.invites.colUsedAt")]: invite.used_at
        ? formatLocalTime(invite.used_at, "datetime")
        : t("eventDetail.invites.na"),
    }));

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invite Links");
      XLSX.writeFile(workbook, `${baseName}.xlsx`);
      toast.success(t("eventDetail.invites.downloadedXlsx"));
    } else {
      const headers = Object.keys(rows[0]);
      const csvRows = [
        headers.join(","),
        ...rows.map((r) => headers.map((h) => r[h as keyof typeof r]).join(",")),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${baseName}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t("eventDetail.invites.downloadedCsv"));
    }
  };

  // ── Export participants (CSV/XLSX) ──────────────────────────────────────────
  // GET /events/export-participants/?event_id&format - same blob-download flow the
  // shared ActionsTab uses; the backend's org branch admits this org's grants.
  const handleExport = async (fmt: "csv" | "xlsx") => {
    if (!details || !token) return;
    setLoadingExport(fmt);
    try {
      const res = await axios.get(`${API}/events/export-participants/`, {
        params: { event_id: details.event_id, format: fmt },
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${details.event_name}_participants.${fmt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("eventDetail.actions.exportDone"));
    } catch {
      toast.error(t("eventDetail.actions.exportFailed"));
    } finally {
      setLoadingExport(null);
    }
  };

  // ── Cancel event ────────────────────────────────────────────────────────────
  // POST /events/cancel-event/ - marks the event cancelled + notifies every
  // registered player (backend _notify_all_registered). Confirm-gated below.
  const handleCancel = async () => {
    if (!details || !token) return;
    setLoadingCancel(true);
    try {
      const res = await axios.post(
        `${API}/events/cancel-event/`,
        { event_id: details.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(res.data.message);
      setCancelOpen(false);
      await refetchEvent();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t("eventDetail.actions.cancelFailed"));
    } finally {
      setLoadingCancel(false);
    }
  };

  // ── derived registration metrics (same math as the admin view page) ──────────
  const calculatedData = useMemo(() => {
    if (!details || !adminDetails) return null;
    const totalRegistered =
      details.participant_type === "squad"
        ? (details.tournament_teams ?? []).filter((tt: any) => tt.status !== "pending").length
        : (details.registered_competitors ?? []).filter((c) => c.status !== "pending").length;
    const maxCapacity = details.max_teams_or_players;
    const registrationProgress = Math.min((totalRegistered / maxCapacity) * 100, 100);
    return {
      totalRegistered,
      maxCapacity,
      registrationProgress,
      daysUntilStart: adminDetails.overview.days_until_start,
      daysUntilRegClose: adminDetails.overview.days_until_registration_close,
      avgRegPerDay: adminDetails.overview.average_registrations_per_day,
      regDurationDays: adminDetails.registration_timeline.registration_window_days,
    };
  }, [details, adminDetails]);

  // ── permission lock (mirrors the sibling groups/leaderboard pages) ──
  if (!canAccess) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("eventDetail.fallbackTitle")} description={t("eventDetail.fallbackDescription")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventDetail.noPermission")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <FullLoader />;

  if (notMine || !details || !adminDetails || !calculatedData) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("eventDetail.fallbackTitle")} description={t("eventDetail.fallbackDescription")} />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("eventDetail.notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    totalRegistered,
    maxCapacity,
    registrationProgress,
    daysUntilStart,
    daysUntilRegClose,
    avgRegPerDay,
    regDurationDays,
  } = calculatedData;

  // Prizepool can be a plain number ("500") or free text; only prefix $ + group
  // digits when numeric (same rule as the admin view page).
  const formattedPrizepool = /^\d+(\.\d+)?$/.test(details.prizepool)
    ? `$${parseFloat(details.prizepool).toLocaleString()}`
    : details.prizepool;

  const stageStatus = adminDetails.stage_progress;

  return (
    <div className="flex flex-col gap-5">
      {/* data-tour anchor: PageHeader does not forward props to the DOM, so the
          title step wraps it in a plain div the tour can spotlight. */}
      <div data-tour="org-event-detail-title">
        <PageHeader
          title={details.event_name}
          description={t("eventDetail.description")}
        />
      </div>

      {/* ── headline: status + type badges + the task-page quick links + actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs capitalize">
          {details.event_status}
        </Badge>
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs capitalize">
          {details.participant_type}
        </Badge>
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs capitalize">
          {details.competition_type}
        </Badge>
        {/* Private event marker (lock + tooltip), mirroring the admin header badge. */}
        {details.is_public === false && (
          <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <IconLockFilled className="size-3" />
                </TooltipTrigger>
                <TooltipContent>{t("eventDetail.privateTooltip")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Badge>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {canEdit && (
            <Button asChild size="sm" variant="outline" data-tour="org-event-detail-edit">
              <Link href={`/organizer/events/${slug}/edit`}>
                <IconPencil className="size-4" /> {t("eventDetail.edit")}
              </Link>
            </Button>
          )}
          {canManageRegs && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/organizer/events/${slug}/groups`}>
                <IconUsersGroup className="size-4" /> {t("eventDetail.groupsAndRosters")}
              </Link>
            </Button>
          )}
          {canUploadResults && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/organizer/events/${slug}/leaderboard`}>
                <IconTrophy className="size-4" /> {t("eventDetail.leaderboard")}
              </Link>
            </Button>
          )}
          {/* Organizer parity quick links (owner 2026-07-02): mirror the admin event
              view page's "Review Sponsors" / "OCR Results" buttons. Both target pages
              gate themselves (sponsors: can_manage_registrations, OCR:
              can_upload_results), matching the backend org_can_event grants. */}
          <Button asChild size="sm" variant="outline">
            <Link href={`/organizer/events/${slug}/sponsors`}>
              <IconUserCheck className="size-4" /> {t("eventDetail.sponsorReview")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/organizer/events/${slug}/ocr`}>
              <IconScan className="size-4" /> {t("eventDetail.ocrResults")}
            </Link>
          </Button>
          {/* Download event media ZIP (organizer parity E2, mirrors the admin header):
              every registered team's logo + every rostered/solo player's esport image,
              for use in event graphics. Own button owns its fetch + options popover.
              Gated the same as export/registration surfaces (edit OR manage-registrations);
              the backend events/download-esport-media/ authorizes the organizer role. */}
          {(canEdit || canManageRegs) && (
            <DownloadEventMediaButton eventId={details.event_id} />
          )}
          {/* Round-Robin standings (shared modal, one per "br - round robin" stage).
              The modal owns its trigger button + fetch (get-round-robin-standings). */}
          {(canEdit || canUploadResults) &&
            (details.stages ?? [])
              .filter((s) => s.stage_format === "br - round robin")
              .map((s) => (
                <RoundRobinResultsModal
                  key={s.stage_id}
                  eventId={details.event_id}
                  stageId={s.stage_id}
                  stageName={s.stage_name}
                />
              ))}
          {/* Export participants: CSV / Excel dropdown -> GET export-participants. */}
          {(canEdit || canManageRegs) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={loadingExport !== null}>
                  <IconDownload className="size-4" /> {t("eventDetail.actions.export")}
                  <IconChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  {t("eventDetail.actions.exportCsv")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                  {t("eventDetail.actions.exportXlsx")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Cancel event: confirm dialog -> POST cancel-event (notifies players). */}
          {canEdit && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={
                details.event_status === "cancelled" || details.event_status === "completed"
              }
            >
              <IconCircleX className="size-4" /> {t("eventDetail.actions.cancelEvent")}
            </Button>
          )}
          {/* Delete event (shared confirm modal -> POST delete-event; the backend's
              org branch requires can_edit_events on the owning org). */}
          {canEdit && (
            <DeleteEventModal
              eventId={details.event_id}
              eventName={details.event_name}
              redirectTo="/organizer/events"
              size="sm"
            />
          )}
        </span>
      </div>

      {/* ── banner (same treatment as the admin view page) ──
          bg-muted keeps this box OPAQUE so a broken banner URL can never let the fixed
          site-wide PageGradient feTurbulence dither show through as colored static (the
          "hash thing", owner 2026-07-14). onError swaps in DEFAULT_IMAGE because the
          `|| DEFAULT_IMAGE` guard only catches an EMPTY url, not a non-empty-but-unloadable
          one (expired/hotlink-blocked/404/wrong content-type). */}
      <div className="overflow-hidden rounded-md bg-muted">
        <Image
          src={details.event_banner_url || DEFAULT_IMAGE}
          alt={`${details.event_name}'s image`}
          width={1000}
          height={1000}
          className="w-full h-50 aspect-video object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />
      </div>

      {/* ── cancel confirm dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("eventDetail.actions.cancelTitle")}</DialogTitle>
            <DialogDescription>
              {t("eventDetail.actions.cancelBody", { name: details.event_name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={loadingCancel}>
              {t("eventDetail.actions.cancelKeep")}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={loadingCancel}>
              {t("eventDetail.actions.cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <ScrollableTabsList className="w-full">
            <TabsTrigger value="overview">{t("eventDetail.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="details">{t("eventDetail.tabs.details")}</TabsTrigger>
            <TabsTrigger value="registrations">{t("eventDetail.tabs.registrations")}</TabsTrigger>
            <TabsTrigger value="engagement">{t("eventDetail.tabs.engagement")}</TabsTrigger>
        </ScrollableTabsList>

        {/* ── Overview tab ─────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-2 space-y-4">
          {/* The qualification-chains card (shared with the admin event page).
              Wrapped in a data-tour div because LinkedEventsCard is a shared
              component that may not forward arbitrary props to its root node. */}
          {canEdit && (
            <div data-tour="org-event-detail-links">
              <LinkedEventsCard
                eventId={details.event_id}
                stages={(details.stages ?? []).map((s) => ({ id: s.stage_id, stage_name: s.stage_name }))}
              />
            </div>
          )}

          {/* ── Clash-Squad brackets (sub-project E organizer parity) ──
              One bracket card per CS-format stage, the SAME component the admin
              Stages tab mounts; the backend authorizes organizers on generate
              (can_edit_events) and result entry (can_upload_results). */}
          {(canEdit || canUploadResults) &&
            (details.stages ?? [])
              .filter((s) => isClashSquadFormat(s.stage_format))
              .map((s) => (
                <H2HStageBrackets
                  key={s.stage_id}
                  stageId={s.stage_id}
                  stageName={s.stage_name}
                  stageFormat={s.stage_format || ""}
                  // Split perms (P2, owner 2026-07-13): Generate/Regenerate needs can_edit_events,
                  // result entry needs can_upload_results - so an organizer with only one no longer
                  // sees a control that 403s. isManager stays as the base flag for the sub-components.
                  isManager={canEdit || canUploadResults}
                  canEdit={canEdit}
                  canUpload={canUploadResults}
                  registeredTeams={(details.tournament_teams ?? [])
                    // Confirmed participants only (owner backlog item 11, 2026-08-14) - same rule
                    // and same reason as the admin event page: `is_waitlisted` is not in this
                    // payload, `status` is, and a withdrawn team must never reach the seed list.
                    .filter((tt: any) => tt.tournament_team_id && !tt.is_waitlisted
                      && (tt.status ?? "active") === "active")
                    .map((tt: any) => ({
                      tournament_team_id: tt.tournament_team_id,
                      team_name: tt.team_name,
                    }))}
                />
              ))}

          {/* ── headline stat cards (same layout as the admin Overview tab) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 2xl:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.stats.totalRegistered")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(totalRegistered)}/{formatMoneyInput(maxCapacity)}
                </div>
                <Progress value={registrationProgress} className="mt-2.5" />
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.stats.prizePool")}
                </CardTitle>
                <IconCurrencyDollar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formattedPrizepool}</div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.stats.daysUntilStart")}
                </CardTitle>
                <IconCalendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {t("eventDetail.stats.days", { count: daysUntilStart })}
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.stats.totalStages")}
                </CardTitle>
                <IconCalendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stageStatus.total_stages}</div>
              </CardContent>
            </Card>
          </div>

          {/* ── Event Configuration + Registration Restrictions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("eventDetail.config.title")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground">{t("eventDetail.config.type")}</div>
                <div className="font-medium text-right capitalize">{details.event_type}</div>
                <div className="text-muted-foreground">{t("eventDetail.config.competition")}</div>
                <div className="font-medium text-right capitalize">{details.competition_type}</div>
                <div className="text-muted-foreground">{t("eventDetail.config.participantType")}</div>
                <div className="font-medium text-right capitalize">{details.participant_type}</div>
                <div className="text-muted-foreground">{t("eventDetail.config.mode")}</div>
                <div className="font-medium text-right capitalize">{details.event_mode}</div>
                <div className="text-muted-foreground">{t("eventDetail.config.maxTeams")}</div>
                <div className="font-medium text-right">
                  {formatMoneyInput(details.max_teams_or_players)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("eventDetail.restrictions.title")}</CardTitle>
                <Badge variant="secondary">{t("eventDetail.restrictions.region")}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {t("eventDetail.restrictions.mode")}
                  </span>
                  <Badge variant="outline" className="bg-white text-black">
                    {formattedWord[details.restriction_mode ?? ""] || details.restriction_mode || "-"}
                  </Badge>
                </div>
                {details.restricted_countries && details.restricted_countries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("eventDetail.restrictions.countries")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {details.restricted_countries.map((c) => (
                        <Badge key={c} variant="secondary" className="rounded-full px-3">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Streaming Channels ── */}
          {details.stream_channels && details.stream_channels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconExternalLink className="size-4" /> {t("eventDetail.streams.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {details.stream_channels.map((url, i) => (
                  <div
                    key={i}
                    className="bg-primary/10 text-primary text-sm font-medium hover:underline rounded-md py-2 px-4 border-none cursor-pointer max-w-full break-all"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Event Timeline (per-stage dots, colour by status) ── */}
          <Card>
            <CardHeader>
              <CardTitle>{t("eventDetail.timeline.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminDetails.stages.map((stage, index) => {
                const now = new Date().toISOString().split("T")[0];
                let status: "completed" | "ongoing" | "upcoming" = "upcoming";
                if (stage.end_date < now) status = "completed";
                else if (stage.start_date <= now && stage.end_date >= now) status = "ongoing";
                return (
                  <div key={stage.stage_id} className="relative flex items-start gap-4">
                    {index !== adminDetails.stages.length - 1 && (
                      <div className="absolute left-[5px] top-6 w-[2px] h-full bg-muted-foreground/20" />
                    )}
                    <div
                      className={`mt-1.5 size-3 rounded-full z-10 ${
                        status === "completed"
                          ? "bg-green-500"
                          : status === "ongoing"
                            ? "bg-blue-500"
                            : "bg-slate-500"
                      }`}
                    />
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{stage.stage_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(stage.start_date)} {t("eventDetail.timeline.to")}{" "}
                          {formatDate(stage.end_date)}
                        </p>
                      </div>
                      <Badge
                        variant={status === "completed" ? "outline" : "secondary"}
                        className="h-6 capitalize"
                      >
                        {t(`eventDetail.timeline.status.${status}`)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Details tab ──────────────────────────────────────────────────── */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="font-medium text-sm md:text-base">{t("eventDetail.info.type")}</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {details.event_type}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">{t("eventDetail.info.location")}</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {details.event_mode}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    {t("eventDetail.info.maxPlayers")}
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatMoneyInput(maxCapacity)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">{t("eventDetail.info.tier")}</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {formattedWord[details.tournament_tier] || details.tournament_tier}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    {t("eventDetail.info.startDate")}
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(details.start_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">{t("eventDetail.info.endDate")}</p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(details.end_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    {t("eventDetail.info.regOpens")}
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(details.registration_open_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    {t("eventDetail.info.regCloses")}
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(details.registration_end_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    {t("eventDetail.info.prizePool")}
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">{formattedPrizepool}</p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">{t("eventDetail.info.status")}</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {details.event_status}
                  </p>
                </div>
                {details.event_type === "external" &&
                  details.registration_link &&
                  details.registration_link.trim().length > 0 && (
                    <div>
                      <p className="font-medium text-sm md:text-base">
                        {t("eventDetail.info.registrationLink")}
                      </p>
                      <Link
                        href={details.registration_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-xs md:text-sm block max-w-full truncate"
                      >
                        {details.registration_link}
                      </Link>
                    </div>
                  )}
              </div>

              <div>
                <p className="font-medium text-sm md:text-base mb-2">
                  {t("eventDetail.info.prizeDistribution")}
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs md:text-sm space-y-1">
                  {Object.entries(details.prize_distribution)
                    .sort(([posA], [posB]) => {
                      const numA = parseInt(posA.replace(/\D/g, ""));
                      const numB = parseInt(posB.replace(/\D/g, ""));
                      return numA - numB;
                    })
                    .map(([position, amount]) => (
                      <li key={position} className="uppercase">
                        {position}: ${formatMoneyInput(String(amount))}
                      </li>
                    ))}
                </ul>
              </div>

              <div>
                <p className="font-medium text-sm md:text-base">
                  {t("eventDetail.info.eventRules")}
                </p>
                {details.uploaded_rules_url && details.uploaded_rules_url.trim().length > 0 ? (
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {t("eventDetail.info.rulesViaDocument")}{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm text-yellow-400 hover:text-yellow-300"
                      onClick={() => window.open(details.uploaded_rules_url!, "_blank")}
                    >
                      {t("eventDetail.info.downloadRules")}
                    </Button>
                  </p>
                ) : details.event_rules && details.event_rules.trim().length > 0 ? (
                  <p className="text-muted-foreground text-xs md:text-sm whitespace-pre-line">
                    {details.event_rules}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs md:text-sm italic">
                    {t("eventDetail.info.noRules")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Registrations tab ────────────────────────────────────────────── */}
        <TabsContent value="registrations" className="mt-4 space-y-4">
          <div className="grid-cols-1 grid md:grid-cols-2 2xl:grid-cols-3 gap-2">
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.registrations.rate")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {adminDetails.overview.registration_percentage.toFixed(1)}%
                </div>
                <Progress value={registrationProgress} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.registrations.ofMaxCapacity", { count: maxCapacity })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.registrations.averagePerDay")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgRegPerDay.toFixed(1)}</div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.registrations.playersPerDay", { count: regDurationDays })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.registrations.timeUntilClose")}
                </CardTitle>
                <IconCalendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {t("eventDetail.stats.days", { count: daysUntilRegClose })}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.registrations.closesOn", {
                      date: formatDate(details.registration_end_date),
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Private Event Invites (private events only; can_manage_registrations) ──
              Same panel as the admin view page: one reusable shared FCFS link,
              single-use links, bulk mint, copy, spreadsheet download. */}
          {details.is_public === false && canManageRegs && (
            <Card>
              <CardHeader>
                <CardTitle className="flex gap-4 flex-col md:flex-row items-start md:items-center justify-between">
                  <span className="flex items-center gap-1">
                    <IconLink className="size-4" />
                    {t("eventDetail.invites.title")}
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={inviteLinks.length === 0 || loadingInvites}
                        >
                          <IconExternalLink className="size-4 mr-1" />
                          {t("eventDetail.invites.download")}
                          <IconChevronDown className="size-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadInvites("xlsx")}>
                          {t("eventDetail.invites.downloadXlsx")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadInvites("csv")}>
                          {t("eventDetail.invites.downloadCsv")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* ONE reusable first-come-first-serve link for the whole group. */}
                    <Button size="sm" onClick={generateSharedInvite} disabled={generatingInvite}>
                      {t("eventDetail.invites.generateShared")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateSingleInvite}
                      disabled={generatingInvite}
                    >
                      {t("eventDetail.invites.generateSingle")}
                    </Button>
                    <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={generatingInvite}>
                          {t("eventDetail.invites.generateBulk")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("eventDetail.invites.generateBulk")}</DialogTitle>
                          <DialogDescription>
                            {t("eventDetail.invites.bulkDescription")}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="count">{t("eventDetail.invites.bulkCountLabel")}</Label>
                            <Input
                              id="count"
                              type="number"
                              min="1"
                              max="100"
                              value={bulkCount}
                              onChange={(e) => setBulkCount(e.target.value)}
                              placeholder={t("eventDetail.invites.bulkPlaceholder")}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                              {t("eventDetail.invites.cancel")}
                            </Button>
                            <Button onClick={generateBulkInvites} disabled={generatingInvite}>
                              {t("eventDetail.invites.generate")}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto space-y-2">
                {/* Explainer: how the shared FCFS link behaves vs single-use links. */}
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">
                      {t("eventDetail.invites.explainerSharedLabel")}
                    </span>{" "}
                    {t("eventDetail.invites.explainerShared", {
                      count: details.max_teams_or_players,
                    })}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium text-foreground">
                      {t("eventDetail.invites.explainerSingleLabel")}
                    </span>{" "}
                    {t("eventDetail.invites.explainerSingle")}
                  </p>
                </div>
                {loadingInvites ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("eventDetail.invites.loading")}
                  </div>
                ) : inviteLinks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("eventDetail.invites.empty")}
                  </div>
                ) : (
                  inviteLinks.map((invite, index) => (
                    <Card
                      key={index}
                      className={`${
                        // A shared link is always live (never consumed), so it keeps the
                        // active highlight. A single-use link greys out once used.
                        !invite.is_shared && invite.is_used
                          ? "bg-muted/50 opacity-60"
                          : "bg-primary/10"
                      }`}
                    >
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <Input value={invite.invite_link} readOnly />
                            </div>
                            <Button
                              size="icon"
                              onClick={() => copyToClipboard(invite.invite_link)}
                              // Copy stays enabled for a shared link even after use:
                              // it is meant to be shared with many people.
                              disabled={!invite.is_shared && invite.is_used}
                            >
                              {copiedLinks.has(invite.invite_link) ? <IconCheck /> : <IconCopy />}
                            </Button>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            <span>
                              {t("eventDetail.invites.createdBy", { name: invite.created_by })}
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span>{formatLocalTime(invite.created_at, "date")}</span>
                            {invite.is_shared ? (
                              <>
                                {/* The reusable FCFS link. Outline badge per AFC design. */}
                                <span className="hidden sm:inline">•</span>
                                <Badge
                                  variant="outline"
                                  className="text-xs rounded-full border-primary text-primary"
                                >
                                  {t("eventDetail.invites.sharedBadge")}
                                </Badge>
                                {invite.expires_at && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span>
                                      {t("eventDetail.invites.expires", {
                                        date: formatLocalTime(invite.expires_at, "date"),
                                      })}
                                    </span>
                                  </>
                                )}
                              </>
                            ) : invite.is_used ? (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <Badge variant="destructive" className="text-xs">
                                  {t("eventDetail.invites.usedBy", {
                                    name: invite.used_by ?? "",
                                    date: formatLocalTime(invite.used_at, "date"),
                                  })}
                                </Badge>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <Badge variant="secondary" className="text-xs">
                                  {t("eventDetail.invites.active")}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* ── registrations table (active, non-waitlisted) ── */}
          <Card className="gap-0">
            <CardHeader className="border-b">
              <CardTitle>
                {t("eventDetail.registrations.recent", { count: totalRegistered })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {details.participant_type === "squad"
                        ? t("eventDetail.registrations.teams")
                        : t("eventDetail.registrations.players")}
                    </TableHead>
                    <TableHead>{t("eventDetail.registrations.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Solo players */}
                  {details.participant_type === "solo" &&
                    (details.registered_competitors ?? [])
                      .filter((c) => !c.is_waitlisted)
                      .map((comp) => (
                        <TableRow key={comp.player_id}>
                          <TableCell className="capitalize font-medium">{comp.username}</TableCell>
                          <TableCell className="capitalize">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-full text-xs",
                                comp.status === "registered" || comp.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700",
                              )}
                            >
                              {comp.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}

                  {/* Squads / teams */}
                  {details.participant_type === "squad" &&
                    (details.tournament_teams ?? [])
                      .filter((tt: any) => !tt.is_waitlisted)
                      .map((team: any) => (
                        <TableRow key={team.team_id || team.player_id}>
                          <TableCell className="capitalize font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {/* Flag beside the registered team name (team's country). */}
                              <CountryFlag country={team.team_country} />
                              {team.team_name}
                            </span>
                          </TableCell>
                          <TableCell className="capitalize">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-full text-xs",
                                team.status === "registered" || team.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700",
                              )}
                            >
                              {team.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Engagement tab ───────────────────────────────────────────────── */}
        <TabsContent value="engagement" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 2xl:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.engagement.pageViews")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(adminDetails.engagement.pageviews)}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.engagement.totalVisits")}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.engagement.uniqueVisitors")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(adminDetails.engagement.unique_visitors)}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.engagement.uniqueUsers")}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.engagement.conversionRate")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {adminDetails.engagement.conversion_rate.toFixed(1)}%
                </div>
                <Progress value={adminDetails.engagement.conversion_rate} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.engagement.visitorsToRegistrations")}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t("eventDetail.engagement.socialShares")}
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(adminDetails.engagement.social_shares)}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("eventDetail.engagement.sharesAcrossPlatforms")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Ratings + anonymous feedback (organizer parity E1) ──
              Same card the admin Engagement tab mounts. Aggregate rating (GET
              events/<id>/rating/) is public; comments (event-comments/<id>/, text +
              date only) lazy-load on expand and are gated by org_can_event -> the
              OWNING org reads its OWN event's feedback, a 403 degrades to a toast. */}
          <EventReviewsCard eventId={details.event_id} />
        </TabsContent>
      </Tabs>

      {/* Broadcast media hygiene (owner 2026-07-02): which teams/players are missing
          logos/esport images, flag bad art, per-event hide/show. Same card the admin
          view page + overlay studio mount (components/overlay/MediaAuditCard, which
          already renders through the organizer i18n namespace). */}
      {canEdit && <MediaAuditCard eventId={details.event_id} />}
    </div>
  );
}
