"use client";

// ── CSRoomSettingsDialog ──────────────────────────────────────────────────────
// The CLASH SQUAD ROOM SETTINGS editor (owner 2026-08-12; spec
// WEBSITE/tasks/cs-room-settings-spec.md). An organizer builds the in-game custom-room
// configuration here instead of agreeing it verbally in the lobby, and players read the result on
// the event page.
//
// FOUR TABS, the same four Free Fire uses, so an organizer comparing the two screens sees the same
// shape: CORE (rounds / map / economy / the yes-no toggles), STORE (per-item on-off and price),
// ECONOMY (starting cash per round + the event bonuses) and AREA (which part of the map each round
// is played in).
//
// SCOPE IS THE POINT: the dialog edits ONE scope - a stage ("apply to every match in this stage")
// or a single match ("except the grand final"). A scope with no configuration of its own INHERITS,
// and the header says what it is inheriting from, so nobody has to guess whether they are looking
// at a real override or at borrowed values.
//
// HOW IT CONNECTS: lib/csRoom.ts -> afc_tournament_and_scrims/cs_room_views.py
// (GET cs-room-catalogue/, GET/PUT/DELETE cs-room-settings/<scope>/<id>/, cs-room-presets/).
// Mounted by components/h2h-bracket.tsx: once for the stage (the card header) and once per match
// (the match menu). The read-only player-facing view of the same data is components/cs-room-card.tsx.
//
// Design: house admin idioms (rounded-md cards, text-xs compact rows, pill Tabs, outline
// rounded-full badges). Every string is translated (bracket.json, en/fr/pt).

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IconLoader2, IconSearch, IconTrash } from "@tabler/icons-react";

import {
  applyBuiltinMode,
  blankSettings,
  csRoomApi,
  optionLabel,
  type CSRoomCatalogue,
  type CSRoomConfig,
  type CSRoomScope,
  type CSRoomSettings,
} from "@/lib/csRoom";

// A dynamic translation key, guarded: next-intl THROWS on a missing key and the scope comes from
// the API, so an unrecognised value must degrade to the raw string rather than take the editor
// down with whatever the organizer had typed into it. House rule (owner 2026-07-13).
function dynScope(
  t: ReturnType<typeof useTranslations>,
  scope: string | null | undefined,
): string {
  const key = `roomScope_${scope ?? ""}`;
  return scope && t.has(key) ? t(key) : String(scope ?? "");
}

// The settings half of a configuration, which is what the editor holds in state. Kept separate
// from the room ID / password / notes below because those belong to a SCOPE, not to a preset.
// Exported because the create-event wizard carries one of these in its stage draft until the
// event is saved (owner 2026-08-13) - see the draft mode on CSRoomSettingsDialog.
export type CSRoomDraft = CSRoomSettings & {
  room_id: string;
  room_password: string;
  notes: string;
  is_published: boolean;
};

/** Turn a saved configuration into the editor's draft. */
function toDraft(config: CSRoomConfig): CSRoomDraft {
  return {
    rounds: config.rounds,
    economy: config.economy,
    special_mode: config.special_mode,
    special_airdrop: config.special_airdrop,
    hp: config.hp,
    ep: config.ep,
    movement_speed: config.movement_speed,
    jump_height: config.jump_height,
    environment: config.environment,
    map_name: config.map_name,
    preset_key: config.preset_key,
    toggles: { ...config.toggles },
    store: { ...config.store },
    round_economy: { ...config.round_economy },
    economy_events: { ...config.economy_events },
    areas: { ...config.areas },
    room_id: config.room_id,
    room_password: config.room_password,
    notes: config.notes,
    is_published: config.is_published,
  };
}

/** A blank room built from the catalogue's own defaults, for a scope that has nothing saved yet
 *  and is not inheriting anything either. blankSettings() mirrors cs_room.blank_settings() on the
 *  backend; the four access fields are the config-only half a preset does not have. */
function blankDraft(catalogue: CSRoomCatalogue): CSRoomDraft {
  return {
    ...blankSettings(catalogue),
    room_id: "",
    room_password: "",
    notes: "",
    is_published: false,
  };
}

export function CSRoomSettingsDialog({
  open,
  onOpenChange,
  scope,
  objectId,
  // What the dialog is editing, for the header line ("Playoffs" / "Match 3: A vs B").
  scopeLabel,
  onSaved,
  draftValue,
  onDraftSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required in SCOPED mode (a saved stage / match). Ignored in draft mode. */
  scope?: CSRoomScope;
  objectId?: number;
  scopeLabel: string;
  /** Called after a successful save or clear so the bracket card can re-read itself. */
  onSaved?: () => void;

  // ── DRAFT MODE (owner 2026-08-13: "the settings should also show when creating and editing
  // the event, it doesn't have to be compulsory") ─────────────────────────────────────────────
  // In the create wizard the stage does not exist yet, so there is nothing to PUT against. Pass
  // draftValue (null for "nothing configured yet") and onDraftSave, and the dialog edits in
  // memory: it fetches only the catalogue, applies preset modes locally, and hands the finished
  // settings back for the wizard to send with create_event. Saving is optional in every sense -
  // never opening this dialog simply means the stage has no room configuration.
  draftValue?: CSRoomDraft | null;
  onDraftSave?: (draft: CSRoomDraft | null) => void;
}) {
  // Draft mode is chosen by the CALLER passing the pair, not by scope being absent, so a caller
  // that forgets one of the two fails loudly rather than silently saving nowhere.
  const isDraft = typeof onDraftSave === "function";
  const t = useTranslations("bracket");

  const [catalogue, setCatalogue] = useState<CSRoomCatalogue | null>(null);
  const [draft, setDraft] = useState<CSRoomDraft | null>(null);
  // Where the values on screen came from: this scope's own row, or an inherited one. Editing an
  // inherited configuration and saving CREATES an override at this scope, which is exactly what an
  // organizer means when they open the dialog on a match and change something.
  const [inheritedFrom, setInheritedFrom] = useState<CSRoomScope | null>(null);
  const [hasOwn, setHasOwn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storeQuery, setStoreQuery] = useState("");

  // ── load the catalogue + this scope's settings together ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cat = await csRoomApi.getCatalogue();
      setCatalogue(cat);

      // Draft mode: nothing to read from the server, the caller holds the value.
      if (isDraft) {
        setHasOwn(!!draftValue);
        setInheritedFrom(null);
        setDraft(draftValue ?? blankDraft(cat));
        return;
      }

      const settings = await csRoomApi.get(scope!, objectId!);
      setHasOwn(!!settings.own);
      setInheritedFrom(settings.own ? null : settings.effective_scope);
      // Own row first, then whatever is inherited (so an override starts from what applies today
      // rather than from a blank room), then the catalogue defaults.
      const source = settings.own ?? settings.effective;
      setDraft(source ? toDraft(source) : blankDraft(cat));
    } catch {
      toast.error(t("roomLoadFailed"));
    } finally {
      setLoading(false);
    }
    // draftValue is intentionally read at open time only: re-running on every keystroke in the
    // parent would throw away what the organizer is typing in here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, objectId, isDraft, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const set = <K extends keyof CSRoomDraft>(key: K, value: CSRoomDraft[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  // Rounds drives two per-round documents. Changing it has to grow or shrink both, or the last
  // rounds of a longer set would have no starting cash and no area.
  const setRounds = (rounds: number) => {
    setDraft((prev) => {
      if (!prev || !catalogue) return prev;
      const areaList = catalogue.map_areas[prev.map_name] ?? [];
      const round_economy: Record<string, number> = {};
      const areas: Record<string, string> = {};
      for (let n = 1; n <= rounds; n += 1) {
        round_economy[String(n)] = prev.round_economy[String(n)] ?? 500;
        areas[String(n)] =
          prev.areas[String(n)] ?? areaList[(n - 1) % Math.max(areaList.length, 1)]?.value ?? "";
      }
      return { ...prev, rounds, round_economy, areas };
    });
  };

  // Changing the map invalidates every area, so refill from the new map's own list (the backend
  // does the same on save, but doing it here keeps the AREA tab honest while you are looking at it).
  const setMap = (map_name: string) => {
    setDraft((prev) => {
      if (!prev || !catalogue) return prev;
      const areaList = catalogue.map_areas[map_name] ?? [];
      const areas: Record<string, string> = {};
      for (let n = 1; n <= prev.rounds; n += 1) {
        areas[String(n)] = areaList[(n - 1) % Math.max(areaList.length, 1)]?.value ?? "";
      }
      return { ...prev, map_name, areas };
    });
  };

  const applyMode = async (modeKey: string) => {
    if (!draft || !catalogue) return;
    // Draft mode applies the mode locally from the catalogue's own patch table, so the wizard
    // lands on exactly the values the server would have produced.
    if (isDraft) {
      setDraft({ ...draft, ...applyBuiltinMode(catalogue, modeKey, draft) });
      setHasOwn(true);
      toast.success(t("roomModeApplied"));
      return;
    }
    setBusy(true);
    try {
      // Applied on the SERVER so the built-in modes are defined in exactly one place, then the
      // fresh configuration is read back into the draft.
      const res = await csRoomApi.save(scope!, objectId!, { apply_mode: modeKey });
      if (res.own) setDraft(toDraft(res.own));
      setHasOwn(true);
      setInheritedFrom(null);
      toast.success(t("roomModeApplied"));
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("roomSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    if (isDraft) {
      // Hand the settings back to the wizard; nothing is written until the event itself is saved.
      onDraftSave!(draft);
      toast.success(t("roomSaved"));
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      const res = await csRoomApi.save(scope!, objectId!, draft);
      toast.success(res.message || t("roomSaved"));
      setHasOwn(true);
      setInheritedFrom(null);
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("roomSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (isDraft) {
      // "Remove these settings" on an unsaved stage means "send nothing", so the stage is created
      // with no room configuration at all.
      onDraftSave!(null);
      toast.success(t("roomCleared"));
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await csRoomApi.clear(scope!, objectId!);
      toast.success(t("roomCleared"));
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("roomSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  // The store is ~110 rows. A search box beats scrolling for the one gun somebody wants to ban.
  const storeRows = useMemo(() => {
    if (!catalogue) return { weapons: [], items: [] };
    const q = storeQuery.trim().toLowerCase();
    const match = (label: string) => !q || label.toLowerCase().includes(q);
    return {
      weapons: catalogue.store_weapons.filter((i) => match(i.label)),
      items: catalogue.store_items.filter((i) => match(i.label)),
    };
  }, [catalogue, storeQuery]);

  const roundNumbers = useMemo(
    () => (draft ? Array.from({ length: draft.rounds }, (_, i) => String(i + 1)) : []),
    [draft],
  );

  const areaOptions = catalogue && draft ? catalogue.map_areas[draft.map_name] ?? [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Tall and scrollable: the STORE tab is a long list, and on a phone every tab is. */}
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("roomSettings")}</DialogTitle>
          <DialogDescription>
            {t("roomSettingsFor", { name: scopeLabel })}{" "}
            {inheritedFrom
              ? t("roomInheritedFrom", { scope: dynScope(t, inheritedFrom) })
              : hasOwn
                ? t("roomOwnSettings")
                : t("roomNoneYet")}
          </DialogDescription>
        </DialogHeader>

        {loading || !draft || !catalogue ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <IconLoader2 className="size-4 animate-spin" /> {t("loading")}
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── one-tap Free Fire modes ── */}
            <div className="space-y-1.5">
              <Label>{t("roomPresetModes")}</Label>
              <p className="text-muted-foreground text-xs">{t("roomPresetModesHint")}</p>
              <div className="flex flex-wrap gap-1.5">
                {catalogue.presets.map((preset) => (
                  <Button
                    key={preset.key}
                    variant={draft.preset_key === preset.label ? "default" : "outline"}
                    size="sm"
                    disabled={busy}
                    title={preset.description}
                    onClick={() => applyMode(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Tabs defaultValue="core">
              <TabsList className="h-9">
                <TabsTrigger value="core">{t("roomTabCore")}</TabsTrigger>
                <TabsTrigger value="store">{t("roomTabStore")}</TabsTrigger>
                <TabsTrigger value="economy">{t("roomTabEconomy")}</TabsTrigger>
                <TabsTrigger value="area">{t("roomTabArea")}</TabsTrigger>
                <TabsTrigger value="access">{t("roomTabAccess")}</TabsTrigger>
              </TabsList>

              {/* ── CORE ─────────────────────────────────────────────────────────── */}
              <TabsContent value="core" className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberSelect
                    label={t("roomRounds")} value={draft.rounds} options={catalogue.rounds}
                    onChange={setRounds}
                  />
                  <OptionSelect
                    label={t("roomMap")} value={draft.map_name} options={catalogue.maps}
                    onChange={setMap}
                  />
                  <OptionSelect
                    label={t("roomEconomy")} value={draft.economy} options={catalogue.economy}
                    onChange={(v) => set("economy", v)}
                  />
                  <OptionSelect
                    label={t("roomSpecialMode")} value={draft.special_mode}
                    options={catalogue.special_mode} onChange={(v) => set("special_mode", v)}
                  />
                  <OptionSelect
                    label={t("roomSpecialAirdrop")} value={draft.special_airdrop}
                    options={catalogue.special_airdrop}
                    onChange={(v) => set("special_airdrop", v)}
                  />
                  <OptionSelect
                    label={t("roomEnvironment")} value={draft.environment}
                    options={catalogue.environment} onChange={(v) => set("environment", v)}
                  />
                  <NumberSelect
                    label={t("roomHp")} value={draft.hp} options={catalogue.hp}
                    onChange={(v) => set("hp", v)}
                  />
                  <NumberSelect
                    label={t("roomEp")} value={draft.ep} options={catalogue.ep}
                    onChange={(v) => set("ep", v)}
                  />
                  <NumberSelect
                    label={t("roomMovementSpeed")} value={draft.movement_speed}
                    options={catalogue.movement_speed} suffix="%"
                    onChange={(v) => set("movement_speed", v)}
                  />
                  <NumberSelect
                    label={t("roomJumpHeight")} value={draft.jump_height}
                    options={catalogue.jump_height} suffix="%"
                    onChange={(v) => set("jump_height", v)}
                  />
                </div>

                {/* Best-of, derived. Worth stating: it is the cap the backend puts on a score. */}
                <p className="text-muted-foreground text-xs">
                  {t("roomBestOfHint", { n: Math.floor(draft.rounds / 2) + 1 })}
                </p>

                <div className="space-y-1.5">
                  <Label>{t("roomToggles")}</Label>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {catalogue.toggles.map((toggle) => (
                      <label
                        key={toggle.key}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-xs"
                      >
                        <span className="truncate">{toggle.label}</span>
                        <Switch
                          checked={draft.toggles[toggle.key] ?? toggle.default}
                          onCheckedChange={(v) =>
                            set("toggles", { ...draft.toggles, [toggle.key]: v })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── STORE ────────────────────────────────────────────────────────── */}
              <TabsContent value="store" className="space-y-3 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch className="text-muted-foreground absolute top-2.5 left-2 size-3.5" />
                    <Input
                      className="h-9 pl-7 text-xs"
                      placeholder={t("roomStoreSearch")}
                      value={storeQuery}
                      onChange={(e) => setStoreQuery(e.target.value)}
                    />
                  </div>
                  {/* shrink-0: on a 390px phone the flex row squeezed this badge off the right
                      edge of the dialog. The search box gives up the space instead. */}
                  <Badge
                    variant="outline"
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs whitespace-nowrap"
                  >
                    {t("roomStoreSelected", {
                      n: Object.values(draft.store).filter((s) => s.enabled).length,
                    })}
                  </Badge>
                </div>
                <StoreList
                  title={t("roomStoreWeapons")} rows={storeRows.weapons} draft={draft}
                  onChange={(store) => set("store", store)} priceLabel={t("roomPrice")}
                />
                <StoreList
                  title={t("roomStoreItems")} rows={storeRows.items} draft={draft}
                  onChange={(store) => set("store", store)} priceLabel={t("roomPrice")}
                />
              </TabsContent>

              {/* ── ECONOMY ──────────────────────────────────────────────────────── */}
              <TabsContent value="economy" className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <Label>{t("roomStartingCash")}</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {roundNumbers.map((n) => (
                      <div key={n} className="space-y-1">
                        <span className="text-muted-foreground text-[10px] uppercase">
                          {t("roomRoundN", { n })}
                        </span>
                        <Input
                          type="number" min={0} className="h-8 text-xs"
                          value={draft.round_economy[n] ?? 0}
                          onChange={(e) =>
                            set("round_economy", {
                              ...draft.round_economy,
                              [n]: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("roomEconomyEvents")}</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {catalogue.economy_events.map((ev) => (
                      <div key={ev.key} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-xs">{ev.label}</span>
                        <Input
                          type="number" min={0} className="h-8 w-24 text-xs"
                          value={draft.economy_events[ev.key] ?? ev.default}
                          onChange={(e) =>
                            set("economy_events", {
                              ...draft.economy_events,
                              [ev.key]: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── AREA ─────────────────────────────────────────────────────────── */}
              <TabsContent value="area" className="space-y-3 pt-3">
                {areaOptions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{t("roomNoAreas")}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {roundNumbers.map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">
                          {t("roomRoundN", { n })}
                        </span>
                        <Select
                          value={draft.areas[n] ?? ""}
                          onValueChange={(v) => set("areas", { ...draft.areas, [n]: v })}
                        >
                          <SelectTrigger size="sm" className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {areaOptions.map((a) => (
                              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── ACCESS: room id / password / notes / publish ─────────────────── */}
              <TabsContent value="access" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("roomId")}</Label>
                    <Input
                      value={draft.room_id}
                      onChange={(e) => set("room_id", e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("roomPassword")}</Label>
                    <Input
                      value={draft.room_password}
                      onChange={(e) => set("room_password", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("roomNotes")}</Label>
                  <Textarea
                    rows={3} value={draft.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder={t("roomNotesPlaceholder")}
                  />
                </div>
                {/* Publishing is what hands the room ID to players AND sends the notification, so
                    it is a deliberate switch rather than a side effect of saving. */}
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                  <Checkbox
                    checked={draft.is_published}
                    onCheckedChange={(v) => set("is_published", v === true)}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-xs font-medium">{t("roomPublish")}</span>
                    <span className="text-muted-foreground block text-xs">
                      {t("roomPublishHint")}
                    </span>
                  </span>
                </label>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {/* Clearing an override is only offered where there IS one to clear. */}
          {hasOwn && scope !== "event" ? (
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={busy}>
              <IconTrash className="size-4" /> {t("roomClear")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={busy || loading}>
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {t("roomSave")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── small field helpers ───────────────────────────────────────────────────────

function OptionSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberSelect({
  label, value, options, onChange, suffix = "",
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={String(o)}>{o}{suffix}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One block of the STORE tab: a tick for on-sale and a box for the price. */
function StoreList({
  title, rows, draft, onChange, priceLabel,
}: {
  title: string;
  rows: Array<{ code: string; label: string; default_price: number }>;
  draft: CSRoomDraft;
  onChange: (store: CSRoomDraft["store"]) => void;
  priceLabel: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-primary text-sm font-semibold">{title}</p>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1.5">
        {rows.map((item) => {
          const entry = draft.store[item.code] ?? { enabled: true, price: item.default_price };
          return (
            <div key={item.code} className="flex items-center gap-2 px-1 text-xs">
              <Checkbox
                checked={entry.enabled}
                onCheckedChange={(v) =>
                  onChange({ ...draft.store, [item.code]: { ...entry, enabled: v === true } })
                }
              />
              <span className="flex-1 truncate">{item.label}</span>
              <Input
                type="number" min={0} className="h-7 w-20 text-center text-xs"
                aria-label={`${priceLabel} ${item.label}`}
                value={entry.price}
                onChange={(e) =>
                  onChange({
                    ...draft.store,
                    [item.code]: { ...entry, price: Number(e.target.value) || 0 },
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── read-only player-facing view ──────────────────────────────────────────────

/**
 * CSRoomCard - what a PLAYER reads: a short summary of how the room plays, the room ID and
 * password once the organizer publishes them, and an expander for the full settings.
 *
 * Deliberately not the editor in disabled form: a player wants the handful of settings that change
 * how they play (rounds, map, economy, headshot, skills, loadout), not 110 store prices, so the
 * summary leads and everything else is one tap away.
 *
 * Mounted by components/h2h-bracket.tsx above the tree (stage-level) and inside a match's detail
 * dialog when that match overrides the stage.
 */
export function CSRoomCard({
  summary,
  roomId,
  roomPassword,
  notes,
  isPublished,
  sourceScope,
  hasCredentials,
}: {
  summary: import("@/lib/csRoom").CSRoomSummary | null;
  roomId?: string;
  roomPassword?: string;
  notes?: string;
  isPublished?: boolean;
  sourceScope?: CSRoomScope | null;
  hasCredentials?: boolean;
}) {
  const t = useTranslations("bracket");
  const [catalogue, setCatalogue] = useState<CSRoomCatalogue | null>(null);

  // The catalogue is what turns codes into words, and it is public + static, so a read-only card
  // can fetch it on its own without any auth plumbing.
  useEffect(() => {
    let alive = true;
    csRoomApi.getCatalogue().then((c) => { if (alive) setCatalogue(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!summary) return null;

  const yesNo = (on: boolean) => (on ? t("roomOn") : t("roomOff"));

  return (
    <div className="bg-card space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-primary text-sm font-semibold">{t("roomSettings")}</span>
        {sourceScope && (
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
            {dynScope(t, sourceScope)}
          </Badge>
        )}
      </div>

      {/* The summary: what actually changes how you play. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="text-muted-foreground">{t("roomRounds")}: </span>
          {summary.rounds} ({t("roomFirstTo", { n: summary.wins_needed })})
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomMap")}: </span>
          {optionLabel(catalogue?.maps, summary.map_name)}
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomEconomy")}: </span>
          {optionLabel(catalogue?.economy, summary.economy)}
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomHp")}: </span>{summary.hp}
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomEnvironment")}: </span>
          {optionLabel(catalogue?.environment, summary.environment)}
        </span>
        {summary.special_mode !== "no" && (
          <span>
            <span className="text-muted-foreground">{t("roomSpecialMode")}: </span>
            {optionLabel(catalogue?.special_mode, summary.special_mode)}
          </span>
        )}
        <span>
          <span className="text-muted-foreground">{t("roomHeadshot")}: </span>
          {yesNo(summary.headshot)}
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomCharacterSkill")}: </span>
          {yesNo(summary.character_skill)}
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomLoadout")}: </span>
          {yesNo(summary.loadout)}
        </span>
        <span>
          <span className="text-muted-foreground">{t("roomGunAttributes")}: </span>
          {yesNo(summary.gun_attributes)}
        </span>
      </div>

      {/* How to get in. Withheld until the organizer publishes, which is the whole point of the
          publish switch: a room ID on a public page hours early invites strangers to walk in. */}
      {roomId ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="text-muted-foreground">{t("roomId")}: </span>
            <span className="font-mono font-semibold">{roomId}</span>
          </span>
          {roomPassword && (
            <span>
              <span className="text-muted-foreground">{t("roomPassword")}: </span>
              <span className="font-mono font-semibold">{roomPassword}</span>
            </span>
          )}
        </div>
      ) : hasCredentials && !isPublished ? (
        <p className="text-muted-foreground text-xs italic">{t("roomNotOpenYet")}</p>
      ) : null}

      {notes && <p className="text-xs">{notes}</p>}
    </div>
  );
}
