"use client";

import { use, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconTrophy,
  IconCrosshair,
  IconAward,
  IconStar,
  IconUserCheck,
  IconX,
  IconSend,
  IconClock,
  IconShield,
  IconTarget,
  IconMessage,
  IconCalendar,
  IconAlertTriangle,
  IconBrandDiscord,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
// Subtle clickable names -> public team / player profiles.
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";
// Live refresh (owner 2026-07-02): site-wide heartbeat; re-runs the read-only
// application-details fetch (the trial chat below already polls itself every 5s).
import { useLiveTick } from "@/hooks/useLiveTick";
// i18n (next-intl): this page is fully localized under the "pmApplication" namespace
// (messages/en|fr|pt/pmApplication.json). Client component -> useTranslations.
import { useTranslations } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────────────────

// Shorthand for the next-intl translator returned by useTranslations, so the plain
// (non-component) helpers below can receive `t` and stay localized.
type TFn = ReturnType<typeof useTranslations>;

interface ApplicationDetails {
  id: number;
  status: string;
  applied_at: string;
  updated_at: string;
  application_message: string | null;
  reason: string | null;
  invite_expires_at: string | null;
  contact_unlocked: boolean;
  team: {
    id: number;
    name: string;
    tag: string | null;
    logo: string | null;
    tier: string;
    country: string;
  };
  post: {
    id: number;
    roles_needed: string[];
    commitment_type: string;
    minimum_tier_required: string;
    country: string | null;
    expiry: string;
  };
  stats: {
    tournament_wins: number;
    total_tournament_kills: number;
    tournament_finals_appearances: number;
    scrims_kills: number;
    scrims_wins: number;
  };
  chat_id: number | null;
}

interface ChatMessage {
  id: number;
  sender: string;
  sender_id: number;
  message: string;
  sent_at: string;
}

interface ChatData {
  chat_id: number;
  application_id: number;
  status: string;
  team: string;
  team_logo: string | null;
  player: string;
  messages: ChatMessage[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
  SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
  INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
  TRIAL_EXTENDED: "bg-purple-900/20 text-purple-400 border-purple-800",
  TRIAL_ONGOING: "bg-indigo-900/20 text-indigo-400 border-indigo-800",
  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
};

// Tier / commitment display labels now come from the "pmApplication" namespace
// (tier.*, commitment.*) via the tierLabel/commitmentLabel helpers in the page
// component, so the raw English maps that used to live here were removed.

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Colored status pill. The already-localized label is passed in by the caller
// (statusLabel() in the page component) so this module-level helper stays hook-free.
function getStatusBadge(status: string, label: string) {
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_COLORS[status] ?? ""}`}
    >
      {label}
    </Badge>
  );
}

function useCountdown(expiryDate: string | null) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!expiryDate) return;

    const calc = () => {
      const diff = new Date(expiryDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          expired: true,
        });
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  return timeLeft;
}

function TrialCountdown({ expiryDate }: { expiryDate: string }) {
  const t = useTranslations("pmApplication");
  const tc = useCountdown(expiryDate);
  if (!tc) return null;

  const totalHours = tc.days * 24 + tc.hours;
  const urgency = tc.expired
    ? "text-red-400"
    : totalHours < 12
      ? "text-red-400"
      : totalHours < 48
        ? "text-yellow-400"
        : "text-green-400";

  const icon =
    tc.expired || totalHours < 12 ? (
      <IconAlertTriangle className="h-4 w-4 shrink-0" />
    ) : (
      <IconClock className="h-4 w-4 shrink-0" />
    );

  // Build the compact "2d 3h 4m 5s" remaining string from localized unit parts,
  // dropping empty leading units, then interpolate it into the "expires in {time}"
  // sentence so the whole phrase stays translatable.
  const remaining = [
    tc.days > 0 ? t("units.days", { n: tc.days }) : null,
    tc.hours > 0 ? t("units.hours", { n: tc.hours }) : null,
    t("units.minutes", { n: tc.minutes }),
    t("units.seconds", { n: tc.seconds }),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${urgency}`}>
      {icon}
      {tc.expired ? (
        <span>{t("trial.expired")}</span>
      ) : (
        <span>{t("trial.expiresIn", { time: remaining })}</span>
      )}
    </div>
  );
}

// Relative "sent at" label. `t` is threaded in from the page component (this is a
// plain helper, not a component, so it cannot call useTranslations itself).
function formatMessageTime(dateString: string, t: TFn) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minsAgo", { n: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t("time.hoursAgo", { n: diffHours });
  return formatDate(dateString);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { token, user } = useAuth();
  const router = useRouter();
  // i18n translator for every user-facing string on this page.
  const t = useTranslations("pmApplication");

  // Localized display labels for backend enum values. Each falls back to the raw
  // value when a key is missing, mirroring the old `MAP[x] ?? x` behavior.
  const statusLabel = (s: string) =>
    t.has(`status.${s}`) ? t(`status.${s}`) : s.replace(/_/g, " ");
  const tierLabel = (tier: string) =>
    t.has(`tier.${tier}`) ? t(`tier.${tier}`) : tier;
  const commitmentLabel = (c: string) =>
    t.has(`commitment.${c}`) ? t(`commitment.${c}`) : c;

  const [details, setDetails] = useState<ApplicationDetails | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [actioning, startAction] = useTransition();
  const [contactInfo, setContactInfo] = useState<{ discord: string; uid: string } | null>(null);
  const [isUnlockingContact, setIsUnlockingContact] = useState(false);
  const [isFinalizingTrial, setIsFinalizingTrial] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live refresh (owner 2026-07-02): heartbeat tick so the application status / trial
  // state stays current without a manual refresh (the chat already polls every 5s).
  const tick = useLiveTick();

  // ── Fetch application details ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    // Live refresh (owner 2026-07-02): background refreshes (tick > 0) skip the loading
    // flag + error toast so the page never flashes while typing in the chat below.
    if (tick === 0) setLoadingDetails(true);
    axios
      .get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/application-details/?application_id=${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => setDetails(res.data))
      .catch(() => {
        if (tick === 0) toast.error(t("toast.loadFailed"));
      })
      .finally(() => setLoadingDetails(false));
  }, [token, id, tick]);

  // ── Fetch + poll messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !details?.chat_id) return;

    const fetchMessages = () => {
      axios
        .get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chat/messages/?chat_id=${details.chat_id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((res) => setChatData(res.data))
        .catch(() => {});
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [token, details?.chat_id]);

  // ── Auto-scroll to latest message ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages.length]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isPlayer =
    !!user && !!chatData && user.in_game_name === chatData.player;
  const isTeamSide = !isPlayer;
  const isTrialActive =
    details?.status === "TRIAL_ONGOING" || details?.status === "TRIAL_EXTENDED";
  const isSettled =
    details?.status === "ACCEPTED" || details?.status === "REJECTED";

  // ── Status actions ────────────────────────────────────────────────────────
  const handleAction = (action: string) => {
    if (!details) return;
    startAction(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/update-application-status/`,
          { application_id: details.id, action },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const updated = res.data?.application;
        if (updated) {
          setDetails((prev) =>
            prev ? { ...prev, status: updated.status } : prev,
          );
        } else {
          const statusMap: Record<string, string> = {
            SHORTLIST: "SHORTLISTED",
            INVITE: "INVITED",
            REJECT: "REJECTED",
            ACCEPT: "ACCEPTED",
            EXTEND_TRIAL: "TRIAL_EXTENDED",
          };
          setDetails((prev) =>
            prev ? { ...prev, status: statusMap[action] ?? prev.status } : prev,
          );
        }
        toast.success(t("toast.statusUpdated"));
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t("toast.statusFailed"));
      }
    });
  };

  // ── Unlock contact info ───────────────────────────────────────────────────
  const handleUnlockContact = async () => {
    if (!details) return;
    setIsUnlockingContact(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/get-player-contact/`,
        { application_id: details.id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setContactInfo(res.data);
      setDetails((prev) => prev ? { ...prev, contact_unlocked: true } : prev);
      toast.success(t("toast.contactUnlocked"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toast.contactFailed"));
    } finally {
      setIsUnlockingContact(false);
    }
  };

  // ── Finalize trial (accept / reject / extend) ─────────────────────────────
  const handleFinalizeTrial = async (action: "ACCEPT" | "REJECT" | "EXTEND") => {
    if (!details) return;
    setIsFinalizingTrial(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/finalize-trial/`,
        { application_id: details.id, action },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const statusMap: Record<string, string> = {
        ACCEPT: "ACCEPTED",
        REJECT: "REJECTED",
        EXTEND: "TRIAL_EXTENDED",
      };
      setDetails((prev) => prev ? { ...prev, status: statusMap[action] ?? prev.status } : prev);
      toast.success(t("toast.trialUpdated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toast.trialFailed"));
    } finally {
      setIsFinalizingTrial(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !chatData) return;
    setSending(true);
    setMessageText("");
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chat/send/`,
        { chat_id: String(chatData.chat_id), message: text },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const newMsg: ChatMessage = res.data;
      setChatData((prev) =>
        prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev,
      );
    } catch {
      toast.error(t("toast.messageFailed"));
      setMessageText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loadingDetails) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">
        {t("loading")}
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">{t("notFound.title")}</p>
        <Button variant="outline" asChild>
          <Link href="/player-markets">{t("notFound.back")}</Link>
        </Button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── Details column (reused in both mobile tabs & desktop grid) ────────────
  const detailsColumn = (
    <div className="space-y-2">
          {/* Team card */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <IconShield className="h-4 w-4" />
                {t("team.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={details.team.logo ?? DEFAULT_PROFILE_PICTURE}
                  />
                  <AvatarFallback>
                    {details.team.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{details.team.name}</p>
                  {details.team.tag && (
                    <p className="text-xs text-muted-foreground">
                      [{details.team.tag}]
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-1">
                <div>
                  <p className="text-muted-foreground">{t("team.tier")}</p>
                  <p className="font-medium text-base">
                    {tierLabel(details.team.tier)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("team.country")}</p>
                  <p className="font-medium text-base">
                    {details.team.country}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Post requirements */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <IconTarget className="h-4 w-4" />
                {t("post.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-1.5">{t("post.rolesNeeded")}</p>
                <div className="flex flex-wrap gap-1">
                  {details.post.roles_needed.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-y-4">
                <div>
                  <p className="text-muted-foreground">{t("post.commitment")}</p>
                  <p className="font-medium">
                    {commitmentLabel(details.post.commitment_type)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("post.minTier")}</p>
                  <p className="font-medium">
                    {tierLabel(details.post.minimum_tier_required)}
                  </p>
                </div>
                {details.post.country && (
                  <div>
                    <p className="text-muted-foreground">{t("post.country")}</p>
                    <p className="font-medium">{details.post.country}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">{t("post.expiry")}</p>
                  <p className="font-medium">
                    {formatDate(details.post.expiry)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Player stats */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <IconTrophy className="h-4 w-4" />
                {t("stats.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-1 mb-2">
                <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <IconTrophy className="h-3.5 w-3.5 mx-auto mb-1 text-yellow-400" />
                  <p className="text-lg font-bold">
                    {details.stats.tournament_wins}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {t("stats.tournamentWins")}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <IconCrosshair className="h-3.5 w-3.5 mx-auto mb-1 text-red-400" />
                  <p className="text-lg font-bold">
                    {details.stats.total_tournament_kills}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {t("stats.tournamentKills")}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <IconAward className="h-3.5 w-3.5 mx-auto mb-1 text-blue-400" />
                  <p className="text-lg font-bold">
                    {details.stats.tournament_finals_appearances}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {t("stats.finals")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">{t("stats.scrimKills")}</p>
                  <p className="text-lg font-bold">
                    {details.stats.scrims_kills}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">{t("stats.scrimWins")}</p>
                  <p className="text-lg font-bold">
                    {details.stats.scrims_wins}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          {isTeamSide && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <IconBrandDiscord className="h-4 w-4" />
                  {t("contact.title")}
                  <InfoTip id="player_market.unlock_contact" />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                {contactInfo ? (
                  <>
                    <div>
                      <p className="text-muted-foreground">{t("contact.discord")}</p>
                      <p className="font-medium">{contactInfo.discord}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("contact.uid")}</p>
                      <p className="font-medium">{contactInfo.uid}</p>
                    </div>
                  </>
                ) : details.contact_unlocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={handleUnlockContact}
                    disabled={isUnlockingContact}
                  >
                    <IconBrandDiscord className="h-3.5 w-3.5 mr-1.5" />
                    {isUnlockingContact ? t("contact.loading") : t("contact.view")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleUnlockContact}
                    disabled={isUnlockingContact || details.status === "PENDING"}
                  >
                    <IconBrandDiscord className="h-3.5 w-3.5 mr-1.5" />
                    {isUnlockingContact ? t("contact.unlocking") : t("contact.unlock")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Application message */}
          {details.application_message && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-semibold">
                  {t("applicationMessage")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  &ldquo;{details.application_message}&rdquo;
                </p>
              </CardContent>
            </Card>
          )}

          {/* Rejection reason */}
          {details.status === "REJECTED" && details.reason && (
            <Card className="border-red-800/40">
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-semibold text-red-400">
                  {t("rejectionReason")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {details.reason}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Team-side actions ── */}
          {isTeamSide && !isSettled && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-semibold">{t("actions.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isTrialActive ? (
                  <>
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={isFinalizingTrial}
                      onClick={() => handleFinalizeTrial("ACCEPT")}
                    >
                      <IconCheck className="h-4 w-4 mr-1.5" />
                      {t("actions.acceptPlayer")}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      disabled={isFinalizingTrial}
                      onClick={() => handleFinalizeTrial("EXTEND")}
                    >
                      <IconCalendar className="h-4 w-4 mr-1.5" />
                      {t("actions.extendTrial")}
                    </Button>
                    <Button
                      className="w-full"
                      variant="destructive"
                      size="sm"
                      disabled={isFinalizingTrial}
                      onClick={() => handleFinalizeTrial("REJECT")}
                    >
                      <IconX className="h-4 w-4 mr-1.5" />
                      {t("actions.reject")}
                    </Button>
                  </>
                ) : (
                  <>
                    {details.status === "PENDING" && (
                      <Button
                        className="w-full"
                        variant="outline"
                        size="sm"
                        disabled={actioning}
                        onClick={() => handleAction("SHORTLIST")}
                      >
                        <IconStar className="h-4 w-4 mr-1.5" />
                        {t("actions.shortlist")}
                      </Button>
                    )}
                    {(details.status === "PENDING" ||
                      details.status === "SHORTLISTED") && (
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={actioning}
                        onClick={() => handleAction("INVITE")}
                      >
                        <IconUserCheck className="h-4 w-4 mr-1.5" />
                        {t("actions.inviteToTrial")}
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      variant="destructive"
                      size="sm"
                      disabled={actioning}
                      onClick={() => handleAction("REJECT")}
                    >
                      <IconX className="h-4 w-4 mr-1.5" />
                      {t("actions.reject")}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
    </div>
  );

  // ── Chat card (reused in both mobile tabs & desktop grid) ─────────────────
  const chatCard = (
    <Card className="flex flex-col h-[calc(100svh-200px)] lg:h-[calc(100vh-220px)]">
      <CardHeader className="border-b shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconMessage className="h-4 w-4 text-muted-foreground" />
          {t("chat.title")}
          <InfoTip id="player_market.trial_chat" />
        </CardTitle>
        {chatData && (
          <CardDescription>
            {/* Both names link to their public profiles. */}
            <TeamLink name={chatData.team} /> &amp;{" "}
            <PlayerLink name={chatData.player} />
          </CardDescription>
        )}
      </CardHeader>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {!chatData ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                {isTrialActive ? (
                  <p className="text-sm">{t("chat.loading")}</p>
                ) : (
                  <>
                    <IconMessage className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">{t("chat.notAvailable")}</p>
                    <p className="text-xs text-center">
                      {t("chat.notAvailableHint")}
                    </p>
                  </>
                )}
              </div>
            ) : chatData.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <IconMessage className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">{t("chat.empty")}</p>
                <p className="text-xs">{t("chat.emptyHint")}</p>
              </div>
            ) : (
              chatData.messages.map((msg) => {
                const isMine = msg.sender === user?.in_game_name;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                      <AvatarImage src={DEFAULT_PROFILE_PICTURE} />
                      <AvatarFallback className="text-xs">
                        {msg.sender.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`max-w-[72%] space-y-0.5 ${isMine ? "items-end" : "items-start"} flex flex-col`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted rounded-tl-sm"
                        }`}
                      >
                        {msg.message}
                      </div>
                      <p className="text-[10px] text-muted-foreground px-1">
                        {formatMessageTime(msg.sent_at, t)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 border-t shrink-0">
            {!chatData || isSettled ? (
              <p className="text-xs text-center text-muted-foreground py-1">
                {isSettled ? t("chat.closed") : t("chat.locked")}
              </p>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <Input
                  ref={inputRef}
                  placeholder={t("chat.placeholder")}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={sending}
                  className="flex-1"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !messageText.trim()}
                >
                  {sending ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconSend className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}
          </div>
        </Card>
  );

  // ─── Page return ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <PageHeader
          back
          title={t("header.title", { id: details.id })}
          description={t("header.applied", { date: formatDate(details.applied_at) })}
        />
        <div className="ml-auto">
          {getStatusBadge(details.status, statusLabel(details.status))}
        </div>
      </div>

      {/* ── Trial countdown ── */}
      {isTrialActive && details.invite_expires_at && (
        <div className="rounded-lg border px-4 py-3">
          <TrialCountdown expiryDate={details.invite_expires_at} />
        </div>
      )}

      {/* ── Mobile: tabs ─────────────────────────────────────────────── */}
      <div className="lg:hidden">
        <Tabs defaultValue="details">
          <TabsList className="w-full mb-3">
            <TabsTrigger value="details" className="flex-1">
              {t("tabs.details")}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">
              <IconMessage className="h-3.5 w-3.5 mr-1.5" />
              {t("tabs.chat")}
              {!details.chat_id && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  {t("tabs.locked")}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details">{detailsColumn}</TabsContent>
          <TabsContent value="chat">{chatCard}</TabsContent>
        </Tabs>
      </div>

      {/* ── Desktop: side-by-side grid ────────────────────────────────── */}
      <div className="hidden lg:grid grid-cols-[360px_1fr] gap-2 items-start">
        {detailsColumn}
        {chatCard}
      </div>
    </div>
  );
}
