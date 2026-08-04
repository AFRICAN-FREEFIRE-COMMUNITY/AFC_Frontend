// ─────────────────────────────────────────────────────────────────────────────
// Admin > Events > [slug] > Team results  (owner backlog item 6, 2026-08-04).
//
// WHAT THIS PAGE IS: the organizer's review queue for results TEAMS filed themselves.
// Teams send their own row for a map, and nothing reaches the standings until someone here
// approves it. Approval writes through the same shared writer manual entry uses
// (afc_tournament_and_scrims/result_writes.py), which is what stops team-submitted results from
// ever disagreeing with organizer-entered ones.
//
// WHY A PAGE OF ITS OWN, rather than a card bolted onto the event detail page: reviewing is a
// task an organizer sits down to do, in the same way they sit down to do an OCR read. It mirrors
// the sibling route app/(a)/a/events/[slug]/ocr/ deliberately, down to the map picker, because
// an organizer who has used that screen already knows this one.
//
// HOW IT CONNECTS
//   - Event structure (stages > groups > maps) + numeric event_id:
//       POST /events/get-event-details/ { slug }  (afc_tournament_and_scrims.views
//       .get_event_details) -> res.data.event_details. Each match in a group IS one map, and a
//       submission is filed against a match_id, so the picked map is what the queue lists.
//   - The queue itself: TeamResultQueue (../_components/TeamResultQueue.tsx), which calls
//       lib/teamMapResults.ts -> events/team-map-results/{queue,<id>/approve,<id>/reject}/.
//   - The team's half of the same feature is components/events/TeamMapResultPanel.tsx, on the
//       public event page.
//   - The feature is OFF unless the organizer switched it on for this event
//       (Event.allow_team_result_submissions, edited on the Basic Info tab of the edit form).
//       This page says so rather than showing an empty queue that looks like nobody has filed
//       anything, which are two very different situations.
//
// i18n: admin is IN scope. Copy lives in the "teamResults" namespace, the same one the team's
// panel and the per-event switch read, so the three cannot drift apart.
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import axios from "axios";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FullLoader } from "@/components/Loader";
import { TeamResultQueue } from "../_components/TeamResultQueue";

/** One selectable map, flattened out of the event structure. Same shape the OCR page uses. */
interface MapOption {
  matchId: number;
  matchNumber?: number;
  matchMap?: string;
  stageName: string;
  groupName: string;
}

export default function AdminEventTeamResultsPage() {
  const t = useTranslations("teamResults");
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [maps, setMaps] = useState<MapOption[]>([]);
  const [matchId, setMatchId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!slug || !token) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        { slug },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } },
      );
      const details = res.data?.event_details;
      if (!details) return;
      setEventName(details.event_name ?? slug);
      setAllowed(Boolean(details.allow_team_result_submissions));

      // Flatten every group's matches into one picker. A match IS a map here, which is why the
      // label reads "map N" rather than naming a fixture.
      const flat: MapOption[] = [];
      for (const stage of details.stages ?? []) {
        for (const group of stage.groups ?? []) {
          for (const m of group.matches ?? []) {
            flat.push({
              matchId: m.match_id,
              matchNumber: m.match_number,
              matchMap: m.match_map,
              stageName: stage.stage_name ?? "",
              groupName: group.group_name ?? "",
            });
          }
        }
      }
      setMaps(flat);
      if (flat.length > 0) setMatchId(flat[0].matchId);
    } finally {
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <FullLoader text={t("queue.title")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("queue.title")}
        description={eventName ? `${eventName} - ${t("queue.subtitle")}` : t("queue.subtitle")}
      />

      {/* Off is not the same as empty, and an organizer reading an empty queue would assume
          nobody had filed anything. Say which it is. */}
      {allowed === false && (
        <Card>
          <CardContent className="py-6">
            <p className="text-xs text-muted-foreground">{t("team.closed")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings.help")}</p>
          </CardContent>
        </Card>
      )}

      {allowed && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("queue.team")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("queue.subtitle")}</Label>
              <Select
                value={matchId ? String(matchId) : undefined}
                onValueChange={(v) => setMatchId(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-96">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {maps.map((m) => (
                    <SelectItem key={m.matchId} value={String(m.matchId)}>
                      {[m.stageName, m.groupName].filter(Boolean).join(" / ")}
                      {m.matchNumber ? ` - ${m.matchNumber}` : ""}
                      {m.matchMap ? ` (${m.matchMap})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {matchId && <TeamResultQueue matchId={matchId} />}
        </>
      )}
    </div>
  );
}
