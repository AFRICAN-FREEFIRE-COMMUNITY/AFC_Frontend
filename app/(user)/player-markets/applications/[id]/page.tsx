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

// ─── Types ───────────────────────────────────────────────────────────────────

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

const TIER_LABELS: Record<string, string> = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
};

const COMMITMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_COLORS[status] ?? ""}`}
    >
      {status.replace(/_/g, " ")}
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
  const t = useCountdown(expiryDate);
  if (!t) return null;

  const totalHours = t.days * 24 + t.hours;
  const urgency = t.expired
    ? "text-red-400"
    : totalHours < 12
      ? "text-red-400"
      : totalHours < 48
        ? "text-yellow-400"
        : "text-green-400";

  const icon =
    t.expired || totalHours < 12 ? (
      <IconAlertTriangle className="h-4 w-4 shrink-0" />
    ) : (
      <IconClock className="h-4 w-4 shrink-0" />
    );

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${urgency}`}>
      {icon}
      {t.expired ? (
        <span>Trial period has expired</span>
      ) : (
        <span>
          Trial expires in {t.days > 0 && `${t.days}d `}
          {t.hours > 0 && `${t.hours}h `}
          {t.minutes}m {t.seconds}s
        </span>
      )}
    </div>
  );
}

function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
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

  const [details, setDetails] = useState<ApplicationDetails | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [actioning, startAction] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch application details ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setLoadingDetails(true);
    axios
      .get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/application-details/?application_id=${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => setDetails(res.data))
      .catch(() => toast.error("Failed to load application details."))
      .finally(() => setLoadingDetails(false));
  }, [token, id]);

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
        toast.success("Status updated.");
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to update status.");
      }
    });
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
      toast.error("Failed to send message.");
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
        Loading...
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">Application not found.</p>
        <Button variant="outline" asChild>
          <Link href="/player-markets">Back to Player Markets</Link>
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
                Team
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
                  <p className="text-muted-foreground">Tier</p>
                  <p className="font-medium text-base">
                    {TIER_LABELS[details.team.tier] ?? details.team.tier}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Country</p>
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
                Post Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-1.5">Roles Needed</p>
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
                  <p className="text-muted-foreground">Commitment</p>
                  <p className="font-medium">
                    {COMMITMENT_LABELS[details.post.commitment_type] ??
                      details.post.commitment_type}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Min Tier</p>
                  <p className="font-medium">
                    {TIER_LABELS[details.post.minimum_tier_required] ??
                      details.post.minimum_tier_required}
                  </p>
                </div>
                {details.post.country && (
                  <div>
                    <p className="text-muted-foreground">Country</p>
                    <p className="font-medium">{details.post.country}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Post Expiry</p>
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
                Player Stats
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
                    T. Wins
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <IconCrosshair className="h-3.5 w-3.5 mx-auto mb-1 text-red-400" />
                  <p className="text-lg font-bold">
                    {details.stats.total_tournament_kills}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    T. Kills
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <IconAward className="h-3.5 w-3.5 mx-auto mb-1 text-blue-400" />
                  <p className="text-lg font-bold">
                    {details.stats.tournament_finals_appearances}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Finals
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">Scrim Kills</p>
                  <p className="text-lg font-bold">
                    {details.stats.scrims_kills}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">Scrim Wins</p>
                  <p className="text-lg font-bold">
                    {details.stats.scrims_wins}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          {details.contact_unlocked && chatData && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <IconBrandDiscord className="h-4 w-4" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div>
                  <p className="text-muted-foreground">Player IGN</p>
                  <p className="font-medium">{chatData.player}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Application message */}
          {details.application_message && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-semibold">
                  Application Message
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
                  Rejection Reason
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
                <CardTitle className="text-sm font-semibold">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isTrialActive ? (
                  <>
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={actioning}
                      onClick={() => handleAction("ACCEPT")}
                    >
                      <IconCheck className="h-4 w-4 mr-1.5" />
                      Accept Player
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      disabled={actioning}
                      onClick={() => handleAction("EXTEND_TRIAL")}
                    >
                      <IconCalendar className="h-4 w-4 mr-1.5" />
                      Extend Trial
                    </Button>
                    <Button
                      className="w-full"
                      variant="destructive"
                      size="sm"
                      disabled={actioning}
                      onClick={() => handleAction("REJECT")}
                    >
                      <IconX className="h-4 w-4 mr-1.5" />
                      Reject
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
                        Shortlist
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
                        Invite to Trial
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
                      Reject
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
          Trial Chat
        </CardTitle>
        {chatData && (
          <CardDescription>{chatData.team} &amp; {chatData.player}</CardDescription>
        )}
      </CardHeader>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {!chatData ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                {isTrialActive ? (
                  <p className="text-sm">Loading messages...</p>
                ) : (
                  <>
                    <IconMessage className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">Chat not available</p>
                    <p className="text-xs text-center">
                      Chat becomes available once a trial is started
                    </p>
                  </>
                )}
              </div>
            ) : chatData.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <IconMessage className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs">Start the conversation below</p>
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
                        {formatMessageTime(msg.sent_at)}
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
                {isSettled
                  ? "This application is closed."
                  : "Chat is not yet available."}
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
                  placeholder="Type a message..."
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
          title={`Application #${details.id}`}
          description={`Applied ${formatDate(details.applied_at)}`}
        />
        <div className="ml-auto">{getStatusBadge(details.status)}</div>
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
              Details
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">
              <IconMessage className="h-3.5 w-3.5 mr-1.5" />
              Chat
              {!details.chat_id && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  (locked)
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
