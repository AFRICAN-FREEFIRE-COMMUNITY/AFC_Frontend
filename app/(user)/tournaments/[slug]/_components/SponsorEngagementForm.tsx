"use client";
// ─────────────────────────────────────────────────────────────────────────────
// SponsorEngagementForm  ·  registration-side sponsor engagement inputs (P3)
//
// Renders the NEW per-sponsorship engagement form inside the registration
// modal's SPONSOR step (EventDetailsWrapper). The form is data-driven: each
// EventSponsorshipRow (from sponsorsApi.forEvent(event_id), lib/sponsors.ts)
// carries an `engagements` array, and every engagement type gets its own
// input block:
//
//   collect_id     - labeled text input (+ optional help text). Payload {value}.
//   follow_social  - "Open page" external link + an action checklist the user
//                    ticks (follow/like/share) + a profile-link input when
//                    collect_profile_link. Payload {profile_link} or {} (the
//                    ticks are a client-side confirmation gate only).
//   create_account - "Create your account" external link to signup_url +
//                    username input. Payload {username}.
//   join_group     - "Join the group" external link to invite_url. WhatsApp
//                    collects country code (+234 default) + phone; Discord
//                    collects a Discord username. Payload {phone, country_code}
//                    or {discord_username}.
//
// HOW IT CONNECTS:
//   - EventDetailsWrapper renders this form once for a solo registrant, or
//     once PER ROSTERED PLAYER (wrapped in SponsorEngagementPlayerSection,
//     the collapsible header below) for squad registrations.
//   - Answers live in EventDetailsWrapper state, keyed
//     [sponsorship_id][engagement_index] (see EngagementAnswers); this form
//     only reads them and reports patches via onAnswerChange.
//   - The exported helpers (isEngagementAnswerComplete, findCollectIdDuplicates,
//     buildSolo/SquadSponsorshipsBody) drive the Continue gate AND build the
//     `sponsorships` key of POST /events/register-for-event/. The server
//     re-validates everything (400 code "sponsor_submission_invalid").
//
// Styling mirrors the legacy sponsor step: bg-primary/10 sections, shadcn
// Input/Label/Checkbox/Select/Badge, destructive inline errors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EventSponsorshipRow, SponsorEngagement } from "@/lib/sponsors";

// ── Answer state shape ────────────────────────────────────────────────────────
// One player's draft answers: [sponsorship_id][engagement_index] -> draft object.
// Draft keys mirror the final payload keys (value / profile_link / username /
// phone / country_code / discord_username) plus UI-only keys prefixed "_"
// (currently _confirmed_actions for the follow_social checklist). The UI-only
// keys NEVER reach the backend: buildEngagementSubmissionPayload constructs the
// payload explicitly per type instead of copying the draft.
export type EngagementAnswers = Record<
  string,
  Record<string, Record<string, any>>
>;

// Immutable nested patch helper. Both the solo and the per-player squad answer
// states in EventDetailsWrapper funnel their onChange updates through this.
export const patchEngagementAnswer = (
  prev: EngagementAnswers,
  sponsorshipId: number,
  engagementIndex: number,
  patch: Record<string, any>,
): EngagementAnswers => ({
  ...prev,
  [sponsorshipId]: {
    ...(prev[sponsorshipId] ?? {}),
    [engagementIndex]: {
      ...((prev[sponsorshipId] ?? {})[engagementIndex] ?? {}),
      ...patch,
    },
  },
});

// WhatsApp join_group default dialing code (owner audience is mostly Nigeria).
const DEFAULT_COUNTRY_CODE = "+234";

// Small curated list for the country-code select; common African codes first.
const COMMON_COUNTRY_CODES: Array<{ code: string; label: string }> = [
  { code: "+234", label: "NG" },
  { code: "+233", label: "GH" },
  { code: "+254", label: "KE" },
  { code: "+27", label: "ZA" },
  { code: "+20", label: "EG" },
  { code: "+212", label: "MA" },
  { code: "+213", label: "DZ" },
  { code: "+216", label: "TN" },
  { code: "+225", label: "CI" },
  { code: "+237", label: "CM" },
  { code: "+250", label: "RW" },
  { code: "+251", label: "ET" },
  { code: "+255", label: "TZ" },
  { code: "+256", label: "UG" },
  { code: "+260", label: "ZM" },
  { code: "+263", label: "ZW" },
  { code: "+44", label: "UK" },
  { code: "+1", label: "US" },
];

// Pretty platform names for follow_social / join_group headings. Unknown
// platforms fall back to the raw string with a capitalize class.
const PLATFORM_NAMES: Record<string, string> = {
  whatsapp: "WhatsApp",
  discord: "Discord",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  twitter: "Twitter",
  x: "X",
};

const platformName = (platform?: string): string =>
  (platform && PLATFORM_NAMES[platform.toLowerCase()]) || platform || "Social";

// ── Validation ────────────────────────────────────────────────────────────────
// True when one engagement's draft satisfies its type's required fields. Drives
// the SPONSOR step's Continue gate (every engagement of every sponsorship for
// every player must pass) and the per-player "N left" badge.
export const isEngagementAnswerComplete = (
  engagement: SponsorEngagement,
  answer: Record<string, any> | undefined,
): boolean => {
  const a = answer ?? {};
  switch (engagement.type) {
    case "collect_id":
      return String(a.value ?? "").trim() !== "";
    case "follow_social": {
      // Every listed action must be ticked; the profile link is only required
      // when the sponsor asked to collect it.
      const confirmed: string[] = a._confirmed_actions ?? [];
      const actionsDone = (engagement.actions ?? []).every((action) =>
        confirmed.includes(action),
      );
      const linkDone = engagement.collect_profile_link
        ? String(a.profile_link ?? "").trim() !== ""
        : true;
      return actionsDone && linkDone;
    }
    case "create_account":
      return String(a.username ?? "").trim() !== "";
    case "join_group":
      // country_code always has the +234 default, so only the phone gates.
      return (engagement.platform ?? "").toLowerCase() === "whatsapp"
        ? String(a.phone ?? "").trim() !== ""
        : String(a.discord_username ?? "").trim() !== "";
    default:
      // Unknown future type: don't block registration client-side; the server
      // is the source of truth (sponsor_submission_invalid).
      return true;
  }
};

// Count of incomplete engagements across all sponsorships for one player.
// Powers the "N left" badge on the per-player collapsible header.
export const countIncompleteEngagements = (
  sponsorships: EventSponsorshipRow[],
  answers: EngagementAnswers | undefined,
): number =>
  sponsorships.reduce(
    (n, s) =>
      n +
      s.engagements.filter(
        (eng, idx) =>
          !isEngagementAnswerComplete(eng, answers?.[s.sponsorship_id]?.[idx]),
      ).length,
    0,
  );

// ── Duplicate detection (squad, collect_id only) ─────────────────────────────
// Mirrors the legacy within-team duplicate UX: the same collect_id value typed
// for two different rostered players is an inline error on BOTH inputs.
// Returns keys "<user_id>|<sponsorship_id>|<engagement_index>" for every
// flagged input; EventDetailsWrapper narrows them per player before passing
// duplicateKeys ("<sponsorship_id>|<engagement_index>") into the form.
export const findCollectIdDuplicates = (
  sponsorships: EventSponsorshipRow[],
  answersByUser: Record<string, EngagementAnswers>,
  userIds: string[],
): Set<string> => {
  const duplicates = new Set<string>();
  sponsorships.forEach((s) => {
    s.engagements.forEach((eng, idx) => {
      if (eng.type !== "collect_id") return;
      // value -> the user ids that typed it (trimmed, non-empty only)
      const owners = new Map<string, string[]>();
      userIds.forEach((uid) => {
        const val = String(
          answersByUser[uid]?.[s.sponsorship_id]?.[idx]?.value ?? "",
        ).trim();
        if (!val) return;
        owners.set(val, [...(owners.get(val) ?? []), uid]);
      });
      owners.forEach((uids) => {
        if (uids.length > 1) {
          uids.forEach((uid) =>
            duplicates.add(`${uid}|${s.sponsorship_id}|${idx}`),
          );
        }
      });
    });
  });
  return duplicates;
};

// ── Payload builders (the register-for-event `sponsorships` key) ─────────────
// Builds ONE engagement's submission payload per the backend contract. UI-only
// draft keys (_confirmed_actions) are dropped here by construction.
export const buildEngagementSubmissionPayload = (
  engagement: SponsorEngagement,
  answer: Record<string, any> | undefined,
): Record<string, any> => {
  const a = answer ?? {};
  switch (engagement.type) {
    case "collect_id":
      return { value: String(a.value ?? "").trim() };
    case "follow_social":
      // Empty payload confirms the ticked actions when no link is collected.
      return engagement.collect_profile_link
        ? { profile_link: String(a.profile_link ?? "").trim() }
        : {};
    case "create_account":
      return { username: String(a.username ?? "").trim() };
    case "join_group":
      return (engagement.platform ?? "").toLowerCase() === "whatsapp"
        ? {
            phone: String(a.phone ?? "").trim(),
            country_code: String(
              a.country_code ?? DEFAULT_COUNTRY_CODE,
            ).trim(),
          }
        : { discord_username: String(a.discord_username ?? "").trim() };
    default:
      return {};
  }
};

// Solo shape: [{sponsorship_id, submissions: [{engagement_index, payload}]}]
export const buildSoloSponsorshipsBody = (
  sponsorships: EventSponsorshipRow[],
  answers: EngagementAnswers,
): Array<Record<string, any>> =>
  sponsorships.map((s) => ({
    sponsorship_id: s.sponsorship_id,
    submissions: s.engagements.map((eng, idx) => ({
      engagement_index: idx,
      payload: buildEngagementSubmissionPayload(
        eng,
        answers[s.sponsorship_id]?.[idx],
      ),
    })),
  }));

// Squad shape: [{sponsorship_id, submissions_by_user: {"<user_id>": [...]}}].
// userIds are the SELECTED roster member ids (= user ids) - every rostered
// player must answer every engagement (server-enforced).
export const buildSquadSponsorshipsBody = (
  sponsorships: EventSponsorshipRow[],
  userIds: string[],
  answersByUser: Record<string, EngagementAnswers>,
): Array<Record<string, any>> =>
  sponsorships.map((s) => ({
    sponsorship_id: s.sponsorship_id,
    submissions_by_user: Object.fromEntries(
      userIds.map((uid) => [
        uid,
        s.engagements.map((eng, idx) => ({
          engagement_index: idx,
          payload: buildEngagementSubmissionPayload(
            eng,
            answersByUser[uid]?.[s.sponsorship_id]?.[idx],
          ),
        })),
      ]),
    ),
  }));

// ── External link (Open page / Create your account / Join the group) ─────────
// Plain anchor in the primary-link idiom used across the event page; opens in
// a new tab so the registration modal survives the round trip.
const EngagementLink: React.FC<{ href?: string; children: React.ReactNode }> =
  ({ href, children }) => {
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:text-primary/80 flex-shrink-0"
      >
        {children}
        <ExternalLink className="size-3" />
      </a>
    );
  };

// ── The form itself ───────────────────────────────────────────────────────────
interface SponsorEngagementFormProps {
  // The event's sponsorships (sponsorsApi.forEvent results), already non-empty.
  sponsorships: EventSponsorshipRow[];
  // This player's draft answers, keyed [sponsorship_id][engagement_index].
  answers: EngagementAnswers;
  // Reports a partial update; the parent merges via patchEngagementAnswer.
  onAnswerChange: (
    sponsorshipId: number,
    engagementIndex: number,
    patch: Record<string, any>,
  ) => void;
  // collect_id inputs flagged as roster duplicates for THIS player, keyed
  // "<sponsorship_id>|<engagement_index>" (see findCollectIdDuplicates).
  duplicateKeys?: Set<string>;
  // Unique prefix for input ids so the same form repeated per player keeps
  // htmlFor/id pairs unique ("solo", "m<user_id>", ...).
  idPrefix: string;
}

export const SponsorEngagementForm: React.FC<SponsorEngagementFormProps> = ({
  sponsorships,
  answers,
  onAnswerChange,
  duplicateKeys,
  idPrefix,
}) => {
  // Renders the type-specific input block for one engagement.
  const renderEngagement = (
    sponsorshipId: number,
    engagement: SponsorEngagement,
    idx: number,
  ) => {
    const answer = answers[sponsorshipId]?.[idx] ?? {};
    const inputId = `${idPrefix}-s${sponsorshipId}-e${idx}`;
    const patch = (p: Record<string, any>) =>
      onAnswerChange(sponsorshipId, idx, p);

    switch (engagement.type) {
      // ── collect_id: labeled input + help, with roster-duplicate error ──
      case "collect_id": {
        const isDuplicate = !!duplicateKeys?.has(`${sponsorshipId}|${idx}`);
        return (
          <div key={inputId} className="space-y-1">
            <Label htmlFor={inputId}>{engagement.label || "Sponsor ID"}</Label>
            <Input
              id={inputId}
              className={
                isDuplicate
                  ? "border-destructive focus-visible:ring-destructive"
                  : "border-input"
              }
              placeholder={`Enter ${engagement.label || "the requested ID"}`}
              value={answer.value || ""}
              onChange={(e) => patch({ value: e.target.value })}
            />
            {engagement.help && (
              <p className="text-xs text-muted-foreground">{engagement.help}</p>
            )}
            {isDuplicate && (
              <p className="text-xs text-destructive">
                This value is already used by another rostered player.
              </p>
            )}
          </div>
        );
      }

      // ── follow_social: open link + tick the actions (+ optional profile link) ──
      case "follow_social": {
        const confirmed: string[] = answer._confirmed_actions ?? [];
        const toggleAction = (action: string) =>
          patch({
            _confirmed_actions: confirmed.includes(action)
              ? confirmed.filter((a) => a !== action)
              : [...confirmed, action],
          });
        return (
          <div key={inputId} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{platformName(engagement.platform)} page</Label>
              <EngagementLink href={engagement.url}>Open page</EngagementLink>
            </div>
            {/* Action checklist: chips the user ticks AFTER doing each action
                on the sponsor's page. Client-side confirmation only; the ticks
                gate Continue but never reach the payload. */}
            {(engagement.actions ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(engagement.actions ?? []).map((action) => {
                  const ticked = confirmed.includes(action);
                  return (
                    <label
                      key={action}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs cursor-pointer transition ${
                        ticked
                          ? "border-primary text-primary bg-primary/10"
                          : "border-input text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <Checkbox
                        className="size-3.5"
                        checked={ticked}
                        onCheckedChange={() => toggleAction(action)}
                      />
                      <span className="capitalize">{action}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Open the page, complete each action, then tick it here.
            </p>
            {engagement.collect_profile_link && (
              <div className="space-y-1">
                <Label htmlFor={inputId}>Your profile link</Label>
                <Input
                  id={inputId}
                  placeholder="Paste a link to your profile"
                  value={answer.profile_link || ""}
                  onChange={(e) => patch({ profile_link: e.target.value })}
                />
              </div>
            )}
          </div>
        );
      }

      // ── create_account: signup link + the username they registered with ──
      case "create_account":
        return (
          <div key={inputId} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={inputId}>
                {engagement.label || "Create an account"}
              </Label>
              <EngagementLink href={engagement.signup_url}>
                Create your account
              </EngagementLink>
            </div>
            <Input
              id={inputId}
              placeholder="Enter the username you signed up with"
              value={answer.username || ""}
              onChange={(e) => patch({ username: e.target.value })}
            />
          </div>
        );

      // ── join_group: invite link + (WhatsApp: code+phone | Discord: username) ──
      case "join_group": {
        const isWhatsapp =
          (engagement.platform ?? "").toLowerCase() === "whatsapp";
        return (
          <div key={inputId} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={inputId}>
                Join the {platformName(engagement.platform)} group
              </Label>
              <EngagementLink href={engagement.invite_url}>
                Join the group
              </EngagementLink>
            </div>
            {isWhatsapp ? (
              <>
                <div className="flex gap-2">
                  <Select
                    value={answer.country_code || DEFAULT_COUNTRY_CODE}
                    onValueChange={(v) => patch({ country_code: v })}
                  >
                    <SelectTrigger className="w-28 flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_COUNTRY_CODES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id={inputId}
                    className="flex-1"
                    inputMode="tel"
                    placeholder="Phone number"
                    value={answer.phone || ""}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The phone number you joined the group with.
                </p>
              </>
            ) : (
              <Input
                id={inputId}
                placeholder="Your Discord username"
                value={answer.discord_username || ""}
                onChange={(e) => patch({ discord_username: e.target.value })}
              />
            )}
          </div>
        );
      }

      default:
        // Unknown future type: nothing to render; the complete-check above
        // also treats it as satisfied so it can't dead-end the modal.
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {sponsorships.map((s) => (
        // One section per sponsorship: sponsor name header + approval note,
        // then that sponsor's engagement inputs. Same bg-primary/10 section
        // idiom as the legacy sponsor description box.
        <div
          key={s.sponsorship_id}
          className="p-3 rounded-md bg-primary/10 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">
              {s.sponsor.name}
            </p>
            {s.requires_approval && (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-xs border-yellow-500/50 text-yellow-400 flex-shrink-0"
              >
                Requires approval
              </Badge>
            )}
          </div>
          {s.requires_approval && (
            <p className="text-xs text-muted-foreground">
              This sponsor reviews submissions. Your spot is confirmed once
              they approve.
            </p>
          )}
          {s.engagements.map((eng, idx) =>
            renderEngagement(s.sponsorship_id, eng, idx),
          )}
        </div>
      ))}
    </div>
  );
};

// ── Per-player collapsible wrapper (squad registrations) ─────────────────────
// EventDetailsWrapper repeats the form once per rostered player; this header
// mirrors how the legacy step listed per-member inputs but keeps long rosters
// manageable: username + a Done / "N left" / Duplicate badge, chevron toggle.
interface SponsorEngagementPlayerSectionProps {
  username: string;
  // Incomplete engagement count for this player (countIncompleteEngagements).
  remaining: number;
  // True when any of this player's collect_id values clash with a teammate's.
  hasDuplicate?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const SponsorEngagementPlayerSection: React.FC<
  SponsorEngagementPlayerSectionProps
> = ({ username, remaining, hasDuplicate = false, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const done = remaining === 0 && !hasDuplicate;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-3 bg-background rounded-md border hover:border-primary transition"
        >
          <span className="text-sm font-medium">{username}</span>
          <span className="flex items-center gap-2">
            {/* Status badge: green Done / red Duplicate / yellow N left. */}
            {done ? (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-xs border-green-500/50 text-green-500"
              >
                Done
              </Badge>
            ) : hasDuplicate ? (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-xs border-destructive/50 text-destructive"
              >
                Duplicate
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-xs border-yellow-500/50 text-yellow-400"
              >
                {remaining} left
              </Badge>
            )}
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
};
