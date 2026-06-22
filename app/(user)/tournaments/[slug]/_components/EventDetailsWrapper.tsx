"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  use,
  useRef,
  useTransition,
} from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
// i18n: copy lives in messages/en/tournaments.json (detail.* / register.* /
// editRoster.* / leaveModal.* / stageResults.* / teamRegister.*). useTranslations
// resolves the NEXT_LOCALE cookie locale, en fallback.
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  Users,
  AlertTriangle,
  User,
  Trophy,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { TournamentStructure } from "./TournamentStructure";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoneyInput } from "@/lib/utils";
// i18n time: <LocalTime/> renders a stored UTC instant in the VIEWER's own
// timezone + language (replaces formatDate, which hardcodes the locale and renders
// in UTC). formatLocalTime is its string form for non-JSX needs (here: the
// interpolated "Used at: {time}" invite message). See components/LocalTime.tsx.
import { LocalTime } from "@/components/LocalTime";
import { LocalEventTime } from "@/components/LocalEventTime";
import { formatLocalTime } from "@/lib/i18n/time";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/AuthModal";
import { AFC_DISCORD_SERVER, DEFAULT_IMAGE } from "@/constants";
import axios from "axios";
import Image from "next/image";
import {
  IconRefresh,
  IconUsers,
  IconUsersGroup,
  IconLoader2,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
// Rate-this-event + organizer-feedback widget (stars + comment box).
import { EventReviewCard } from "./EventReviewCard";
// ⓘ help tips for the non-obvious registration steps (copy in lib/help-content.ts).
import { InfoTip } from "@/components/ui/info-tip";
// Subtle clickable name -> public player/team profile (used in standings + lists).
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";
// Paid-event registration client (Stripe). startPaidRegistration() below calls
// initRegistrationPayment, then the success page verifies + completes registration.
import { eventPaymentsApi } from "@/lib/api/eventPayments";
// ── Sponsor redesign P3/P4 ── typed client for the entity-sponsorship system
// (backend afc_sponsors). forEvent() decides whether the SPONSOR step renders the
// NEW engagement form or the legacy single-ID inputs; mySubmissions/resubmit power
// the post-registration SponsorRequirementsCard.
import { sponsorsApi, EventSponsorshipRow } from "@/lib/sponsors";
// The data-driven engagement form (one per player) + its validation/payload
// helpers. The helpers build the `sponsorships` key of register-for-event/.
import {
  SponsorEngagementForm,
  SponsorEngagementPlayerSection,
  EngagementAnswers,
  RosterDiscordStatus,
  patchEngagementAnswer,
  isEngagementAnswerComplete,
  countIncompleteEngagements,
  findCollectIdDuplicates,
  buildSoloSponsorshipsBody,
  buildSquadSponsorshipsBody,
} from "./SponsorEngagementForm";
// Post-registration status board: the player's own sponsor submissions with
// pending/approved/rejected pills and the rejected-row resubmit loop.
import { SponsorRequirementsCard } from "./SponsorRequirementsCard";
// Pre-register requirements heads-up (asset + sponsor requirements), shown to all viewers (owner 2026-06-20).
import { EventRequirementsCard } from "./EventRequirementsCard";
// Public "Qualified field" provenance banner (event linking P2): who entered this
// event through fired qualification links. Self-hides when there are none.
import { QualifiedFromBanner } from "@/components/qualified-from-banner";
// localStorage key for the saved register-for-event payload, so it survives the Stripe
// redirect. Keyed by payment_id; the success page reads `${PAID_REG_KEY_PREFIX}${payment_id}`.
const PAID_REG_KEY_PREFIX = "afc_evt_reg_";

// ── Registration draft resume (owner 2026-06-13: "if any user starts registration on
// the platform, if they close the page or reload ... they should continue where they
// stopped even if they have not submitted") ──
// One draft per event, in localStorage under afc_reg_draft_<event_id>. EventDetailsWrapper
// persists it on every meaningful change of the registration modal state, restores it
// SILENTLY into state when the page reopens, and resumes at the saved step when the user
// clicks Register again (less intrusive than auto-opening the modal on load). Cleared on
// every successful registration path: the free flow's SUCCESS step, the paid already-paid
// branch (also lands on SUCCESS), and - for the Stripe round trip, which completes on the
// /register/success page - by the is_registered sweep when the user next views the event.
// JSON-safe values only (strings, booleans, arrays, plain objects).
const REG_DRAFT_KEY_PREFIX = "afc_reg_draft_";

// Where Register drops the user back in: the main RegistrationModals step OR the
// TeamRegistrationModals step (mid member-selection), whichever was open last.
interface RegistrationDraftResumePoint {
  kind: "main" | "team";
  step: ModalStep | TeamModalStep;
}

// The full draft shape. Every field mirrors one piece of EventDetailsWrapper state the
// registration flow collects before submission (see the persist effect for the mapping).
interface RegistrationDraft {
  v: 1; // shape version - bump if fields ever change incompatibly
  resume: RegistrationDraftResumePoint | null;
  regType: RegistrationType | null;
  teamId: string | null; // snapshot of the team the roster was picked from
  selectedMembers: string[];
  selectedTeamMembersData: TeamMember[];
  rulesAccepted: boolean;
  // Legacy single-ID sponsor inputs (events without entity sponsorships).
  soloSponsorUuid: string;
  teamSponsorUuids: Record<string, string>;
  // Sponsor-engagement answer drafts (solo + per rostered player).
  soloEngagementAnswers: EngagementAnswers;
  teamEngagementAnswers: Record<string, EngagementAnswers>;
  savedAt: number;
}

// Set to true when Discord is required for tournament registration
const DISCORD_REQUIRED = false;

// ── Roster Rules (Feature B, owner 2026-06-15) ──────────────────────────────────
// A team member's role lives in TeamMembers.management_role (afc_team/models.py).
// The choices MIX playing + management; only PLAYING roles may be picked for event
// registration. STAFF roles (coach/manager/analyst) are rejected by the backend at
// POST /events/register-for-event/ (and POST /events/edit-roster/), so the FE must
// not even offer them. We keep the same canonical sets the backend uses
// (afc_team/views.py PLAYER_ROLES / STAFF_ROLES). isPlayingMember() is the predicate
// both registration pickers below filter the team roster through.
const PLAYER_ROLES = ["team_captain", "vice_captain", "member"] as const;
// A member is selectable when their management_role is a PLAYING role. We default a
// missing/unknown role to "member" (a PLAYING role) so older data without the field
// stays selectable rather than silently disappearing from the picker.
const isPlayingMember = (m: TeamMember): boolean =>
  PLAYER_ROLES.includes((m.management_role ?? "member") as any);

// ── Who may REGISTER a team for an event (owner 2026-06-21) ─────────────────────
// The team OWNER plus these management roles. Everyone on the team SEES the Register
// button; a member without one of these roles gets a popup explaining only the team
// owner / captain / vice-captain / manager / coach can register. Must match the backend
// TEAM_EVENT_REGISTER_ROLES (+ owner) in afc_tournament_and_scrims/views.py
// ::_user_can_register_team.
const TEAM_REGISTER_ROLES = [
  "team_captain",
  "vice_captain",
  "manager",
  "coach",
] as const;

// True if the given user (by in-game name) may register `team` for an event: the team
// owner, or a member whose management_role is one of TEAM_REGISTER_ROLES.
function userCanRegisterTeam(
  team: { team_owner: string; members: TeamMember[] } | null,
  ign?: string | null,
): boolean {
  if (!team || !ign) return false;
  if (team.team_owner === ign) return true;
  const role = team.members.find((m) => m.username === ign)?.management_role;
  return TEAM_REGISTER_ROLES.includes((role ?? "") as any);
}

type ModalStep =
  | "CLOSED"
  | "INFO"
  | "TYPE"
  | "UID_PROMPT"
  | "UID_MISSING_MEMBERS"
  | "RULES"
  | "SPONSOR"
  | "DISCORD_LINK"
  | "DISCORD_JOIN"
  | "DISCORD_STATUS"
  // PAYMENT: the final step for a PAID event (registration_type === "paid"). It replaces
  // the direct register-for-event call - the user reviews the fee, then on "Pay" we save
  // the full registration payload to localStorage and redirect to Stripe Checkout. The
  // success page completes registration after payment. Free events never hit this step.
  | "PAYMENT"
  | "SUCCESS";
type RegistrationType = "solo" | "team";
type TeamModalStep = "CLOSED" | "SELECT_MEMBERS" | "TEAM_INFO";

interface StageGroup {
  group_id: number;
  group_name: string;
  playing_date: string;
  playing_time: string;
  teams_qualifying: number;
  overall_leaderboard?: any[];
  matches?: any[];
}

interface Stage {
  stage_id: number;
  stage_name: string;
  start_date: string;
  end_date: string;
  stage_format: string;
  teams_qualifying_from_stage: number;
  groups: StageGroup[];
}

interface EventDetails {
  event_id: number;
  competition_type: string;
  participant_type: string;
  registered_competitors: any[];
  event_type: string;
  max_teams_or_players: number;
  event_name: string;
  event_mode: string;
  start_date: string;
  end_date: string;
  registration_open_date: string;
  registration_end_date: string;
  registration_start_time?: string | null;
  registration_end_time?: string | null;
  event_start_time?: string | null;
  event_end_time?: string | null;
  // Host IANA timezone the times were entered in (owner 2026-06-21); paired with the
  // *_time fields by <LocalEventTime/> to show viewer-local + host time.
  timezone?: string | null;
  prizepool: string;
  prize_distribution: { [key: string]: number };
  event_rules: string;
  tournament_teams: {
    team_name: string;
    team_id: number;
    status: string;
  }[];
  event_status: string;
  registration_link: string;
  tournament_tier: string;
  stream_channels: string[];
  stages: Stage[];
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  is_registered: boolean;
  is_public: boolean;
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_field_label?: string;
  sponsor_requirement_description?: string | null;
  // M (waitlist) + capacity snapshot from the event-details endpoints.
  // is_full = active (non-waitlisted) registrations have hit max_teams_or_players;
  // when is_waitlist_enabled is also true the Register CTA flips to "Join Waitlist".
  is_waitlist_enabled?: boolean;
  waitlist_capacity?: number | null;
  registered_count?: number;
  is_full?: boolean;
  // Waitlist slot-assignment mode + roster (owner 2026-06-17): shown to players so they know how a
  // no-show's slot is filled, and who is waiting (with queue position).
  waitlist_mode?: string;
  waitlist_competitors?: Array<{
    position?: number;
    name?: string;
    registration_date?: string | null;
  }>;
  // ── Paid registration (Phase 1, Stripe) ──
  // registration_type flips the whole register flow: "free" keeps the existing direct
  // register-for-event path; "paid" routes the final step through Stripe Checkout (see the
  // PAYMENT ModalStep and startPaidRegistration below). registration_fee is the entry fee
  // charged in registration_fee_currency (a 3-letter ISO code, e.g. "USD"). These come
  // straight off the event-details endpoints and mirror the admin create/edit contract.
  registration_type?: "free" | "paid";
  registration_fee?: number | null;
  registration_fee_currency?: string;
  // ── Registration criteria (owner 2026-06-12) ── set on the event create/edit wizard.
  // require_team_logo: the team must have a logo before it can register. require_esport_images:
  // every (rostered) player must have their esport image uploaded (UserProfile.esports_pic).
  // Shown as a "Profile Requirements" callout on the INFO step so people know what to upload
  // and WHERE, before the backend gates reject them.
  require_team_logo?: boolean;
  require_esport_images?: boolean;
  // F3 (owner 2026-06-19): two more per-player registration gates. require_player_uid blocks until
  // every registering player has their Free Fire UID set; require_player_profile_image until each
  // has a profile image. Shown in the INFO-step requirements callout + enforced server-side.
  require_player_uid?: boolean;
  require_player_profile_image?: boolean;
  // ── Discord registration gate (per-event) ── echoed by get-event-details/. When
  // require_discord is true, the event shows a "Discord required" badge in the header
  // and register-for-event/ rejects participants who aren't Discord-connected + in the
  // event's server (403 code:"discord_required", handled in handleRegistrationGateError
  // below with a "Connect Discord" action). discord_server_id is informational here.
  require_discord?: boolean;
  discord_server_id?: string | null;
  // Discord invite link echoed by get-event-details/. When require_discord is on and this
  // is set, the event header shows a "Join the event's Discord" button (target _blank) for
  // ALL viewers so they can join before/while registering. See the join button below.
  discord_invite_link?: string | null;
  // Roster-edit window (owner 2026-06-15): true while an admin/organizer has opened roster editing
  // (until roster_edit_until, capped at the event end). When open, the team captain may edit their
  // roster EVEN AFTER the event start time - so the Edit Roster button honours this, not just the
  // pre-start check (owner 2026-06-22 bug: editing was blocked despite an open window). Echoed by
  // get_event_details; the backend edit_roster enforces the same window.
  roster_edit_open?: boolean;
  // ── Owning organization (F4, owner 2026-06-19) ── rendered as an "Organized by [logo] name"
  // attribution in the event header, linking to /organizations/<slug>. All null for native AFC
  // events (the header then falls back to AFC branding). organization_logo is an absolute URL
  // (or null when the org has no logo). These come straight off the event-details endpoints.
  organization_id?: number | null;
  organization_name?: string | null;
  organization_slug?: string | null;
  organization_logo?: string | null;
  // F6 co-ownership (owner 2026-06-19): accepted co-organizing orgs → "Organized by A & B".
  co_organizers?: Array<{
    name: string;
    slug: string | null;
    logo: string | null;
  }>;
}

interface ApiResponse {
  event_details: EventDetails;
}

interface TeamMember {
  id: string;
  username: string;
  uid?: string | null;
  is_verified: boolean;
  discord_connected: boolean;
  discord_id: string | null; // ✅ FIX: Change from boolean to string | null
  discord_username?: string;
  // Team role from TeamMembers.management_role (team/get-team-details/ -> team.members[]).
  // One of team_captain/vice_captain/member (PLAYING) or coach/manager/analyst (STAFF).
  // Drives isPlayingMember(): STAFF members are filtered out of the registration pickers
  // because the backend rejects them at register-for-event/ + edit-roster/. (Roster Rules)
  management_role?: string;
}

interface UserTeam {
  team_id: string;
  team_name: string;
  members: TeamMember[];
  min_players?: number;
  max_players?: number;
  team_owner: string;
  is_banned?: boolean;
}

interface DiscordValidationResult {
  user_id: number;
  username: string;
  is_active: boolean;
  discord_connected: boolean;
  discord_id: string | null;
  in_discord_server: boolean;
  membership_error: string | null;
  ok: boolean;
  reasons: string[];
}

interface DiscordValidationResponse {
  event_id: number;
  team_id: number;
  participant_type: string;
  roster_size: number;
  all_ok: boolean;
  results: DiscordValidationResult[];
}

interface RosterMember {
  user_id: number;
  username: string;
  full_name: string;
  user_id_from_sponsor: string;
  status: string;
  reason?: string;
}

interface LeaveEventModalProps {
  eventId: number;
  eventName: string;
  onSuccess: () => void;
}

const LeaveEventModal: React.FC<LeaveEventModalProps> = ({
  eventId,
  eventName,
  onSuccess,
}) => {
  const t = useTranslations("tournaments");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();

  const handleLeave = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/leave-event/`,
          { event_id: eventId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        toast.success(res.data.message || t("leaveModal.successFallback"));
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(e.response?.data?.message || t("leaveModal.failed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full md:w-auto">
          {t("leaveModal.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <DialogTitle className="text-xl">{t("leaveModal.title")}</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            {t.rich("leaveModal.confirm", {
              name: eventName,
              bold: (chunks) => <b>{chunks}</b>,
            })}
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-4">
            {t("leaveModal.note")}
          </p>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleLeave}
              disabled={pending}
            >
              {pending ? (
                <Loader text={t("leaveModal.leaving")} />
              ) : (
                t("leaveModal.trigger")
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface EditRosterModalProps {
  eventDetails: EventDetails;
  userTeam: UserTeam | null;
  token: string | null;
  onSuccess: () => void;
}

const EditRosterModal: React.FC<EditRosterModalProps> = ({
  eventDetails,
  userTeam,
  token,
  onSuccess,
}) => {
  const t = useTranslations("tournaments");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"SELECT_MEMBERS" | "SPONSOR_IDS">(
    "SELECT_MEMBERS",
  );
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [sponsorIds, setSponsorIds] = useState<Record<string, string>>({});
  const [currentRoster, setCurrentRoster] = useState<RosterMember[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [touchedRejectedIds, setTouchedRejectedIds] = useState<Set<string>>(
    new Set(),
  );

  // ── NEW: all-competitors sponsor IDs fetched once when SPONSOR_IDS opens ──
  const [allRegisteredSponsorIds, setAllRegisteredSponsorIds] = useState<
    Map<string, string> // sponsorId → username who owns it
  >(new Map());
  const [isFetchingAllSponsors, setIsFetchingAllSponsors] = useState(false);

  const minPlayers = userTeam?.min_players || 4;
  const maxPlayers = userTeam?.max_players || 6;

  // ── Fetch every competitor's sponsor_id for this event ──
  const fetchAllSponsorIds = async () => {
    if (!eventDetails.is_sponsored || !token) return;
    setIsFetchingAllSponsors(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-competitors-and-their-sponsor-id/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const map = new Map<string, string>();
      (res.data.competitors || []).forEach((c: any) => {
        if (c.sponsor_id) map.set(c.sponsor_id.trim(), c.username);
      });
      setAllRegisteredSponsorIds(map);
    } catch {
      // Non-fatal - duplicate-across-event check just won't run
    } finally {
      setIsFetchingAllSponsors(false);
    }
  };

  const handleOpen = async () => {
    setIsLoadingRoster(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-roster-details/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = res.data;
      setCurrentRoster(data.roster || []);
      setTeamId(data.team_id);

      const rosterByUsername = new Map<string, RosterMember>();
      (data.roster || []).forEach((r: RosterMember) => {
        rosterByUsername.set(r.username, r);
      });

      const currentIds = (userTeam?.members || [])
        .filter((m) => rosterByUsername.has(m.username))
        .map((m) => m.id);
      setSelectedMemberIds(currentIds);

      const sponsorMap: Record<string, string> = {};
      (userTeam?.members || []).forEach((m) => {
        const rosterMember = rosterByUsername.get(m.username);
        if (rosterMember?.user_id_from_sponsor) {
          sponsorMap[m.id] = rosterMember.user_id_from_sponsor;
        }
      });
      setSponsorIds(sponsorMap);

      setTouchedRejectedIds(new Set());
      setStep("SELECT_MEMBERS");
      setOpen(true);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || t("editRoster.loadFailed"),
      );
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleMemberToggle = (memberId: string) => {
    // @ts-ignore
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id: string) => id !== memberId);
      } else {
        if (prev.length >= maxPlayers) {
          toast.error(t("editRoster.selectMaxError", { max: maxPlayers }));
          return prev;
        }
        return [...prev, memberId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedMemberIds.length < minPlayers) {
      toast.error(t("editRoster.selectMinError", { min: minPlayers }));
      return;
    }
    if (eventDetails.is_sponsored) {
      // Kick off the all-sponsors fetch in parallel while we show the step
      fetchAllSponsorIds();
      setStep("SPONSOR_IDS");
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const rosterMemberIds = selectedMemberIds.map((id) => parseInt(id));

      const payload: any = {
        event_id: eventDetails.event_id,
        team_id: teamId,
        roster_member_ids: rosterMemberIds,
      };

      if (eventDetails.is_sponsored) {
        const filteredSponsorIds: Record<string, string> = {};
        rosterMemberIds.forEach((uid) => {
          filteredSponsorIds[uid.toString()] = sponsorIds[uid.toString()] || "";
        });
        payload.sponsor_ids = filteredSponsorIds;
      }

      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-roster/`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      toast.success(res.data.message || t("editRoster.updateSuccess"));
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || t("editRoster.updateFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMembersData = useMemo(() => {
    return (
      userTeam?.members.filter((m) => selectedMemberIds.includes(m.id)) || []
    );
  }, [userTeam, selectedMemberIds]);

  // ── Duplicate detection (within team) ──
  const editSeenValues = new Set<string>();
  const editDuplicateMemberIds = new Set<string>();
  selectedMembersData.forEach((m) => {
    const val = (sponsorIds[m.id] || "").trim();
    if (val !== "") {
      if (editSeenValues.has(val)) {
        selectedMembersData.forEach((other) => {
          if ((sponsorIds[other.id] || "").trim() === val) {
            editDuplicateMemberIds.add(other.id);
          }
        });
      } else {
        editSeenValues.add(val);
      }
    }
  });
  const editHasDuplicates = editDuplicateMemberIds.size > 0;

  // ── NEW: Duplicate detection (against all registered competitors) ──
  //    Build a set of sponsor_ids that belong to OTHER competitors
  //    (i.e. not the current member being edited).
  const getExternalConflict = (memberId: string): string | null => {
    if (allRegisteredSponsorIds.size === 0) return null;
    const val = (sponsorIds[memberId] || "").trim();
    if (!val) return null;

    // Find this member's current accepted sponsor_id so they can keep it
    const rosterEntry = currentRoster.find(
      (r) => r.user_id.toString() === memberId,
    );
    const ownCurrentId = rosterEntry?.user_id_from_sponsor?.trim() || null;

    // If they're keeping their own existing accepted value, it's not a conflict
    if (
      ownCurrentId &&
      val === ownCurrentId &&
      rosterEntry?.status === "active"
    ) {
      return null;
    }

    const ownerUsername = allRegisteredSponsorIds.get(val);
    if (!ownerUsername) return null;

    // Conflict only if someone *else* already registered with this ID
    const thisMember = selectedMembersData.find((m) => m.id === memberId);
    if (ownerUsername === thisMember?.username) return null;

    return ownerUsername;
  };

  const anyExternalConflict = selectedMembersData.some(
    (m) => getExternalConflict(m.id) !== null,
  );

  const canSubmitSponsor =
    selectedMembersData.every((m) => (sponsorIds[m.id] || "").trim() !== "") &&
    !editHasDuplicates &&
    !anyExternalConflict; // ← NEW gate

  return (
    <>
      <Button
        variant="outline"
        className="w-full md:w-auto"
        onClick={handleOpen}
        disabled={isLoadingRoster}
      >
        {isLoadingRoster ? (
          <Loader text={t("common.loading")} />
        ) : (
          t("editRoster.trigger")
        )}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="flex flex-col max-h-[85vh]">
          {step === "SELECT_MEMBERS" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t("editRoster.selectMembers.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("editRoster.selectMembers.description", {
                    eventName: eventDetails.event_name,
                  })}
                </DialogDescription>
              </DialogHeader>

              {(() => {
                const rejectedOnRoster = currentRoster.filter(
                  (r) => r.status === "rejected",
                );
                if (rejectedOnRoster.length === 0) return null;
                const allRejected =
                  rejectedOnRoster.length === currentRoster.length;
                return (
                  <Alert className="border-destructive/50 bg-destructive/10 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {allRejected ? (
                        <p>
                          {t.rich("editRoster.selectMembers.allRejected", {
                            bold: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </p>
                      ) : (
                        <p>
                          {t.rich("editRoster.selectMembers.someRejected", {
                            count: rejectedOnRoster.length,
                            playerWord:
                              rejectedOnRoster.length === 1
                                ? t("editRoster.selectMembers.playerSingular")
                                : t("editRoster.selectMembers.playerPlural"),
                            haveWord:
                              rejectedOnRoster.length === 1
                                ? t("editRoster.selectMembers.hasWord")
                                : t("editRoster.selectMembers.haveWord"),
                            bold: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-primary/10 rounded-md">
                <h3 className="font-semibold mb-3">
                  {t("editRoster.selectMembers.selectPlayers", {
                    min: minPlayers,
                    max: maxPlayers,
                  })}
                </h3>
                <div className="space-y-2">
                  {/* Roster Rules (owner 2026-06-15): only PLAYING-role members
                      (team_captain/vice_captain/member) are selectable. STAFF
                      (coach/manager/analyst) are filtered out here because the
                      backend edit-roster/ endpoint rejects them with a 400. */}
                  {userTeam?.members.filter(isPlayingMember).map((member) => {
                    const rosterEntry = currentRoster.find(
                      (r) => r.user_id.toString() === member.id,
                    );
                    const isRejected = rosterEntry?.status === "rejected";
                    const isCurrent = !!rosterEntry;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-background rounded-md border hover:border-primary transition"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`edit-member-${member.id}`}
                            checked={selectedMemberIds.includes(member.id)}
                            onCheckedChange={() =>
                              handleMemberToggle(member.id)
                            }
                          />
                          <label
                            htmlFor={`edit-member-${member.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {member.username}
                          </label>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCurrent && !isRejected && (
                            <Badge variant="outline" className="text-xs">
                              {t("editRoster.selectMembers.current")}
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="destructive" className="text-xs">
                              {t("editRoster.selectMembers.rejected")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {t("editRoster.selectMembers.selectedCount", {
                  count: selectedMemberIds.length,
                  max: maxPlayers,
                })}
              </div>

              <DialogFooter className="flex sm:justify-between">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={
                    selectedMemberIds.length < minPlayers ||
                    selectedMemberIds.length > maxPlayers ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <Loader text={t("common.saving")} />
                  ) : eventDetails.is_sponsored ? (
                    t("editRoster.selectMembers.continue")
                  ) : (
                    t("common.saveChanges")
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "SPONSOR_IDS" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t("editRoster.sponsorIds.title", {
                    sponsorName: eventDetails.sponsor_name ?? "",
                  })}
                </DialogTitle>
                <DialogDescription>
                  {t("editRoster.sponsorIds.description", {
                    fieldLabel: eventDetails.sponsor_field_label ?? "",
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
                {eventDetails.sponsor_requirement_description && (
                  <div className="p-3 rounded-md bg-primary/10 text-sm text-muted-foreground">
                    {eventDetails.sponsor_requirement_description}
                  </div>
                )}

                {/* ── NEW: loading indicator while fetching all sponsors ── */}
                {isFetchingAllSponsors && (
                  <div className="p-3 rounded-md bg-primary/10 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader text={t("editRoster.sponsorIds.validating")} />
                  </div>
                )}

                <div className="space-y-3 px-2">
                  {(editHasDuplicates || anyExternalConflict) && (
                    <p className="text-sm text-destructive">
                      {t("editRoster.sponsorIds.uniqueRequired", {
                        fieldLabel: eventDetails.sponsor_field_label ?? "",
                      })}
                    </p>
                  )}
                  {selectedMembersData.map((member) => {
                    const isTeamDuplicate = editDuplicateMemberIds.has(
                      member.id,
                    );
                    const externalConflictUser = getExternalConflict(member.id);
                    const hasAnyError =
                      isTeamDuplicate || !!externalConflictUser;

                    const rosterEntry = currentRoster.find(
                      (r) => r.username === member.username,
                    );
                    const memberStatus = rosterEntry?.status;
                    const isAccepted = memberStatus === "active";
                    const isRejectedSponsor = memberStatus === "rejected";
                    const rejectedUntouched =
                      isRejectedSponsor && !touchedRejectedIds.has(member.id);

                    let inputClassName = "border-input";
                    if (isAccepted && !hasAnyError) {
                      inputClassName =
                        "border-green-500 focus-visible:ring-green-500";
                    } else if (rejectedUntouched || hasAnyError) {
                      inputClassName =
                        "border-destructive focus-visible:ring-destructive";
                    }

                    return (
                      <div key={member.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label>{member.username}</Label>
                          {isAccepted && !hasAnyError && (
                            <span className="text-xs font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                              {t("editRoster.sponsorIds.accepted")}
                            </span>
                          )}
                          {isRejectedSponsor && (
                            <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                              {t("editRoster.sponsorIds.rejected")}
                            </span>
                          )}
                        </div>
                        <Input
                          className={inputClassName}
                          placeholder={t("editRoster.sponsorIds.placeholder", {
                            fieldLabel: eventDetails.sponsor_field_label ?? "",
                          })}
                          value={sponsorIds[member.id] || ""}
                          disabled={isAccepted && !hasAnyError}
                          onChange={(e) => {
                            if (isRejectedSponsor) {
                              setTouchedRejectedIds((prev) =>
                                new Set(prev).add(member.id),
                              );
                            }
                            setSponsorIds({
                              ...sponsorIds,
                              [member.id]: e.target.value,
                            });
                          }}
                        />
                        {/* Error messages - ordered by specificity */}
                        {rejectedUntouched && !hasAnyError && (
                          <p className="text-xs text-destructive">
                            {rosterEntry?.reason
                              ? t("editRoster.sponsorIds.rejectedReason", {
                                  reason: rosterEntry.reason,
                                })
                              : t("editRoster.sponsorIds.rejectedUpdate", {
                                  fieldLabel:
                                    eventDetails.sponsor_field_label ?? "",
                                })}
                          </p>
                        )}
                        {isTeamDuplicate && (
                          <p className="text-xs text-destructive">
                            {t("editRoster.sponsorIds.duplicateMember")}
                          </p>
                        )}
                        {/* ── NEW error ── */}
                        {!isTeamDuplicate && externalConflictUser && (
                          <p className="text-xs text-destructive">
                            {t("editRoster.sponsorIds.externalConflict", {
                              fieldLabel: eventDetails.sponsor_field_label ?? "",
                            })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setStep("SELECT_MEMBERS")}
                >
                  {t("common.back")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !canSubmitSponsor || isSubmitting || isFetchingAllSponsors
                  }
                >
                  {isSubmitting ? (
                    <Loader text={t("common.saving")} />
                  ) : (
                    t("common.saveChanges")
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// participantType decides whether a standings-row name is a team ("squad") or a
// player ("solo"), so we can link the competitor name to the right public profile.
const StageResultsTable: React.FC<{
  stage: Stage;
  participantType?: string;
}> = ({ stage, participantType }) => {
  const t = useTranslations("tournaments");
  // Initialize with first group's ID
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    stage?.groups?.[0]?.group_id?.toString() || "",
  );
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

  // Find active group
  const activeGroup = useMemo(() => {
    if (!stage?.groups || !selectedGroupId) return null;
    return stage.groups.find(
      (g) => g?.group_id?.toString() === selectedGroupId,
    );
  }, [stage.groups, selectedGroupId]);

  // Find active match
  const activeMatch = useMemo(() => {
    if (selectedMatchId === "overall" || !activeGroup?.matches) return null;
    return activeGroup.matches.find(
      (m: any) => m?.match_id?.toString() === selectedMatchId,
    );
  }, [activeGroup, selectedMatchId]);

  // Get table data
  const tableRows = useMemo(() => {
    if (selectedMatchId === "overall") {
      const rawData = activeGroup?.overall_leaderboard;
      return Array.isArray(rawData) ? rawData : [];
    } else {
      // API returns 'stats' not 'solo_stats'
      const rawData = activeMatch?.stats || activeMatch?.solo_stats;
      return Array.isArray(rawData) ? rawData : [];
    }
  }, [selectedMatchId, activeGroup, activeMatch]);

  if (!stage?.groups || stage.groups.length === 0) {
    return (
      <Card className="">
        <CardContent className="p-10 text-center">
          <p className="text-zinc-500">{t("stageResults.noGroups")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className=" overflow-hidden">
      <CardHeader className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          {/* Group Selector */}
          <div className="flex-1 space-y-2">
            <Label>{t("stageResults.selectGroup")}</Label>
            <Select
              value={selectedGroupId}
              onValueChange={(val) => {
                setSelectedGroupId(val);
                setSelectedMatchId("overall");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("stageResults.chooseGroup")} />
              </SelectTrigger>
              <SelectContent>
                {stage.groups.map((g) => (
                  <SelectItem key={g.group_id} value={g.group_id?.toString()}>
                    {g.group_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result View Selector */}
          <div className="flex-1 space-y-2">
            <Label>{t("stageResults.viewType")}</Label>
            <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">
                  {t("stageResults.consolidatedLeaderboard")}
                </SelectItem>
                {activeGroup?.matches?.map((m: any) => (
                  <SelectItem key={m.match_id} value={m.match_id?.toString()}>
                    {t("stageResults.match", {
                      number: m.match_number,
                      map: m.match_map,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="size-4 text-yellow-500" />
          <h3 className="text-sm font-semibold uppercase">
            {selectedMatchId === "overall"
              ? t("stageResults.groupStandings", {
                  group:
                    activeGroup?.group_name || t("stageResults.groupFallback"),
                })
              : t("stageResults.matchHeading", {
                  number: activeMatch?.match_number,
                  map: activeMatch?.match_map,
                })}
          </h3>
        </div>

        <div className="rounded-md border overflow-hidden shadow-inner">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center ">
                  {t("stageResults.rank")}
                </TableHead>
                <TableHead className="">
                  {t("stageResults.competitor")}
                </TableHead>
                <TableHead className="text-center ">
                  {t("stageResults.kills")}
                </TableHead>
                {/* Place Pts: always-shown placement-points contribution behind the total
                    (owner 2026-06-15). Group standings carry it as placement_sum; per-match
                    rows as placement_points. */}
                <TableHead className="text-center ">
                  {t("stageResults.placePts")}
                </TableHead>
                <TableHead className="text-right text-[10px] uppercase font-semibold pr-6">
                  {t("stageResults.totalPoints")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length > 0 ? (
                tableRows.map((row: any, idx: number) => {
                  const username =
                    row.username ||
                    row.competitor__user__username ||
                    `Player ${row.competitor_id || idx + 1}`;
                  const kills = row.total_kills ?? row.kills ?? 0;
                  const points = row.total_points ?? row.total_pts ?? 0;
                  // Group standings expose placement_sum; per-match rows expose placement_points.
                  const placePts = row.placement_sum ?? row.placement_points ?? 0;
                  const placement = row.placement ?? idx + 1;

                  return (
                    <TableRow
                      key={`${
                        row.competitor_id || row.id
                      }-${selectedMatchId}-${idx}`}
                      className="group"
                    >
                      <TableCell className="text-center font-semibold">
                        #{placement}
                      </TableCell>
                      <TableCell className="font-bold">
                        {/* Competitor name links to the public team or player
                            profile depending on the event's participant type. */}
                        {participantType === "squad" ? (
                          <TeamLink name={username} />
                        ) : (
                          <PlayerLink name={username} />
                        )}
                      </TableCell>
                      <TableCell className="text-center group-hover:text-white font-medium">
                        {kills}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {placePts}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary pr-6">
                        {parseFloat(points).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-40 text-center text-muted-foreground italic"
                  >
                    {t("stageResults.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// Team Registration Modals Component
interface TeamRegistrationModalsProps {
  teamModalStep: TeamModalStep;
  setTeamModalStep: (step: TeamModalStep) => void;
  userTeam: UserTeam | null;
  selectedMembers: string[];
  setSelectedMembers: (members: string[]) => void;
  eventDetails: EventDetails;
  onContinueToRules: () => void;
}

const TeamRegistrationModals: React.FC<TeamRegistrationModalsProps> = ({
  teamModalStep,
  setTeamModalStep,
  userTeam,
  selectedMembers,
  setSelectedMembers,
  eventDetails,
  onContinueToRules,
}) => {
  const t = useTranslations("tournaments");
  const minPlayers = userTeam?.min_players || 4;
  const maxPlayers = userTeam?.max_players || 6;

  const handleMemberToggle = (memberId: string) => {
    // @ts-ignore
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id: any) => id !== memberId);
      } else {
        if (prev.length >= maxPlayers) {
          toast.error(t("teamRegister.selectMaxError", { max: maxPlayers }));
          return prev;
        }
        return [...prev, memberId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedMembers.length < minPlayers) {
      toast.error(t("teamRegister.selectMinError", { min: minPlayers }));
      return;
    }
    if (selectedMembers.length > maxPlayers) {
      toast.error(t("teamRegister.selectAtMostError", { max: maxPlayers }));
      return;
    }
    setTeamModalStep("TEAM_INFO");
  };

  const selectedMembersData = useMemo(() => {
    return (
      userTeam?.members.filter((m) => selectedMembers.includes(m.id)) || []
    );
  }, [userTeam, selectedMembers]);

  const closeAll = () => {
    setTeamModalStep("CLOSED");
    // NOTE (draft resume, owner 2026-06-13): the member selection is intentionally
    // KEPT on close. It used to be wiped here, but the registration draft in
    // localStorage now restores the roster when the user comes back - clearing it
    // on dismiss would defeat "continue where you stopped".
  };

  if (teamModalStep === "CLOSED") return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && closeAll()}>
      <DialogContent className="flex flex-col max-h-[85vh]">
        {teamModalStep === "SELECT_MEMBERS" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1">
                {t("teamRegister.selectMembers.title")}
                <InfoTip id="tournaments.register.select_members._section" />
              </DialogTitle>
              <DialogDescription>
                {t("teamRegister.selectMembers.description", {
                  min: minPlayers,
                  max: maxPlayers,
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-primary/10 rounded-md">
              <h3 className="font-semibold mb-3">
                {t("teamRegister.selectMembers.availablePlayers")}
              </h3>
              <div className="space-y-2">
                {/* Roster Rules (owner 2026-06-15): only PLAYING-role members
                    (team_captain/vice_captain/member) can be rostered for an event.
                    STAFF (coach/manager/analyst) are filtered out so the picker never
                    offers someone the backend register-for-event/ endpoint would reject. */}
                {userTeam?.members.filter(isPlayingMember).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-background rounded-md border hover:border-primary transition"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <label
                        htmlFor={`member-${member.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {member.username}
                      </label>
                    </div>
                    {/* <Badge
                      variant={member.is_verified ? "default" : "secondary"}
                    >
                      {member.is_verified ? "Verified" : "Not Verified"}
                    </Badge> */}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {t("teamRegister.selectMembers.selectedCount", {
                count: selectedMembers.length,
                max: maxPlayers,
              })}
            </div>

            <DialogFooter className="flex sm:justify-between">
              <Button variant="secondary" onClick={closeAll}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleContinue}
                disabled={
                  selectedMembers.length < minPlayers ||
                  selectedMembers.length > maxPlayers
                }
              >
                {t("teamRegister.selectMembers.continue")}
              </Button>
            </DialogFooter>
          </>
        )}

        {teamModalStep === "TEAM_INFO" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("teamRegister.teamInfo.title")}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-primary/10 rounded-md space-y-3">
              <div>
                <span className="font-semibold text-primary">
                  {t("teamRegister.teamInfo.teamName")}
                </span>{" "}
                {userTeam?.team_name}
              </div>
              <div>
                <span className="font-semibold text-primary">
                  {t("teamRegister.teamInfo.membersSelected")}
                </span>{" "}
                {selectedMembers.length}
              </div>
              <div>
                <span className="font-semibold text-primary">
                  {t("teamRegister.teamInfo.tournament")}
                </span>{" "}
                {eventDetails.event_name}
              </div>
              <div>
                <span className="font-semibold text-primary">
                  {t("teamRegister.teamInfo.format")}
                </span>{" "}
                {eventDetails.competition_type}
              </div>

              <Separator className="my-3" />

              <div>
                <p className="font-semibold text-primary mb-2">
                  {t("teamRegister.teamInfo.teamMembers")}
                </p>
                <ul className="space-y-1">
                  {selectedMembersData.map((member, idx) => (
                    <li key={member.id} className="text-sm">
                      {idx + 1}. {member.username}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Profile requirements (owner 2026-06-12) ── TEAM flow twin of the solo INFO
                  step callout: tells the captain what the event demands and WHERE each item is
                  uploaded, BEFORE the backend gates reject the registration. Esport image (and
                  Free Fire UID) live on each player's /profile/edit; the team logo on the
                  team's edit page. */}
              {(eventDetails.require_esport_images ||
                eventDetails.require_team_logo) && (
                <div className="flex items-start space-x-2 text-sm">
                  <AlertTriangle className="size-4 flex-shrink-0 mt-1 text-yellow-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-yellow-400">
                      {t("teamRegister.teamInfo.profileRequirements")}
                    </p>
                    {eventDetails.require_esport_images && (
                      <p className="text-xs">
                        {t.rich("teamRegister.teamInfo.esportImageNote", {
                          editProfileLink: (chunks) => (
                            <Link
                              href="/profile/edit"
                              className="text-primary underline underline-offset-2"
                            >
                              {chunks}
                            </Link>
                          ),
                        })}
                      </p>
                    )}
                    {eventDetails.require_team_logo && (
                      <p className="text-xs">
                        {userTeam?.team_id
                          ? t.rich(
                              "teamRegister.teamInfo.teamLogoNoteWithLink",
                              {
                                teamEditLink: (chunks) => (
                                  <Link
                                    href={`/teams/${userTeam.team_id}/edit`}
                                    className="text-primary underline underline-offset-2"
                                  >
                                    {chunks}
                                  </Link>
                                ),
                              },
                            )
                          : t("teamRegister.teamInfo.teamLogoNote")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setTeamModalStep("SELECT_MEMBERS")}
              >
                {t("common.back")}
              </Button>
              <Button onClick={onContinueToRules}>
                {t("teamRegister.teamInfo.continueToRules")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface ModalProps {
  eventDetails: EventDetails & {
    selectedTeamMembers?: TeamMember[];
    validationResults?: DiscordValidationResult[];
  };
  token: string | null;
  modalStep: ModalStep;
  setModalStep: (step: ModalStep) => void;
  handleSelectType: (type: RegistrationType) => void;
  rulesAccepted: boolean;
  setRulesAccepted: (checked: boolean) => void;
  handleGoToRules: () => void;
  handleRulesContinue: () => void;
  handleDiscordConnect: () => void;
  handleJoinedServer: () => void;
  // Paid-event only: invoked from the PAYMENT step to start Stripe Checkout. For free
  // events this step is never reached, so the prop is harmless there.
  startPaidRegistration: () => void;
  uidInput: string;
  setUidInput: (v: string) => void;
  savingUid: boolean;
  handleSaveUid: () => void;
  uidMissingMembers: string[];
  pendingJoined: boolean;
  // M: drives the success-step copy (waitlist vs confirmed registration).
  wasWaitlisted?: boolean;
  isDiscordConnected: boolean;
  regType: RegistrationType | null;
  onCheckDiscordStatus?: () => void;
  checkUserDiscordStatus?: () => void;
  isCheckingDiscord?: boolean;
  isCheckingUserDiscord?: boolean;
  isInAfcServer?: boolean;
  teamAfcServerStatus?: Record<string, boolean>;
  copyAfcServerLink: () => void;
  // The registering user's team (null until loaded / solo). Used by the INFO step's
  // "Profile Requirements" callout to deep-link the team-logo upload (/teams/<id>/edit).
  userTeam?: UserTeam | null;
  soloSponsorUuid: string;
  setSoloSponsorUuid: (v: string) => void;
  teamSponsorUuids: Record<string, string>;
  setTeamSponsorUuids: (v: Record<string, string>) => void;
  // ── Sponsor redesign P3 ── the event's entity sponsorships (sponsorsApi.forEvent,
  // fetched once by the parent). NON-EMPTY flips the SPONSOR step to the new
  // engagement form; EMPTY keeps the legacy single-ID UI above untouched.
  eventSponsorships: EventSponsorshipRow[];
  // Engagement answer drafts, owned by the parent so buildRegistrationPayload can
  // read them. Solo: [sponsorship_id][engagement_index] -> draft payload. Squad:
  // the same shape nested under each rostered player's user id.
  soloEngagementAnswers: EngagementAnswers;
  setSoloEngagementAnswers: React.Dispatch<
    React.SetStateAction<EngagementAnswers>
  >;
  teamEngagementAnswers: Record<string, EngagementAnswers>;
  setTeamEngagementAnswers: React.Dispatch<
    React.SetStateAction<Record<string, EngagementAnswers>>
  >;
  // True when register-for-event/ answered pending_sponsor_approval (a sponsor
  // with requires_approval must vet the submissions) - flips the SUCCESS copy.
  pendingSponsorApproval?: boolean;
  // ── Roster Discord auto-verification (owner 2026-06-13, join_group discord) ──
  // Per-player results from POST events/roster-discord-status/, keyed by
  // String(user_id). Fetched by the parent's checkRosterDiscordStatus when the
  // SPONSOR step opens; each SponsorEngagementForm gets its player's row.
  rosterDiscordStatus: Record<string, RosterDiscordStatus>;
  // True while that roster check is in flight (the panels show a checking row).
  isCheckingRosterDiscord: boolean;
  // Re-runs the roster check (the panels' "Re-check" buttons).
  onRecheckRosterDiscord: () => void;
  // The logged-in registrant's user id - the SOLO path picks their own status row.
  currentUserId: string | null;
  // ── Registration draft resume ──
  // True when a saved draft was restored this visit: the TYPE step then shows the
  // subtle "Clear saved progress" affordance wired to onClearDraft.
  hasResumableDraft?: boolean;
  onClearDraft?: () => void;
}

const RegistrationModals: React.FC<ModalProps> = ({
  eventDetails,
  modalStep,
  setModalStep,
  handleSelectType,
  handleGoToRules,
  rulesAccepted,
  setRulesAccepted,
  handleRulesContinue,
  handleDiscordConnect,
  handleJoinedServer,
  startPaidRegistration,
  uidInput,
  setUidInput,
  savingUid,
  handleSaveUid,
  uidMissingMembers,
  pendingJoined,
  wasWaitlisted = false,
  isDiscordConnected,
  regType,
  onCheckDiscordStatus,
  isCheckingDiscord = false,
  isCheckingUserDiscord = false,
  isInAfcServer = false,
  checkUserDiscordStatus,
  copyAfcServerLink,
  teamAfcServerStatus,
  userTeam,
  soloSponsorUuid,
  setSoloSponsorUuid,
  teamSponsorUuids,
  setTeamSponsorUuids,
  eventSponsorships,
  soloEngagementAnswers,
  setSoloEngagementAnswers,
  teamEngagementAnswers,
  setTeamEngagementAnswers,
  pendingSponsorApproval = false,
  rosterDiscordStatus,
  isCheckingRosterDiscord,
  onRecheckRosterDiscord,
  currentUserId,
  hasResumableDraft = false,
  onClearDraft,
  token,
}) => {
  const t = useTranslations("tournaments");
  const isSoloDisabled = eventDetails.participant_type === "squad";
  const isTeamDisabled = eventDetails.participant_type === "solo";
  const closeAll = () => setModalStep("CLOSED");
  // Sponsor redesign P3: non-empty = this event uses the NEW engagement system,
  // so the SPONSOR step renders the engagement form instead of the legacy UI.
  const hasEntitySponsorships = eventSponsorships.length > 0;

  // Keep refs fresh so the interval can read latest values without causing re-runs
  const onCheckDiscordStatusRef = useRef(onCheckDiscordStatus);
  const teamAfcServerStatusRef = useRef(teamAfcServerStatus);
  const validationResultsRef = useRef(eventDetails.validationResults);
  const selectedTeamMembersRef = useRef(eventDetails.selectedTeamMembers);

  const [allRegisteredSponsorIds, setAllRegisteredSponsorIds] = useState<
    Map<string, string>
  >(new Map());
  const [isFetchingAllSponsors, setIsFetchingAllSponsors] = useState(false);

  const fetchAllSponsorIds = async () => {
    if (!eventDetails.is_sponsored || !token) return;
    setIsFetchingAllSponsors(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-competitors-and-their-sponsor-id/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const map = new Map<string, string>();
      (res.data.competitors || []).forEach((c: any) => {
        if (c.sponsor_id) map.set(c.sponsor_id.trim(), c.username);
      });
      setAllRegisteredSponsorIds(map);
    } catch {
      // Non-fatal - duplicate-across-event check just won't run
    } finally {
      setIsFetchingAllSponsors(false);
    }
  };

  useEffect(() => {
    onCheckDiscordStatusRef.current = onCheckDiscordStatus;
  }, [onCheckDiscordStatus]);
  useEffect(() => {
    teamAfcServerStatusRef.current = teamAfcServerStatus;
  }, [teamAfcServerStatus]);
  useEffect(() => {
    validationResultsRef.current = eventDetails.validationResults;
    selectedTeamMembersRef.current = eventDetails.selectedTeamMembers;
  }, [eventDetails.validationResults, eventDetails.selectedTeamMembers]);

  useEffect(() => {
    // The cross-event duplicate fetch belongs to the LEGACY sponsor-ID step only;
    // the new engagement path (hasEntitySponsorships) validates server-side.
    if (
      modalStep === "SPONSOR" &&
      eventDetails.is_sponsored &&
      !hasEntitySponsorships
    ) {
      fetchAllSponsorIds();
    }
    // fetchAllSponsorIds reads token + eventDetails.event_id via closure;
    // they don't change while the modal is open so modalStep is the only dep needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalStep]);

  // Poll Discord status for team members - only restarts when modal step changes
  useEffect(() => {
    if (modalStep !== "DISCORD_STATUS" || !onCheckDiscordStatusRef.current)
      return;

    // Initial check when entering the step
    onCheckDiscordStatusRef.current();

    // Poll every 30 seconds; reads fresh values from refs so status updates
    // don't restart this effect and cause rapid successive calls
    const interval = setInterval(() => {
      const vr = validationResultsRef.current || [];
      const allMembersOk = vr.length > 0 && vr.every((r: any) => r.ok);
      const smData = selectedTeamMembersRef.current || [];
      const allInAfcServer = smData.every(
        (member) =>
          member.discord_id &&
          teamAfcServerStatusRef.current?.[member.discord_id] === true,
      );

      if (allMembersOk && allInAfcServer) {
        clearInterval(interval);
        return;
      }

      onCheckDiscordStatusRef.current?.();
    }, 30000);

    return () => clearInterval(interval);
  }, [modalStep]);

  const renderDialog = () => {
    switch (modalStep) {
      case "INFO":
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t("register.info.title")}</DialogTitle>
              <DialogDescription>
                {t("register.info.description")}
              </DialogDescription>
            </DialogHeader>
            <DialogContent className="p-4 rounded-md text-sm space-y-2">
              <p className="capitalize">
                {t("register.info.format", {
                  mode: eventDetails.event_mode,
                  type: eventDetails.competition_type,
                })}
              </p>
              <p>
                {/* i18n time: the start date renders in the viewer's own timezone +
                    language via <LocalTime mode="date"/>, injected as the <date> tag of
                    the "Date: <date>" string (t.rich). */}
                {t.rich("register.info.date", {
                  date: () => (
                    <LocalTime value={eventDetails.start_date} mode="date" />
                  ),
                })}
              </p>
              {/* Format the raw prizepool string (e.g. "1750.0") with thousands
                  separators and no trailing ".0", mirroring the render at the
                  Prize Pool block further down this file. Falls back to the raw
                  value when it isn't a plain number. */}
              <p>
                {t("register.info.prizePool", {
                  value: /^\d+(\.\d+)?$/.test(eventDetails.prizepool)
                    ? `$${parseFloat(eventDetails.prizepool).toLocaleString()}`
                    : eventDetails.prizepool,
                })}
              </p>
              <p className="capitalize">
                {t("register.info.location", { value: eventDetails.event_mode })}
              </p>
              <Separator />
              <div className="flex items-start space-x-2 text-sm">
                <AlertTriangle className="size-4 flex-shrink-0 mt-1 text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-400">
                    {t("register.info.discordRequirement")}
                  </p>
                  <p className="text-xs">
                    {t("register.info.discordRequirementNote")}
                  </p>
                </div>
              </div>
              {/* ── Profile requirements (owner 2026-06-12: "let there be a way for people to
                  know where to upload their esports picture or uid") ── shown BEFORE the user
                  walks into the backend gates, with links to the exact upload pages: esport
                  image + Free Fire UID live on /profile/edit, the team logo on the team's edit
                  page. Only rendered when the event creator turned the criteria on. */}
              {(eventDetails.require_esport_images ||
                eventDetails.require_team_logo) && (
                <div className="flex items-start space-x-2 text-sm">
                  <AlertTriangle className="size-4 flex-shrink-0 mt-1 text-yellow-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-yellow-400">
                      {t("register.info.profileRequirements")}
                    </p>
                    {eventDetails.require_esport_images && (
                      <p className="text-xs">
                        {t.rich("register.info.esportImageNote", {
                          playerWord:
                            eventDetails.participant_type === "solo"
                              ? t("register.info.esportPlayerSolo")
                              : t("register.info.esportPlayerTeam"),
                          editProfileLink: (chunks) => (
                            <Link
                              href="/profile/edit"
                              className="text-primary underline underline-offset-2"
                            >
                              {chunks}
                            </Link>
                          ),
                        })}
                      </p>
                    )}
                    {eventDetails.require_team_logo && (
                      <p className="text-xs">
                        {userTeam?.team_id
                          ? t.rich("register.info.teamLogoNoteWithLink", {
                              teamEditLink: (chunks) => (
                                <Link
                                  href={`/teams/${userTeam.team_id}/edit`}
                                  className="text-primary underline underline-offset-2"
                                >
                                  {chunks}
                                </Link>
                              ),
                            })
                          : t("register.info.teamLogoNote")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setModalStep("TYPE")}
                >
                  {t("common.back")}
                </Button>
                <Button onClick={handleGoToRules}>
                  {t("register.info.continue")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </>
        );

      case "UID_PROMPT":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.uidPrompt.title")}
                <InfoTip id="tournaments.register.afc_uid" />
              </DialogTitle>
              <DialogDescription>
                {t("register.uidPrompt.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("register.uidPrompt.notSet")}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="uid-input">
                  {t("register.uidPrompt.label")}
                </Label>
                <Input
                  id="uid-input"
                  placeholder={t("register.uidPrompt.placeholder")}
                  value={uidInput}
                  maxLength={12}
                  onChange={(e) => setUidInput(e.target.value)}
                  disabled={savingUid}
                />
              </div>
            </div>
            <DialogFooter className="flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() =>
                  regType === "team"
                    ? setModalStep("CLOSED")
                    : setModalStep("INFO")
                }
                disabled={savingUid}
              >
                {t("common.back")}
              </Button>
              <Button
                onClick={handleSaveUid}
                disabled={!uidInput.trim() || savingUid}
              >
                {savingUid && (
                  <IconLoader2 className="size-4 animate-spin mr-2" />
                )}
                {savingUid
                  ? t("register.uidPrompt.saving")
                  : t("register.uidPrompt.saveContinue")}
              </Button>
            </DialogFooter>
          </>
        );

      case "UID_MISSING_MEMBERS": {
        const lastMember = uidMissingMembers[uidMissingMembers.length - 1];
        const otherMembers = uidMissingMembers.slice(0, -1);
        // Name list (e.g. "A, B and C" / "C"). The localized " and " joiner is
        // pulled from the message file so other locales can adjust it.
        const nameList =
          otherMembers.length > 0
            ? `${otherMembers.join(", ")}${t(
                "register.uidMissingMembers.andJoiner",
              )}${lastMember}`
            : lastMember;
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.uidMissingMembers.title")}
              </DialogTitle>
              <DialogDescription>
                {t("register.uidMissingMembers.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                {uidMissingMembers.length === 1
                  ? t.rich("register.uidMissingMembers.bodySingular", {
                      names: nameList,
                      bold: (chunks) => (
                        <span className="font-semibold">{chunks}</span>
                      ),
                    })
                  : t.rich("register.uidMissingMembers.bodyPlural", {
                      names: nameList,
                      bold: (chunks) => (
                        <span className="font-semibold">{chunks}</span>
                      ),
                    })}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setModalStep("CLOSED")}>
                {t("register.uidMissingMembers.close")}
              </Button>
            </DialogFooter>
          </>
        );
      }

      case "TYPE":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.type.title")}
                <InfoTip id="tournaments.register.type._section" />
              </DialogTitle>
              <DialogDescription>
                {t("register.type.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Card
                onClick={() => !isSoloDisabled && handleSelectType("solo")}
                className={`cursor-pointer transition ${
                  isSoloDisabled
                    ? "bg-white text-primary border-white opacity-50"
                    : "bg-white hover:bg-white/90"
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center text-primary">
                    <User className="size-4 mr-1" />
                    {t("register.type.soloTitle")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t("register.type.soloDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card
                onClick={() => !isTeamDisabled && handleSelectType("team")}
                className={`cursor-pointer transition ${
                  isTeamDisabled
                    ? "bg-white text-primary border-white opacity-50"
                    : "bg-white hover:bg-white/90"
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center text-primary">
                    <Users className="size-4 mr-1" />
                    {t("register.type.teamTitle")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t("register.type.teamDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
            {/* ── Draft resume (owner 2026-06-13) ── subtle start-over affordance,
                only when a saved draft was restored this visit. Clears the
                localStorage draft AND the in-memory flow state (onClearDraft =
                EventDetailsWrapper.clearRegistrationDraft). */}
            {hasResumableDraft && onClearDraft && (
              <button
                type="button"
                onClick={onClearDraft}
                className="mx-auto mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive transition"
              >
                {t("register.type.clearDraft")}
              </button>
            )}
          </>
        );

      case "RULES":
        const textRules = eventDetails.event_rules;
        const documentUrl = (eventDetails as any).uploaded_rules_url;
        const hasDocument = documentUrl && documentUrl.startsWith("http");
        const hasTextRules = !!textRules;

        const renderRulesContent = () => {
          if (hasTextRules) {
            return (
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-primary">
                    {t("register.rules.generalRules")}
                  </p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {textRules}
                  </p>
                </div>
                {hasDocument && (
                  <div className="pt-2">
                    <p className="font-medium text-primary">
                      {t("register.rules.fullRulesDocument")}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm text-yellow-400 hover:text-yellow-300"
                      onClick={() => window.open(documentUrl, "_blank")}
                    >
                      {t("register.rules.downloadOfficialDoc")}
                    </Button>
                  </div>
                )}
              </div>
            );
          }

          if (hasDocument) {
            return (
              <div className="text-center space-y-4 pt-4">
                <AlertTriangle className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-primary">
                  {t("register.rules.officialDocAvailable")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("register.rules.officialDocNote")}
                </p>
                <Button
                  type="button"
                  onClick={() => window.open(documentUrl, "_blank")}
                  className="w-full"
                >
                  {t("register.rules.downloadDoc")}
                </Button>
              </div>
            );
          }

          return (
            <div className="text-center p-4">
              <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="font-semibold text-yellow-400">
                {t("register.rules.rulesMissing")}
              </p>
              <p className="text-xs">{t("register.rules.rulesMissingNote")}</p>
            </div>
          );
        };

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.rules.title")}
                <InfoTip id="tournaments.register.rules._section" />
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-80 p-4 bg-primary/10 rounded-md overflow-y-auto pr-4 space-y-4 text-sm text-gray-300">
              {renderRulesContent()}
              <Separator className="my-4 bg-gray-700" />
              <div>
                <p className="font-medium text-primary">
                  {t("register.rules.conductPolicy")}
                </p>
                <p className="text-muted-foreground">
                  {t("register.rules.conductPolicyNote")}
                </p>
              </div>
              <div>
                <p className="font-medium text-primary">
                  {t("register.rules.devicePolicy")}
                </p>
                <p className="text-muted-foreground">
                  {t("register.rules.devicePolicyNote")}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="rules"
                checked={rulesAccepted}
                onCheckedChange={(checked) => setRulesAccepted(!!checked)}
                className="w-4 h-4 rounded border-gray-500 data-[state=checked]:bg-primary data-[state=checked]:text-black"
              />
              <label
                htmlFor="rules"
                className="text-sm font-medium text-muted-foreground"
              >
                {t("register.rules.agree")}
              </label>
              <InfoTip id="tournaments.register.rules_accept" />
            </div>
            <DialogFooter className="mt-2 flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("INFO")}>
                {t("common.back")}
              </Button>
              <Button
                onClick={handleRulesContinue} // ← plain call; useEffect above handles the fetch
                disabled={!rulesAccepted}
              >
                {eventDetails.is_sponsored || hasEntitySponsorships
                  ? t("register.rules.continue")
                  : t("register.rules.continueToDiscord")}
              </Button>
            </DialogFooter>
          </>
        );

      case "SPONSOR": {
        // ── NEW PATH (sponsor redesign P3): entity sponsorships w/ engagements ──
        // When sponsors/for-event/ returned rows for this event, render the
        // per-sponsorship engagement form (SponsorEngagementForm.tsx) instead of
        // the legacy single sponsor-ID inputs below. Solo: one form. Squad: the
        // form repeats per ROSTERED player (collapsible, mirroring the legacy
        // per-member inputs) - the server requires EVERY engagement of EVERY
        // sponsorship answered by EVERY rostered player. Continue stays disabled
        // until all answers validate and no collect_id value repeats across the
        // roster. The answers feed buildRegistrationPayload's `sponsorships` key.
        if (hasEntitySponsorships) {
          const engTeamMembers = eventDetails.selectedTeamMembers || [];
          const isTeamEngagement =
            regType === "team" && engTeamMembers.length > 0;
          const engNextStep =
            regType === "team" ? "DISCORD_STATUS" : "DISCORD_LINK";

          // ── collect_id duplicate check across the roster (squad only) ──
          // Keys: "<user_id>|<sponsorship_id>|<engagement_index>" (both sides
          // of a clash are flagged, same UX as the legacy duplicate check).
          const engDuplicateKeys = isTeamEngagement
            ? findCollectIdDuplicates(
                eventSponsorships,
                teamEngagementAnswers,
                engTeamMembers.map((m) => m.id),
              )
            : new Set<string>();
          // Narrow the global duplicate set to one player's
          // "<sponsorship_id>|<engagement_index>" keys for the form's inline errors.
          const duplicateKeysFor = (memberId: string): Set<string> => {
            const out = new Set<string>();
            engDuplicateKeys.forEach((k) => {
              if (k.startsWith(`${memberId}|`))
                out.add(k.slice(memberId.length + 1));
            });
            return out;
          };

          // ── Continue gate: every engagement answered by every player ──
          const allEngagementsComplete = isTeamEngagement
            ? engTeamMembers.every(
                (m) =>
                  countIncompleteEngagements(
                    eventSponsorships,
                    teamEngagementAnswers[m.id],
                  ) === 0,
              )
            : eventSponsorships.every((s) =>
                s.engagements.every((eng, idx) =>
                  isEngagementAnswerComplete(
                    eng,
                    soloEngagementAnswers[s.sponsorship_id]?.[idx],
                  ),
                ),
              );
          const canContinueEngagements =
            allEngagementsComplete && engDuplicateKeys.size === 0;

          return (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {t("register.sponsor.title")}
                  <InfoTip id="tournaments.register.sponsor._section" />
                </DialogTitle>
                <DialogDescription>
                  {isTeamEngagement
                    ? t("register.sponsor.descriptionTeam")
                    : t("register.sponsor.descriptionSolo")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {/* Roster-wide duplicate banner, mirroring the legacy copy. */}
                {engDuplicateKeys.size > 0 && (
                  <p className="text-sm text-destructive">
                    {t("register.sponsor.duplicateBanner")}
                  </p>
                )}

                {isTeamEngagement ? (
                  // ── SQUAD: one collapsible engagement form per rostered player ──
                  engTeamMembers.map((member, i) => {
                    const memberDuplicates = duplicateKeysFor(member.id);
                    return (
                      <SponsorEngagementPlayerSection
                        key={member.id}
                        username={member.username}
                        remaining={countIncompleteEngagements(
                          eventSponsorships,
                          teamEngagementAnswers[member.id],
                        )}
                        hasDuplicate={memberDuplicates.size > 0}
                        defaultOpen={i === 0}
                      >
                        <SponsorEngagementForm
                          sponsorships={eventSponsorships}
                          answers={teamEngagementAnswers[member.id] ?? {}}
                          onAnswerChange={(sid, idx, patch) =>
                            setTeamEngagementAnswers((prev) => ({
                              ...prev,
                              [member.id]: patchEngagementAnswer(
                                prev[member.id] ?? {},
                                sid,
                                idx,
                                patch,
                              ),
                            }))
                          }
                          duplicateKeys={memberDuplicates}
                          idPrefix={`m${member.id}`}
                          // join_group(discord) auto-verify: this member's
                          // roster-discord-status row + the shared re-check.
                          discordStatus={
                            rosterDiscordStatus[String(member.id)] ?? null
                          }
                          discordChecking={isCheckingRosterDiscord}
                          onRecheckDiscord={onRecheckRosterDiscord}
                        />
                      </SponsorEngagementPlayerSection>
                    );
                  })
                ) : (
                  // ── SOLO: a single engagement form for the registrant ──
                  <SponsorEngagementForm
                    sponsorships={eventSponsorships}
                    answers={soloEngagementAnswers}
                    onAnswerChange={(sid, idx, patch) =>
                      setSoloEngagementAnswers((prev) =>
                        patchEngagementAnswer(prev, sid, idx, patch),
                      )
                    }
                    idPrefix="solo"
                    // join_group(discord) auto-verify: the registrant's own row.
                    discordStatus={
                      currentUserId
                        ? (rosterDiscordStatus[currentUserId] ?? null)
                        : null
                    }
                    discordChecking={isCheckingRosterDiscord}
                    onRecheckDiscord={onRecheckRosterDiscord}
                  />
                )}
              </div>

              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setModalStep("RULES")}
                >
                  {t("common.back")}
                </Button>
                {/* Same routing as the legacy step: Discord next when required,
                    otherwise straight into handleJoinedServer (register / pay). */}
                <Button
                  onClick={() =>
                    DISCORD_REQUIRED
                      ? setModalStep(engNextStep)
                      : handleJoinedServer()
                  }
                  disabled={!canContinueEngagements || pendingJoined}
                >
                  {pendingJoined ? (
                    <Loader text={t("common.submitting")} />
                  ) : (
                    t("register.sponsor.continue")
                  )}
                </Button>
              </DialogFooter>
            </>
          );
        }

        // ── LEGACY PATH below: unchanged single sponsor-ID step for events
        // with no entity sponsorships (is_sponsored flag + sponsor_field_label). ──
        // const teamMembers = eventDetails.selectedTeamMembers || [];
        // const isTeamSponsor = regType === "team" && teamMembers.length > 0;
        // const nextStep = regType === "team" ? "DISCORD_STATUS" : "DISCORD_LINK";

        // // Detect duplicate sponsor values across team members
        // const seenValues = new Set<string>();
        // const duplicateMemberIds = new Set<string>();
        // teamMembers.forEach((m) => {
        //   const val = (teamSponsorUuids[m.id] || "").trim();
        //   if (val !== "") {
        //     if (seenValues.has(val)) {
        //       // Mark all members with this value as duplicates
        //       teamMembers.forEach((other) => {
        //         if ((teamSponsorUuids[other.id] || "").trim() === val) {
        //           duplicateMemberIds.add(other.id);
        //         }
        //       });
        //     } else {
        //       seenValues.add(val);
        //     }
        //   }
        // });
        // const hasDuplicates = duplicateMemberIds.size > 0;

        // const canContinueSponsor = isTeamSponsor
        //   ? teamMembers.every(
        //       (m) => (teamSponsorUuids[m.id] || "").trim() !== "",
        //     ) && !hasDuplicates
        //   : soloSponsorUuid.trim() !== "";

        const teamMembers = eventDetails.selectedTeamMembers || [];
        const isTeamSponsor = regType === "team" && teamMembers.length > 0;
        const nextStep = regType === "team" ? "DISCORD_STATUS" : "DISCORD_LINK";

        // ── Within-team duplicate detection ──────────────────────────────────
        const seenValues = new Set<string>();
        const duplicateMemberIds = new Set<string>();
        if (isTeamSponsor) {
          teamMembers.forEach((m) => {
            const val = (teamSponsorUuids[m.id] || "").trim();
            if (val !== "") {
              if (seenValues.has(val)) {
                teamMembers.forEach((other) => {
                  if ((teamSponsorUuids[other.id] || "").trim() === val) {
                    duplicateMemberIds.add(other.id);
                  }
                });
              } else {
                seenValues.add(val);
              }
            }
          });
        }
        const hasDuplicates = duplicateMemberIds.size > 0;

        // ── Cross-event duplicate detection ──────────────────────────────────
        // Returns the username of whoever already registered with that sponsor ID,
        // or null if it's unused / belongs to the current solo user.
        const getSoloExternalConflict = (): string | null => {
          if (!soloSponsorUuid.trim() || allRegisteredSponsorIds.size === 0)
            return null;
          const owner = allRegisteredSponsorIds.get(soloSponsorUuid.trim());
          return owner || null; // for solo we never exclude - they don't have a prior entry
        };

        const getTeamMemberExternalConflict = (
          memberId: string,
        ): string | null => {
          if (allRegisteredSponsorIds.size === 0) return null;
          const val = (teamSponsorUuids[memberId] || "").trim();
          if (!val) return null;
          const owner = allRegisteredSponsorIds.get(val);
          if (!owner) return null;
          const thisMember = teamMembers.find((m) => m.id === memberId);
          // If the owner IS this member they were previously registered (solo re-register edge case)
          if (thisMember && owner === thisMember.username) return null;
          return owner;
        };

        const anyTeamExternalConflict =
          isTeamSponsor &&
          teamMembers.some((m) => getTeamMemberExternalConflict(m.id) !== null);

        const soloExternalConflict = !isTeamSponsor
          ? getSoloExternalConflict()
          : null;

        const canContinueSponsor = isTeamSponsor
          ? teamMembers.every(
              (m) => (teamSponsorUuids[m.id] || "").trim() !== "",
            ) &&
            !hasDuplicates &&
            !anyTeamExternalConflict
          : soloSponsorUuid.trim() !== "" && !soloExternalConflict;

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.sponsor.legacyTitle", {
                  sponsorName: eventDetails.sponsor_name ?? "",
                })}
                <InfoTip id="tournaments.register.sponsor._section" />
              </DialogTitle>
              <DialogDescription>
                {t("register.sponsor.legacyDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 rounded-md bg-primary/10 text-sm text-muted-foreground">
                {eventDetails.sponsor_requirement_description}
              </div>

              {isFetchingAllSponsors && (
                <div className="p-3 rounded-md bg-primary/10 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader text={t("register.sponsor.legacyValidating")} />
                </div>
              )}

              {isTeamSponsor ? (
                <div className="space-y-3">
                  {(hasDuplicates || anyTeamExternalConflict) && (
                    <p className="text-sm text-destructive">
                      {t("register.sponsor.legacyUniqueRequired", {
                        fieldLabel: eventDetails.sponsor_field_label ?? "",
                      })}
                    </p>
                  )}
                  {teamMembers.map((member) => {
                    const isTeamDuplicate = duplicateMemberIds.has(member.id);
                    const externalConflictUser = getTeamMemberExternalConflict(
                      member.id,
                    );
                    const hasError = isTeamDuplicate || !!externalConflictUser;
                    return (
                      <div key={member?.id} className="space-y-1">
                        <label className="text-sm font-medium">
                          {member?.username}
                        </label>
                        <Input
                          className={
                            hasError
                              ? "border-destructive focus-visible:ring-destructive"
                              : "border-input"
                          }
                          placeholder={t(
                            "register.sponsor.legacyPlaceholderTeam",
                            {
                              fieldLabel:
                                eventDetails.sponsor_field_label ?? "",
                            },
                          )}
                          value={teamSponsorUuids[member.id] || ""}
                          onChange={(e) =>
                            setTeamSponsorUuids({
                              ...teamSponsorUuids,
                              [member.id]: e.target.value,
                            })
                          }
                        />
                        {isTeamDuplicate && (
                          <p className="text-xs text-destructive">
                            {t("register.sponsor.legacyDuplicateMember")}
                          </p>
                        )}
                        {!isTeamDuplicate && externalConflictUser && (
                          <p className="text-xs text-destructive">
                            {t("register.sponsor.legacyExternalConflict", {
                              fieldLabel: eventDetails.sponsor_field_label ?? "",
                            })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {eventDetails.sponsor_field_label}
                  </label>
                  <input
                    className={`flex h-9 w-full rounded-md border ${soloExternalConflict ? "border-destructive focus-visible:ring-destructive" : "border-input"} bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
                    placeholder={t("register.sponsor.legacyPlaceholderSolo", {
                      fieldLabel: eventDetails.sponsor_field_label ?? "",
                    })}
                    value={soloSponsorUuid}
                    onChange={(e) => setSoloSponsorUuid(e.target.value)}
                  />
                  {soloExternalConflict && (
                    <p className="text-xs text-destructive">
                      {t.rich("register.sponsor.legacySoloConflict", {
                        fieldLabel: eventDetails.sponsor_field_label ?? "",
                        owner: soloExternalConflict,
                        bold: (chunks) => (
                          <span className="font-semibold">{chunks}</span>
                        ),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("RULES")}>
                {t("common.back")}
              </Button>
              <Button
                onClick={() =>
                  DISCORD_REQUIRED
                    ? setModalStep(nextStep)
                    : handleJoinedServer()
                }
                disabled={!canContinueSponsor || isFetchingAllSponsors}
              >
                {t("register.sponsor.continue")}
              </Button>
            </DialogFooter>
          </>
        );
      }

      case "DISCORD_LINK":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.discordLink.title")}
                <InfoTip id="tournaments.register.discord_link._section" />
              </DialogTitle>
              <DialogDescription>
                {t("register.discordLink.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="text-center p-4 bg-primary/10 rounded-lg space-y-4">
              {isCheckingUserDiscord ? (
                <div className="space-y-4">
                  <Loader text={t("register.discordLink.checking")} />
                </div>
              ) : isDiscordConnected ? (
                <div className="space-y-4">
                  <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                  <p className="font-semibold text-primary">
                    {t("register.discordLink.connected")}
                  </p>
                  <p className="text-sm text-gray-300">
                    {t("register.discordLink.connectedNote")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
                  <p className="text-sm text-gray-300">
                    {t("register.discordLink.connectPrompt")}
                  </p>
                  <Button onClick={handleDiscordConnect} className="w-full">
                    {t("register.discordLink.connectButton")}
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter className="flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("RULES")}>
                {t("common.back")}
              </Button>
              <Button
                onClick={() => setModalStep("DISCORD_JOIN")}
                disabled={!isDiscordConnected || isCheckingUserDiscord}
              >
                {t("register.discordLink.continueToFinal")}
              </Button>
            </DialogFooter>
          </>
        );

      case "DISCORD_JOIN":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.discordJoin.title")}
                <InfoTip id="tournaments.register.discord_join._section" />
              </DialogTitle>
              <DialogDescription>
                {t("register.discordJoin.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="text-center p-4 bg-primary/10 rounded-lg space-y-4">
              {isCheckingUserDiscord ? (
                <div className="space-y-4">
                  <Loader text={t("register.discordJoin.checkingMembership")} />
                </div>
              ) : isInAfcServer ? (
                <div className="space-y-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                  <p className="font-semibold text-green-500">
                    {t("register.discordJoin.alreadyIn")}
                  </p>
                  <p className="text-sm text-gray-300">
                    {t("register.discordJoin.alreadyInNote")}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("register.discordJoin.joinPrompt")}
                  </p>
                  <Button
                    onClick={() =>
                      window.open(
                        AFC_DISCORD_SERVER,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    disabled={pendingJoined}
                    className="w-full bg-indigo-600 hover:bg-indigo-500"
                  >
                    {t("register.discordJoin.joinButton")}
                  </Button>
                </>
              )}
            </div>
            <DialogFooter className="mt-4 flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setModalStep("DISCORD_LINK")}
              >
                {t("common.back")}
              </Button>
              {isInAfcServer ? (
                <Button
                  onClick={handleJoinedServer}
                  disabled={pendingJoined}
                  className="bg-green-600 hover:bg-green-500"
                >
                  {pendingJoined ? (
                    <Loader text={t("common.completing")} />
                  ) : (
                    t("register.discordJoin.completeRegistration")
                  )}
                </Button>
              ) : (
                <Button
                  onClick={checkUserDiscordStatus}
                  disabled={isCheckingUserDiscord}
                  className="bg-green-600 hover:bg-green-500"
                >
                  {isCheckingUserDiscord ? (
                    <Loader text={t("common.checking")} />
                  ) : (
                    t("register.discordJoin.joinedServer")
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        );

      case "DISCORD_STATUS":
        const validationResults = eventDetails.validationResults || [];
        const allMembersOk =
          validationResults.length > 0 &&
          validationResults.every((r: any) => r.ok);

        // Check if all members are in AFC server
        const selectedMembersData = eventDetails.selectedTeamMembers || [];
        const allInAfcServer = selectedMembersData.every(
          (member) =>
            member.discord_id &&
            teamAfcServerStatus?.[member.discord_id] === true, // ✅ FIX: Check explicitly
        );

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.discordStatus.title")}
                <InfoTip id="tournaments.register.discord_status._section" />
              </DialogTitle>
              <DialogDescription>
                {t("register.discordStatus.description")}
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-md">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">
                    {t("register.discordStatus.membersStatus")}
                  </h3>
                  <div className="space-y-2">
                    {validationResults.map((result: any) => {
                      const hasIssues = !result.ok;
                      const reasons = result.reasons || [];
                      const inAfcServer =
                        result.discord_id &&
                        teamAfcServerStatus?.[result.discord_id] === true;

                      return (
                        <div
                          key={result.user_id}
                          className={`p-3 rounded-md border transition-all ${
                            result.ok && inAfcServer
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-red-500/50 bg-red-500/10"
                          }`}
                        >
                          <div className="flex items-start text-sm justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              {result.ok && inAfcServer ? (
                                <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <span
                                  className={`font-medium ${
                                    result.ok && inAfcServer
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {result.username}
                                </span>
                                {hasIssues && reasons.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {reasons.map(
                                      (reason: string, idx: number) => (
                                        <p
                                          key={idx}
                                          className="text-xs text-red-300"
                                        >
                                          • {reason.replace(/_/g, " ")}
                                        </p>
                                      ),
                                    )}
                                  </div>
                                )}
                                {result.ok && !inAfcServer && (
                                  <p className="text-xs text-red-300 mt-1">
                                    • {t("register.discordStatus.notInServer")}
                                  </p>
                                )}
                                {result.discord_connected &&
                                  result.discord_id && (
                                    <>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {t("register.discordStatus.discordId", {
                                          id: result.discord_id,
                                        })}
                                      </p>
                                      {inAfcServer && (
                                        <p className="text-xs text-green-400 mt-1">
                                          ✓ {t("register.discordStatus.inAfcServer")}
                                        </p>
                                      )}
                                    </>
                                  )}
                              </div>
                            </div>
                            {result.ok && inAfcServer ? (
                              <CheckCircle className="size-5 text-green-400 flex-shrink-0" />
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={copyAfcServerLink}
                              >
                                {t("register.discordStatus.copyLink")}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isCheckingDiscord && (
                  <div className="p-3 bg-blue-600 border border-blue-600/50 rounded-md">
                    <p className="text-sm text-blue-100 text-center">
                      {t("register.discordStatus.checkingStatus")}
                    </p>
                  </div>
                )}

                {!allMembersOk &&
                  !isCheckingDiscord &&
                  validationResults.length > 0 && (
                    <div className="p-3 bg-yellow-600 border border-yellow-600/50 rounded-md">
                      <p className="text-sm text-yellow-100 text-center">
                        {t("register.discordStatus.waiting")}
                      </p>
                    </div>
                  )}

                {allMembersOk && !allInAfcServer && (
                  <div className="p-3 bg-orange-600 border border-orange-600/50 rounded-md">
                    <p className="text-sm text-orange-100 text-center">
                      {t("register.discordStatus.someNotJoined")}
                    </p>
                  </div>
                )}

                {allMembersOk && allInAfcServer && (
                  <div className="p-3 bg-green-600 border border-green-600/50 rounded-md">
                    <p className="text-sm text-green-100 text-center font-medium">
                      {t("register.discordStatus.allReady")}
                    </p>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCheckDiscordStatus}
                    disabled={isCheckingDiscord}
                    className="text-xs"
                  >
                    {isCheckingDiscord ? (
                      <IconRefresh className="mr-1 size-3 animate-spin" />
                    ) : (
                      <IconRefresh className="mr-1 size-3" />
                    )}
                    {isCheckingDiscord
                      ? t("register.discordStatus.checking")
                      : t("register.discordStatus.refreshStatus")}
                  </Button>
                </div>
              </div>
              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setModalStep("RULES")}
                >
                  {t("common.back")}
                </Button>
                {allMembersOk && allInAfcServer && (
                  <Button onClick={handleJoinedServer} disabled={pendingJoined}>
                    {pendingJoined ? (
                      <Loader text={t("common.completing")} />
                    ) : (
                      t("register.discordStatus.completeRegistration")
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </>
        );

      case "PAYMENT": {
        // Final step for a PAID event. Everything else (roster, sponsor, invite) is already
        // collected; here the user reviews the entry fee and pays via Stripe. The "Pay" button
        // saves the register payload to localStorage and redirects to checkout_url; the success
        // page verifies the payment and completes the actual registration.
        const fee = eventDetails.registration_fee;
        const currency = eventDetails.registration_fee_currency || "USD";
        const feeLabel =
          typeof fee === "number"
            ? `${currency} ${fee.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : `${currency} 0.00`;
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("register.payment.title")}
              </DialogTitle>
              <DialogDescription>
                {t("register.payment.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between rounded-md bg-primary/10 p-4">
                <span className="text-sm text-muted-foreground">
                  {t("register.payment.entryFee")}
                </span>
                <span className="text-lg font-bold text-primary">
                  {feeLabel}
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="size-4 flex-shrink-0 mt-0.5 text-yellow-400" />
                <p className="text-xs text-muted-foreground">
                  {t("register.payment.note")}
                </p>
              </div>
            </div>
            <DialogFooter className="flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setModalStep("RULES")}
                disabled={pendingJoined}
              >
                {t("common.back")}
              </Button>
              <Button onClick={startPaidRegistration} disabled={pendingJoined}>
                {pendingJoined ? (
                  <Loader text={t("register.payment.startingCheckout")} />
                ) : (
                  t("register.payment.payToRegister", { fee: feeLabel })
                )}
              </Button>
            </DialogFooter>
          </>
        );
      }

      case "SUCCESS":
        return (
          <>
            <div className="text-center px-4 py-8 bg-primary/10 rounded-lg space-y-2">
              <DialogHeader className="text-center">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-2" />
              </DialogHeader>
              <p className="text-sm font-semibold">
                {/* Order matters: waitlist > sponsor approval > plain success.
                    pendingSponsorApproval comes from register-for-event/'s
                    pending_sponsor_approval flag (a requires_approval sponsor
                    must vet the engagement submissions first). */}
                {wasWaitlisted
                  ? t("register.success.waitlist")
                  : pendingSponsorApproval
                    ? t("register.success.pendingApproval")
                    : t("register.success.registered")}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={closeAll} className="w-full">
                {t("register.success.close")}
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  if (modalStep === "CLOSED") return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && closeAll()}>
      <DialogContent className="flex flex-col max-h-[85vh] overflow-y-auto">
        {renderDialog()}
      </DialogContent>
    </Dialog>
  );
};

export const EventDetailsWrapper = ({ slug }: { slug: string }) => {
  const t = useTranslations("tournaments");
  const { token, user, login, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();

  const requireAuth = (action: () => void) => {
    if (!token) {
      openAuthModal({ defaultTab: "login", onSuccess: action });
      return;
    }
    action();
  };
  const searchParams = useSearchParams();

  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<string>("");
  // Results ⇄ Structure view toggle for the main stage area (default Results = existing behavior).
  const [mainView, setMainView] = useState<"results" | "structure">("results");
  const [modalStep, setModalStep] = useState<ModalStep>("CLOSED");
  // M: remember whether the last registration was routed to the waitlist so the
  // success step shows accurate copy instead of "Welcome to the tournament!".
  const [wasWaitlisted, setWasWaitlisted] = useState(false);
  const [regType, setRegType] = useState<RegistrationType | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [pendingJoined, startJoinedTransition] = useTransition();
  const [isInAfcServer, setIsInAfcServer] = useState(false);

  // Team registration states
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamModalStep, setTeamModalStep] = useState<TeamModalStep>("CLOSED");
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [selectedTeamMembersData, setSelectedTeamMembersData] = useState<
    TeamMember[]
  >([]);

  const [isCheckingDiscord, setIsCheckingDiscord] = useState(false);
  const [validationResults, setValidationResults] = useState<
    DiscordValidationResult[]
  >([]);

  // Sponsor UUID state
  const [soloSponsorUuid, setSoloSponsorUuid] = useState("");
  const [teamSponsorUuids, setTeamSponsorUuids] = useState<
    Record<string, string>
  >({});

  // ── Sponsor redesign P3/P4 state ──
  // The event's entity sponsorships (sponsors/for-event/). Non-empty switches the
  // SPONSOR modal step to the engagement form AND the register payload to the
  // `sponsorships` key; empty keeps the full legacy path. Fetched once below.
  const [eventSponsorships, setEventSponsorships] = useState<
    EventSponsorshipRow[]
  >([]);
  // Engagement answer drafts (see SponsorEngagementForm.tsx for the draft keys).
  // Solo: [sponsorship_id][engagement_index] -> draft payload object.
  const [soloEngagementAnswers, setSoloEngagementAnswers] =
    useState<EngagementAnswers>({});
  // Squad: the same nesting per rostered player: [user_id][sponsorship_id][engagement_index].
  const [teamEngagementAnswers, setTeamEngagementAnswers] = useState<
    Record<string, EngagementAnswers>
  >({});
  // register-for-event/ returns pending_sponsor_approval when a requires_approval
  // sponsor must vet the submissions; flips the SUCCESS step copy.
  const [pendingSponsorApproval, setPendingSponsorApproval] = useState(false);

  // Invite token state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [hasValidInvite, setHasValidInvite] = useState<boolean>(false);

  const [isCheckingInvite, setIsCheckingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    is_used: boolean;
    used_by: string | null;
    used_at: string | null;
    // is_shared marks the reusable first-come-first-serve link: it stays valid even when
    // is_used is true. is_expired mirrors the backend expiry gate so we block expired links.
    is_shared?: boolean;
    is_expired?: boolean;
  } | null>(null);

  // Ban state
  const [isUserBanned, setIsUserBanned] = useState(false);
  const [showBannedModal, setShowBannedModal] = useState(false);
  // Team-event registration gate popups (owner 2026-06-21): shown when a non-privileged
  // user clicks Register on a team event (no team / wrong role). See handleRegisterClick.
  const [showNoTeamModal, setShowNoTeamModal] = useState(false);
  const [showRoleDeniedModal, setShowRoleDeniedModal] = useState(false);

  // User Discord state
  const [userDiscordId, setUserDiscordId] = useState<string | null>(null);
  const [isCheckingUserDiscord, setIsCheckingUserDiscord] = useState(false);

  // Roster rejection state
  const [pageRoster, setPageRoster] = useState<RosterMember[]>([]);

  const [teamAfcServerStatus, setTeamAfcServerStatus] = useState<
    Record<string, boolean>
  >({});

  // ── Roster Discord auto-verification (owner 2026-06-13) ──
  // Per-player rows from POST events/roster-discord-status/ keyed String(user_id).
  // Filled by checkRosterDiscordStatus when the SPONSOR step opens (and on every
  // "Re-check"); read by the SponsorEngagementForm discord join_group panels.
  const [rosterDiscordStatus, setRosterDiscordStatus] = useState<
    Record<string, RosterDiscordStatus>
  >({});
  const [isCheckingRosterDiscord, setIsCheckingRosterDiscord] = useState(false);

  // The logged-in registrant's id as a string - the key used everywhere user ids
  // are map keys (selectedMembers / answers / rosterDiscordStatus).
  const currentUserId = user?.user_id != null ? String(user.user_id) : null;

  // ── Registration draft resume (owner 2026-06-13) ──
  // draftRef holds the last saved/restored draft; the persist effect below keeps
  // localStorage (afc_reg_draft_<event_id>) in sync. hydrated = restore attempted
  // (writes allowed only after); restored guards the one-shot restore.
  const regDraftKey = eventDetails?.event_id
    ? `${REG_DRAFT_KEY_PREFIX}${eventDetails.event_id}`
    : null;
  const draftRef = useRef<RegistrationDraft | null>(null);
  const draftHydratedRef = useRef(false);
  const draftRestoredRef = useRef(false);
  // True once a draft was restored this visit: shows the TYPE step's clear button.
  const [hasResumableDraft, setHasResumableDraft] = useState(false);

  // UID prompt state
  const [uidInput, setUidInput] = useState("");
  const [savingUid, setSavingUid] = useState(false);
  const [uidMissingMembers, setUidMissingMembers] = useState<string[]>([]);

  // Ref to allow handleRulesContinue to call handleJoinedServer without circular deps
  const handleJoinedServerRef = useRef<() => void>(() => {});

  const checkUserDiscordStatus = useCallback(async () => {
    if (!token) {
      return false;
    }

    setIsCheckingUserDiscord(true);
    try {
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/is-discord-account-connected/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // Check if user has Discord connected
      const isConnected = response.data?.connected || false;
      setDiscordConnected(isConnected);

      // If connected, also check if they're in AFC server
      if (isConnected && userDiscordId) {
        const serverCheckResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/check-discord-membership-v2/`,
          {
            discord_id: userDiscordId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const inServer = serverCheckResponse.data?.is_member || false;
        setIsInAfcServer(inServer);
      }

      return isConnected;
    } catch (err: any) {
      console.error("Error checking Discord status:", err);
      setDiscordConnected(false);
      setIsInAfcServer(false);
      return false;
    } finally {
      setIsCheckingUserDiscord(false);
    }
  }, [userDiscordId, token]);

  // Check invite token status
  const checkInviteTokenStatus = useCallback(
    async (token: string) => {
      setIsCheckingInvite(true);
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/check-invite-token-status/`,
          {
            invite_token: token,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        setInviteStatus({
          is_used: response.data.is_used,
          used_by: response.data.used_by,
          used_at: response.data.used_at,
          is_shared: response.data.is_shared,
          is_expired: response.data.is_expired,
        });

        // An expired link can never register anyone (matches the backend gate).
        if (response.data.is_expired) {
          toast.error(t("register.toast.expiredInvite"));
          setHasValidInvite(false);
          return false;
        }

        // A shared link is the reusable first-come-first-serve link, so is_used being
        // true does NOT block it; only a consumed single-use link is rejected here.
        if (response.data.is_used && !response.data.is_shared) {
          toast.error(t("register.toast.usedInvite"));
          setHasValidInvite(false);
          return false;
        }

        return true;
      } catch (err: any) {
        console.error("Error checking invite token:", err);
        toast.error(t("register.toast.invalidInvite"));
        setHasValidInvite(false);
        return false;
      } finally {
        setIsCheckingInvite(false);
      }
    },
    [token, t],
  );

  // Fetch user profile to get Discord ID
  const fetchUserProfile = useCallback(async () => {
    if (!token || !user?.user_id) return;

    try {
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-user-profile/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.discord_id) {
        setUserDiscordId(response.data.discord_id);
      }
      setIsUserBanned(response.data?.is_banned === true);
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
    }
  }, [token, user]);

  // Fetch user profile on mount
  useEffect(() => {
    if (token && user) {
      fetchUserProfile();
    }
  }, [fetchUserProfile, token, user]);

  // Check Discord status when entering DISCORD_LINK modal
  useEffect(() => {
    if (modalStep === "DISCORD_LINK" && userDiscordId) {
      checkUserDiscordStatus();
    }
  }, [modalStep, userDiscordId, checkUserDiscordStatus]);

  useEffect(() => {
    const invitation =
      searchParams.get("invitation") || searchParams.get("invite_token");

    if (invitation && !inviteToken) {
      setInviteToken(invitation);
      // Validate the invite token
      checkInviteTokenStatus(invitation);
    }
  }, [searchParams, inviteToken, checkInviteTokenStatus]);

  const checkTeamDiscordStatus = useCallback(async () => {
    if (!eventDetails || !userTeam || selectedMembers.length === 0) return;

    setIsCheckingDiscord(true);
    try {
      const memberIds = selectedMembers.map((id) => parseInt(id));

      // Check Discord connection for all members
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/validate-team-roster-discord/`,
        {
          event_id: eventDetails.event_id,
          team_id: parseInt(userTeam.team_id),
          roster_member_ids: memberIds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setValidationResults(response.data.results);

      // Get discord IDs of selected members
      const selectedMembersData = userTeam.members.filter((m) =>
        selectedMembers.includes(m.id),
      );

      // ✅ FIX: Filter out null/undefined AND ensure discord_id is a string
      const discordIds = selectedMembersData
        .map((m) => m.discord_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (discordIds.length > 0) {
        // Check AFC server membership
        const serverResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/check-team-members-discord-membership/`,
          {
            discord_ids: discordIds,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        setTeamAfcServerStatus(serverResponse.data.membership || {});
      }

      if (response.data.all_ok) {
        toast.success(t("register.toast.allMembersDiscord"));
      }
    } catch (err: any) {
      console.error("Error validating team Discord status:", err);
      toast.error(
        err.response?.data?.message || t("register.toast.discordValidateFailed"),
      );
    } finally {
      setIsCheckingDiscord(false);
    }
  }, [eventDetails, userTeam, selectedMembers, token, t]);

  const copyAfcServerLink = useCallback(() => {
    navigator.clipboard.writeText(AFC_DISCORD_SERVER);
    toast.success(t("register.toast.serverLinkCopied"));
  }, [t]);

  // ── Roster Discord auto-verification (owner 2026-06-13) ──────────────────────
  // Calls POST events/roster-discord-status/ (backend
  // afc_tournament_and_scrims/roster_discord.py) for the SELECTED roster (squad)
  // or just the registrant (solo), stores the per-player results, and AUTO-FILLS
  // every discord join_group engagement answer:
  //   verified player  -> {discord_username: <their Discord username or id>, verified: true}
  //   anyone else      -> {discord_username: "", verified: false}
  // isEngagementAnswerComplete (SponsorEngagementForm) gates Continue on
  // verified === true, so an unverified player blocks the SPONSOR step with the
  // exact feedback panel shown. Triggered on entering the SPONSOR step (effect
  // below) and by the per-player "Re-check" buttons.
  const checkRosterDiscordStatus = useCallback(async () => {
    if (!token) return;
    const ids =
      regType === "team" ? selectedMembers : currentUserId ? [currentUserId] : [];
    if (ids.length === 0) return;

    setIsCheckingRosterDiscord(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/roster-discord-status/`,
        { user_ids: ids.map((id) => parseInt(id, 10)) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const byId: Record<string, RosterDiscordStatus> = {};
      (res.data.results || []).forEach((r: RosterDiscordStatus) => {
        byId[String(r.user_id)] = r;
      });
      setRosterDiscordStatus(byId);

      // Every discord join_group engagement across the event's sponsorships -
      // each one gets the same auto-filled answer per player.
      const discordEngagements: Array<{ sid: number; idx: number }> = [];
      eventSponsorships.forEach((s) =>
        s.engagements.forEach((eng, idx) => {
          if (
            eng.type === "join_group" &&
            (eng.platform ?? "").toLowerCase() !== "whatsapp"
          ) {
            discordEngagements.push({ sid: s.sponsorship_id, idx });
          }
        }),
      );
      if (discordEngagements.length === 0) return;

      const patchFor = (st: RosterDiscordStatus | undefined) => {
        const verified = !!st && st.discord_connected && st.in_server === true;
        return {
          discord_username: verified
            ? st!.discord_username || st!.discord_id || ""
            : "",
          verified,
        };
      };

      if (regType === "team") {
        setTeamEngagementAnswers((prev) => {
          const next = { ...prev };
          ids.forEach((uid) => {
            const p = patchFor(byId[uid]);
            let ans = next[uid] ?? {};
            discordEngagements.forEach(({ sid, idx }) => {
              ans = patchEngagementAnswer(ans, sid, idx, p);
            });
            next[uid] = ans;
          });
          return next;
        });
      } else {
        const p = patchFor(currentUserId ? byId[currentUserId] : undefined);
        setSoloEngagementAnswers((prev) => {
          let next = prev;
          discordEngagements.forEach(({ sid, idx }) => {
            next = patchEngagementAnswer(next, sid, idx, p);
          });
          return next;
        });
      }
    } catch (err: any) {
      console.error("Error checking roster Discord status:", err);
      toast.error(
        err.response?.data?.message ||
          t("register.toast.rosterDiscordFailed"),
      );
    } finally {
      setIsCheckingRosterDiscord(false);
    }
  }, [token, regType, selectedMembers, currentUserId, eventSponsorships, t]);

  // Fire the roster Discord check the moment the SPONSOR step opens, but only
  // when a sponsorship actually asks for a discord join_group. modalStep is the
  // only dep on purpose (same idiom as the legacy fetchAllSponsorIds effect):
  // re-running on every keystroke in the answers would spam the Discord API.
  useEffect(() => {
    if (modalStep !== "SPONSOR") return;
    const needsDiscord = eventSponsorships.some((s) =>
      s.engagements.some(
        (e) =>
          e.type === "join_group" &&
          (e.platform ?? "").toLowerCase() !== "whatsapp",
      ),
    );
    if (!needsDiscord) return;
    checkRosterDiscordStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalStep]);

  useEffect(() => {
    // Fix malformed URLs where backend uses ? instead of & (e.g. ?invite_token=...?discord=connected)
    const fullQuery = window.location.search;
    const fixedQuery = fullQuery.replace(/\?/g, (_match, offset) =>
      offset === 0 ? "?" : "&",
    );
    const fixedParams = new URLSearchParams(fixedQuery);

    const discordStatus =
      searchParams.get("discord") || fixedParams.get("discord");

    const inviteFromUrl =
      searchParams.get("invitation") ||
      searchParams.get("invite_token") ||
      fixedParams.get("invitation") ||
      fixedParams.get("invite_token");

    // Clean up the invite_token value in case it has a malformed ? appended
    const cleanInvite = inviteFromUrl?.split("?")[0] || null;

    if (cleanInvite && !inviteToken) {
      setInviteToken(cleanInvite);
      setHasValidInvite(true);
    }

    if (discordStatus) {
      setModalStep("DISCORD_LINK");
      setTimeout(() => {
        if (discordStatus === "connected") {
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN");
          toast.success(t("register.toast.discordLinked"));
        } else if (discordStatus === "already_linked") {
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN");
          toast.info(t("register.toast.discordAlreadyLinked"));
        } else {
          setDiscordConnected(false);
          toast.error(
            searchParams.get("message") ||
              fixedParams.get("message") ||
              t("register.toast.discordFailed"),
          );
        }

        const newSearchParams = new URLSearchParams();
        if (cleanInvite) {
          newSearchParams.set("invitation", cleanInvite);
        }

        const newUrl = newSearchParams.toString()
          ? `${window.location.pathname}?${newSearchParams.toString()}`
          : window.location.pathname;

        router.replace(newUrl, { scroll: false });
      }, 50);
    }
  }, [searchParams, router, inviteToken, t]);

  const fetchEventDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = token
        ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`
        : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-not-logged-in/`;

      // i18n: this uses raw fetch (not the axios instance carrying the locale interceptor), so
      // forward the active locale (NEXT_LOCALE cookie) explicitly. The backend then localizes
      // event_name/event_rules (cached) for fr/pt; "en" or absent stays English.
      const locale = (typeof document !== "undefined"
        ? document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)?.[1]
        : undefined);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(locale && locale !== "en" ? { "Accept-Language": locale } : {}),
        },
        body: JSON.stringify({ slug: slug }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result: ApiResponse = await response.json();
      const details = result.event_details;

      setEventDetails(details);

      if (details?.stages?.length > 0) {
        setActiveStageTab(details.stages[0].stage_name);
      }
    } catch (err) {
      toast.error(t("detail.loadFailed"));
      setError(t("detail.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [slug, token, t]);

  // Returns the user's team (and caches it in state), or null when they are on no team
  // / the fetch fails. Returning it lets the Register click gate decide synchronously
  // (no-team -> "join a team" popup) instead of waiting on async state. No longer toasts
  // on "no team" - the click gate shows a dedicated dialog for that case now.
  const fetchUserTeam = useCallback(async (): Promise<UserTeam | null> => {
    setLoadingTeam(true);
    try {
      const resCurrent = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (resCurrent.data && resCurrent.data.team) {
        const resDetails = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: resCurrent.data.team.team_name },
        );
        setUserTeam(resDetails.data.team);
        return resDetails.data.team as UserTeam;
      }
      setUserTeam(null);
      return null;
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || t("detail.loadTeamFailed"));
      return null;
    } finally {
      setLoadingTeam(false);
    }
  }, [token, t]);

  const fetchPageRoster = useCallback(async () => {
    if (!token || !eventDetails?.event_id) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-roster-details/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPageRoster(res.data.roster || []);
    } catch {
      // silently fail - this is supplementary UI
    }
  }, [token, eventDetails?.event_id]);

  useEffect(() => {
    if (
      eventDetails?.is_registered &&
      eventDetails?.participant_type === "squad" &&
      token
    ) {
      fetchPageRoster();
    }
  }, [
    eventDetails?.is_registered,
    eventDetails?.participant_type,
    eventDetails?.event_id,
    token,
    fetchPageRoster,
  ]);

  // ── Sponsor redesign P3: fetch the event's entity sponsorships ONCE ──
  // Public endpoint (sponsors/for-event/<event_id>/), fetched as soon as the
  // event id is known so the SPONSOR step + buildRegistrationPayload + the
  // SponsorRequirementsCard gate all read the same answer. A failed fetch is
  // non-fatal: eventSponsorships stays [] and everything falls back to legacy.
  useEffect(() => {
    const eventId = eventDetails?.event_id;
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sponsorsApi.forEvent(eventId);
        if (!cancelled) setEventSponsorships(res.results || []);
      } catch {
        // Non-fatal - the registration flow simply uses the legacy sponsor path.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventDetails?.event_id]);

  // ── Registration draft resume: remove ────────────────────────────────────────
  // Drops the saved draft + the in-memory copy. Used by the SUCCESS clear, the
  // is_registered sweep, and the TYPE step's "start over" affordance.
  const removeRegDraft = useCallback(() => {
    if (regDraftKey) {
      try {
        localStorage.removeItem(regDraftKey);
      } catch {
        // localStorage can throw in private mode - nothing to clean then anyway.
      }
    }
    draftRef.current = null;
    setHasResumableDraft(false);
  }, [regDraftKey]);

  // ── Registration draft resume: RESTORE (one-shot per visit) ──────────────────
  // When the event loads for a logged-in, NOT-yet-registered user, silently put a
  // saved draft back into state. The modal is NOT auto-opened (less intrusive);
  // clicking Register resumes at the saved step (see handleRegisterClick).
  // If the user IS registered, any leftover draft is stale - this also covers the
  // paid Stripe flow, whose registration completes on /register/success: the next
  // time this page loads, is_registered is true and the draft is swept away.
  useEffect(() => {
    if (!eventDetails?.event_id || !regDraftKey) return;
    if (eventDetails.is_registered) {
      draftRestoredRef.current = true;
      draftHydratedRef.current = true;
      removeRegDraft();
      return;
    }
    if (draftRestoredRef.current) return;
    // Not logged in yet: allow persistence (inert - nothing meaningful exists
    // without a session) but hold the restore until the token arrives.
    if (!token) {
      draftHydratedRef.current = true;
      return;
    }
    draftRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(regDraftKey);
      if (raw) {
        const draft = JSON.parse(raw) as RegistrationDraft;
        if (draft && draft.v === 1) {
          // Restore every collected field silently. Each setter mirrors one
          // RegistrationDraft field (see the persist effect for the save side).
          if (draft.regType) setRegType(draft.regType);
          if (Array.isArray(draft.selectedMembers))
            setSelectedMembers(draft.selectedMembers);
          if (Array.isArray(draft.selectedTeamMembersData))
            setSelectedTeamMembersData(draft.selectedTeamMembersData);
          setRulesAccepted(!!draft.rulesAccepted);
          setSoloSponsorUuid(draft.soloSponsorUuid || "");
          setTeamSponsorUuids(draft.teamSponsorUuids || {});
          setSoloEngagementAnswers(draft.soloEngagementAnswers || {});
          setTeamEngagementAnswers(draft.teamEngagementAnswers || {});
          draftRef.current = draft;
          setHasResumableDraft(true);
        }
      }
    } catch {
      // Corrupt/old draft - ignore it; the persist effect will overwrite.
    }
    draftHydratedRef.current = true;
  }, [
    eventDetails?.event_id,
    eventDetails?.is_registered,
    token,
    regDraftKey,
    removeRegDraft,
  ]);

  // ── Registration draft resume: PERSIST (every meaningful change) ─────────────
  // Saves the whole collected flow state to localStorage whenever anything the
  // registration collects changes. Runs only after the restore attempt
  // (draftHydratedRef) so an empty first render can't clobber a saved draft.
  useEffect(() => {
    if (!draftHydratedRef.current || !regDraftKey || !eventDetails?.event_id)
      return;
    if (eventDetails.is_registered) return;
    // SUCCESS = registration done (free flow + the paid already-paid branch both
    // land here): the draft has served its purpose.
    if (modalStep === "SUCCESS") {
      removeRegDraft();
      return;
    }

    // Resume point = whichever dialog is open NOW; when both are closed (the
    // user dismissed mid-flow) keep the LAST open step from the previous save so
    // Register still drops them back where they stopped. TYPE is excluded - it's
    // the natural entry step, resuming "at TYPE" is just a normal start.
    const resume: RegistrationDraftResumePoint | null =
      teamModalStep !== "CLOSED"
        ? { kind: "team", step: teamModalStep }
        : modalStep !== "CLOSED" && modalStep !== "TYPE"
          ? { kind: "main", step: modalStep }
          : (draftRef.current?.resume ?? null);

    // "Meaningful" = the user actually started registering (picked a type or got
    // past TYPE). Otherwise write nothing - this also keeps the "Clear saved
    // progress" reset from instantly re-saving an empty draft.
    if (regType === null && resume === null) return;

    const draft: RegistrationDraft = {
      v: 1,
      resume,
      regType,
      teamId: userTeam?.team_id ?? null,
      selectedMembers,
      selectedTeamMembersData,
      rulesAccepted,
      soloSponsorUuid,
      teamSponsorUuids,
      soloEngagementAnswers,
      teamEngagementAnswers,
      savedAt: Date.now(),
    };
    draftRef.current = draft;
    try {
      localStorage.setItem(regDraftKey, JSON.stringify(draft));
    } catch {
      // Private mode / quota: resume simply won't survive a reload - non-fatal.
    }
  }, [
    modalStep,
    teamModalStep,
    regType,
    selectedMembers,
    selectedTeamMembersData,
    rulesAccepted,
    soloSponsorUuid,
    teamSponsorUuids,
    soloEngagementAnswers,
    teamEngagementAnswers,
    userTeam?.team_id,
    eventDetails?.event_id,
    eventDetails?.is_registered,
    regDraftKey,
    removeRegDraft,
  ]);

  // ── Registration draft resume: START OVER ────────────────────────────────────
  // The TYPE step's subtle "Clear saved progress and start over" button. Wipes
  // the saved draft AND resets the in-memory flow state so nothing leaks into a
  // fresh registration.
  const clearRegistrationDraft = useCallback(() => {
    removeRegDraft();
    setRegType(null);
    setSelectedMembers([]);
    setSelectedTeamMembersData([]);
    setRulesAccepted(false);
    setSoloSponsorUuid("");
    setTeamSponsorUuids({});
    setSoloEngagementAnswers({});
    setTeamEngagementAnswers({});
    setTeamModalStep("CLOSED");
    toast.info(t("register.toast.draftCleared"));
  }, [removeRegDraft, t]);

  useEffect(() => {
    // Wait until auth has fully resolved before fetching.
    // This prevents the public endpoint from being called first and then
    // overwriting the authenticated result (which has is_registered).
    if (!slug || authLoading) return;

    fetchEventDetails();

    if (token) {
      const fetchUser = async () => {
        const resCurrent = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (resCurrent.data && resCurrent.data.team) {
          const resDetails = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
            { team_name: resCurrent.data.team.team_name },
          );
          setUserTeam(resDetails.data.team);
        } else {
          toast.error(t("detail.noTeam"));
        }
      };

      fetchUser();
    }
  }, [fetchEventDetails, slug, token, authLoading, t]);

  const handleRegisterClick = useCallback(async () => {
    // Check ban status before anything else
    if (eventDetails?.participant_type === "squad" && userTeam?.is_banned) {
      setShowBannedModal(true);
      return;
    }
    if (eventDetails?.participant_type !== "squad" && isUserBanned) {
      setShowBannedModal(true);
      return;
    }

    // ── Team-event registration gate (owner 2026-06-21) ──────────────────────────
    // Everyone can SEE the Register button on a team event, but only certain people may
    // actually register the team. Resolve the clicker's team + role here (fetching the
    // team if it has not loaded yet) and short-circuit with the right popup:
    //   • not on any team  -> "this is a team tournament, join a team as a player"
    //   • on a team but not owner/captain/manager/coach -> "only those roles can register"
    // A privileged member falls through to the normal registration flow below. The
    // backend (register_for_event::_user_can_register_team) enforces the same rule.
    if (eventDetails?.participant_type === "squad") {
      let team = userTeam;
      if (!team) team = await fetchUserTeam();
      if (!team) {
        setShowNoTeamModal(true);
        return;
      }
      if (!userCanRegisterTeam(team, user?.in_game_name)) {
        setShowRoleDeniedModal(true);
        return;
      }
    }

    // Check if event is private and if user has a valid invite
    if (eventDetails && !eventDetails.is_public && !hasValidInvite) {
      toast.error(t("register.toast.privateEvent"));
      return;
    }

    // If private event, check invite status again before proceeding
    if (eventDetails && !eventDetails.is_public && inviteToken) {
      const isValid = await checkInviteTokenStatus(inviteToken);
      if (!isValid) {
        return; // Don't proceed if invite is invalid/used
      }
    }

    // ── Draft resume (owner 2026-06-13) ── a restored draft reopens the flow at
    // the step where the user stopped instead of restarting at TYPE. The state
    // behind that step (regType / roster / answers / rules) was already restored
    // silently on page load, so the step renders exactly as they left it.
    const draft = draftRef.current;
    if (draft?.resume) {
      toast.info(t("register.toast.resuming"));
      if (draft.resume.kind === "team") {
        // Mid member-selection: reopen the team dialog. userTeam is normally
        // fetched on mount; fetch here only if it never arrived.
        if (!userTeam) await fetchUserTeam();
        setTeamModalStep(draft.resume.step as TeamModalStep);
      } else {
        setModalStep(draft.resume.step as ModalStep);
      }
      return;
    }

    setModalStep("TYPE");
  }, [
    eventDetails,
    hasValidInvite,
    inviteToken,
    checkInviteTokenStatus,
    userTeam,
    isUserBanned,
    fetchUserTeam,
    user,
    t,
  ]);

  const handleSelectType = useCallback(
    async (type: RegistrationType) => {
      setRegType(type);

      if (type === "team") {
        // Fetch user's team before proceeding
        await fetchUserTeam();
        setTeamModalStep("SELECT_MEMBERS");
        setModalStep("CLOSED"); // Close the type selection modal
      } else {
        // Solo registration - proceed to INFO
        setModalStep("INFO");
      }
    },
    [fetchUserTeam],
  );

  const handleGoToRules = useCallback(() => {
    if (regType === "team") {
      const selectedMembersData =
        userTeam?.members.filter((m) => selectedMembers.includes(m.id)) ?? [];
      const membersWithoutUid = selectedMembersData.filter(
        (m) => !m.uid?.trim(),
      );

      if (membersWithoutUid.length > 0) {
        const nonCurrentUserMissing = membersWithoutUid.filter(
          (m) => String(m.id) !== String(user?.user_id),
        );

        if (nonCurrentUserMissing.length > 0) {
          // One or more non-current-user members are missing UIDs - blocking
          setUidMissingMembers(membersWithoutUid.map((m) => m.username));
          setModalStep("UID_MISSING_MEMBERS");
          return;
        }

        // Only the current user is missing their UID
        setUidInput("");
        setModalStep("UID_PROMPT");
        return;
      }
    } else {
      if (!user?.uid?.trim()) {
        setUidInput("");
        setModalStep("UID_PROMPT");
        return;
      }
    }
    setModalStep("RULES");
  }, [user, regType, selectedMembers, userTeam]);

  const handleSaveUid = useCallback(async () => {
    if (!uidInput.trim()) return;
    setSavingUid(true);
    try {
      const formData = new FormData();
      formData.append("full_name", user?.full_name || "");
      formData.append("in_game_name", user?.in_game_name || "");
      formData.append("email", user?.email || "");
      formData.append("uid", uidInput.trim());
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const storedToken = localStorage.getItem("authToken");
      if (storedToken) await login(storedToken);
      setModalStep("RULES");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t("register.toast.saveUidFailed"),
      );
    } finally {
      setSavingUid(false);
    }
  }, [uidInput, user, token, login, t]);

  const handleTeamContinueToRules = useCallback(() => {
    // Store selected team members data
    const membersData =
      userTeam?.members.filter((m) => selectedMembers.includes(m.id)) || [];
    setSelectedTeamMembersData(membersData);

    setTeamModalStep("CLOSED");
    handleGoToRules();
  }, [userTeam, selectedMembers, handleGoToRules]);

  const handleRulesContinue = useCallback(() => {
    if (!rulesAccepted) return;
    // SPONSOR step is reachable on BOTH sponsor systems: the legacy is_sponsored
    // flag AND the new entity sponsorships (sponsor redesign P3) - the step itself
    // picks which UI to render based on eventSponsorships.
    if (eventDetails?.is_sponsored || eventSponsorships.length > 0) {
      setModalStep("SPONSOR");
      return;
    }
    if (!DISCORD_REQUIRED) {
      handleJoinedServerRef.current();
      return;
    }
    if (regType === "team" && selectedTeamMembersData.length > 0) {
      setModalStep("DISCORD_STATUS");
    } else {
      setModalStep("DISCORD_LINK");
    }
  }, [
    rulesAccepted,
    regType,
    selectedTeamMembersData,
    eventDetails,
    eventSponsorships,
  ]);

  const handleDiscordConnect = useCallback(() => {
    let redirectPath = `${window.location.origin}${window.location.pathname}?id=${slug}&discord=connected&step=discord`;
    if (inviteToken) {
      redirectPath += `&invitation=${encodeURIComponent(inviteToken)}`;
    }
    const redirectUrl = encodeURIComponent(redirectPath);

    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord/?session_token=${token}&tournament_id=${slug}&invite_token=${inviteToken}&redirect_url=${redirectUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [slug, token, inviteToken]);

  // Build the EXACT payload register-for-event/ expects, from the collected modal state.
  // Extracted so BOTH the free direct-register path AND the paid path (which saves this
  // payload to localStorage to survive the Stripe redirect) send byte-for-byte the same
  // thing. The success page replays this saved payload to complete a paid registration.
  const buildRegistrationPayload = useCallback((): Record<string, any> => {
    const payload: any = { slug: slug, event_id: eventDetails?.event_id };

    // If team registration, include team and member info
    if (regType === "team" && userTeam) {
      payload.team_id = userTeam.team_id;
      payload.roster_member_ids = selectedMembers;
      payload.event_id = eventDetails?.event_id;
    }

    // Add invite token if present
    if (inviteToken) {
      payload.invite_token = inviteToken;
    }

    // ── Sponsor data ──
    // NEW PATH (sponsor redesign P3): events with entity sponsorships send the
    // per-engagement answers as `sponsorships` and OMIT the legacy
    // sponsor_id/sponsor_ids keys entirely. Solo: [{sponsorship_id, submissions}].
    // Squad: [{sponsorship_id, submissions_by_user: {"<user_id>": [...]}}] - one
    // entry per SELECTED roster member (the server requires every player covered;
    // 400 code "sponsor_submission_invalid" otherwise).
    if (eventSponsorships.length > 0) {
      payload.sponsorships =
        regType === "team"
          ? buildSquadSponsorshipsBody(
              eventSponsorships,
              selectedMembers,
              teamEngagementAnswers,
            )
          : buildSoloSponsorshipsBody(eventSponsorships, soloEngagementAnswers);
    } else if (eventDetails?.is_sponsored) {
      // LEGACY PATH: single sponsor-ID value(s), unchanged.
      if (regType === "team") {
        payload.sponsor_ids = teamSponsorUuids;
      } else {
        payload.sponsor_id = soloSponsorUuid;
      }
    }

    return payload;
  }, [
    slug,
    regType,
    userTeam,
    selectedMembers,
    inviteToken,
    teamSponsorUuids,
    soloSponsorUuid,
    eventSponsorships,
    soloEngagementAnswers,
    teamEngagementAnswers,
    eventDetails,
  ]);

  // ── Actionable registration-gate errors (owner 2026-06-12: "let there be a way for people
  // to know where to upload their esports picture or uid when they try to register") ──
  // register-for-event/ returns code:"esport_image_required" or "team_logo_required" when the
  // event's registration criteria are unmet (see backend register_for_event gates). Instead of
  // a dead-end toast, each code gets a description naming WHERE the missing asset lives plus an
  // action button that jumps straight there: esport image AND Free Fire UID are both on
  // /profile/edit, the team logo is on /teams/<id>/edit (captain). Any other error falls back
  // to the plain backend message. Used by BOTH register catches (free + paid already-paid path).
  const handleRegistrationGateError = useCallback(
    (error: any, fallback?: string) => {
      const data = error?.response?.data;
      const message: string =
        data?.message || fallback || t("register.toast.genericError");
      if (data?.code === "esport_image_required") {
        toast.error(message, {
          description: t("register.toast.esportImageDescription"),
          action: {
            label: t("register.toast.esportImageAction"),
            onClick: () => router.push("/profile/edit"),
          },
          duration: 12000,
        });
        return;
      }
      if (data?.code === "team_logo_required") {
        toast.error(message, {
          description: t("register.toast.teamLogoDescription"),
          // Only captains can edit the team, but the link helps everyone find the place.
          ...(userTeam?.team_id
            ? {
                action: {
                  label: t("register.toast.teamLogoAction"),
                  onClick: () => router.push(`/teams/${userTeam.team_id}/edit`),
                },
              }
            : {}),
          duration: 12000,
        });
        return;
      }
      // F3 (owner 2026-06-19): the per-player registration gates (esports image / profile image /
      // Free Fire UID, + team logo) reject with this structured code, listing EXACTLY which player
      // is missing which field. We surface a toast that NAMES each offending player + what they
      // must add, with a jump to /profile/edit. fields are stable keys mapped to localized labels.
      if (data?.code === "registration_requirements_unmet") {
        const fieldLabel = (f: string) =>
          ({
            uid: t("register.toast.req.uid"),
            esports_image: t("register.toast.req.esportsImage"),
            profile_image: t("register.toast.req.profileImage"),
          })[f] ?? f;
        const lines: string[] = (data.missing ?? []).map(
          (m: { username: string; fields: string[] }) =>
            `${m.username}: ${(m.fields ?? []).map(fieldLabel).join(", ")}`,
        );
        if (data.team_logo_missing) lines.unshift(t("register.toast.req.teamLogo"));
        toast.error(t("register.toast.requirementsTitle"), {
          description: lines.join("  •  ") || message,
          action: {
            label: t("register.toast.esportImageAction"),
            onClick: () => router.push("/profile/edit"),
          },
          duration: 15000,
        });
        return;
      }
      // Sponsor redesign P3: the server re-validates every engagement answer for
      // every rostered player and rejects the whole registration with this code
      // when anything is missing or malformed. The message names what failed.
      if (data?.code === "sponsor_submission_invalid") {
        toast.error(message, {
          description: t("register.toast.sponsorSubmissionDescription"),
          duration: 12000,
        });
        return;
      }
      // ── Discord registration gate (per-event require_discord) ──
      // register-for-event/ rejects with code:"discord_required" when a participant isn't
      // Discord-connected and/or not in the event's Discord server. discord_missing (when
      // present) names the usernames still missing the connection. We surface the backend
      // message + a "Connect Discord" action that opens the OAuth connect flow
      // (handleDiscordConnect, defined just above). Mirrors the other gate branches.
      if (data?.code === "discord_required") {
        const missing: string[] = Array.isArray(data?.discord_missing)
          ? data.discord_missing
          : [];
        toast.error(message, {
          // List the players still needing to connect, when the backend provides them.
          description:
            missing.length > 0
              ? t("register.toast.discordMissing", { names: missing.join(", ") })
              : undefined,
          action: {
            label: t("register.toast.discordAction"),
            onClick: handleDiscordConnect,
          },
          duration: 12000,
        });
        return;
      }
      toast.error(message);
    },
    [router, userTeam, t, handleDiscordConnect],
  );

  // ── PAID PATH ──────────────────────────────────────────────────────────────
  // Kicks off a Stripe Checkout for a paid event. Called from the PAYMENT step's
  // "Pay ..." button. Steps: (a) init the payment, (b) save the full register payload to
  // localStorage under afc_evt_reg_<payment_id> so it survives the redirect, (c) send the
  // browser to checkout_url. If the user already paid, skip straight to completing the
  // registration in-place (no redirect). The success page handles verify + register-for-event.
  const startPaidRegistration = useCallback(async () => {
    startJoinedTransition(async () => {
      try {
        const eventId = eventDetails?.event_id;
        if (!eventId) return;

        const init = await eventPaymentsApi.initRegistrationPayment({
          event_id: eventId,
          // team_id only matters for squad events; omitted for solo.
          ...(regType === "team" && userTeam
            ? { team_id: userTeam.team_id }
            : {}),
        });

        // Persist the register payload keyed by payment_id BEFORE leaving the page, so the
        // success page can finish registration after the Stripe round-trip.
        const payload = buildRegistrationPayload();
        try {
          localStorage.setItem(
            `${PAID_REG_KEY_PREFIX}${init.payment_id}`,
            JSON.stringify(payload),
          );
        } catch {
          // localStorage can throw in private-mode / quota edge cases; not fatal - the
          // success page has a fallback "Complete registration" path if the payload is missing.
        }

        // Already paid (e.g. a retry after a prior successful charge): no checkout needed  - 
        // complete the registration right here using the existing endpoint.
        if (init.already_paid) {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/register-for-event/`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || t("register.toast.registeredFallback"));
          setWasWaitlisted(!!res.data.waitlisted);
          // Sponsor redesign P3: true when a requires_approval sponsor must vet
          // the engagement submissions before the spot is confirmed.
          setPendingSponsorApproval(!!res.data.pending_sponsor_approval);
          // Clean up the saved payload - registration is done.
          try {
            localStorage.removeItem(`${PAID_REG_KEY_PREFIX}${init.payment_id}`);
          } catch {
            /* non-fatal */
          }
          setModalStep("SUCCESS");
          await fetchEventDetails();
          return;
        }

        if (!init.checkout_url) {
          toast.error(t("register.toast.checkoutFailed"));
          return;
        }

        // Redirect to Stripe-hosted checkout. The return URL (configured server-side) lands
        // on /tournaments/<slug>/register/success with ?session_id & ?payment_id.
        window.location.href = init.checkout_url;
      } catch (error: any) {
        // 409 = already registered; other 4xx carry a human message from the backend. The
        // already_paid branch above hits register-for-event/ directly, so its gate errors
        // (esport image / team logo) get the same actionable deep-link toast as the free path.
        handleRegistrationGateError(
          error,
          t("register.toast.paymentStartFailed"),
        );
      }
    });
  }, [
    eventDetails,
    regType,
    userTeam,
    buildRegistrationPayload,
    token,
    fetchEventDetails,
    startJoinedTransition,
    handleRegistrationGateError,
    t,
  ]);

  const handleJoinedServer = useCallback(async () => {
    // PAID events do NOT register directly - route to the PAYMENT step instead. Everything
    // up to here (INFO/RULES/SPONSOR/DISCORD) has already collected the roster + sponsor +
    // invite info, which buildRegistrationPayload() snapshots when the user pays.
    if (eventDetails?.registration_type === "paid") {
      setModalStep("PAYMENT");
      return;
    }

    startJoinedTransition(async () => {
      try {
        const payload = buildRegistrationPayload();

        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/register-for-event/`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message);
        // M: backend returns waitlisted:true when the active cap was full and the
        // entry was routed to the waitlist instead of a confirmed slot.
        setWasWaitlisted(!!res.data.waitlisted);
        // Sponsor redesign P3: pending_sponsor_approval flips the SUCCESS copy to
        // "Registered, waiting for sponsor approval" (requires_approval sponsor).
        setPendingSponsorApproval(!!res.data.pending_sponsor_approval);
        setModalStep("SUCCESS");

        // Refresh event details to update registration status
        await fetchEventDetails();
      } catch (error: any) {
        // Gate errors (esport image / team logo) become actionable toasts with a deep-link.
        handleRegistrationGateError(error);
      }
    });
  }, [
    eventDetails,
    buildRegistrationPayload,
    token,
    fetchEventDetails,
    startJoinedTransition,
    handleRegistrationGateError,
  ]);

  // Keep ref in sync so handleRulesContinue can call it without a circular dep
  handleJoinedServerRef.current = handleJoinedServer;

  if (isLoading) return <FullLoader />;
  if (error || !eventDetails) return notFound();

  const formatText = `${eventDetails.event_mode.toUpperCase()} / ${eventDetails.competition_type.toUpperCase()}`;
  const participantText = `${formatMoneyInput(
    eventDetails.max_teams_or_players,
  )} ${
    eventDetails.participant_type.charAt(0).toUpperCase() +
    eventDetails.participant_type.slice(1)
  }s`;

  // "Consumed" = a single-use invite that has already been used. A SHARED link is the
  // reusable first-come-first-serve link, so it is NOT consumed even when is_used is true.
  // Use this anywhere we previously keyed off inviteStatus.is_used to show the
  // "already used" warning or block registration, so a shared link is never treated as used.
  const isInviteConsumed = Boolean(
    inviteStatus?.is_used && !inviteStatus?.is_shared,
  );

  // Determine if user can register
  const canRegister = eventDetails.is_public || hasValidInvite;

  const combineDateAndTime = (date: string, time?: string | null) => {
    if (!time) return new Date(date);
    return new Date(`${date}T${time}`);
  };

  const now = new Date();
  const registrationOpenDateTime = combineDateAndTime(
    eventDetails.registration_open_date,
    eventDetails.registration_start_time,
  );
  const registrationCloseDateTime = combineDateAndTime(
    eventDetails.registration_end_date,
    eventDetails.registration_end_time,
  );
  const eventStartDateTime = combineDateAndTime(
    eventDetails.start_date,
    eventDetails.event_start_time,
  );
  const eventEndDateTime = combineDateAndTime(
    eventDetails.end_date,
    eventDetails.event_end_time,
  );

  const isEventEnded = now > eventEndDateTime;
  const isEventStarted = now >= eventStartDateTime;

  // M: full when active (non-waitlisted) registrations have hit the cap (backend computed).
  const isFull = !!eventDetails.is_full;
  const registrationDisabledReason = !canRegister
    ? t("detail.disabledReason.privateInviteRequired")
    : eventDetails.event_status !== "upcoming"
      ? t("detail.disabledReason.registrationClosed")
      : isEventEnded
        ? t("detail.disabledReason.eventEnded")
        : now < registrationOpenDateTime
          ? t("detail.disabledReason.registrationNotOpen")
          : now > registrationCloseDateTime
            ? t("detail.disabledReason.registrationClosed")
            : isFull && !eventDetails.is_waitlist_enabled
              ? t("detail.disabledReason.registrationFull")
              : null;

  // M: when the event is full but a waitlist is open, registration stays ENABLED and
  // the CTA flips to "Join Waitlist". The backend register endpoint auto-routes the
  // entry onto the waitlist once the active cap is reached.
  const waitlistMode =
    isFull && !!eventDetails.is_waitlist_enabled && !registrationDisabledReason;

  // ── Paid event helpers (Stripe registration) ──
  // isPaidEvent flips the badge + register-button label. paidFeeLabel is the formatted
  // "<currency> <fee>" string shown on the badge and on the register CTA. Used below in
  // the meta badges and the Register button copy.
  const isPaidEvent =
    eventDetails.registration_type === "paid" &&
    typeof eventDetails.registration_fee === "number" &&
    eventDetails.registration_fee > 0;
  const paidFeeCurrency = eventDetails.registration_fee_currency || "USD";
  const paidFeeLabel = isPaidEvent
    ? `${paidFeeCurrency} ${Number(eventDetails.registration_fee).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}`
    : "";

  const statusVariant: Record<
    string,
    "default" | "secondary" | "destructive" | "outline" | "pending"
  > = {
    approved: "default",
    registered: "secondary",
    disqualified: "destructive",
    withdrawn: "outline",
    left: "outline",
    pending: "pending",
    rejected: "destructive",
  };

  return (
    <div>
      <Card className="p-0 bg-transparent border-0">
        <PageHeader title={eventDetails.event_name} back />
        <div className="p-0 space-y-2">
          <Image
            src={eventDetails.event_banner_url || DEFAULT_IMAGE}
            alt={eventDetails.event_name || t("detail.bannerAlt")}
            width={1000}
            height={1000}
            className="aspect-video size-full object-cover rounded-md"
          />
          {!eventDetails.is_public && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md border ${
                isInviteConsumed
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-yellow-500/10 border-yellow-500/30"
              }`}
            >
              <AlertTriangle
                className={`size-4 flex-shrink-0 ${
                  isInviteConsumed ? "text-red-400" : "text-yellow-400"
                }`}
              />
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    isInviteConsumed ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  {t("detail.privateEvent.title")}
                </p>
                {isCheckingInvite && (
                  <p className="text-xs text-gray-300">
                    {t("detail.privateEvent.validating")}
                  </p>
                )}
                {!isCheckingInvite && isInviteConsumed && (
                  <div className="text-xs text-red-300 space-y-1">
                    <p>❌ {t("detail.privateEvent.alreadyUsed")}</p>
                    {inviteStatus?.used_by && (
                      <p>
                        {t("detail.privateEvent.usedBy", {
                          name: inviteStatus.used_by,
                        })}
                      </p>
                    )}
                    {inviteStatus?.used_at && (
                      <p>
                        {/* i18n time: the invite's used-at moment in the viewer's own
                            timezone + language. formatLocalTime (string form) is used
                            because it is interpolated into the "Used at: {time}" string.
                            This block only appears after the post-mount invite check
                            resolves, so the client-only helper has a browser timezone. */}
                        {t("detail.privateEvent.usedAt", {
                          time: formatLocalTime(
                            inviteStatus.used_at,
                            "datetime",
                          ),
                        })}
                      </p>
                    )}
                  </div>
                )}
                {/* Shared first-come-first-serve link: confirm it is reusable so the
                    group is not scared off by the "already used" copy. */}
                {!isCheckingInvite &&
                  hasValidInvite &&
                  inviteStatus?.is_shared && (
                    <p className="text-xs text-green-300">
                      ✓ {t("detail.privateEvent.sharedLink")}
                    </p>
                  )}
                {!isCheckingInvite && !inviteToken && (
                  <p className="text-xs text-yellow-300">
                    {t("detail.privateEvent.needInvite")}
                  </p>
                )}
                {!isCheckingInvite &&
                  hasValidInvite &&
                  !inviteStatus?.is_shared &&
                  !isInviteConsumed && (
                    <p className="text-xs text-green-300">
                      ✓ {t("detail.privateEvent.validInvite")}
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>
        {/* ── Organized by (F4, owner 2026-06-19) ── attribution to the owning organization.
            Links to the org's public page (/organizations/<slug>) when present; for native AFC
            events (no organization) it falls back to AFC branding and is not a link. Logo avatar
            when the org has one, else an "AFC"/initials chip. Mirrors the org badge on the event
            cards (tournaments list + home). Backend keys: organization_{name,slug,logo}. */}
        {(() => {
          const orgName =
            eventDetails.organization_name || t("detail.afcOfficial");
          const orgSlug = eventDetails.organization_slug;
          const orgLogo = eventDetails.organization_logo;
          const inner = (
            <>
              {orgLogo ? (
                <Image
                  src={orgLogo}
                  alt={orgName}
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-cover border border-border"
                />
              ) : (
                <span className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                  AFC
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {t("detail.organizedBy", { name: orgName })}
              </span>
            </>
          );
          const primary = orgSlug ? (
            <Link
              href={`/organizations/${orgSlug}`}
              className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {inner}
            </Link>
          ) : (
            <div className="inline-flex items-center gap-2">{inner}</div>
          );
          // F6: append accepted co-organizers → "Organized by A & B".
          const coOrgs = eventDetails.co_organizers ?? [];
          if (coOrgs.length === 0) return primary;
          return (
            <div className="flex flex-wrap items-center gap-2">
              {primary}
              {coOrgs.map((co, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <span className="text-muted-foreground/60">&amp;</span>
                  {co.logo && (
                    <Image
                      src={co.logo}
                      alt={co.name}
                      width={20}
                      height={20}
                      className="size-5 rounded-full object-cover border border-border"
                    />
                  )}
                  {co.slug ? (
                    <Link href={`/organizations/${co.slug}`} className="hover:opacity-80">
                      {co.name}
                    </Link>
                  ) : (
                    <span>{co.name}</span>
                  )}
                </span>
              ))}
            </div>
          );
        })()}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* i18n time: event start date in the viewer's timezone + language,
              injected as the <date> tag of the "Date: <date>" string (t.rich). */}
          <p>
            {t.rich("detail.date", {
              date: () => (
                <LocalTime value={eventDetails.start_date} mode="date" />
              ),
            })}
          </p>
          {/* Event time (owner 2026-06-21): shows BOTH the viewer's local time and the
              host's time with a tz label, pinned from the host wall-clock + Event.timezone.
              Only rendered once a start time exists (it is compulsory on new events; older
              events may have none). */}
          {eventDetails.event_start_time && (
            <p>
              {t.rich("detail.time", {
                time: () => (
                  <LocalEventTime
                    date={eventDetails.start_date}
                    startTime={eventDetails.event_start_time}
                    endTime={eventDetails.event_end_time}
                    tz={eventDetails.timezone}
                  />
                ),
              })}
            </p>
          )}
          <p>
            {t("detail.prizePool", {
              value: /^\d+(\.\d+)?$/.test(eventDetails.prizepool)
                ? `$${parseFloat(eventDetails.prizepool).toLocaleString()}`
                : eventDetails.prizepool,
            })}
          </p>
          <p>{t("detail.locationOnline")}</p>
          <p>{t("detail.format", { value: formatText })}</p>
        </div>
        <p className="text-sm">
          {t("detail.participants", { value: participantText })}
        </p>

        {/* ── Paid-event badge ──
            Only rendered for a paid event (registration_type === "paid" with a positive
            fee). Outline Badge in the AFC tier-badge idiom (rounded-full, green accent),
            mirroring the organizer badge on the event cards. Shows the entry fee up front
            so users know before they open the register flow. */}
        {isPaidEvent && (
          <div>
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-xs border-primary/50 text-primary"
            >
              {t("detail.paidBadge", { fee: paidFeeLabel })}
            </Badge>
          </div>
        )}

        {/* ── Discord-required badge ──
            Shown when the event's require_discord gate is ON (echoed by get-event-details/).
            Tells viewers up front that registering needs a connected Discord account + server
            membership, before they hit the register flow (where register-for-event/ enforces it
            with code:"discord_required"). Same outline tier-badge idiom as the paid badge. */}
        {eventDetails.require_discord && (
          <div>
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-xs border-primary/50 text-primary"
            >
              {t("detail.discordRequiredBadge")}
            </Badge>
          </div>
        )}

        {/* ── Join the event's Discord ──
            Shown to ALL viewers when the event requires Discord AND an invite link was set
            on the create/edit wizard (eventDetails.discord_invite_link, echoed by
            get-event-details/). Opens the organizer-provided invite in a new tab so players
            can join the server before/while registering (registering itself is gated by
            register-for-event/ → code:"discord_required"). i18n label: detail.joinDiscord. */}
        {eventDetails.require_discord && eventDetails.discord_invite_link && (
          <div>
            <Button asChild variant="outline" size="sm">
              <a
                href={eventDetails.discord_invite_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("detail.joinDiscord")}
              </a>
            </Button>
          </div>
        )}

        <CardContent style={{ padding: 0 }} className="space-y-4">
          {eventDetails.stages?.length > 0 ? (
            <>
              {/* Waitlist (owner 2026-06-17): when the event has a waitlist, show players HOW open
                  slots are filled (the active mode) + who is waiting, with queue position. Backed by
                  eventDetails.waitlist_mode + waitlist_competitors from get-event-details. */}
              {eventDetails.is_waitlist_enabled && (
                <div className="mb-6 rounded-md border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-primary">
                      {t("waitlist.title")}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {t("waitlist.count", {
                        count: eventDetails.waitlist_competitors?.length ?? 0,
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("waitlist.howFilled")}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t(
                      `waitlist.mode_${eventDetails.waitlist_mode || "first_registered"}` as any,
                    )}
                  </p>
                  {(eventDetails.waitlist_competitors?.length ?? 0) > 0 ? (
                    <ul className="mt-3 divide-y rounded-md border">
                      {eventDetails.waitlist_competitors!.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 px-3 py-2 text-sm"
                        >
                          <span className="w-8 shrink-0 font-bold text-primary">
                            {t("waitlist.position", { n: w.position ?? i + 1 })}
                          </span>
                          <span className="flex-1 truncate font-medium capitalize">
                            {w.name}
                          </span>
                          {w.registration_date && (
                            <LocalTime
                              value={w.registration_date}
                              mode="date"
                              className="shrink-0 text-xs text-muted-foreground"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted-foreground">
                      {t("waitlist.empty")}
                    </p>
                  )}
                </div>
              )}

              {/* Requirements heads-up (owner 2026-06-20): what this event asks of registrants - the
                  asset requirements toggled on + the sponsor ask - shown to ALL viewers BEFORE they
                  register so they know the bar up front. Renders nothing when there are none. */}
              <EventRequirementsCard
                requireTeamLogo={eventDetails.require_team_logo}
                requireEsportImages={eventDetails.require_esport_images}
                requirePlayerUid={eventDetails.require_player_uid}
                requirePlayerProfileImage={eventDetails.require_player_profile_image}
                isSponsored={eventDetails.is_sponsored}
                sponsorName={eventDetails.sponsor_name}
                sponsorRequirementDescription={eventDetails.sponsor_requirement_description}
                sponsorFieldLabel={eventDetails.sponsor_field_label}
              />

              {/* Results ⇄ Structure toggle. "Structure" renders the new graphical
                  TournamentStructure view (stage flow + group standings); "Results"
                  keeps the existing per-stage results tables. */}
              <Tabs
                value={mainView}
                onValueChange={(v) =>
                  setMainView(v as "results" | "structure")
                }
              >
                <TabsList>
                  <TabsTrigger value="results">
                    {t("detail.viewToggle.results")}
                  </TabsTrigger>
                  <TabsTrigger value="structure">
                    {t("detail.viewToggle.structure")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {mainView === "structure" ? (
                <TournamentStructure
                  stages={eventDetails.stages as any}
                  participantType={eventDetails.participant_type}
                />
              ) : (
                <Tabs
                  value={activeStageTab}
                  onValueChange={setActiveStageTab}
                  className="w-full"
                >
              <ScrollArea>
                <TabsList className="w-full">
                  {eventDetails.stages.map((stage) => (
                    <TabsTrigger
                      key={stage.stage_id}
                      value={stage.stage_name}
                      className="flex-1"
                    >
                      {stage.stage_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {eventDetails.stages.map((stage) => (
                <TabsContent
                  key={stage.stage_id}
                  value={stage.stage_name}
                  className="mt-4 animate-in fade-in slide-in-from-bottom-2"
                >
                  <StageResultsTable
                    stage={stage}
                    participantType={eventDetails.participant_type}
                  />
                </TabsContent>
              ))}
                </Tabs>
              )}
            </>
          ) : (
            <div className="p-10 text-center border-2 border-dashed border-zinc-900 rounded-2xl text-zinc-500">
              {t("detail.noStages")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal rejection notice - visible to any registered team member */}
      {(() => {
        if (
          !eventDetails.is_registered ||
          eventDetails.participant_type !== "squad" ||
          pageRoster.length === 0 ||
          !user?.in_game_name
        )
          return null;
        const myEntry = pageRoster.find(
          (r) => r.username === user.in_game_name,
        );
        if (myEntry?.status !== "rejected") return null;
        return (
          <Alert className="mt-4 border-destructive/50 bg-destructive/10 text-destructive">
            <XCircle className="h-4 w-4" />
            <p className="text-red-900 dark:text-red-100">
              {t.rich("detail.rejectionNotice.personal", {
                bold: (chunks) => (
                  <span className="font-semibold inline-block">{chunks}</span>
                ),
              })}
            </p>
          </Alert>
        );
      })()}

      {/* The register section is shown to EVERYONE (owner 2026-06-21): any visitor sees
          the Register button for a team event; the click handler then pops the right
          message if they have no team or lack the owner/captain/manager/coach role.
          (Previously this whole block was hidden unless you were the team owner.) */}
      {true && (
        <div className="text-center mt-6 space-y-2">
          {/* Captain-level roster rejection notice */}
          {(() => {
            if (
              !eventDetails.is_registered ||
              eventDetails.participant_type !== "squad" ||
              pageRoster.length === 0
            )
              return null;
            const rejected = pageRoster.filter((r) => r.status === "rejected");
            if (rejected.length === 0) return null;
            const allRejected = rejected.length === pageRoster.length;
            return (
              <Alert className="border-destructive/50 bg-destructive/10 text-destructive text-left">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {allRejected ? (
                    <>
                      {t.rich("detail.rejectionNotice.captainAll", {
                        bold: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </>
                  ) : (
                    <p>
                      {t.rich("detail.rejectionNotice.captainSome", {
                        count: rejected.length,
                        playerWord:
                          rejected.length === 1
                            ? t("detail.rejectionNotice.playerSingular")
                            : t("detail.rejectionNotice.playerPlural"),
                        haveWord:
                          rejected.length === 1
                            ? t("detail.rejectionNotice.hasWord")
                            : t("detail.rejectionNotice.haveWord"),
                        names: rejected.map((r) => r.username).join(", "),
                        bold: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            );
          })()}

          {eventDetails.is_registered ? (
            <div className="flex flex-col md:flex-row items-start justify-center md:items-center gap-2">
              <Button disabled className="w-full md:w-auto">
                {t("detail.registered.already")}
              </Button>

              {/* EDIT ROSTER (squad): allowed while the event has NOT started OR while the
                  roster-edit window is open (owner 2026-06-22 fix). The window (roster_edit_open,
                  set by an admin/organizer) exists precisely so captains can edit AFTER the event
                  start / registration close, so gating Edit on !isEventStarted alone hid it and the
                  window did nothing. Manager-gated (owner/captain/vice/manager/coach); the backend
                  edit_roster enforces the same window + the match-start lock. */}
              {eventDetails.participant_type === "squad" &&
                (!isEventStarted || eventDetails.roster_edit_open) &&
                userCanRegisterTeam(userTeam, user?.in_game_name) && (
                  <EditRosterModal
                    eventDetails={eventDetails}
                    userTeam={userTeam}
                    token={token}
                    onSuccess={fetchEventDetails}
                  />
                )}

              {/* LEAVE: only before the event starts (the roster-edit window is for EDITING, not
                  leaving) - and, for a team event, only a manager. Solo registrants can leave too. */}
              {!isEventStarted &&
                (eventDetails.participant_type !== "squad" ||
                  userCanRegisterTeam(userTeam, user?.in_game_name)) && (
                  <LeaveEventModal
                    eventId={eventDetails.event_id}
                    eventName={eventDetails.event_name}
                    onSuccess={() => {
                      fetchEventDetails();
                      toast.info(t("detail.registered.leftToast"));
                    }}
                  />
                )}
            </div>
          ) : eventDetails.event_type === "external" &&
            !eventDetails.organization_name ? (
            // External (off-platform) registration is AFC-admin-only. Organizer events
            // (those with an organization) always register on-platform, so even if a
            // legacy org event still has event_type="external" in the DB, we never show
            // the "Register (External Link)" button for it. (Backend now forces org
            // events to internal; this is defense-in-depth for un-backfilled rows.)
            <Button
              onClick={() =>
                requireAuth(() =>
                  window.open(eventDetails.registration_link, "_blank"),
                )
              }
              disabled={
                eventDetails.event_status !== "upcoming" ||
                isEventEnded ||
                now < registrationOpenDateTime ||
                now > registrationCloseDateTime
              }
              className="w-full"
            >
              {!token
                ? t("detail.registerButton.loginToRegister")
                : isEventEnded
                  ? t("detail.registerButton.eventEnded")
                  : now < registrationOpenDateTime
                    ? t("detail.registerButton.registrationNotOpen")
                    : now > registrationCloseDateTime || eventDetails.event_status !== "upcoming"
                      ? t("detail.registerButton.registrationClosed")
                      : t("detail.registerButton.registerExternal")}
            </Button>
          ) : (
            <Button
              onClick={() => requireAuth(handleRegisterClick)}
              disabled={
                !!token &&
                (!!registrationDisabledReason ||
                  isCheckingInvite ||
                  (isInviteConsumed && !eventDetails.is_public))
              }
              className="w-full"
            >
              {!token
                ? t("detail.registerButton.loginToRegister")
                : isCheckingInvite
                  ? t("detail.registerButton.validatingInvite")
                  : isInviteConsumed && !eventDetails.is_public
                    ? t("detail.registerButton.inviteAlreadyUsed")
                    : registrationDisabledReason ||
                      (waitlistMode
                        ? t("detail.registerButton.joinWaitlist")
                        : // Paid events surface the fee on the CTA so it's clear before the
                          // user opens the register flow (which ends on the PAYMENT step).
                          isPaidEvent
                          ? t("detail.registerButton.registerPaid", {
                              fee: paidFeeLabel,
                            })
                          : t("detail.registerButton.registerForTournament"))}
            </Button>
          )}
        </div>
      )}

      {/* ── Sponsor requirements status (sponsor redesign P4) ──
          For registered users on events with entity sponsorships: the caller's
          own engagement submissions with pending/approved/rejected pills and the
          rejected-row resubmit loop (sponsorsApi.mySubmissions / resubmitSubmission).
          Sits right under the registration status on purpose. NOT gated to the
          captain: every rostered player has their own submissions to track. The
          card hides itself when the user has no submissions for this event. */}
      {/* NOT gated on is_registered: a pending-sponsor-approval competitor reads
          is_registered=false yet is exactly who must see their submission status
          (found in the 2026-06-13 Chrome walk). The card self-hides when the
          caller has no submissions, so mounting on any logged-in viewer is safe. */}
      {token && eventSponsorships.length > 0 && (
        <SponsorRequirementsCard eventId={eventDetails.event_id} />
      )}

      {/* ── Qualified field provenance (event linking P2) ──
          Public banner naming who qualified into this event through fired
          qualification links ("top N from <stage> of <source event>"). Renders
          nothing when the event has no fired inbound links, so it is mounted
          unconditionally. */}
      <div className="mt-4">
        <QualifiedFromBanner eventId={eventDetails.event_id} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-start gap-2">
            {eventDetails.participant_type === "squad" ? (
              <>
                <IconUsersGroup />
                {t("detail.registeredList.teamsTitle")}
              </>
            ) : (
              <>
                <IconUsers />
                {t("detail.registeredList.participantsTitle")}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center grid grid-cols-2 gap-2">
            {eventDetails.participant_type === "squad" && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2">
                  <p className="font-semibold text-lg md:text-2xl">
                    {eventDetails.tournament_teams.length || 0}
                  </p>
                  <p className="text-xs md:text-sm">
                    {t("detail.registeredList.totalTeams")}
                  </p>
                </CardContent>
              </Card>
            )}
            {eventDetails.participant_type === "solo" && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2">
                  <p className="font-semibold text-lg md:text-2xl">
                    {eventDetails?.registered_competitors?.length || 0}
                  </p>
                  <p className="text-xs md:text-sm">
                    {t("detail.registeredList.players")}
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <p className="font-semibold text-lg md:text-2xl">
                  {formatMoneyInput(
                    eventDetails?.max_teams_or_players -
                      (eventDetails?.registered_competitors?.length ||
                        eventDetails?.tournament_teams?.length ||
                        0),
                  )}
                </p>
                <p className="text-xs md:text-sm">
                  {t("detail.registeredList.slotLeft")}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-auto custom-scroll">
            {eventDetails.participant_type === "solo" &&
              eventDetails?.registered_competitors?.map(
                (reg: any, index: number) => (
                  <Card
                    className="hover:border-primary group cursor-pointer"
                    onClick={() => router.push(`/players/${reg.username}`)}
                    key={`competitor-${reg.id || index}`}
                  >
                    <CardContent className="flex items-center justify-between gap-2">
                      <div className="flex items-center justify-start gap-2">
                        <div className="px-4 py-2 rounded-full bg-primary text-white font-semibold text-base">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-white font-semibold group-hover:text-primary text-base">
                            {reg.username}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className="capitalize"
                        variant={statusVariant[reg.status]}
                      >
                        {reg.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ),
              )}
            {eventDetails.participant_type === "squad" &&
              eventDetails?.tournament_teams?.map(
                (team: any, index: number) => (
                  <Card
                    className="hover:border-primary group cursor-pointer"
                    onClick={() => router.push(`/teams/${team.team_name}`)}
                    key={`competitor-${team.id || index}`}
                  >
                    <CardContent className="flex items-center justify-between gap-2">
                      <div className="flex items-center justify-start gap-2">
                        <div className="px-4 py-2 rounded-full bg-primary text-white font-semibold text-base">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-white group-hover:text-primary font-semibold text-base">
                            {team.team_name}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className="capitalize"
                        variant={statusVariant[team.status]}
                      >
                        {team.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ),
              )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-2">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xl mb-3">
              {t("detail.rulesCard.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const textRules = eventDetails.event_rules;
              const documentUrl = (eventDetails as any).uploaded_rules_url;
              const hasDocument = documentUrl && documentUrl.startsWith("http");
              const hasTextRules = !!textRules;

              if (hasTextRules) {
                return (
                  <p className="text-sm whitespace-pre-wrap">{textRules}</p>
                );
              } else if (hasDocument) {
                return (
                  <div className="flex flex-col items-start space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t("detail.rulesCard.downloadableDoc")}
                    </p>
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => window.open(documentUrl, "_blank")}
                      className="w-full"
                    >
                      {t("detail.rulesCard.downloadButton")}
                    </Button>
                  </div>
                );
              } else {
                return (
                  <p className="text-sm text-gray-500">
                    {t("detail.rulesCard.pending")}
                  </p>
                );
              }
            })()}
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xl mb-3">
              {t("detail.prizeDistribution.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {Object.entries(eventDetails.prize_distribution)?.map(
                ([place, prize]) => (
                  <li key={place}>
                    {place.toUpperCase()}: {prize.toLocaleString()}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Rate this event + organizer feedback ──
          Logged-in users get editable stars + a private comment box; anonymous
          visitors see the aggregate read-only. Uses the numeric event_id the
          page already loaded. */}
      <EventReviewCard
        eventId={eventDetails.event_id}
        eventName={eventDetails.event_name}
      />

      {/* Banned Modal */}
      <Dialog open={showBannedModal} onOpenChange={setShowBannedModal}>
        <DialogContent className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <DialogTitle className="text-xl">
              {t("detail.bannedModal.title")}
            </DialogTitle>
            <DialogDescription className="mt-2 text-base">
              {eventDetails.participant_type === "squad"
                ? t("detail.bannedModal.team")
                : t("detail.bannedModal.account")}
            </DialogDescription>
            <Button
              className="mt-6 w-full"
              onClick={() => setShowBannedModal(false)}
            >
              {t("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team-event registration gate: clicked Register but NOT on any team (owner
          2026-06-21). Tells them it's a team tournament + points them to join a team. */}
      <Dialog open={showNoTeamModal} onOpenChange={setShowNoTeamModal}>
        <DialogContent className="sm:max-w-[420px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              {t("detail.registerGate.noTeam.title")}
            </DialogTitle>
            <DialogDescription className="mt-2 text-base">
              {t("detail.registerGate.noTeam.body")}
            </DialogDescription>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/teams">
                  {t("detail.registerGate.noTeam.cta")}
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNoTeamModal(false)}
              >
                {t("common.close")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team-event registration gate: clicked Register, on a team, but lacks an
          owner/captain/manager/coach role (owner 2026-06-21). */}
      <Dialog open={showRoleDeniedModal} onOpenChange={setShowRoleDeniedModal}>
        <DialogContent className="sm:max-w-[420px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">
              {t("detail.registerGate.roleDenied.title")}
            </DialogTitle>
            <DialogDescription className="mt-2 text-base">
              {t("detail.registerGate.roleDenied.body")}
            </DialogDescription>
            <Button
              className="mt-6 w-full"
              onClick={() => setShowRoleDeniedModal(false)}
            >
              {t("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Registration Modals */}
      {loadingTeam ? (
        <Dialog open={true}>
          <DialogContent>
            <div className="flex items-center justify-center p-8">
              <Loader text={t("detail.loadingTeamData")} />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <TeamRegistrationModals
          teamModalStep={teamModalStep}
          setTeamModalStep={setTeamModalStep}
          userTeam={userTeam}
          selectedMembers={selectedMembers}
          setSelectedMembers={setSelectedMembers}
          eventDetails={eventDetails}
          onContinueToRules={handleTeamContinueToRules}
        />
      )}

      {/* Solo Registration Modals */}
      <RegistrationModals
        eventDetails={{
          ...eventDetails,
          selectedTeamMembers: selectedTeamMembersData,
          validationResults: validationResults,
        }}
        userTeam={userTeam}
        token={token}
        modalStep={modalStep}
        setModalStep={setModalStep}
        handleSelectType={handleSelectType}
        handleGoToRules={handleGoToRules}
        rulesAccepted={rulesAccepted}
        setRulesAccepted={setRulesAccepted}
        handleRulesContinue={handleRulesContinue}
        handleDiscordConnect={handleDiscordConnect}
        uidInput={uidInput}
        setUidInput={setUidInput}
        savingUid={savingUid}
        handleSaveUid={handleSaveUid}
        uidMissingMembers={uidMissingMembers}
        handleJoinedServer={handleJoinedServer}
        startPaidRegistration={startPaidRegistration}
        pendingJoined={pendingJoined}
        wasWaitlisted={wasWaitlisted}
        isDiscordConnected={discordConnected}
        regType={regType}
        onCheckDiscordStatus={checkTeamDiscordStatus}
        isCheckingDiscord={isCheckingDiscord}
        isCheckingUserDiscord={isCheckingUserDiscord}
        isInAfcServer={isInAfcServer}
        checkUserDiscordStatus={checkUserDiscordStatus}
        copyAfcServerLink={copyAfcServerLink}
        teamAfcServerStatus={teamAfcServerStatus}
        soloSponsorUuid={soloSponsorUuid}
        setSoloSponsorUuid={setSoloSponsorUuid}
        teamSponsorUuids={teamSponsorUuids}
        setTeamSponsorUuids={setTeamSponsorUuids}
        eventSponsorships={eventSponsorships}
        soloEngagementAnswers={soloEngagementAnswers}
        setSoloEngagementAnswers={setSoloEngagementAnswers}
        teamEngagementAnswers={teamEngagementAnswers}
        setTeamEngagementAnswers={setTeamEngagementAnswers}
        pendingSponsorApproval={pendingSponsorApproval}
        rosterDiscordStatus={rosterDiscordStatus}
        isCheckingRosterDiscord={isCheckingRosterDiscord}
        onRecheckRosterDiscord={checkRosterDiscordStatus}
        currentUserId={currentUserId}
        hasResumableDraft={hasResumableDraft}
        onClearDraft={clearRegistrationDraft}
      />
    </div>
  );
};
