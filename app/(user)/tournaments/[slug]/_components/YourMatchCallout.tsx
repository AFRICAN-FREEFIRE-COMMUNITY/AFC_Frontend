"use client";

// YourMatchCallout
// ────────────────
// A prominent, top-of-page card for REGISTERED participants that surfaces the two pieces of
// info players actually need without digging into the Structure tab + tapping a stage:
//   1. WHEN they play (their group's date + time, in the viewer's own timezone), and
//   2. their ROOM ID / NAME / PASSWORD the moment the organizer posts them (with copy buttons).
//
// WHY (owner 2026-06-29): the same data lived only inside TournamentStructure -> Structure tab ->
// tap a stage -> find your group -> scroll to room details, which players were not discovering.
//
// HOW IT CONNECTS:
//   - Rendered by EventDetailsWrapper above the Results/Structure toggle, only when is_registered.
//   - Data is the SAME `stages` payload the page already has. The backend marks the viewer's own
//     group with `is_my_group` (get_event_details), and room creds are gated to that group
//     (_can_see_room) + only after the organizer posts them (match.room_details_released).
//   - LocalTime (date) + LocalEventTime (dual-tz time) render the schedule in the viewer's locale.
// ─────────────────────────────────────────────────────────────────────────────
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, KeyRound, Copy, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/LocalTime";
import { LocalEventTime } from "@/components/LocalEventTime";
import { Room3dJoinHelp } from "@/components/Room3dJoinHelp";

interface MatchRow {
  match_id: number;
  match_number: number;
  match_map?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  room_password?: string | null;
  /** Is this map a 3D custom room? Not a credential, so the backend sends it whether or not the
   *  room details have been released. */
  room_is_3d?: boolean;
  // True when the organizer has posted a room for this match but the creds aren't visible yet
  // (e.g. pre-release for non-members); for the viewer's own group it accompanies the creds.
  room_details_released?: boolean;
}
interface Group {
  group_id: number;
  group_name: string;
  is_my_group?: boolean;
  playing_date?: string | null;
  playing_time?: string | null;
  match_maps?: string[] | null;
  matches?: MatchRow[];
}
interface Stage {
  stage_id: number;
  stage_name: string;
  groups: Group[];
}

interface Props {
  stages: Stage[];
  isRegistered: boolean;
  timezone?: string | null;
}

// A flat "my group" entry carrying its parent stage name for the heading.
interface MyEntry {
  stageName: string;
  group: Group;
}

export function YourMatchCallout({ stages, isRegistered, timezone }: Props) {
  const t = useTranslations("tournaments");

  // Only registered participants have a "my group"; never render for anonymous / non-members.
  if (!isRegistered || !Array.isArray(stages)) return null;

  // Every group the viewer competes in, across stages (usually one active at a time).
  const mine: MyEntry[] = [];
  for (const s of stages) {
    for (const g of s.groups || []) {
      if (g.is_my_group) mine.push({ stageName: s.stage_name, group: g });
    }
  }
  if (mine.length === 0) return null;

  const copy = (value: string, label: string) => {
    try {
      navigator.clipboard?.writeText(value);
      toast.success(t("yourMatch.copied", { label }));
    } catch {
      // clipboard can be unavailable (insecure context); fail quietly
    }
  };

  // A single room cred chip with a copy button (mono value so IDs/passwords read clearly).
  const cred = (labelKey: string, value: string) => (
    <button
      type="button"
      onClick={() => copy(value, t(labelKey))}
      className="group inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-left transition-colors hover:border-primary/50"
      title={t("yourMatch.copyTitle")}
    >
      <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {t(labelKey)}
      </span>
      <span className="font-mono text-sm font-semibold">{value}</span>
      <Copy className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
    </button>
  );

  return (
    <section className="rounded-md border border-primary/40 bg-primary/[0.06] p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 shrink-0 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
          {t("yourMatch.title")}
        </h3>
      </div>

      <div className="space-y-3">
        {mine.map(({ stageName, group }) => {
          const maps = Array.isArray(group.match_maps) ? group.match_maps : [];
          // Matches whose room creds are visible to the viewer (their own group, post-release).
          const withCreds = (group.matches || []).filter(
            (m) => m.room_id || m.room_name || m.room_password,
          );
          // A room exists but isn't visible yet -> show a "posted soon" hint.
          const roomComingSoon =
            withCreds.length === 0 &&
            (group.matches || []).some((m) => m.room_details_released);

          return (
            <div
              key={group.group_id}
              className="rounded-md border bg-card px-4 py-3"
            >
              {/* group + schedule */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <span className="font-semibold">
                  {stageName} · {group.group_name}
                </span>
                {group.playing_date && (
                  <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="size-3.5 shrink-0" />
                    <LocalTime value={group.playing_date} mode="date" />
                    {group.playing_time && (
                      <>
                        <span aria-hidden>·</span>
                        <LocalEventTime
                          date={group.playing_date}
                          startTime={group.playing_time}
                          tz={timezone}
                        />
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* maps this group plays, in order */}
              {maps.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                  {maps.map((m, i) => (
                    <Badge
                      key={`${group.group_id}-map-${i}`}
                      variant="outline"
                      className="rounded-full px-2 py-0.5 text-xs capitalize"
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              )}

              {/* room creds (the headline reason this callout exists) */}
              {withCreds.length > 0 ? (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                    <KeyRound className="size-3.5" />
                    {t("yourMatch.roomDetails")}
                  </p>
                  <div className="space-y-2">
                    {withCreds.map((m) => (
                      <div
                        key={m.match_id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("yourMatch.match", { n: m.match_number })}
                          {m.match_map ? ` · ${m.match_map}` : ""}
                        </span>
                        {m.room_id && cred("yourMatch.roomId", m.room_id)}
                        {m.room_name && cred("yourMatch.roomName", m.room_name)}
                        {m.room_password &&
                          cred("yourMatch.roomPassword", m.room_password)}
                      </div>
                    ))}
                  </div>
                  {/* The 3D joining steps, once under the whole list rather than once per map: a
                      group can have several maps and repeating eight steps would bury the room ids
                      they belong to. Shown when ANY map here is a 3D room. */}
                  {withCreds.some((m) => m.room_is_3d) && <Room3dJoinHelp />}
                </div>
              ) : roomComingSoon ? (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  {t("yourMatch.roomSoon")}
                </p>
              ) : (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  {t("yourMatch.roomPending")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
