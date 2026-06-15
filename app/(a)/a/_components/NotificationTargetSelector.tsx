"use client";

// ── Admin "What is this about?" target selector ───────────────────────────────
// A shared control that lets an admin attach an optional DEEP LINK to a
// notification, so the recipient gets a "Take me there" button (rendered by the
// user-side NotificationDropdown) that opens the related entity.
//
// It produces { target_type, target_id }:
//   - target_type: one of the backend choices (event/news/team/player/shop/
//     organizer/custom/none). "none" = no link (the safe default).
//   - target_id: the slug/id/username of the entity, or for "custom" a relative
//     "/path". Not needed for "shop" or "none".
//
// How it connects to the rest of the system:
//   - The backend send endpoints accept the target and compute the per-notification
//     `link` returned by GET /auth/get-notifications/:
//       * POST /auth/send-notification/ and /auth/send-notification-to-multiple-users/
//         take target_type + target_id          (settings bulk composer)
//       * /events/broadcast-announcement/ takes target_type + target_id
//         (ActionsTab event broadcast)
//       * /auth/admin-send-message/ uses its target_type/target_id to pick the
//         RECIPIENT, so the LINK target rides on link_target_type + link_target_id
//         instead (SendMessageModal). That mapping is done by the caller; this
//         component always emits the neutral { target_type, target_id } pair.
//   - This is an admin-only surface, so its copy is intentionally English (the
//     admin app under app/(a)/ is i18n-exempt per project rules).

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Backend target_type choices (kept in sync with the afc_auth contract).
export type NotificationTargetType =
  | "none"
  | "event"
  | "news"
  | "team"
  | "player"
  | "shop"
  | "organizer"
  | "custom";

// The value this control manages and hands back to its parent.
export interface NotificationTarget {
  target_type: NotificationTargetType;
  target_id: string;
}

// The empty/"no link" target, exported so callers can seed their own state and
// reset back to it after a send.
export const EMPTY_TARGET: NotificationTarget = {
  target_type: "none",
  target_id: "",
};

// Dropdown options. "none" first so it reads as (and stays) the default.
const TYPE_OPTIONS: { value: NotificationTargetType; label: string }[] = [
  { value: "none", label: "No link" },
  { value: "event", label: "Tournament / Event" },
  { value: "news", label: "News article" },
  { value: "team", label: "Team" },
  { value: "player", label: "Player" },
  { value: "shop", label: "Shop" },
  { value: "organizer", label: "Organization" },
  { value: "custom", label: "Custom URL" },
];

// Per-type placeholder + helper hint for the entity input.
const ENTITY_HINT: Partial<
  Record<NotificationTargetType, { placeholder: string; help: string }>
> = {
  event: {
    placeholder: "event-slug",
    help: "The tournament slug (from its URL, e.g. /tournaments/<slug>).",
  },
  news: {
    placeholder: "news-slug",
    help: "The news article slug (from its URL, e.g. /news/<slug>).",
  },
  team: {
    placeholder: "team id",
    help: "The team's numeric id.",
  },
  player: {
    placeholder: "username",
    help: "The player's username (e.g. /players/<username>).",
  },
  organizer: {
    placeholder: "organization-slug",
    help: "The organization slug (e.g. /organizations/<slug>).",
  },
  custom: {
    placeholder: "/some/path",
    help: "A relative path on the site, starting with a slash.",
  },
};

export function NotificationTargetSelector({
  value,
  onChange,
}: {
  value: NotificationTarget;
  onChange: (next: NotificationTarget) => void;
}) {
  // "shop" links to a fixed page and "none" has no link, so neither needs an
  // entity id. Everything else shows the entity input.
  const needsEntity = value.target_type !== "none" && value.target_type !== "shop";
  const hint = ENTITY_HINT[value.target_type];

  return (
    <div className="space-y-2">
      <Label>What is this about? (optional link)</Label>
      <Select
        value={value.target_type}
        onValueChange={(v) =>
          // Changing the type always clears the previous entity id so a stale
          // slug never rides along under the wrong type.
          onChange({ target_type: v as NotificationTargetType, target_id: "" })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="No link" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsEntity && (
        <div className="space-y-1">
          <Input
            placeholder={hint?.placeholder}
            value={value.target_id}
            onChange={(e) =>
              onChange({ ...value, target_id: e.target.value })
            }
          />
          {hint?.help && (
            <p className="text-[11px] text-muted-foreground">{hint.help}</p>
          )}
        </div>
      )}
    </div>
  );
}
