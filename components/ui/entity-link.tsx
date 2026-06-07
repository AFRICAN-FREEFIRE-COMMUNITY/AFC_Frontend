"use client";

// ── entity-link ──────────────────────────────────────────────────────────────
// Shared helpers that turn a player name or a team name into a subtle inline
// link to that entity's PUBLIC profile page. Used across the whole user-facing
// site (tournaments, leaderboards, teams, player-markets, rankings, awards,
// home, etc.) so every clickable name renders + behaves identically.
//
//   PlayerLink -> /players/<username>   (public Player Profile page)
//   TeamLink   -> /teams/<team_name>    (public Team page; id segment = team name)
//
// Design intent (per AFC design constants): styling stays SUBTLE so it does not
// disturb existing table/card layouts. Default look is the surrounding text
// colour with `hover:underline hover:text-primary` only. Callers can pass extra
// classes (e.g. `font-medium`) to match the cell/heading they sit in.
//
// Safety: the dynamic segment is always encodeURIComponent'd (player IGNs and
// team names can contain spaces / special chars). When the name is empty/missing
// we render the plain text fallback instead of a dead link, so nothing breaks.
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Subtle, shared link styling. Kept in one place so the whole sweep is uniform.
const SUBTLE_LINK = "hover:underline hover:text-primary transition-colors";

// Some tables (tournament standings, the Structure view) fall back to a SYNTHETIC
// placeholder when a row has no real competitor name yet: a placement marker like
// "#3" or an id-built label like "Player 5". Those are not routable entities, so we
// must render them as plain text instead of producing a dead link (/teams/%233).
function isPlaceholderName(name: string) {
  return name.startsWith("#") || /^Player \d+$/.test(name);
}

type EntityLinkProps = {
  // The visible label. Defaults to `name` when no children are supplied, so most
  // call sites can stay terse: <PlayerLink name={row.username} />.
  name: string | null | undefined;
  children?: React.ReactNode;
  className?: string;
  // Stop click/navigation from bubbling to a clickable parent (row onClick, etc.)
  // so wrapping the name in a link never double-fires the parent handler.
  stopPropagation?: boolean;
};

// Internal builder shared by both helpers. `hrefFor` maps a (decoded) name to the
// destination path; we encode here so callers never have to remember to.
function buildLink(
  prefix: "players" | "teams",
  { name, children, className, stopPropagation }: EntityLinkProps,
) {
  const label = children ?? name;
  // No usable name (empty) or a synthetic placeholder -> render plain text so we
  // never produce an empty/dead link.
  if (!name || isPlaceholderName(name)) return <>{label}</>;

  return (
    <Link
      href={`/${prefix}/${encodeURIComponent(name)}`}
      className={cn(SUBTLE_LINK, className)}
      onClick={
        stopPropagation ? (e) => e.stopPropagation() : undefined
      }
    >
      {label}
    </Link>
  );
}

// Player name -> public player profile (/players/<username>).
export function PlayerLink(props: EntityLinkProps) {
  return buildLink("players", props);
}

// Team name -> public team page (/teams/<team_name>).
export function TeamLink(props: EntityLinkProps) {
  return buildLink("teams", props);
}
