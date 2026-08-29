"use client";

// SponsorshipBuilder = the event wizard's "pick sponsors + build their engagements" surface
// (sponsor-system redesign P2). Design source: public/_sponsor_system_preview.html, view 3
// ("Event wizard: Sponsor tab") - sponsor typeahead, one card per attached sponsor with a
// "requires approval" toggle, and a per-sponsor engagement list (collect id / follow socials /
// create account / join group) with reorder + delete.
//
// CONNECTS TO:
//  - lib/sponsors.ts -> sponsorsApi.list({q}) powers the typeahead (active sponsors only).
//    The PARENT owns persistence: it diffs `value` against the server and calls
//    sponsorsApi.attachEvent / detachEvent / configureSponsorship (see SponsorTab.tsx for the
//    edit wizard and the create pages' post-create loop for the create wizard).
//  - Backend schema mirror: afc_sponsors/engagements.py validates the same shapes server-side
//    (collect_id needs label; follow_social needs platform + url + non-empty actions subset of
//    [follow, like, share]; create_account needs label + signup_url; join_group needs
//    platform whatsapp|discord + invite_url). sponsorshipIssues() below is the CLIENT copy of
//    those rules so the wizard can warn before the server rejects.
//
// CONSUMED BY:
//  - app/(a)/a/events/[slug]/edit/_components/SponsorTab.tsx   (edit wizard, admin + organizer)
//  - app/(a)/a/events/create/_components/StepSponsorRequirement.tsx (create wizard, admin +
//    organizer - the organizer create page reuses the same step component)
//
// This component is FULLY CONTROLLED: `value` in, `onChange` out. It never talks to the
// attach/detach/configure endpoints itself, so the create wizard can hold the rows in form
// state for an event that does not exist yet (eventId = null).

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { sponsorsApi, SponsorEngagement, SponsorRow } from "@/lib/sponsors";

// ── value shape ───────────────────────────────────────────────────────────────
// One row per sponsor attached (or about to be attached) to the event. The edit
// wizard hydrates these from sponsorsApi.forEvent(); the create wizard starts empty
// and persists them AFTER /events/create-event/ returns the new event_id.
// Matches PLAYER_NOTE_MAX in afc_sponsors/engagements.py. The backend refuses anything longer with
// a 400 rather than truncating; this stops a player-facing 400 by capping the box itself.
const PLAYER_NOTE_MAX = 2000;

export interface SponsorshipDraft {
  sponsor_id: number;
  sponsor_name: string;
  requires_approval: boolean;
  engagements: SponsorEngagement[];
  /**
   * The organizer's explainer, shown to players on the registration step above this sponsor's
   * fields (owner 2026-08-29). Optional: "" means the fields appear on their own, as they always
   * have. Lives per event-sponsor, not on the sponsor, because the same brand can want different
   * wording on different events.
   */
  player_note?: string;
}

interface SponsorshipBuilderProps {
  // The event the rows belong to. null/undefined = the event does not exist yet
  // (create wizard) - only the helper copy changes; persistence is the parent's job
  // in both cases.
  eventId?: number | null;
  value: SponsorshipDraft[];
  onChange: (next: SponsorshipDraft[]) => void;
}

// ── engagement type catalogue ─────────────────────────────────────────────────
// The type CODES are stable (they mirror afc_sponsors/engagements.py); their user-facing
// labels are i18n'd via the "sponsor" ns at render time (builder.engType.<code> for the
// add-entry select, builder.badge.<code> for the per-entry badge). Badge colors mirror the
// mockup's per-type badges (collect id green / follow socials blue / create account gold /
// join group orange) using the AFC outline rounded-full badge idiom.
type EngagementType = SponsorEngagement["type"];

const ENGAGEMENT_TYPE_VALUES: EngagementType[] = [
  "collect_id",
  "follow_social",
  "create_account",
  "join_group",
];

const TYPE_BADGE_CLS: Record<EngagementType, string> = {
  collect_id: "border-green-500/60 text-green-500",
  follow_social: "border-blue-500/60 text-blue-400",
  create_account: "border-yellow-500/60 text-yellow-500",
  join_group: "border-orange-500/60 text-orange-500",
};

// The actions a follow_social engagement can ask for (server validates the same set).
const SOCIAL_ACTIONS: Array<"follow" | "like" | "share"> = ["follow", "like", "share"];

// Fresh entry per type, pre-seeded so the server-required keys exist from the start.
function newEngagement(type: EngagementType): SponsorEngagement {
  switch (type) {
    case "collect_id":
      return { type, label: "", help: "" };
    case "follow_social":
      return { type, platform: "", url: "", actions: ["follow"], collect_profile_link: true };
    case "create_account":
      return { type, label: "", signup_url: "" };
    case "join_group":
      return { type, platform: "whatsapp", invite_url: "" };
  }
}

// ── client-side mirror of the server's engagement validation ──────────────────
// Returns human-readable problems ("ydpay: entry 2 (Follow socials) needs a page URL")
// so the SAVE paths (SponsorTab save button + the create wizards' step-7 Next gate)
// can warn BEFORE the configure endpoint 400s. Keep in sync with
// afc_sponsors/engagements.py.
//
// i18n: this is a PURE function (no React context), so it takes an OPTIONAL translator `t`
// bound to the "sponsor" ns (builder.issues.*). When passed, every message is localized;
// when omitted it falls back to the identical English string. The admin callers under
// app/(a)/ (i18n-exempt) omit it and keep their exact English behavior; the organizer
// create page can pass `useTranslations("sponsor")` to localize the same warnings.
type IssueTranslator = (key: string, values?: Record<string, string | number>) => string;

export function sponsorshipIssues(
  rows: SponsorshipDraft[],
  t?: IssueTranslator,
): string[] {
  const issues: string[] = [];
  for (const row of rows) {
    row.engagements.forEach((e, i) => {
      // Shared "<sponsor>: entry <n>" prefix reused by every message below.
      const where = t
        ? t("builder.issues.where", { sponsor: row.sponsor_name, n: i + 1 })
        : `${row.sponsor_name}: entry ${i + 1}`;
      // Localized message when a translator is provided, else the English fallback (the
      // english arg is the exact suffix appended after `where`, matching the ns value).
      const msg = (key: string, english: string) =>
        t ? t(`builder.issues.${key}`, { where }) : `${where}${english}`;
      switch (e.type) {
        case "collect_id":
          if (!e.label?.trim())
            issues.push(msg("collectIdLabel", " (Collect an ID) needs a field label."));
          break;
        case "follow_social":
          if (!e.platform?.trim())
            issues.push(msg("followPlatform", " (Follow socials) needs a platform."));
          if (!e.url?.trim())
            issues.push(msg("followUrl", " (Follow socials) needs a page URL."));
          if (!e.actions || e.actions.length === 0)
            issues.push(msg("followAction", " (Follow socials) needs at least one action."));
          break;
        case "create_account":
          if (!e.label?.trim())
            issues.push(msg("createAccountLabel", " (Create an account) needs a field label."));
          if (!e.signup_url?.trim())
            issues.push(msg("createAccountUrl", " (Create an account) needs a signup URL."));
          break;
        case "join_group":
          if (!e.platform?.trim())
            issues.push(msg("joinPlatform", " (Join a group) needs a platform."));
          if (!e.invite_url?.trim())
            issues.push(msg("joinInvite", " (Join a group) needs an invite link."));
          break;
      }
    });
  }
  return issues;
}

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════
export function SponsorshipBuilder({ eventId, value, onChange }: SponsorshipBuilderProps) {
  // i18n: the "sponsor" namespace (messages/en/sponsor.json -> "builder" keys). This component
  // is shared by the organizer event-create wizard (NOT i18n-exempt), so every new user-facing
  // string here is translated.
  const t = useTranslations("sponsor");

  // ── sponsor typeahead state ──
  // Plain input + dropdown (per the approved mockup) instead of the Popover trigger
  // button idiom: the list opens on focus, queries sponsorsApi.list({q}) debounced,
  // and excludes sponsors already in `value`.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SponsorRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── inline "Create sponsor" modal state ──
  // Lets an organizer (or admin) self-serve a brand-new sponsor during event setup instead of
  // waiting for a sponsor-admin to create it under /a/sponsors. Mirrors the admin create dialog
  // in app/(a)/a/sponsors/_components/SponsorProfilesContent.tsx; submits to
  // sponsorsApi.create (POST sponsors/create/), whose gate now also allows event-creating
  // organizers (afc_sponsors.views._can_create_sponsor). On success the new sponsor is auto-added
  // to the picked list below.
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cWebsite, setCWebsite] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Per-sponsor "type to add next" select value (defaults to collect_id), keyed by
  // sponsor_id so two cards don't share one select.
  const [addType, setAddType] = useState<Record<number, EngagementType>>({});

  // Debounced server search. Empty query is allowed - the endpoint then lists every
  // sponsor, which makes the on-focus dropdown useful before the admin types.
  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await sponsorsApi.list({ q: q.trim() || undefined, limit: 8 });
        // Suspended sponsors can't take new events, so the picker only offers active ones.
        setResults((res.results ?? []).filter((s) => s.status === "active"));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    runSearch(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, pickerOpen, runSearch]);

  // Hide sponsors that are already added.
  const pickable = results.filter((s) => !value.some((v) => v.sponsor_id === s.id));

  // ── row mutation helpers (all immutable; every change flows out via onChange) ──

  const addSponsor = (s: SponsorRow) => {
    onChange([
      ...value,
      { sponsor_id: s.id, sponsor_name: s.name, requires_approval: false, engagements: [], player_note: "" },
    ]);
    setQuery("");
    setPickerOpen(false);
  };

  // Create a brand-new sponsor from the inline modal, then attach it to this event's draft.
  // Hits sponsorsApi.create (POST sponsors/create/); the backend now lets event-creating
  // organizers through (afc_sponsors.views._can_create_sponsor), so this works for both the
  // admin and organizer create wizards. On success the returned sponsor is auto-added to the
  // picked list via addSponsor (no extra search needed; a just-picked sponsor is filtered out
  // of the typeahead by `pickable`).
  const handleCreateSponsor = async () => {
    const name = cName.trim();
    if (!name) {
      toast.error(t("builder.modal.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await sponsorsApi.create({
        name,
        website: cWebsite.trim(),
        description: cDesc.trim(),
      });
      toast.success(t("builder.modal.created"));
      setCreateOpen(false);
      setCName("");
      setCWebsite("");
      setCDesc("");
      addSponsor(res.sponsor);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("builder.modal.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const removeSponsor = (sponsorId: number) =>
    onChange(value.filter((v) => v.sponsor_id !== sponsorId));

  const patchRow = (sponsorId: number, patch: Partial<SponsorshipDraft>) =>
    onChange(value.map((v) => (v.sponsor_id === sponsorId ? { ...v, ...patch } : v)));

  const addEngagement = (sponsorId: number) => {
    const type = addType[sponsorId] ?? "collect_id";
    const row = value.find((v) => v.sponsor_id === sponsorId);
    if (!row) return;
    patchRow(sponsorId, { engagements: [...row.engagements, newEngagement(type)] });
  };

  const patchEngagement = (
    sponsorId: number,
    index: number,
    patch: Partial<SponsorEngagement>,
  ) => {
    const row = value.find((v) => v.sponsor_id === sponsorId);
    if (!row) return;
    patchRow(sponsorId, {
      engagements: row.engagements.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  };

  const removeEngagement = (sponsorId: number, index: number) => {
    const row = value.find((v) => v.sponsor_id === sponsorId);
    if (!row) return;
    patchRow(sponsorId, { engagements: row.engagements.filter((_, i) => i !== index) });
  };

  // Up/down reorder - the order here IS the order registrants see the steps in.
  const moveEngagement = (sponsorId: number, index: number, dir: "up" | "down") => {
    const row = value.find((v) => v.sponsor_id === sponsorId);
    if (!row) return;
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= row.engagements.length) return;
    const next = [...row.engagements];
    [next[index], next[target]] = [next[target], next[index]];
    patchRow(sponsorId, { engagements: next });
  };

  // Toggle one action (follow/like/share) on a follow_social entry.
  const toggleAction = (
    sponsorId: number,
    index: number,
    action: "follow" | "like" | "share",
  ) => {
    const row = value.find((v) => v.sponsor_id === sponsorId);
    if (!row) return;
    const current = row.engagements[index]?.actions ?? [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    patchEngagement(sponsorId, index, { actions: next });
  };

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Section intro (mockup copy: pick existing sponsors, no free-text names) */}
      <p className="text-xs text-muted-foreground">
        {t("builder.intro")}
        {!eventId && ` ${t("builder.introCreateSuffix")}`}
      </p>

      {/* ── Sponsor typeahead (search input + dropdown over sponsorsApi.list) ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("builder.searchPlaceholder")}
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setPickerOpen(true)}
          // Delay close so a mousedown on a result still lands (preventDefault below
          // keeps focus, but blur via Tab/Escape should still dismiss the list).
          onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
        />
        {pickerOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover shadow-md">
            {searching ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("builder.searching")}
              </div>
            ) : pickable.length === 0 ? (
              // Empty-state copy is now neutral: organizers can create sponsors too, so the
              // "no match" line points to the Create button below instead of "admins only".
              <div className="px-3 py-3 text-sm text-muted-foreground">
                {results.length > 0
                  ? t("builder.emptyAllAdded")
                  : t("builder.emptyCreate")}
              </div>
            ) : (
              <div className="max-h-56 divide-y overflow-y-auto">
                {pickable.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    // preventDefault keeps the input focused so onBlur doesn't race the click
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSponsor(s)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    {/* initials tile, same visual as the mockup's sponsor logo square */}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gold/90 text-xs font-bold text-background">
                      {s.name.slice(0, 2).toLowerCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t("builder.eventsCount", { count: s.events_count })}
                      </span>
                    </span>
                    <Plus className="size-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── "Create sponsor" inline self-serve (owner 2026-06-30) ──
          Organizers no longer wait for an admin to create a sponsor first: this opens the
          create modal below and, on success, attaches the new sponsor to this event. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("builder.cantFind")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1 size-3.5" />
          {t("builder.createSponsor")}
        </Button>
      </div>

      {/* ── One card per attached sponsor ── */}
      {value.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {t("builder.noneAdded")}
        </p>
      )}

      {value.map((row) => (
        <div key={row.sponsor_id} className="rounded-md border bg-muted/20 p-3">
          {/* card header: name + approval switch + remove (mockup's engrow hdr) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gold/90 text-xs font-bold text-background">
              {row.sponsor_name.slice(0, 2).toLowerCase()}
            </span>
            <span className="text-sm font-semibold">{row.sponsor_name}</span>
            <Badge
              variant="outline"
              className="rounded-full border-gold/60 px-2 py-0.5 text-xs text-gold"
            >
              {eventId ? t("builder.attached") : t("builder.willAttach")}
            </Badge>
            <label className="ml-2 flex cursor-pointer items-center gap-2 text-xs">
              <Switch
                checked={row.requires_approval}
                onCheckedChange={(v) => patchRow(row.sponsor_id, { requires_approval: v })}
              />
              {t("builder.mustApprove")}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeSponsor(row.sponsor_id)}
              aria-label={t("builder.removeSponsor", { name: row.sponsor_name })}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* ── the explainer players read (owner 2026-08-29) ──
              Sits ABOVE the engagement list on purpose, because that is the order a player meets
              it in: first why they are being asked, then the fields. */}
          <div className="mt-3">
            <label
              htmlFor={`player-note-${row.sponsor_id}`}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("builder.playerNote.label")}
            </label>
            <Textarea
              id={`player-note-${row.sponsor_id}`}
              value={row.player_note ?? ""}
              maxLength={PLAYER_NOTE_MAX}
              rows={3}
              className="mt-1 text-sm"
              placeholder={t("builder.playerNote.placeholder")}
              onChange={(e) =>
                patchRow(row.sponsor_id, { player_note: e.target.value })
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("builder.playerNote.help")}
            </p>
          </div>

          {/* ── engagement list ── */}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("builder.engagementsHeading")}
          </p>

          {row.engagements.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("builder.noEngagements")}
            </p>
          )}

          {row.engagements.map((e, i) => {
            return (
              <div
                key={`${row.sponsor_id}-${i}`}
                className="mt-2 rounded-md border bg-background/60 p-3"
              >
                {/* entry header: type badge + reorder arrows + delete */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-xs ${TYPE_BADGE_CLS[e.type]}`}
                  >
                    {t(`builder.badge.${e.type}`)}
                  </Badge>
                  <span className="truncate text-xs font-medium">
                    {e.label || e.platform || e.url || t("builder.entryN", { n: i + 1 })}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      disabled={i === 0}
                      onClick={() => moveEngagement(row.sponsor_id, i, "up")}
                      aria-label={t("builder.moveUp")}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      disabled={i === row.engagements.length - 1}
                      onClick={() => moveEngagement(row.sponsor_id, i, "down")}
                      aria-label={t("builder.moveDown")}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEngagement(row.sponsor_id, i)}
                      aria-label={t("builder.deleteEngagement")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* type-specific inputs (schema mirror of afc_sponsors/engagements.py) */}
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {e.type === "collect_id" && (
                    <>
                      {/* Each collect_id entry is its OWN labelled field at registration,
                          so one sponsor can ask for several values (multi-label ask). */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.collectIdLabel")}</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.collectIdLabelPlaceholder")}
                          value={e.label ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { label: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("builder.fields.collectIdHelp")}
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.collectIdHelpPlaceholder")}
                          value={e.help ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { help: ev.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  {e.type === "follow_social" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.followPlatform")}</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.followPlatformPlaceholder")}
                          value={e.platform ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { platform: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.followUrl")}</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.followUrlPlaceholder")}
                          value={e.url ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { url: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.followActions")}</Label>
                        <div className="flex h-8 items-center gap-4">
                          {SOCIAL_ACTIONS.map((action) => (
                            <label
                              key={action}
                              className="flex cursor-pointer items-center gap-1.5 text-xs"
                            >
                              <Checkbox
                                checked={(e.actions ?? []).includes(action)}
                                onCheckedChange={() => toggleAction(row.sponsor_id, i, action)}
                              />
                              {t(`builder.socialAction.${action}`)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("builder.fields.followCollectProfile")}
                        </Label>
                        <label className="flex h-8 cursor-pointer items-center gap-1.5 text-xs">
                          <Checkbox
                            checked={e.collect_profile_link ?? false}
                            onCheckedChange={(v) =>
                              patchEngagement(row.sponsor_id, i, {
                                collect_profile_link: v === true,
                              })
                            }
                          />
                          {t("builder.fields.followCollectProfileYes")}
                        </label>
                      </div>
                    </>
                  )}

                  {e.type === "create_account" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.createSignupUrl")}</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.createSignupUrlPlaceholder")}
                          value={e.signup_url ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { signup_url: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("builder.fields.createLabel")}
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.createLabelPlaceholder")}
                          value={e.label ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { label: ev.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  {e.type === "join_group" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.joinPlatform")}</Label>
                        {/* whatsapp collects phone + country code, discord collects the
                            discord username - copy mirrors the approved mockup. */}
                        <Select
                          value={e.platform ?? "whatsapp"}
                          onValueChange={(v) =>
                            patchEngagement(row.sponsor_id, i, { platform: v })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={t("builder.fields.joinPlatformPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">
                              {t("builder.fields.joinWhatsapp")}
                            </SelectItem>
                            <SelectItem value="discord">
                              {t("builder.fields.joinDiscord")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("builder.fields.joinInviteUrl")}</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("builder.fields.joinInviteUrlPlaceholder")}
                          value={e.invite_url ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { invite_url: ev.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* add-entry row: type select + add button (mockup's bottom row) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              value={addType[row.sponsor_id] ?? "collect_id"}
              onValueChange={(v) =>
                setAddType((p) => ({ ...p, [row.sponsor_id]: v as EngagementType }))
              }
            >
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGAGEMENT_TYPE_VALUES.map((val) => (
                  <SelectItem key={val} value={val}>
                    {t(`builder.engType.${val}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => addEngagement(row.sponsor_id)}
            >
              <Plus className="mr-1 size-3.5" />
              {t("builder.addEngagement")}
            </Button>
          </div>
        </div>
      ))}

      {/* multi collect_id note from the mockup */}
      {value.length > 0 && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("builder.multiCollectNote")}
        </p>
      )}

      {/* ── Inline "Create sponsor" modal ──
          Same fields + flow as the admin dialog (SponsorProfilesContent): Name (required),
          Website (optional), Description (optional). Submits via handleCreateSponsor ->
          sponsorsApi.create, then auto-adds the new sponsor to the picked list. */}
      <Dialog open={createOpen} onOpenChange={(o) => !creating && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("builder.modal.title")}</DialogTitle>
            <DialogDescription>{t("builder.modal.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="space-y-1.5">
              <Label>{t("builder.modal.nameLabel")}</Label>
              <Input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder={t("builder.modal.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("builder.modal.websiteLabel")}</Label>
              <Input
                value={cWebsite}
                onChange={(e) => setCWebsite(e.target.value)}
                placeholder={t("builder.modal.websitePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("builder.modal.descriptionLabel")}</Label>
              <Textarea rows={3} value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
              {t("builder.modal.cancel")}
            </Button>
            <Button disabled={creating} onClick={handleCreateSponsor}>
              {creating && <Loader2 className="mr-1 size-4 animate-spin" />}
              {t("builder.modal.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
