"use client";

// ── FanHater (owner 2026-06-20) ──────────────────────────────────────────────
// Public "I'm a fan" / "I'm a hater" reactions on a player or team profile. Counts
// are visible to everyone; tapping requires a session. One stance per viewer per
// subject (fan XOR hater) - tapping the active stance clears it, tapping the other
// switches. Backed by GET/POST /auth/sentiment/ (afc_auth.views_sentiment).
//
// Used on: app/(user)/players/[username] (PlayerClient, subjectType="player",
// targetId=player.user_id) and app/(user)/teams/[id] (subjectType="team",
// targetId=teamDetails.team_id). Copy: messages/en/teamsplayers.json -> sentiment.*.
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { IconThumbUp, IconThumbDown } from "@tabler/icons-react";

type Stance = "fan" | "hater" | null;

export function FanHater({
  subjectType,
  targetId,
  className = "",
}: {
  subjectType: "player" | "team";
  targetId: number | string | undefined;
  className?: string;
}) {
  const t = useTranslations("teamsplayers");
  const [fanCount, setFanCount] = useState(0);
  const [haterCount, setHaterCount] = useState(0);
  const [myStance, setMyStance] = useState<Stance>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const apply = (d: any) => {
    setFanCount(d?.fan_count ?? 0);
    setHaterCount(d?.hater_count ?? 0);
    setMyStance((d?.my_stance ?? null) as Stance);
  };

  // Load public counts (+ my stance if logged in) on mount / when the subject changes.
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    const token = Cookies.get("auth_token");
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/sentiment/`, {
        params: { subject_type: subjectType, target_id: targetId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then((res) => {
        if (!cancelled) {
          apply(res.data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectType, targetId]);

  const react = useCallback(
    async (stance: "fan" | "hater") => {
      if (busy || !targetId) return;
      const token = Cookies.get("auth_token");
      if (!token) {
        toast.error(t("sentiment.loginRequired"));
        return;
      }
      setBusy(true);
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/sentiment/set/`,
          { subject_type: subjectType, target_id: targetId, stance },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        apply(res.data);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t("sentiment.failed"));
      } finally {
        setBusy(false);
      }
    },
    [busy, targetId, subjectType, t],
  );

  if (!targetId || !loaded) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        size="sm"
        variant={myStance === "fan" ? "default" : "outline"}
        className={myStance === "fan" ? "" : "border-green-600/40 text-green-600 hover:bg-green-600/10 hover:text-green-600"}
        onClick={() => react("fan")}
        disabled={busy}
        aria-pressed={myStance === "fan"}
      >
        <IconThumbUp className="h-4 w-4" />
        {t("sentiment.fan")}
        <span className="ml-1 rounded-full bg-background/30 px-1.5 text-xs font-semibold">
          {fanCount}
        </span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={myStance === "hater" ? "destructive" : "outline"}
        className={myStance === "hater" ? "" : "border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"}
        onClick={() => react("hater")}
        disabled={busy}
        aria-pressed={myStance === "hater"}
      >
        <IconThumbDown className="h-4 w-4" />
        {t("sentiment.hater")}
        <span className="ml-1 rounded-full bg-background/30 px-1.5 text-xs font-semibold">
          {haterCount}
        </span>
      </Button>
    </div>
  );
}
