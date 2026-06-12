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
import { sponsorsApi, SponsorEngagement, SponsorRow } from "@/lib/sponsors";

// ── value shape ───────────────────────────────────────────────────────────────
// One row per sponsor attached (or about to be attached) to the event. The edit
// wizard hydrates these from sponsorsApi.forEvent(); the create wizard starts empty
// and persists them AFTER /events/create-event/ returns the new event_id.
export interface SponsorshipDraft {
  sponsor_id: number;
  sponsor_name: string;
  requires_approval: boolean;
  engagements: SponsorEngagement[];
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
// Labels match the mockup's add-entry select; badge colors mirror the mockup's
// per-type badges (collect id green / follow socials blue / create account gold /
// join group orange) using the AFC outline rounded-full badge idiom.
type EngagementType = SponsorEngagement["type"];

const ENGAGEMENT_TYPES: Array<{ value: EngagementType; label: string }> = [
  { value: "collect_id", label: "Collect an ID" },
  { value: "follow_social", label: "Follow socials" },
  { value: "create_account", label: "Create an account" },
  { value: "join_group", label: "Join a group" },
];

const TYPE_BADGE: Record<EngagementType, { label: string; cls: string }> = {
  collect_id: { label: "collect id", cls: "border-green-500/60 text-green-500" },
  follow_social: { label: "follow socials", cls: "border-blue-500/60 text-blue-400" },
  create_account: { label: "create account", cls: "border-yellow-500/60 text-yellow-500" },
  join_group: { label: "join group", cls: "border-orange-500/60 text-orange-500" },
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
export function sponsorshipIssues(rows: SponsorshipDraft[]): string[] {
  const issues: string[] = [];
  for (const row of rows) {
    row.engagements.forEach((e, i) => {
      const where = `${row.sponsor_name}: entry ${i + 1}`;
      switch (e.type) {
        case "collect_id":
          if (!e.label?.trim()) issues.push(`${where} (Collect an ID) needs a field label.`);
          break;
        case "follow_social":
          if (!e.platform?.trim()) issues.push(`${where} (Follow socials) needs a platform.`);
          if (!e.url?.trim()) issues.push(`${where} (Follow socials) needs a page URL.`);
          if (!e.actions || e.actions.length === 0)
            issues.push(`${where} (Follow socials) needs at least one action.`);
          break;
        case "create_account":
          if (!e.label?.trim()) issues.push(`${where} (Create an account) needs a field label.`);
          if (!e.signup_url?.trim()) issues.push(`${where} (Create an account) needs a signup URL.`);
          break;
        case "join_group":
          if (!e.platform?.trim()) issues.push(`${where} (Join a group) needs a platform.`);
          if (!e.invite_url?.trim()) issues.push(`${where} (Join a group) needs an invite link.`);
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
  // ── sponsor typeahead state ──
  // Plain input + dropdown (per the approved mockup) instead of the Popover trigger
  // button idiom: the list opens on focus, queries sponsorsApi.list({q}) debounced,
  // and excludes sponsors already in `value`.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SponsorRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      { sponsor_id: s.id, sponsor_name: s.name, requires_approval: false, engagements: [] },
    ]);
    setQuery("");
    setPickerOpen(false);
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
        Pick existing sponsors (no free-text names). An event can carry multiple
        sponsors; each brings its own engagements.
        {!eventId && " Sponsors are attached right after the event is created."}
      </p>

      {/* ── Sponsor typeahead (search input + dropdown over sponsorsApi.list) ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search a sponsor..."
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
                <Loader2 className="size-4 animate-spin" /> Searching...
              </div>
            ) : pickable.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                {results.length > 0
                  ? "All matching sponsors are already added."
                  : "No sponsors found. Sponsor admins create them under Admin, Sponsors."}
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
                        {s.events_count} event{s.events_count === 1 ? "" : "s"} so far
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

      {/* ── One card per attached sponsor ── */}
      {value.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          No sponsors added yet. Search above to attach one.
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
              {eventId ? "attached" : "will attach on create"}
            </Badge>
            <label className="ml-2 flex cursor-pointer items-center gap-2 text-xs">
              <Switch
                checked={row.requires_approval}
                onCheckedChange={(v) => patchRow(row.sponsor_id, { requires_approval: v })}
              />
              Sponsor must approve registrations
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeSponsor(row.sponsor_id)}
              aria-label={`Remove ${row.sponsor_name}`}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* ── engagement list ── */}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Engagements
          </p>

          {row.engagements.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No engagements yet. Add one below; registrants complete them in this order.
            </p>
          )}

          {row.engagements.map((e, i) => {
            const badge = TYPE_BADGE[e.type];
            return (
              <div
                key={`${row.sponsor_id}-${i}`}
                className="mt-2 rounded-md border bg-background/60 p-3"
              >
                {/* entry header: type badge + reorder arrows + delete */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}
                  >
                    {badge.label}
                  </Badge>
                  <span className="truncate text-xs font-medium">
                    {e.label || e.platform || e.url || `Entry ${i + 1}`}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground"
                      disabled={i === 0}
                      onClick={() => moveEngagement(row.sponsor_id, i, "up")}
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground"
                      disabled={i === row.engagements.length - 1}
                      onClick={() => moveEngagement(row.sponsor_id, i, "down")}
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEngagement(row.sponsor_id, i)}
                      aria-label="Delete engagement"
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
                        <Label className="text-xs text-muted-foreground">Field label</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. ydpay UID"
                          value={e.label ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { label: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Help text (optional)
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. Find it in the app under Profile"
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
                        <Label className="text-xs text-muted-foreground">Platform</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. Instagram, X, TikTok"
                          value={e.platform ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { platform: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Page URL</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. instagram.com/ydpay"
                          value={e.url ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { url: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Actions</Label>
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
                              {action}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Collect registrant profile link
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
                          yes, ask for their profile link
                        </label>
                      </div>
                    </>
                  )}

                  {e.type === "create_account" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Signup URL</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. app.sponsor.com/signup"
                          value={e.signup_url ?? ""}
                          onChange={(ev) =>
                            patchEngagement(row.sponsor_id, i, { signup_url: ev.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Collected field label
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. App username"
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
                        <Label className="text-xs text-muted-foreground">Platform</Label>
                        {/* whatsapp collects phone + country code, discord collects the
                            discord username - copy mirrors the approved mockup. */}
                        <Select
                          value={e.platform ?? "whatsapp"}
                          onValueChange={(v) =>
                            patchEngagement(row.sponsor_id, i, { platform: v })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Pick a platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">
                              WhatsApp (collects phone + country code)
                            </SelectItem>
                            <SelectItem value="discord">
                              Discord (collects discord username)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Invite link</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. chat.whatsapp.com/your-community"
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
                {ENGAGEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
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
              Add engagement
            </Button>
          </div>
        </div>
      ))}

      {/* multi collect_id note from the mockup */}
      {value.length > 0 && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Each &quot;collect id&quot; entry is its own labelled field at registration, so one
          sponsor can ask for several values.
        </p>
      )}
    </div>
  );
}
