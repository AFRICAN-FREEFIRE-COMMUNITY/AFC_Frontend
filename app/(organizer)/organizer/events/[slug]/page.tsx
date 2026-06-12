// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › [slug] (event detail).
//
// The organizer-side EVENT DETAIL surface (event linking P2). Until now organizers
// only had per-task routes (edit / groups / leaderboard); this page is the hub:
// a summary header for one of the org's events, quick links to those task pages,
// and the LinkedEventsCard - the SAME qualification-chains card the admin event
// page mounts (create links, fire, allow/reject, decline/replace, undo, the
// standings-edited diff, the chain map and the "Import from events" merge).
// The backend already authorizes organizers on every link endpoint via
// org_can_event("can_edit_events", event) on BOTH ends; this page just gives them
// the UI.
//
// ── DATA SOURCE ──
//   1. GET /events/get-all-events/?organization_id=<id>  - the "notMine" guard the
//      sibling groups/leaderboard pages use: the slug must be one of THIS org's
//      events, else we show the not-found card (an organizer can never open
//      another org's event here).
//   2. POST /events/get-event-details/ { slug }          - the same public details
//      payload the admin page reads; we use event_id, stages (for the link create
//      dialog), status badges and headline counts.
//
// ── CONNECTS TO ──
//   components/event-links.tsx (LinkedEventsCard) -> lib/eventLinks.ts ->
//   afc_tournament_and_scrims/event_links.py. Linked from the organizer events
//   list (app/(organizer)/organizer/events/page.tsx row click/action).
//   Gate: can_edit_events || isOwner (the same permission the backend enforces
//   on the link endpoints).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconLock, IconPencil, IconTrophy, IconUsersGroup } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
// The shared qualification-chains card (same component the admin event page mounts).
import { LinkedEventsCard } from "@/components/event-links";
// Clash-Squad bracket card (sub-project C/E): generate/tree/results per CS stage.
import { H2HBracketCard } from "@/components/h2h-bracket";
import { useOrganizer } from "../../_components/OrganizerContext";

type Params = { slug: string };

// The slice of get-event-details this page reads (the payload is much larger;
// see the admin event page for the full shape).
interface EventDetails {
  event_id: number;
  event_name: string;
  event_status: string;
  participant_type: string;
  competition_type: string;
  max_teams_or_players: number;
  start_date: string | null;
  stages?: Array<{ stage_id: number; stage_name: string; stage_format?: string }>;
  // Registered teams (squad events): feed the Clash-Squad bracket seed picker.
  tournament_teams?: Array<{
    tournament_team_id: number;
    team_name: string;
    is_waitlisted?: boolean;
  }>;
}

export default function OrganizerEventDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = use(params);
  const { token } = useAuth();
  const { membership, isOwner } = useOrganizer();

  // Same gate the backend applies to every link endpoint for organizers.
  const canEdit = membership.permissions.can_edit_events || isOwner;
  const organizationId = membership.organization.organization_id;

  const [details, setDetails] = useState<EventDetails | null>(null);
  const [notMine, setNotMine] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canEdit) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        // 1. Ownership guard: the slug must be one of THIS org's events.
        const mine = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          { ...config, params: { organization_id: organizationId } },
        );
        const owned = (mine.data?.events ?? []).some((e: any) => e.slug === slug);
        if (!owned) {
          setNotMine(true);
          return;
        }
        // 2. The event details (stages feed the link create dialog).
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          { slug },
          config,
        );
        setDetails(res.data.event_details);
      } catch {
        setNotMine(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, token, organizationId, canEdit]);

  // ── permission lock (mirrors the sibling groups/leaderboard pages) ──
  if (!canEdit) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Event" description="Event detail and qualification links." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You don&apos;t have permission to manage this organization&apos;s events.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <FullLoader />;

  if (notMine || !details) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Event" description="Event detail and qualification links." />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            That event was not found in this organization.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={details.event_name}
        description="Manage this event's qualification links, or jump to its task pages."
      />

      {/* ── headline: status + type badges + the task-page quick links ── */}
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
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button asChild size="sm" variant="outline">
            <Link href={`/organizer/events/${slug}/edit`}>
              <IconPencil className="size-4" /> Edit
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/organizer/events/${slug}/groups`}>
              <IconUsersGroup className="size-4" /> Groups &amp; Rosters
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/organizer/events/${slug}/leaderboard`}>
              <IconTrophy className="size-4" /> Leaderboard
            </Link>
          </Button>
        </span>
      </div>

      {/* ── the qualification-chains card (shared with the admin event page) ── */}
      <LinkedEventsCard
        eventId={details.event_id}
        stages={(details.stages ?? []).map((s) => ({ id: s.stage_id, stage_name: s.stage_name }))}
      />

      {/* ── Clash-Squad brackets (sub-project E organizer parity) ──
          One bracket card per CS-format stage, the SAME component the admin
          Stages tab mounts; the backend authorizes organizers on generate
          (can_edit_events) and result entry (can_upload_results). */}
      {(details.stages ?? [])
        .filter((s) => String(s.stage_format || "").startsWith("cs"))
        .map((s) => (
          <H2HBracketCard
            key={s.stage_id}
            stageId={s.stage_id}
            stageName={s.stage_name}
            stageFormat={s.stage_format || ""}
            isManager
            registeredTeams={(details.tournament_teams ?? [])
              .filter((t) => !t.is_waitlisted && t.tournament_team_id)
              .map((t) => ({
                tournament_team_id: t.tournament_team_id,
                team_name: t.team_name,
              }))}
          />
        ))}
    </div>
  );
}
