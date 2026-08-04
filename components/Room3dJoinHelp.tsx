"use client";

// ── components/Room3dJoinHelp.tsx (owner 2026-08-04) ─────────────────────────────────────────
// The joining steps a player is shown when a map's room is a 3D CUSTOM ROOM.
//
// WHY IT EXISTS. A 3D room is not joined the way an ordinary custom room is: the squad has to be a
// complete group first, and the leader goes in through Customs and League rather than typing a room
// id on the lobby screen. Players who did not know that simply failed to join, so the steps now
// travel with the room id and password wherever those appear.
//
// WHY IT IS ONE COMPONENT rather than the same markup twice. Two player-facing surfaces show room
// credentials: the "your match" callout at the top of the event page
// (app/(user)/tournaments/[slug]/_components/YourMatchCallout.tsx) and the Structure tab
// (…/TournamentStructure.tsx). Instructions that drifted between them would be worse than none,
// because a player following the shorter copy would be missing a step.
//
// The backend has its own copy of the same words for the notification and email bodies
// (afc_tournament_and_scrims/room_join_help.py), which cannot read these message files. The two are
// kept in step by hand and both trace back to the owner's original wording in tasks/todo.md.
//
// DATA: `room_is_3d` on each match, returned by get_event_details and its public sibling
// (afc_tournament_and_scrims/views.py). It is NOT gated behind the room-credentials permission,
// because it describes the kind of room rather than being a credential.
//
// i18n: messages/{en,fr,pt}/tournaments.json, key `roomJoin3d.*`. Eight steps, each its own key,
// so a translator can see them as the numbered list they are.

import { useTranslations } from "next-intl";
import { IconInfoCircle } from "@tabler/icons-react";

/** The step keys, in order. Numbered by the <ol>, not baked into the strings, so a translator
 *  never has to keep "1." in step one. */
const STEP_KEYS = [
  "step1",
  "step2",
  "step3",
  "step4",
  "step5",
  "step6",
  "step7",
  "step8",
] as const;

export function Room3dJoinHelp({ className }: { className?: string }) {
  const t = useTranslations("tournaments");

  return (
    <div className={`bg-muted/40 mt-3 rounded-md border p-3 ${className ?? ""}`}>
      <p className="text-primary mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wide uppercase">
        <IconInfoCircle className="size-3.5" />
        {t("roomJoin3d.title")}
      </p>
      {/* An ordered list rather than eight paragraphs: these are steps taken in sequence, and step
          3 is meaningless before step 2. */}
      <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
        {STEP_KEYS.map((key) => (
          <li key={key}>{t(`roomJoin3d.${key}`)}</li>
        ))}
      </ol>
    </div>
  );
}
