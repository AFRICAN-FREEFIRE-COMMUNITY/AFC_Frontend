"use client";

// ── Admin · Wagers · the market form ─────────────────────────────────────────────────────────
// One form for /a/wagers/new (create) and the edit panel on /a/wagers/[slug]. Pick a template
// and an event, then the match it settles from; the options come from the event's teams or
// players (or are typed for a custom market, or made from the line for over / under). Rates
// and limits start from the settings defaults and can be changed per market.
//
// Sends MarketInput to POST /wagers/admin/markets/create/ or PATCH /wagers/admin/markets/<slug>/.
// On an existing market the template and event are fixed; options can only change on a draft
// with no stakes (the server refuses otherwise, `options_locked`).

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconPlus, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createMarket, getAdminSettings, listTemplates, pickerEvent, pickerEvents, saveMarket,
  type AdminMarketDetail, type MarketInput, type MarketTemplate, type PickerEvent, type PickerEventDetail,
} from "@/lib/api/wagersAdmin";

import {
  bpsToPercentInput, isoToLocalInput, koboToNairaInput, localInputToIso, nairaInputToKobo, Panel,
  percentInputToBps, useAdminRefusal,
} from "./shared";

interface Props {
  existing?: AdminMarketDetail;
  onSaved: (market: AdminMarketDetail) => void;
}

export function MarketForm({ existing, onSaved }: Props) {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const editing = !!existing;

  const [templates, setTemplates] = useState<MarketTemplate[] | null>(null);
  const [events, setEvents] = useState<PickerEvent[]>([]);
  const [eventQuery, setEventQuery] = useState("");
  const [detail, setDetail] = useState<PickerEventDetail | null>(null);

  const [template, setTemplate] = useState(existing?.template ?? "");
  const [eventId, setEventId] = useState<string>(existing ? String(existing.event_id) : "");
  const [stageId, setStageId] = useState<string>(existing?.stage_id ? String(existing.stage_id) : "");
  const [matchId, setMatchId] = useState<string>(existing?.match_id ? String(existing.match_id) : "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [rules, setRules] = useState(existing?.rules_text ?? "");
  const [lockAt, setLockAt] = useState(isoToLocalInput(existing?.lock_at));
  const [openAt, setOpenAt] = useState(isoToLocalInput(existing?.open_at));
  const [visibility, setVisibility] = useState<"public" | "signed_in">(existing?.visibility ?? "public");
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [line, setLine] = useState(existing?.over_under_line ? String(existing.over_under_line) : "");
  const [rake, setRake] = useState(bpsToPercentInput(existing?.rake_bps));
  const [cancelFee, setCancelFee] = useState(bpsToPercentInput(existing?.cancel_fee_bps));
  const [minStake, setMinStake] = useState(koboToNairaInput(existing?.min_stake_kobo));
  const [maxPerUser, setMaxPerUser] = useState(koboToNairaInput(existing?.max_stake_per_user_kobo));
  const [maxPool, setMaxPool] = useState(koboToNairaInput(existing?.max_pool_kobo));
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [playerIds, setPlayerIds] = useState<number[]>([]);
  const [custom, setCustom] = useState<string[]>(existing && existing.template_detail.option_source === "custom" ? existing.options.map((o) => o.label) : ["", ""]);
  const [busy, setBusy] = useState(false);

  const tpl = templates?.find((x) => x.code === template) ?? existing?.template_detail ?? null;
  const optionsLocked = editing && (existing!.status !== "DRAFT" || existing!.wager_count > 0);

  // templates + settings defaults once; the event list follows the search box
  useEffect(() => {
    listTemplates().then((rows) => setTemplates(rows.filter((r) => r.is_active || r.code === existing?.template))).catch(refuse);
    if (!editing) {
      getAdminSettings().then((s) => {
        setRake(bpsToPercentInput(s.rake_bps));
        setCancelFee(bpsToPercentInput(s.cancel_fee_bps));
        setMinStake(koboToNairaInput(s.min_stake_kobo));
        setMaxPerUser(koboToNairaInput(s.max_stake_per_user_kobo));
        setMaxPool(koboToNairaInput(s.max_pool_kobo));
      }).catch(refuse);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing) return;
    const handle = setTimeout(() => { pickerEvents(eventQuery).then(setEvents).catch(refuse); }, 250);
    return () => clearTimeout(handle);
  }, [eventQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!eventId) { setDetail(null); return; }
    pickerEvent(Number(eventId)).then((d) => {
      setDetail(d);
      if (existing) {
        // pre-tick the options already on the market
        setTeamIds(d.teams.filter((tm) => existing.options.some((o) => o.team === tm.name)).map((tm) => tm.id));
        setPlayerIds(d.players.filter((p) => existing.options.some((o) => o.player === p.username)).map((p) => p.id));
      }
    }).catch(refuse);
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // the match narrows the stage; a title is suggested once, never overwritten
  const match = detail?.matches.find((m) => String(m.id) === matchId);
  useEffect(() => {
    if (match?.stage_id && !stageId) setStageId(String(match.stage_id));
    if (!editing && tpl && match && !title) setTitle(t("form.suggestedTitle", { n: match.number, kind: tpl.name }));
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionsPayload = useMemo<MarketInput["options"] | undefined>(() => {
    if (!tpl) return undefined;
    if (tpl.option_source === "teams_in_match") return teamIds.map((id) => ({ team_id: id }));
    if (tpl.option_source === "players_in_match") return playerIds.map((id) => ({ player_id: id }));
    if (tpl.option_source === "custom") return custom.map((label) => ({ label: label.trim() })).filter((o) => o.label);
    return undefined;
  }, [tpl, teamIds, playerIds, custom]);

  const optionCount = tpl?.option_source === "over_under" ? (line ? 2 : 0) : (optionsPayload?.length ?? 0);
  const lockIso = localInputToIso(lockAt);
  const ready = !!tpl && !!eventId && (!tpl.needs_match || !!matchId) && title.trim().length > 0 && !!lockIso
    && (editing ? true : optionCount >= 2) && (tpl.option_source !== "over_under" || Number(line) > 0);

  const submit = async (publish: boolean) => {
    if (!ready || !tpl) return;
    setBusy(true);
    const body: MarketInput = {
      title: title.trim(), description, rules_text: rules,
      lock_at: lockIso!, open_at: localInputToIso(openAt),
      visibility, featured,
      rake_bps: percentInputToBps(rake), cancel_fee_bps: percentInputToBps(cancelFee),
      min_stake_kobo: nairaInputToKobo(minStake), max_stake_per_user_kobo: nairaInputToKobo(maxPerUser), max_pool_kobo: nairaInputToKobo(maxPool),
    };
    if (tpl.option_source === "over_under") body.over_under_line = Number(line) || null;
    if (!editing) {
      Object.assign(body, { template, event_id: Number(eventId), stage_id: stageId ? Number(stageId) : null, match_id: matchId ? Number(matchId) : null, options: optionsPayload, publish });
    } else if (!optionsLocked && tpl.option_source !== "over_under") {
      body.options = optionsPayload;
    }
    try {
      const out = editing ? await saveMarket(existing!.slug, body) : await createMarket(body);
      toast.success(out.message);
      onSaved(out.market);
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: number[], id: number, set: (v: number[]) => void) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  if (templates === null) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t("form.whatTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label>{t("form.template")}</Label>
            <Select value={template} onValueChange={setTemplate} disabled={editing}>
              <SelectTrigger aria-label={t("form.template")}><SelectValue placeholder={t("form.pickTemplate")} /></SelectTrigger>
              <SelectContent>{templates.map((x) => <SelectItem key={x.code} value={x.code}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            {tpl && <p className="text-muted-foreground text-[11px]">{tpl.description || `${t(`sources.${tpl.option_source}`)} · ${t(`rules.${tpl.settle_rule}`)}`}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("form.event")}</Label>
            {editing ? (
              <Input value={existing!.event.name} disabled />
            ) : (
              <>
                <Input value={eventQuery} onChange={(e) => setEventQuery(e.target.value)} placeholder={t("form.searchEvents")} aria-label={t("form.searchEvents")} />
                <Select value={eventId} onValueChange={(v) => { setEventId(v); setMatchId(""); setStageId(""); setTeamIds([]); setPlayerIds([]); }}>
                  <SelectTrigger aria-label={t("form.event")}><SelectValue placeholder={t("form.pickEvent")} /></SelectTrigger>
                  <SelectContent>{events.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name} · {e.status}</SelectItem>)}</SelectContent>
                </Select>
              </>
            )}
          </div>
          {detail && (
            <>
              <div className="flex flex-col gap-1">
                <Label>{t("form.stage")}</Label>
                <Select value={stageId} onValueChange={setStageId} disabled={editing}>
                  <SelectTrigger aria-label={t("form.stage")}><SelectValue placeholder={t("form.noStage")} /></SelectTrigger>
                  <SelectContent>{detail.stages.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>{t("form.match")}{tpl?.needs_match ? "" : ` (${t("common.optional")})`}</Label>
                <Select value={matchId} onValueChange={setMatchId} disabled={editing}>
                  <SelectTrigger aria-label={t("form.match")}><SelectValue placeholder={t("form.pickMatch")} /></SelectTrigger>
                  <SelectContent>
                    {detail.matches.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {t("form.matchN", { n: m.number })}{m.group ? ` · ${m.group}` : ""}{m.map ? ` · ${m.map}` : ""}{m.result_in ? ` · ${t("form.resultIn")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.matches.length === 0 && <p className="text-destructive text-[11px]">{t("form.noMatches")}</p>}
              </div>
            </>
          )}
        </div>
      </Panel>

      <Panel title={t("form.copyTitle")}>
        <div className="flex flex-col gap-1">
          <Label>{t("form.title")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("form.description")}</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("form.descriptionHint")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("form.rules")}</Label>
          <Textarea rows={3} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={t("form.rulesHint")} />
        </div>
      </Panel>

      <Panel title={t("form.optionsTitle")}>
        {optionsLocked && <p className="text-muted-foreground text-xs">{t("form.optionsLocked")}</p>}
        {!tpl ? (
          <p className="text-muted-foreground text-xs">{t("form.pickTemplateFirst")}</p>
        ) : tpl.option_source === "over_under" ? (
          <div className="flex flex-col gap-1 sm:max-w-xs">
            <Label>{t("form.line")}</Label>
            <Input inputMode="numeric" value={line} onChange={(e) => setLine(e.target.value.replace(/\D/g, ""))} disabled={optionsLocked} />
            <p className="text-muted-foreground text-[11px]">{t("form.lineHint")}</p>
          </div>
        ) : tpl.option_source === "custom" ? (
          <div className="flex flex-col gap-2">
            {custom.map((label, i) => (
              <div key={i} className="flex gap-2">
                <Input value={label} onChange={(e) => setCustom((c) => c.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t("form.optionLabel", { n: i + 1 })} disabled={optionsLocked} maxLength={80} />
                {!optionsLocked && custom.length > 2 && (
                  <Button type="button" size="icon" variant="secondary" aria-label={t("common.remove")} onClick={() => setCustom((c) => c.filter((_, j) => j !== i))}><IconX className="size-4" /></Button>
                )}
              </div>
            ))}
            {!optionsLocked && <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => setCustom((c) => [...c, ""])}><IconPlus />{t("form.addOption")}</Button>}
          </div>
        ) : !detail ? (
          <p className="text-muted-foreground text-xs">{t("form.pickEventFirst")}</p>
        ) : tpl.option_source === "teams_in_match" ? (
          <ChoiceList
            items={detail.teams.map((tm) => ({ id: tm.id, label: tm.name }))}
            selected={teamIds} onToggle={(id) => toggle(teamIds, id, setTeamIds)}
            onAll={() => setTeamIds(detail.teams.map((tm) => tm.id))} onNone={() => setTeamIds([])}
            disabled={optionsLocked} empty={t("form.noTeams")} />
        ) : (
          <ChoiceList
            items={detail.players.map((p) => ({ id: p.id, label: p.username, hint: p.team }))}
            selected={playerIds} onToggle={(id) => toggle(playerIds, id, setPlayerIds)}
            onAll={() => setPlayerIds(detail.players.map((p) => p.id))} onNone={() => setPlayerIds([])}
            disabled={optionsLocked} empty={t("form.noPlayers")} />
        )}
        {tpl && tpl.option_source !== "over_under" && !optionsLocked && (
          <p className="text-muted-foreground text-[11px]">{t("form.optionCount", { n: optionCount })}</p>
        )}
      </Panel>

      <Panel title={t("form.whenTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label>{t("form.lockAt")}</Label>
            <Input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} />
            <p className="text-muted-foreground text-[11px]">{t("form.lockAtHint")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("form.openAt")} ({t("common.optional")})</Label>
            <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
            <p className="text-muted-foreground text-[11px]">{t("form.openAtHint")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("form.visibility")}</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "public" | "signed_in")}>
              <SelectTrigger aria-label={t("form.visibility")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t("form.visibilityPublic")}</SelectItem>
                <SelectItem value="signed_in">{t("form.visibilitySignedIn")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-3 self-end text-sm"><Switch checked={featured} onCheckedChange={setFeatured} />{t("form.featured")}</label>
        </div>
      </Panel>

      <Panel title={t("form.moneyTitle")}>
        <p className="text-muted-foreground text-xs">{t("form.moneyHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MoneyField label={t("settings.rake")} value={rake} onChange={setRake} decimal />
          <MoneyField label={t("settings.cancelFee")} value={cancelFee} onChange={setCancelFee} decimal />
          <MoneyField label={t("settings.minStake")} value={minStake} onChange={setMinStake} />
          <MoneyField label={t("settings.maxStakePerUser")} value={maxPerUser} onChange={setMaxPerUser} />
          <MoneyField label={t("settings.maxPool")} value={maxPool} onChange={setMaxPool} />
        </div>
      </Panel>

      <div className="flex flex-wrap justify-end gap-2">
        {editing ? (
          <Button onClick={() => void submit(false)} disabled={!ready || busy}>{t("common.save")}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => void submit(false)} disabled={!ready || busy}>{t("form.saveDraft")}</Button>
            <Button onClick={() => void submit(true)} disabled={!ready || busy}>{t("form.publish")}</Button>
          </>
        )}
      </div>
    </div>
  );
}

function ChoiceList({ items, selected, onToggle, onAll, onNone, disabled, empty }: {
  items: { id: number; label: string; hint?: string }[]; selected: number[]; onToggle: (id: number) => void;
  onAll: () => void; onNone: () => void; disabled: boolean; empty: string;
}) {
  const t = useTranslations("wagersAdmin");
  if (items.length === 0) return <p className="text-muted-foreground text-xs">{empty}</p>;
  return (
    <div className="flex flex-col gap-2">
      {!disabled && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onAll}>{t("form.selectAll")}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={onNone}>{t("form.selectNone")}</Button>
        </div>
      )}
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <label key={it.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${selected.includes(it.id) ? "bg-muted" : ""}`}>
            <Checkbox checked={selected.includes(it.id)} onCheckedChange={() => onToggle(it.id)} disabled={disabled} />
            <span className="truncate">{it.label}</span>
            {it.hint && <span className="text-muted-foreground truncate text-xs">{it.hint}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

function MoneyField({ label, value, onChange, decimal }: { label: string; value: string; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""))} />
    </div>
  );
}
