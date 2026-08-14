"use client";

// ── Clash Squad (head-to-head) stage panel (CS sub-project, P1#2) ────────────────
//
// Sibling of RoundRobinPanel: shared between the CREATE wizard (StageModal) and the
// EDIT flow (StageConfigModal) so the two never drift. Rendered ONLY when a stage's
// format starts with "cs - " (see lib/eventFormats.ts); the caller guards the render
// and, like round-robin, skips the classic "Number of Groups" + Step-2 per-group
// (maps / room / match-count) wizard for this format.
//
// Why it is just an explainer and not a builder:
//   A Clash Squad stage is run as a BRACKET, not as BR lobbies. The bracket is seeded
//   and generated from the EVENT PAGE (components/h2h-bracket.tsx → H2HBracketCard →
//   POST events/bracket/generate/) once the event has registered teams, and results
//   are entered on that same card. So there is nothing map/group-shaped to configure
//   at stage-creation time - the admin only picks the format + dates + how many
//   qualify. This panel makes that explicit instead of forcing the BR lobby wizard
//   (which used to materialise phantom BR Match rows next to the real bracket - see
//   the P1#1 backend guard in views.create_event / edit_event).
//
// Connects to: StageModal.tsx + StageConfigModal.tsx (render it), lib/eventFormats.ts
// (FORMAT_LABEL for the human name), and the backend head_to_head.generate_bracket
// which actually builds the tree from the registered team_ids.

import React, { useState } from "react";
// i18n (namespace "clashSquad"): this panel is authored once and mounted by BOTH the admin
// and organizer create/edit flows, and admin pages are in scope for translation
// (owner 2026-07-13). Every string here is localized; en/fr/pt hand-authored.
import { useTranslations } from "next-intl";
import { IconPlus, IconSettings, IconTournament, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CS_BRACKET_MODES, FORMAT_LABEL, legacyClashSquadMode, type CSBracketMode,
} from "@/lib/eventFormats";

// Room settings, offered right here while the stage is being set up (owner 2026-08-13:
// "the settings should also show when creating and editing the event, it doesn't have to be
// compulsory to be filled").
import { CSRoomSettingsDialog, type CSRoomDraft } from "@/components/cs-room-settings";

interface ClashSquadPanelProps {
  // The stage's chosen format, e.g. "cs - knockout". Used only to show the human
  // label + a one-line description of how that specific bracket type resolves.
  stageFormat: string;

  // ── OPTIONAL room settings (owner 2026-08-13) ─────────────────────────────────
  // Two modes, because a stage may or may not exist yet:
  //   • SAVED stage (edit page): pass stageId, and the editor reads and writes the stage's
  //     configuration through the API immediately, exactly as the bracket card does.
  //   • NEW stage (create wizard, or a stage added during an edit): pass roomSettings +
  //     onRoomSettingsChange, and the editor works on a draft the form carries until the event
  //     is saved, at which point it rides along as stage.cs_room_settings.
  // Neither is required, and never opening the editor simply means this stage has no room
  // configuration - which is what every Clash Squad stage before today looked like.
  stageId?: number | null;
  stageName?: string;
  roomSettings?: CSRoomDraft | null;
  onRoomSettingsChange?: (draft: CSRoomDraft | null) => void;

  // ── the mode, and the optional split into groups (owner backlog item 21, 2026-08-13) ──────
  // The stage format now only says "Clash Squad"; the MODE is picked here. By default that is
  // one mode for one bracket and the organizer never sees the word "group".
  //
  // Ticking "split this stage into groups" reveals the group editor: Group A / Group B / ... ,
  // each with its own mode, its own teams and its own room. That is the Champions League shape -
  // each group stands alone and the top N from each qualify onward.
  mode?: CSBracketMode;
  onModeChange?: (mode: CSBracketMode) => void;
  groups?: CSGroupDraft[];
  onGroupsChange?: (groups: CSGroupDraft[]) => void;
}

/** One Clash Squad group as the stage form carries it, before the event is saved. */
export interface CSGroupDraft {
  // Present once the group exists in the database; absent for a row just added in the form.
  group_id?: number;
  group_name: string;
  bracket_format: CSBracketMode;
  playing_date?: string;
  playing_time?: string;
}

// The translation key for each legacy "cs - <mode>" format's hint, keyed by the bare mode so it
// survives label changes. Falls back to the generic line.
const LEGACY_HINT_KEY: Record<string, string> = {
  normal: "hintSingleElim",
  knockout: "hintSingleElim",
  "double elimination": "hintDoubleElim",
  league: "hintLeague",
  "round robin": "hintRoundRobin",
};

// The translation key for each MODE's hint + label, keyed by the backend's bracket_format code.
const MODE_HINT_KEY: Record<string, string> = {
  single_elim: "hintSingleElim",
  double_elim: "hintDoubleElim",
  league: "hintLeague",
  round_robin_h2h: "hintRoundRobin",
};
const MODE_LABEL_KEY: Record<string, string> = {
  single_elim: "modeSingleElim",
  double_elim: "modeDoubleElim",
  league: "modeLeague",
  round_robin_h2h: "modeRoundRobin",
};

export function ClashSquadPanel({
  stageFormat,
  stageId,
  stageName,
  roomSettings,
  onRoomSettingsChange,
  mode,
  onModeChange,
  groups,
  onGroupsChange,
}: ClashSquadPanelProps) {
  const t = useTranslations("clashSquad");
  const bare = String(stageFormat || "")
    .replace(/^cs\s*-\s*/i, "")
    .trim()
    .toLowerCase();
  const label = FORMAT_LABEL[stageFormat] || "Clash Squad";

  // The mode this stage runs. Explicit prop wins; otherwise fall back to whatever the legacy
  // stage_format implied, so an old "cs - league" stage opens on League rather than on a default.
  const canPickMode = typeof onModeChange === "function";
  const effectiveMode: CSBracketMode =
    mode ?? legacyClashSquadMode(stageFormat) ?? "single_elim";

  // Splitting into groups is OPT-IN (owner 2026-08-13): the toggle is on only when groups
  // actually exist, so a stage nobody has split reads exactly as it did before.
  const canSplit = typeof onGroupsChange === "function";
  const groupList = groups ?? [];
  const [splitOpen, setSplitOpen] = useState(groupList.length > 0);
  const isSplit = canSplit && splitOpen;

  // Dynamic key -> t.has() guard, per the house rule: an unrecognised mode must fall back to the
  // generic line rather than throwing (a missing key is the single most common crash here).
  const hintKey = canPickMode ? MODE_HINT_KEY[effectiveMode] : LEGACY_HINT_KEY[bare];
  const hint = hintKey && t.has(hintKey) ? t(hintKey) : t("hintGeneric");

  // The localized label for a mode code, same guard.
  const modeLabel = (code: string) => {
    const key = MODE_LABEL_KEY[code];
    return key && t.has(key) ? t(key) : code;
  };

  const [roomOpen, setRoomOpen] = useState(false);
  // Draft mode when the caller handed us a change handler (a stage that is not saved yet);
  // scoped mode when it handed us a stage id instead.
  const draftMode = typeof onRoomSettingsChange === "function";
  const canEditRoom = draftMode || !!stageId;
  // What is configured, in one line, so the panel says whether anything was set without making
  // anyone open the editor to find out.
  const roomLine = draftMode
    ? roomSettings
      ? roomSettings.room_id
        ? t("roomSummaryWithId", {
            rounds: roomSettings.rounds,
            map: roomSettings.map_name,
            roomId: roomSettings.room_id,
          })
        : t("roomSummary", {
            rounds: roomSettings.rounds,
            map: roomSettings.map_name,
          })
      : null
    : null;

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <IconTournament className="size-4 shrink-0" />
        {t("runsAsBracket", { label })}
      </p>

      {/* ── the MODE: the second of the two questions (owner backlog item 21) ────────────── */}
      {canPickMode && !isSplit && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("mode")}</Label>
          <Select
            value={effectiveMode}
            onValueChange={(v) => onModeChange!(v as CSBracketMode)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CS_BRACKET_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{modeLabel(m.value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{isSplit ? t("hintSplit") : hint}</p>

      {/* ── split into groups: OFF by default (owner 2026-08-13) ──────────────────────────
          Most stages are one bracket and should never mention groups. Ticking this is how an
          organizer builds the Champions League shape: several groups, each its own bracket,
          top N from each qualifying onward. */}
      {canSplit && (
        <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
          <Checkbox
            checked={isSplit}
            onCheckedChange={(v) => {
              const on = v === true;
              setSplitOpen(on);
              // Turning it on seeds two groups, because one group IS the unsplit stage and an
              // empty list would just look broken. Turning it off clears them, so the stage goes
              // back to a single bracket rather than keeping half-built groups nobody can see.
              onGroupsChange!(
                on && groupList.length === 0
                  ? [
                      { group_name: "Group A", bracket_format: effectiveMode },
                      { group_name: "Group B", bracket_format: effectiveMode },
                    ]
                  : on
                    ? groupList
                    : [],
              );
            }}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-xs font-medium">{t("splitLabel")}</span>
            <span className="block text-xs text-muted-foreground">{t("splitHelp")}</span>
          </span>
        </label>
      )}

      {/* ── the group editor, only once the toggle is on ── */}
      {isSplit && (
        <div className="space-y-2">
          {groupList.map((g, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-2.5">
              <div className="min-w-0 flex-1 space-y-1">
                <Label className="text-xs">{t("groupName")}</Label>
                <Input
                  className="h-8 text-xs"
                  value={g.group_name}
                  onChange={(e) =>
                    onGroupsChange!(groupList.map((row, idx) =>
                      idx === i ? { ...row, group_name: e.target.value } : row))
                  }
                />
              </div>
              <div className="w-44 space-y-1">
                <Label className="text-xs">{t("mode")}</Label>
                <Select
                  value={g.bracket_format}
                  onValueChange={(v) =>
                    onGroupsChange!(groupList.map((row, idx) =>
                      idx === i ? { ...row, bracket_format: v as CSBracketMode } : row))
                  }
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CS_BRACKET_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{modeLabel(m.value)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("removeGroup", { name: g.group_name })}
                // One group is the same thing as not being split, so the last row cannot go -
                // untick the toggle instead.
                disabled={groupList.length <= 1}
                onClick={() => onGroupsChange!(groupList.filter((_, idx) => idx !== i))}
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onGroupsChange!([
                ...groupList,
                {
                  // "Group A", "Group B", ... by position, so the names stay predictable.
                  group_name: `Group ${String.fromCharCode(65 + groupList.length)}`,
                  bracket_format: effectiveMode,
                },
              ])
            }
          >
            <IconPlus className="size-4" /> {t("addGroup")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("groupsFooter")}</p>
        </div>
      )}

      {/* No group / map / room fields: a bracket has none. Tell the admin exactly where the
          real setup happens so the empty step does not read as "unfinished". */}
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground">{t("nothingToConfigure")}</p>
        <p>{t("nothingToConfigureBody")}</p>
        <p>{t("nothingToConfigureBody2")}</p>
      </div>

      {/* ── Room settings: optional, and available right here ────────────────────────────
          The in-game room configuration (rounds, map, store, economy, per-round areas, and the
          room ID + password) can be set now rather than only from the event page afterwards.
          Leaving it alone is fine: nothing is created and the stage behaves exactly as before. */}
      {canEditRoom && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground">
                {t("roomSettings")}{" "}
                <span className="text-muted-foreground">{t("optional")}</span>
              </p>
              <p className="text-xs text-muted-foreground">{t("roomHelp")}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRoomOpen(true)}
            >
              <IconSettings className="size-4" />
              {roomLine || (!draftMode && stageId) ? t("editRoom") : t("setUpRoom")}
            </Button>
          </div>
          {roomLine && (
            <p className="text-xs text-primary">
              {t("roomConfigured", { summary: roomLine })}
            </p>
          )}
        </div>
      )}

      {roomOpen && (
        <CSRoomSettingsDialog
          open
          onOpenChange={setRoomOpen}
          scopeLabel={stageName || label}
          // Saved stage -> read and write through the API. Unsaved -> edit the form's own draft.
          {...(draftMode
            ? {
                draftValue: roomSettings ?? null,
                onDraftSave: (draft: CSRoomDraft | null) => onRoomSettingsChange!(draft),
              }
            : { scope: "stage" as const, objectId: stageId! })}
        />
      )}
    </div>
  );
}
