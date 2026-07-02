"use client";

// ── MediaAuditCard (owner 2026-07-02) ────────────────────────────────────────
// Broadcast-media hygiene inside the overlay studio (admin + organizer): see which registered TEAMS
// have no logo and which roster PLAYERS have no esport image; FLAG bad art (the owner gets a
// notification asking for a replacement); SUPPRESS a logo/image from THIS event's broadcast
// surfaces (per-event opt-out, upload untouched) or restore it.
// CONNECTS TO: events/<id>/media-audit|media-flags|media-opt-outs (views_media_audit.py).
// Mounted by EventOverlayStudio. i18n: organizer.mediaAudit.* (en → fr/pt via i18n:translate).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconFlag, IconLoader2, IconPhotoOff, IconPhotoCheck } from "@tabler/icons-react";

const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface TeamRow {
  team_id: number;
  team_name: string;
  has_logo: boolean;
  logo_url: string | null;
  suppressed: boolean;
  flagged: boolean;
}
interface PlayerRow {
  user_id: number;
  in_game_name: string;
  team_name: string | null;
  has_image: boolean;
  image_url: string | null;
  suppressed: boolean;
  flagged: boolean;
}

export function MediaAuditCard({ eventId }: { eventId: number }) {
  const t = useTranslations("organizer");
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/media-audit/`, { headers: authHeaders() });
      setTeams(res.data.teams ?? []);
      setPlayers(res.data.players ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("mediaAudit.loadError"));
    } finally {
      setLoading(false);
    }
  }, [base, t]);

  useEffect(() => {
    load();
  }, [load]);

  const flag = async (kind: "team_logo" | "esports_image", id: number) => {
    const reason = window.prompt(t("mediaAudit.flagReasonPrompt")) ?? "";
    try {
      await axios.post(
        `${base}/media-flags/`,
        { kind, team_id: kind === "team_logo" ? id : undefined, user_id: kind === "esports_image" ? id : undefined, reason },
        { headers: authHeaders() },
      );
      toast.success(t("mediaAudit.flagged"));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("mediaAudit.flagError"));
    }
  };

  const suppress = async (
    kind: "team_logo" | "esports_image",
    id: number,
    remove: boolean,
  ) => {
    try {
      await axios.post(
        `${base}/media-opt-outs/`,
        { kind, team_id: kind === "team_logo" ? id : undefined, user_id: kind === "esports_image" ? id : undefined, remove },
        { headers: authHeaders() },
      );
      toast.success(remove ? t("mediaAudit.restored") : t("mediaAudit.suppressed"));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("mediaAudit.suppressError"));
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-md border p-4 shadow-sm">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <IconLoader2 className="size-4 animate-spin" />
          {t("mediaAudit.loading")}
        </div>
      </div>
    );
  }

  const missingTeams = teams.filter((x) => !x.has_logo);
  const missingPlayers = players.filter((x) => !x.has_image);

  const Row = ({
    label,
    sub,
    img,
    missing,
    suppressedState,
    flaggedState,
    onFlag,
    onSuppress,
  }: {
    label: string;
    sub?: string | null;
    img: string | null;
    missing: boolean;
    suppressedState: boolean;
    flaggedState: boolean;
    onFlag: () => void;
    onSuppress: (remove: boolean) => void;
  }) => (
    <div className="flex items-center gap-2 py-1.5">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="size-7 rounded border object-contain" />
      ) : (
        <IconPhotoOff className="text-muted-foreground size-7 rounded border p-1" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{label}</p>
        {sub ? <p className="text-muted-foreground truncate text-[0.65rem]">{sub}</p> : null}
      </div>
      <div className="ml-auto flex items-center gap-1">
        {missing ? (
          <Badge variant="outline" className="rounded-full border-amber-500/50 px-2 py-0 text-[0.6rem] text-amber-500">
            {t("mediaAudit.missing")}
          </Badge>
        ) : (
          <>
            {flaggedState ? (
              <Badge variant="outline" className="rounded-full border-red-500/50 px-2 py-0 text-[0.6rem] text-red-500">
                {t("mediaAudit.flaggedBadge")}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[0.65rem]" onClick={onFlag}>
                <IconFlag className="size-3" />
                {t("mediaAudit.flag")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[0.65rem]"
              onClick={() => onSuppress(suppressedState)}
            >
              {suppressedState ? t("mediaAudit.restore") : t("mediaAudit.suppress")}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-md border p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <IconPhotoCheck className="text-primary size-4" />
        <h3 className="text-primary text-sm font-semibold">{t("mediaAudit.title")}</h3>
        <span className="text-muted-foreground ml-auto text-xs">
          {t("mediaAudit.summary", {
            teams: missingTeams.length,
            players: missingPlayers.length,
          })}
        </span>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">{t("mediaAudit.description")}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-1 text-[0.68rem] font-semibold uppercase tracking-wide">
            {t("mediaAudit.teamLogos")}
          </p>
          <div className="divide-border max-h-64 divide-y overflow-y-auto pr-1">
            {teams.length === 0 ? (
              <p className="text-muted-foreground py-3 text-xs italic">{t("mediaAudit.noTeams")}</p>
            ) : (
              teams.map((x) => (
                <Row
                  key={x.team_id}
                  label={x.team_name}
                  img={x.logo_url}
                  missing={!x.has_logo}
                  suppressedState={x.suppressed}
                  flaggedState={x.flagged}
                  onFlag={() => flag("team_logo", x.team_id)}
                  onSuppress={(remove) => suppress("team_logo", x.team_id, remove)}
                />
              ))
            )}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-[0.68rem] font-semibold uppercase tracking-wide">
            {t("mediaAudit.playerImages")}
          </p>
          <div className="divide-border max-h-64 divide-y overflow-y-auto pr-1">
            {players.length === 0 ? (
              <p className="text-muted-foreground py-3 text-xs italic">{t("mediaAudit.noPlayers")}</p>
            ) : (
              players.map((x) => (
                <Row
                  key={x.user_id}
                  label={x.in_game_name}
                  sub={x.team_name}
                  img={x.image_url}
                  missing={!x.has_image}
                  suppressedState={x.suppressed}
                  flaggedState={x.flagged}
                  onFlag={() => flag("esports_image", x.user_id)}
                  onSuppress={(remove) => suppress("esports_image", x.user_id, remove)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
