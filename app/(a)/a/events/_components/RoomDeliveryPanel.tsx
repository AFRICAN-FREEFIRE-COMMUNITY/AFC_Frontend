"use client";

// RoomDeliveryPanel (owner 2026-08-03)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// Answers the question an organizer actually has ten minutes before a match: "did the players get
// the room ID?"
//
// Until now the answer was unavailable. The send returned a count that was thrown away, so nobody
// could tell whether a single WhatsApp arrived, let alone which player was missing one. A player
// who never receives the room password does not play, so this is the most consequential message
// AFC sends.
//
// Rendered inside EditMatchModal, under the "Send to players" button.
//   GET  /events/match-room-delivery/?match_id=  per-player state
//   POST /events/resend-room-details/            retries ONLY the failures
// Both live in backend/afc_tournament_and_scrims/views_room_delivery.py and read
// afc_whatsapp.WhatsAppMessage rows, which Meta's status callbacks keep up to date.
//
// i18n: the `waDelivery` block of the existing `evEditStages` namespace, the same namespace the
// surrounding stages and groups tab already uses. The admin area IS in scope for translation
// (owner override), so this ships in en, fr and pt from creation.
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Send } from "lucide-react";

type PlayerRow = {
  user_id: number;
  username: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "no_number";
  has_number: boolean;
  error_code: number | null;
  error_title: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

type Summary = {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  no_number: number;
};

// Colour carries the same meaning as the words, so a glance is enough: red needs action,
// amber is in flight, green arrived. "no number" is grey because it is not a delivery
// failure, it is a missing detail on the player's profile, and resending cannot fix it.
const STATUS_CLASS: Record<PlayerRow["status"], string> = {
  failed: "border-destructive text-destructive",
  no_number: "border-muted-foreground text-muted-foreground",
  queued: "border-amber-500 text-amber-500",
  sent: "border-amber-500 text-amber-500",
  delivered: "border-primary text-primary",
  read: "border-primary text-primary",
};

// matchId is a string in EditMatchModal and a number in the API payloads, and this repo
// builds with ignoreBuildErrors on, so a mismatch here would not have failed the build.
// Accept both rather than pretend.
export function RoomDeliveryPanel({ matchId }: { matchId: string | number }) {
  const { token } = useAuth();
  const t = useTranslations("evEditStages");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [opened, setOpened] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/match-room-delivery/`,
        { params: { match_id: matchId }, headers: { Authorization: `Bearer ${token}` } },
      );
      setPlayers(res.data?.players ?? []);
      setSummary(res.data?.summary ?? null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || t("waDelivery.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [matchId, token]);

  // Only fetch once the organizer opens the panel: most of the time they are editing the room
  // details, not auditing a send that has not happened yet.
  useEffect(() => {
    if (opened) load();
  }, [opened, load]);

  const resendFailures = async () => {
    if (!token) return;
    setResending(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/resend-room-details/`,
        { match_id: matchId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(res.data?.message || "Resent.");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t("waDelivery.resendFailed"));
    } finally {
      setResending(false);
    }
  };

  if (!opened) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => setOpened(true)}
      >
        {t("waDelivery.open")}
      </button>
    );
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("waDelivery.title")}</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            {t("waDelivery.refresh")}
          </Button>
          {summary && summary.failed > 0 ? (
            <Button type="button" size="sm" onClick={resendFailures} disabled={resending}>
              {resending ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Send className="size-3 mr-1" />
              )}
              {t(summary.failed === 1 ? "waDelivery.resend" : "waDelivery.resendPlural",
                 { count: summary.failed })}
            </Button>
          ) : null}
        </div>
      </div>

      {summary ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("waDelivery.summary", {
            delivered: summary.delivered + summary.read,
            total: summary.total,
          })}
          {summary.failed > 0 ? t("waDelivery.summaryFailed", { count: summary.failed }) : ""}
          {summary.no_number > 0
            ? t("waDelivery.summaryNoNumber", { count: summary.no_number })
            : ""}
          .
        </p>
      ) : null}

      {/* Said plainly, because an organizer who reads "not read" as "did not arrive" will
          resend for no reason and pay for another conversation. */}
      <p className="mt-1 text-[11px] text-muted-foreground">{t("waDelivery.readNote")}</p>

      {loading && players.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("waDelivery.loading")}</p>
      ) : players.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("waDelivery.nothingSent")}</p>
      ) : (
        // Scrolls inside its own box: a 40 player group must not stretch the modal off screen,
        // and on a phone the modal is the whole screen.
        <ul className="mt-2 max-h-56 overflow-y-auto text-xs">
          {players.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">{p.username}</span>
              <span className="flex items-center gap-2">
                {p.status === "failed" && p.error_title ? (
                  <span className="max-w-[10rem] truncate text-muted-foreground" title={p.error_title}>
                    {p.error_title}
                  </span>
                ) : null}
                <Badge variant="outline" className={STATUS_CLASS[p.status]}>
                  {t(`waDelivery.status.${p.status}`)}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
