"use client";

// ── Who is missing what, and where to fix it ─────────────────────────────────
//
// The BODY of the registration-requirements panel: one row per player, one badge per unmet
// requirement, plus the note telling the reader where to go.
//
// WHY IT IS A COMPONENT (owner 2026-09-02)
//   The owner accepted an event invitation from their team page and got a single sentence, "Some
//   players are missing required profile info before this registration can proceed", with no way
//   to learn WHO or WHAT:
//
//     "instead of it just showing like this, it can do the flow like its on the tournament page
//      itself and theyre trying to register, it should show the exact flow and issues as to why
//      they cant register and what players and their issues."
//
//   The tournament page has answered that question properly since 2026-08-02, but its panel was
//   inline in EventDetailsWrapper.tsx, a 5,400-line file, so the accept dialog could not reuse it
//   and fell back to the toast. The rows moved here so BOTH read from one implementation; copying
//   them would have guaranteed the two drift, and the "(you)" rule and the connection-prefix
//   handling below are exactly the details a copy loses first.
//
//   Only the BODY moved. The header and footer stay with each host, because they genuinely differ:
//   the registration flow offers Back and "Re-check and continue", while the invitation dialog
//   offers Cancel and a retry of the acceptance.
//
// WHERE THE DATA COMES FROM
//   afc_tournament_and_scrims.views._registration_requirements_response builds the 403 body:
//     {code: "registration_requirements_unmet", team_logo_missing, missing: [{user_id, username,
//      fields}]}
//   register_for_event returns it, and the invitation accept endpoint hands that refusal back
//   untouched, so both surfaces receive the identical shape.
//
// i18n: reads `register.rosterRequirements.*` from the `tournaments` namespace regardless of which
// page mounts it. next-intl namespaces are global, so the keys did not move and neither did their
// fr/pt translations.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

/** One player and everything they are missing. `isSelf` marks the viewer's own row. */
export interface RosterRequirementIssue {
  username: string;
  missing: string[];
  isSelf?: boolean;
}

/** A required CONNECTED ACCOUNT arrives prefixed, as "connection:<slug>", so a provider named like
 *  a future asset field can never collide with one and the label map needs no entry per provider. */
export const CONNECTION_PREFIX = "connection:";

export const connectionProviderLabel = (slug: string) =>
  ({ discord: "Discord", google: "Google", vent: "v-ent.co" })[slug] ?? slug;

/**
 * Turn the requirement rows into a readable list.
 *
 * `isSolo` changes only the wording of the closing note: a solo registrant is the only person in
 * the list, so "These players" reads wrong and "(you)" earns nothing.
 */
export function RosterRequirementsList({
  issues,
  teamLogoMissing,
  isSolo = false,
  actionHint,
}: {
  issues: RosterRequirementIssue[];
  teamLogoMissing: boolean;
  isSolo?: boolean;
  /** The HOST's own closing sentence, telling the reader which button to press next.
   *
   *  It is a prop rather than part of the shared copy because the note used to end with "then
   *  press Re-check and continue", which is a button the registration flow has and the invitation
   *  dialog does not. Found on the 390px pass: the dialog was instructing people to press
   *  something that was not on their screen. Shared copy must never name a control only one of its
   *  hosts owns. */
  actionHint?: string;
}) {
  const t = useTranslations("tournaments");

  const reqLabel = (f: string) =>
    ({
      uid: t("register.rosterRequirements.req.uid"),
      discord: t("register.rosterRequirements.req.discord"),
      esports_image: t("register.rosterRequirements.req.esportsImage"),
      profile_image: t("register.rosterRequirements.req.profileImage"),
      whatsapp: t("register.rosterRequirements.req.whatsapp"),
    })[f] ??
    (f.startsWith(CONNECTION_PREFIX)
      ? t("register.rosterRequirements.req.connection", {
          provider: connectionProviderLabel(f.slice(CONNECTION_PREFIX.length)),
        })
      : // An unknown key falls back to ITSELF rather than rendering blank: a raw token on screen is
        // ugly but debuggable, an empty badge is neither.
        f);

  const blockedSelf = issues.some((it) => it.isSelf);

  return (
    <>
      <div className="space-y-2 text-sm max-h-72 overflow-y-auto">
        {issues.map((it) => (
          <div
            key={it.username}
            className="flex flex-col gap-1 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
          >
            <span className="font-medium">
              {it.username}
              {/* "(you)" only earns its place when there are OTHER people in the list. */}
              {it.isSelf && !isSolo && (
                <span className="ml-1 text-muted-foreground">
                  {t("register.rosterRequirements.youSuffix")}
                </span>
              )}
            </span>
            {/* Each unmet requirement as its own badge: on a phone a comma-joined string wrapped
                into an unreadable blob, and the owner asked for exactly what is missing per
                player. */}
            <span className="flex flex-wrap gap-1 sm:justify-end">
              {it.missing.map((k) => (
                <Badge key={k} variant="outline" className="border-destructive text-destructive">
                  {reqLabel(k)}
                </Badge>
              ))}
            </span>
          </div>
        ))}
        {/* Team logo is a TEAM asset, not a player one (backend team_logo_missing). */}
        {teamLogoMissing && (
          <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <span className="font-medium">{t("register.rosterRequirements.teamRow")}</span>
            <span className="flex flex-wrap gap-1 sm:justify-end">
              <Badge variant="outline" className="border-destructive text-destructive">
                {t("register.rosterRequirements.req.teamLogo")}
              </Badge>
            </span>
          </div>
        )}
      </div>

      {/* Where to go and fix it. The reader can fix their OWN row right now, so link them straight
          to /profile/edit; teammates have to be chased, so say that instead. */}
      <p className="text-xs text-muted-foreground">
        {isSolo || blockedSelf ? (
          t.rich(
            isSolo
              ? "register.rosterRequirements.soloNote"
              : "register.rosterRequirements.selfNote",
            {
              editProfileLink: (chunks) => (
                <Link href="/profile/edit" className="text-primary underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            },
          )
        ) : (
          <>{t("register.rosterRequirements.othersNote")}</>
        )}
        {actionHint ? <> {actionHint}</> : null}
      </p>
    </>
  );
}

/**
 * Read a registration refusal into the rows this list renders.
 *
 * Both surfaces receive the identical 403 body, so parsing it belongs here rather than in each
 * caller: EventInvitationsCard used to reach for `message` alone and throw the rest away, which is
 * the bug the owner reported.
 */
export function parseRequirementIssues(
  data: unknown,
  viewerUserId?: number | string | null,
): { issues: RosterRequirementIssue[]; teamLogoMissing: boolean } | null {
  const body = data as
    | {
        code?: string;
        team_logo_missing?: boolean;
        missing?: { user_id?: number | string; username: string; fields?: string[] }[];
      }
    | undefined;
  if (!body || body.code !== "registration_requirements_unmet") return null;
  return {
    issues: (body.missing ?? []).map((m) => ({
      username: m.username,
      missing: m.fields ?? [],
      isSelf:
        m.user_id != null && viewerUserId != null && String(m.user_id) === String(viewerUserId),
    })),
    teamLogoMissing: !!body.team_logo_missing,
  };
}
