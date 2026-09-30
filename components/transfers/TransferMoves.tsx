// components/transfers/TransferMoves.tsx
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The latest player moves (joined / left a team), as a short list for the HOME surfaces (owner
// 2026-09-30, inbox #93 / #96 / #102: "a section that showed when people joined or left teams to the
// public ... on the homepage"; placement "both"; the lock badge on leaves only).
//
// Two callers, one data hook and one row, so the two surfaces can never disagree:
//   - components/home/HomeTransfers.tsx          the card on /home (signed in), under Featured Shop
//   - app/(root)/_components/LandingTransfers.tsx the "Who's moving in AFC" section on / (public)
// The full, filterable feed is still components/news/TransferFeed.tsx on /news?category=transfers.
//
// DATA: GET team/transfers/?limit=N (backend afc_team/views_transfers.py, public, no auth). Rows are
// written by the TeamMembers signals, so nobody maintains this list. The backend already keeps it to
// teams that have competed.
//
// THE LOCK BADGE (owner 2026-09-30, "okay" to the proposal): shown only on a player who LEFT while
// the transfer window was shut. Since #92 joining during a shut window is normal, so a badge on joins
// would sit on almost every row and mean nothing; a leave while shut really is out of the ordinary.
//
// Sentences come from the "news" namespace (transfers.entry.joined / left, ICU rich text with the
// names as placeholders), the same strings the feed uses, so a translation fixed once is fixed in
// all three places. Links go through lib/routes.ts (names are percent-encoded, NG.KILLA-safe).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconLock, IconMinus, IconPlus } from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { useLiveTick } from "@/hooks/useLiveTick";
import { env } from "@/lib/env";
import { playerPath, teamPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type TransferMove = {
  transfer_id: number;
  direction: "joined" | "left";
  player_username: string;
  player_exists: boolean;
  team_id: number | null;
  team_name: string;
  team_logo: string | null;
  management_role: string | null;
  occurred_at: string;
  /** true = window open when it happened, false = shut, null = no season. */
  in_transfer_window: boolean | null;
};

type State = { rows: TransferMove[]; total: number; loading: boolean; failed: boolean };

/** The latest `limit` moves, refreshed on the site-wide live tick without flashing a loader. */
export function useLatestTransfers(limit: number) {
  const tick = useLiveTick();
  const [state, setState] = useState<State>({ rows: [], total: 0, loading: true, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const background = tick > 0 && attempt === 0;
    const load = async () => {
      try {
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/transfers/`, {
          params: { limit, offset: 0 },
        });
        if (!cancelled) {
          setState({ rows: res.data?.results ?? [], total: res.data?.total_count ?? 0, loading: false, failed: false });
        }
      } catch {
        // A background refresh never blanks a list that is already on screen.
        if (!cancelled && !background) setState((s) => ({ ...s, loading: false, failed: true }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [limit, tick, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, failed: false }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}

/** "Today" / "Yesterday" by the viewer's own calendar, else the date in their language. */
function MoveDate({ iso }: { iso: string }) {
  const t = useTranslations("home");
  const when = new Date(iso);
  const today = new Date();
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(when) === dayKey(today)) return <>{t("transfers.today")}</>;
  if (dayKey(when) === dayKey(yesterday)) return <>{t("transfers.yesterday")}</>;
  return <LocalTime value={iso} mode="date" />;
}

const KNOWN_ROLES = ["team_captain", "vice_captain", "coach", "manager", "analyst"];

export function TransferMoveRow({ move, surface = "card" }: { move: TransferMove; surface?: "card" | "page" }) {
  const t = useTranslations("news");
  const th = useTranslations("home");
  const [logoFailed, setLogoFailed] = useState(false);
  const joined = move.direction === "joined";
  const leftWhileShut = !joined && move.in_transfer_window === false;
  const role = joined && move.management_role && KNOWN_ROLES.includes(move.management_role)
    ? t(`transfers.roles.${move.management_role}`)
    : null;

  const name = (chunks: React.ReactNode, href: string | null) =>
    href ? (
      <Link href={href} className="font-bold text-foreground hover:text-primary">
        {chunks}
      </Link>
    ) : (
      <span className="font-bold text-foreground">{chunks}</span>
    );

  return (
    <li
      className={cn(
        "grid grid-cols-[40px_1fr] items-center gap-x-3 gap-y-0.5 rounded-md px-3 py-2.5 sm:grid-cols-[40px_1fr_auto]",
        // A step off whatever it sits on: inside a card on /home, straight on the page on /.
        surface === "card" ? "bg-muted/40 hover:bg-muted/70" : "bg-card hover:bg-muted/60",
      )}
    >
      <span className="relative row-span-2 size-10 self-center sm:row-span-1" aria-hidden="true">
        {move.team_logo && !logoFailed ? (
          <Image
            src={move.team_logo}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-md bg-muted object-cover"
            // A logo that will not load falls back to the team's initial, never a broken image.
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-md bg-muted font-bold text-muted-foreground">
            {move.team_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span
          className={cn(
            "absolute -right-1.5 -bottom-1.5 grid size-[18px] place-items-center rounded-full bg-card",
            joined ? "text-primary" : "text-muted-foreground",
          )}
        >
          {joined ? <IconPlus className="size-3" stroke={3} /> : <IconMinus className="size-3" stroke={3} />}
        </span>
      </span>

      {/* The words between the two names ARE the verb in every language ("joined", "a rejoint",
          "entrou para"), so colouring the line and keeping the names white colours just the verb. */}
      <p className={cn("min-w-0 text-sm break-words", joined ? "text-primary" : "text-muted-foreground")}>
        {t.rich(joined ? "transfers.entry.joined" : "transfers.entry.left", {
          playerName: move.player_username,
          teamName: move.team_name,
          pl: (chunks) => name(chunks, move.player_exists ? playerPath(move.player_username) : null),
          tm: (chunks) => name(chunks, move.team_id ? teamPath(move.team_name) : null),
        })}
        {role && <span className="text-muted-foreground"> {t("transfers.entry.asRole", { role })}</span>}
      </p>

      <span className="flex items-center gap-2 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
        <span className="tabular-nums whitespace-nowrap">
          <MoveDate iso={move.occurred_at} />
        </span>
        {leftWhileShut && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-semibold whitespace-nowrap text-destructive"
            title={th("transfers.leftWhileShutHint")}
          >
            <IconLock className="size-3" aria-hidden="true" />
            {t("transfers.window.outside")}
          </span>
        )}
      </span>
    </li>
  );
}

/** Loading, error, empty and the list itself: every surface shows the same four states. */
export function TransferMovesBody({
  data,
  count,
  surface,
  className,
}: {
  data: ReturnType<typeof useLatestTransfers>;
  count: number;
  surface: "card" | "page";
  className?: string;
}) {
  const t = useTranslations("news");
  const th = useTranslations("home");

  if (data.loading) {
    return (
      <div className={cn("space-y-1", className)} aria-busy="true" aria-label={t("transfers.loading")}>
        {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
          <div key={i} className={cn("h-14 rounded-md", surface === "card" ? "bg-muted/40" : "bg-card")} />
        ))}
      </div>
    );
  }
  if (data.failed) {
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 p-3 text-sm", className)}>
        <span>{t("transfers.error")}</span>
        <button
          type="button"
          onClick={data.retry}
          className="rounded-md bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/70"
        >
          {th("transfers.retry")}
        </button>
      </div>
    );
  }
  if (data.rows.length === 0) {
    return (
      <div className={cn("py-6 text-center", className)}>
        <p className="font-semibold">{t("transfers.empty.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("transfers.empty.body")}</p>
      </div>
    );
  }
  return (
    // A page section lays the moves out in two columns from md up; a card stacks them.
    <ul className={cn(surface === "page" ? "grid gap-1.5 md:grid-cols-2" : "space-y-1", className)}>
      {data.rows.slice(0, count).map((move) => (
        <TransferMoveRow key={move.transfer_id} move={move} surface={surface} />
      ))}
    </ul>
  );
}
