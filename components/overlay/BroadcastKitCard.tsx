"use client";

// ── BroadcastKitCard (owner 2026-07-03; client folder pieces 2026-11-18, AFC inbox #618) ───────────
// One-click download of the Free Fire PC client-side broadcast files, already customized to this
// event. Shows a readiness table (slot, letter, logo, flag, what shows under each player's name,
// per-player UID/image coverage) so the operator knows what will end up in the zip, plus the optional
// pieces of the client folder, each in a section that opens: the name tag choice, team flags from an
// empty banner, team billboards with room slots, the sky title, panel backgrounds, map skins, caster.
// DATA: GET  events/<id>/broadcast-kit/ (summary, `one_room`, and `names`: the game's own file names
// from afc_tournament_and_scrims/client_files.py) and POST .../download/ (the zip) -
// afc_tournament_and_scrims/views_broadcast_kit.py, gated by _broadcast_gate (admin OR organizer
// with can_edit_events). Team letters are assigned on the Registered Teams tab (assigned_letter).
// Mounted by EventOverlayStudio (admin + organizer overlay studio).
//
// STAGE + LOBBY PICKERS (AFC inbox #602, owner 2026-11-16): letters are now distinct per LOBBY, so
// two lobbies of one stage may share a letter, and each team's flag file is NAMED after its letter.
// A stage-wide zip could then hold two logos under one name. Picking a stage sends stage_id (the zip
// uses that stage's letters); picking a lobby sends group_id too (only that lobby's teams), which is
// the zip an observer loads for one room. The summary's `stages` list feeds both pickers.
//
// PREVIEWS (#618, mockup approved 18 Nov 2026, mockups/client-kit in the WEBSITE folder): the flag,
// billboard and sky previews are the organizer's own picked files layered with CSS in the same
// proportions the server draws them (afc_tournament_and_scrims/kit_art.py), so what they see is what
// the zip holds. Which picked panel and skin files the game reads is lib/broadcastKit.ts.

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
import { formatNumber } from "@/lib/i18n/number";
import { KIT_UPLOAD_LIMIT_BYTES, kitUploadBytes, matchKitFiles } from "@/lib/broadcastKit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UidInput } from "@/components/UidInput";
import { Label } from "@/components/ui/label";
import {
  IconBroadcast,
  IconChevronRight,
  IconDownload,
  IconLoader2,
  IconUpload,
} from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewBadge } from "@/components/NewBadge";
import { cn } from "@/lib/utils";

/** The day the client folder pieces went live (the NEW tags expire 5 days later by themselves). */
const KIT_PIECES_SINCE = "2026-11-18";

// The tick and cross the table has always shown (built from their code points: the repo's dash
// guard reads their lead byte as a dash).
const CHECK = String.fromCharCode(0x2713);
const CROSS = String.fromCharCode(0x2717);

type KitStage = { stage_id: number; stage_name: string; groups: { group_id: number; group_name: string }[] };

type KitNames = {
  hud_panels: string[];
  hud_misspelt: Record<string, string>;
  map_skins: string[];
  flag_letters: string[];
  name_file_max_rows: number;
};

type TeamRow = {
  tournament_team_id: number;
  team_name: string;
  slot: number | null;
  assigned_letter: string | null;
  headpic_id: string | null;
  flag_letter: boolean;
  has_logo: boolean;
  logo_url: string | null;
  nation_team: string;
  country: string;
  game_country: string | null;
  players: number;
  players_with_uid: number;
  players_with_image: number;
  players_with_role: number;
};

type NationMode = "team" | "country" | "role";
type Place = "left" | "centre" | "right";
type SkyShape = "title" | "logo";
type Picked = { file: File; url: string } | null;

const EMPTY_NAMES: KitNames = { hud_panels: [], hud_misspelt: {}, map_skins: [], flag_letters: [], name_file_max_rows: 101 };

// ── small pieces ──────────────────────────────────────────────────────────────────────────────
/** One section of the card: a filled row that opens (the card-in-card step, no stroke). */
function KitSection({ title, state, isNew, open, onToggle, children }: {
  title: string; state: string; isNew?: boolean; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className="rounded-md bg-muted/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <IconChevronRight className={cn("text-muted-foreground size-3.5 shrink-0", open && "rotate-90")} />
        <span className="text-xs font-semibold">{title}</span>
        {isNew ? <NewBadge since={KIT_PIECES_SINCE} /> : null}
        <span className="text-muted-foreground ml-auto text-right text-[0.7rem]">{state}</span>
      </button>
      {open ? <div className="px-2.5 pb-2.5">{children}</div> : null}
    </div>
  );
}

/** A filled segmented choice (pill segment, the AFC tab look). */
function Segment<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs",
            o.value === value ? "bg-background text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A filled file button with the picked file's name and a remove link. */
function FilePick({ label, accept, multiple, onPick, fileName, emptyText, onClear, clearLabel }: {
  label: string; accept: string; multiple?: boolean; onPick: (files: File[]) => void;
  fileName?: string; emptyText?: string; onClear?: () => void; clearLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="bg-muted dark:bg-input/50 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium focus-within:ring-[3px] focus-within:ring-ring/50">
        <IconUpload className="size-3.5" />
        {label}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onPick(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {fileName !== undefined || emptyText ? (
        <span className="text-muted-foreground min-w-0 truncate text-[0.7rem]">{fileName || emptyText}</span>
      ) : null}
      {onClear ? (
        <button type="button" onClick={onClear} className="text-muted-foreground ml-auto min-h-8 px-2 text-[0.7rem] underline underline-offset-2">
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

export function BroadcastKitCard({ eventId }: { eventId: number }) {
  const t = useTranslations("organizer");
  // The stage + lobby picker copy lives with the rest of the letters copy (evEditTabs, inbox #602).
  const lt = useTranslations("evEditTabs");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [casterName, setCasterName] = useState("");
  const [casterUid, setCasterUid] = useState("");
  const [stages, setStages] = useState<KitStage[]>([]);
  const [stageId, setStageId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [oneRoom, setOneRoom] = useState(false);
  const [names, setNames] = useState<KitNames>(EMPTY_NAMES);
  // ── the client folder pieces (#618) ──
  const [nationMode, setNationMode] = useState<NationMode>("team");
  const [banner, setBanner] = useState<Picked>(null);
  const [flagSize, setFlagSize] = useState(62);
  const [flagHeight, setFlagHeight] = useState(34);
  const [art, setArt] = useState<Picked>(null);
  const [place, setPlace] = useState<Place>("right");
  const [sky, setSky] = useState<Picked>(null);
  const [skyShape, setSkyShape] = useState<SkyShape>("title");
  const [hudFiles, setHudFiles] = useState<File[]>([]);
  const [skinFiles, setSkinFiles] = useState<File[]>([]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(["zip"]));

  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/broadcast-kit`;
  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/`, {
        headers: authHeaders(),
        params: { stage_id: stageId ?? undefined, group_id: groupId ?? undefined },
      });
      setTeams(res.data?.teams ?? []);
      setStages(res.data?.stages ?? []);
      setOneRoom(Boolean(res.data?.one_room));
      setNames(res.data?.names ?? EMPTY_NAMES);
    } catch {
      /* best-effort: the card just shows no rows if the summary can't load */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stageId, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // A picked picture is shown from a local object URL; free it when it is replaced or the card goes.
  const pickOne = (setter: (fn: (prev: Picked) => Picked) => void) => (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setter((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file: f, url: URL.createObjectURL(f) };
    });
  };
  const clearOne = (setter: (fn: (prev: Picked) => Picked) => void) => () =>
    setter((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  useEffect(() => () => {
    [banner, art, sky].forEach((p) => p && URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hudMatch = useMemo(
    () => matchKitFiles(hudFiles.map((f) => f.name), names.hud_panels, names.hud_misspelt),
    [hudFiles, names],
  );
  const skinMatch = useMemo(() => matchKitFiles(skinFiles.map((f) => f.name), names.map_skins), [skinFiles, names]);
  const usedHud = hudFiles.filter((f) => hudMatch.used.some((u) => u.file === f.name));
  const usedSkins = skinFiles.filter((f) => skinMatch.used.some((u) => u.file === f.name));

  const download = async () => {
    const sending = [banner?.file, art?.file, sky?.file, ...usedHud, ...usedSkins];
    const bytes = kitUploadBytes(sending);
    if (bytes > KIT_UPLOAD_LIMIT_BYTES) {
      toast.error(t("broadcastKit.tooBig", { size: formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 }) }));
      return;
    }
    setDownloading(true);
    try {
      const fd = new FormData();
      if (casterName.trim()) fd.append("caster_name", casterName.trim());
      if (casterUid.trim()) fd.append("caster_uid", casterUid.trim());
      if (stageId != null) fd.append("stage_id", String(stageId));
      if (stageId != null && groupId != null) fd.append("group_id", String(groupId));
      fd.append("nation_mode", nationMode);
      if (banner) {
        fd.append("flag_banner", banner.file);
        fd.append("flag_logo_size", String(flagSize));
        fd.append("flag_logo_height", String(flagHeight));
      }
      if (art) fd.append("team_billboard", art.file);
      fd.append("billboard_place", place);
      if (sky) {
        fd.append("skybox", sky.file);
        fd.append("sky_shape", skyShape);
      }
      usedHud.forEach((f) => fd.append("hud_pics", f));
      usedSkins.forEach((f) => fd.append("map_skins", f));
      const res = await axios.post(`${base}/download/`, fd, {
        headers: authHeaders(),
        responseType: "blob",
      });
      // Trigger a browser download of the returned zip.
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `broadcast-kit-${eventId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("broadcastKit.downloaded"));
    } catch (err) {
      // A refusal comes back as a Blob (responseType above): read its {code, file} to say which file.
      let code = "";
      let file = "";
      try {
        const data = axios.isAxiosError(err) ? err.response?.data : null;
        if (data instanceof Blob) {
          const body = JSON.parse(await data.text());
          code = String(body?.code ?? "");
          file = String(body?.file ?? "");
        }
      } catch {
        /* not JSON: fall through to the general message */
      }
      if (["not_an_image", "image_too_large", "too_many_files"].includes(code)) {
        toast.error(t(`broadcastKit.errors.${code}`, { file }));
      } else {
        toast.error(t("broadcastKit.downloadFailed"));
      }
    } finally {
      setDownloading(false);
    }
  };

  // ── what the readiness table and the warnings say ──
  const flagTeams = teams.filter((x) => x.assigned_letter);
  const missingLetter = teams.filter((x) => !x.assigned_letter).length;
  const missingLogo = teams.filter((x) => x.assigned_letter && !x.has_logo).length;
  const noFlagLetter = flagTeams.filter((x) => !x.flag_letter).length;
  const nameRows = teams.reduce((n, x) => n + x.players_with_uid, 0);
  const flagCount = flagTeams.filter((x) => x.flag_letter && x.has_logo).length;
  const placeOptions: { value: Place; label: string }[] = [
    { value: "left", label: t("broadcastKit.billboards.left") },
    { value: "centre", label: t("broadcastKit.billboards.centre") },
    { value: "right", label: t("broadcastKit.billboards.right") },
  ];

  const underName = (x: TeamRow) => {
    if (nationMode === "country") {
      return x.game_country ? (
        <>{x.game_country} <span className="text-muted-foreground text-[0.65rem]">{t("broadcastKit.nation.icon")}</span></>
      ) : (
        <>{x.nation_team} <span className="text-amber-500 text-[0.65rem]">{t("broadcastKit.nation.noIcon")}</span></>
      );
    }
    if (nationMode === "role") {
      return t("broadcastKit.nation.roleCell", { withRole: x.players_with_role, players: x.players });
    }
    return x.nation_team;
  };

  const zipRows: { name: string; value: string; on: boolean }[] = [
    { name: "PlayerNameOverwrite.json", value: t("broadcastKit.zip.players", { count: Math.min(nameRows, names.name_file_max_rows) }), on: true },
    { name: "HeadPics, GloowallPics, BackPackPics", value: t("broadcastKit.zip.logos", { count: teams.filter((x) => x.assigned_letter && x.has_logo).length }), on: true },
    { name: "RolePicture, RolePictureHUD", value: t("broadcastKit.zip.photos", { count: teams.reduce((n, x) => n + x.players_with_image, 0) }), on: true },
    { name: "FlagLogos", value: banner ? t("broadcastKit.zip.flags", { count: flagCount }) : t("broadcastKit.zip.noBanner"), on: !!banner && flagCount > 0 },
    { name: "TeamBillboard", value: oneRoom ? t("broadcastKit.zip.billboards", { count: teams.length }) : t("broadcastKit.zip.oneLobbyOnly"), on: oneRoom && teams.length > 0 },
    { name: "Room seating.txt", value: oneRoom ? t("broadcastKit.zip.seating") : t("broadcastKit.zip.oneLobbyOnly"), on: oneRoom && teams.length > 0 },
    { name: "EnvWeather", value: sky ? (skyShape === "title" ? "VFX_VFX_PC_SKYBOX_FFWS" : "VFX_VFX_PC_SKYBOX_EWC26") : t("broadcastKit.zip.none"), on: !!sky },
    { name: "HUD_PIC", value: hudMatch.used.length ? t("broadcastKit.zip.panels", { count: hudMatch.used.length }) : t("broadcastKit.zip.none"), on: hudMatch.used.length > 0 },
    { name: "PCTexture", value: skinMatch.used.length ? t("broadcastKit.zip.skins", { count: skinMatch.used.length }) : t("broadcastKit.zip.none"), on: skinMatch.used.length > 0 },
    { name: "HOW_TO_USE.txt", value: t("broadcastKit.zip.howTo"), on: true },
  ];

  const namedChips = (match: ReturnType<typeof matchKitFiles>, missingKey: "panels.noPanel" | "skins.noSkin") => (
    <div className="mt-2 flex max-h-36 flex-wrap gap-1 overflow-y-auto">
      {match.unknown.map((u) => (
        <span key={"x" + u.file} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.65rem] text-amber-500">
          {u.hint
            ? t("broadcastKit.panels.gameReads", { file: u.file, name: u.hint })
            : t(`broadcastKit.${missingKey}`, { file: u.file })}
        </span>
      ))}
      {match.used.map((u) => (
        <span key={u.name} className="bg-primary/10 rounded-full px-2 py-0.5 text-[0.65rem]">
          {u.name}
        </span>
      ))}
    </div>
  );

  return (
    // min-w-0: the card sits in a grid cell, and a grid cell will not shrink below its widest child (the flag and
    // billboard strips) unless told to, so on a phone the strips would push the whole page sideways.
    <div className="min-w-0 rounded-md bg-card p-3">
      <div className="mb-1 flex items-center gap-2">
        <IconBroadcast className="text-primary size-4" />
        <h3 className="text-primary text-sm font-semibold">{t("broadcastKit.title")}</h3>
        <span className="text-muted-foreground ml-auto text-xs">
          {t("broadcastKit.summary", { teams: teams.length })}
        </span>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">{t("broadcastKit.description")}</p>

      {/* Which stage and lobby the zip is for (inbox #602). */}
      {stages.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={stageId == null ? "__all__" : String(stageId)}
              onValueChange={(v) => {
                setStageId(v === "__all__" ? null : Number(v));
                setGroupId(null);
              }}
            >
              <SelectTrigger className="h-8 w-40 text-xs" aria-label={lt("registeredTeams.kitStageLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{lt("registeredTeams.kitStageAll")}</SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                    {s.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(stages.find((s) => s.stage_id === stageId)?.groups.length ?? 0) > 0 && (
              <Select
                value={groupId == null ? "__all__" : String(groupId)}
                onValueChange={(v) => setGroupId(v === "__all__" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 w-40 text-xs" aria-label={lt("registeredTeams.kitGroupLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{lt("registeredTeams.kitGroupAll")}</SelectItem>
                  {stages
                    .find((s) => s.stage_id === stageId)!
                    .groups.map((g) => (
                      <SelectItem key={g.group_id} value={String(g.group_id)}>
                        {g.group_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="text-muted-foreground text-[0.7rem]">{lt("registeredTeams.kitGroupHint")}</p>
        </div>
      )}

      {/* Warnings the operator should fix (letters are set on the Registered Teams tab). */}
      {(missingLetter > 0 || missingLogo > 0 || noFlagLetter > 0 || (!oneRoom && teams.length > 0) || nameRows > names.name_file_max_rows) && (
        <div className="mb-3 space-y-0.5 rounded-md bg-amber-500/10 p-2 text-[0.7rem] text-amber-600">
          {missingLetter > 0 ? <p>{t("broadcastKit.warnLetters", { count: missingLetter })}</p> : null}
          {missingLogo > 0 ? <p>{t("broadcastKit.warnLogos", { count: missingLogo })}</p> : null}
          {!oneRoom && teams.length > 0 ? <p>{t("broadcastKit.warnOneLobby")}</p> : null}
          {noFlagLetter > 0 ? <p>{t("broadcastKit.warnNoFlag", { count: noFlagLetter })}</p> : null}
          {nameRows > names.name_file_max_rows ? (
            <p>{t("broadcastKit.warnRows", { count: nameRows, max: names.name_file_max_rows })}</p>
          ) : null}
        </div>
      )}

      {/* Readiness table. */}
      <div className="mb-3 max-h-56 overflow-x-auto overflow-y-auto rounded-md bg-muted/30">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-1.5">{t("broadcastKit.colSlot")}</th>
              <th className="p-1.5">{t("broadcastKit.colTeam")}</th>
              <th className="p-1.5">{t("broadcastKit.colLetter")}</th>
              <th className="p-1.5">{t("broadcastKit.colLogo")}</th>
              <th className="p-1.5">{t("broadcastKit.colFlag")}</th>
              <th className="p-1.5">{t("broadcastKit.colUnderName")}</th>
              <th className="p-1.5">{t("broadcastKit.colPlayers")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground p-3 text-center">
                  <IconLoader2 className="inline size-4 animate-spin" />
                </td>
              </tr>
            ) : teams.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground p-3 text-center italic">
                  {t("broadcastKit.noTeams")}
                </td>
              </tr>
            ) : (
              teams.map((x) => (
                <tr key={x.tournament_team_id} className="even:bg-muted/30">
                  <td className="p-1.5 font-semibold">{x.slot ?? <span className="text-muted-foreground">-</span>}</td>
                  <td className="p-1.5 font-medium">{x.team_name}</td>
                  <td className="p-1.5">
                    {x.assigned_letter ? (
                      <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[0.6rem]">
                        {x.assigned_letter} · {x.headpic_id}
                      </Badge>
                    ) : (
                      <span className="text-amber-500">{t("broadcastKit.none")}</span>
                    )}
                  </td>
                  <td className="p-1.5">{x.has_logo ? CHECK : <span className="text-amber-500">{CROSS}</span>}</td>
                  <td className="p-1.5">
                    {!x.assigned_letter ? (
                      <span className="text-muted-foreground">-</span>
                    ) : !x.flag_letter ? (
                      <span className="text-amber-500">{t("broadcastKit.flagNoneYZ")}</span>
                    ) : banner ? (
                      <span className="text-primary">{CHECK}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("broadcastKit.flagNoBanner")}</span>
                    )}
                  </td>
                  <td className="p-1.5">{underName(x)}</td>
                  <td className="p-1.5 text-muted-foreground">
                    {t("broadcastKit.playersCell", { withUid: x.players_with_uid, players: x.players, withImage: x.players_with_image })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        {/* 1. What shows under each player's name (PlayerNation). */}
        <KitSection
          title={t("broadcastKit.nation.title")}
          state={t(`broadcastKit.nation.${nationMode}`)}
          isNew
          open={open.has("nation")}
          onToggle={() => toggle("nation")}
        >
          <Segment<NationMode>
            value={nationMode}
            onChange={setNationMode}
            label={t("broadcastKit.nation.title")}
            options={[
              { value: "team", label: t("broadcastKit.nation.team") },
              { value: "country", label: t("broadcastKit.nation.country") },
              { value: "role", label: t("broadcastKit.nation.role") },
            ]}
          />
          <p className="text-muted-foreground mt-2 text-[0.7rem]">{t(`broadcastKit.nation.hint_${nationMode}`)}</p>
        </KitSection>

        {/* 2. Team flags in the map (FlagLogos), from the organizer's empty banner. */}
        <KitSection
          title={t("broadcastKit.flags.title")}
          state={banner ? t("broadcastKit.flags.count", { count: flagCount }) : t("broadcastKit.flags.noBanner")}
          isNew
          open={open.has("flags")}
          onToggle={() => toggle("flags")}
        >
          <FilePick
            label={t("broadcastKit.flags.choose")}
            accept="image/png,image/jpeg,image/webp"
            onPick={pickOne(setBanner)}
            fileName={banner?.file.name}
            emptyText={t("broadcastKit.flags.noBannerYet")}
            onClear={banner ? clearOne(setBanner) : undefined}
            clearLabel={t("broadcastKit.remove")}
          />
          <label className="text-muted-foreground mt-1 grid min-h-8 grid-cols-[auto_1fr_auto] items-center gap-2 text-[0.7rem]">
            {t("broadcastKit.flags.size")}
            <input type="range" min={30} max={95} value={flagSize} onChange={(e) => setFlagSize(Number(e.target.value))} className="accent-primary w-full" />
            <span>{formatNumber(flagSize)}%</span>
          </label>
          <label className="text-muted-foreground mt-1 grid min-h-8 grid-cols-[auto_1fr_auto] items-center gap-2 text-[0.7rem]">
            {t("broadcastKit.flags.height")}
            <input type="range" min={10} max={90} value={flagHeight} onChange={(e) => setFlagHeight(Number(e.target.value))} className="accent-primary w-full" />
            <span>{formatNumber(flagHeight)}%</span>
          </label>
          <div className="flex gap-2 overflow-x-auto pt-2 pb-1">
            {!banner ? (
              <p className="text-muted-foreground py-1.5 text-[0.7rem]">{t("broadcastKit.flags.empty")}</p>
            ) : (
              flagTeams.map((x) => (
                <div key={x.tournament_team_id} className="w-16 shrink-0 text-center">
                  {x.flag_letter ? (
                    <div className="bg-muted relative h-40 w-16 overflow-hidden rounded-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={banner.url} alt="" className="absolute inset-0 size-full" />
                      {x.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={x.logo_url}
                          alt=""
                          className="absolute left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 object-contain"
                          style={{ width: `${flagSize}%`, top: `${flagHeight}%` }}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="bg-muted grid h-40 w-16 place-items-center rounded-sm p-1.5 text-[0.65rem] leading-tight text-amber-500">
                      {t("broadcastKit.flags.noFlagFor", { letter: x.assigned_letter ?? "" })}
                    </div>
                  )}
                  <div className="text-muted-foreground mt-1 text-[0.65rem]">
                    {x.assigned_letter} · {x.headpic_id?.slice(-2)}
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-[0.7rem]">{t("broadcastKit.flags.hint")}</p>
        </KitSection>

        {/* 3. Team billboards (TeamBillboard/<slot>.png) and the room seating sheet: one room only. */}
        <KitSection
          title={t("broadcastKit.billboards.title")}
          state={oneRoom ? t("broadcastKit.billboards.count", { count: teams.length }) : t("broadcastKit.billboards.pickLobby")}
          isNew
          open={open.has("billboards")}
          onToggle={() => toggle("billboards")}
        >
          <FilePick
            label={t("broadcastKit.billboards.choose")}
            accept="image/png,image/jpeg,image/webp"
            onPick={pickOne(setArt)}
            fileName={art?.file.name}
            emptyText={t("broadcastKit.billboards.noArt")}
            onClear={art ? clearOne(setArt) : undefined}
            clearLabel={t("broadcastKit.remove")}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-[0.7rem]">{t("broadcastKit.billboards.place")}</span>
            <Segment<Place> value={place} onChange={setPlace} label={t("broadcastKit.billboards.place")} options={placeOptions} />
          </div>
          {!oneRoom ? (
            <p className="text-muted-foreground mt-2 text-[0.7rem]">{t("broadcastKit.billboards.needLobby")}</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pt-2 pb-1">
                {teams.map((x) => (
                  <div key={x.tournament_team_id} className="w-52 shrink-0">
                    <div
                      className="relative aspect-video w-52 overflow-hidden rounded bg-[#16141b]"
                      style={{ containerType: "inline-size" }}
                    >
                      {art ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={art.url} alt="" className="absolute inset-0 size-full object-cover" />
                      ) : null}
                      <div
                        className={cn(
                          "absolute inset-y-0 flex items-center",
                          place === "centre" ? "left-1/2 w-[70%] -translate-x-1/2 flex-col justify-center text-center" : "w-[58%]",
                          place === "left" && "left-[4%]",
                          place === "right" && "right-[4%]",
                        )}
                        style={{ gap: place === "centre" ? "2.5cqw" : "4cqw" }}
                      >
                        {x.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={x.logo_url} alt="" className="aspect-square shrink-0 object-contain" style={{ width: "22cqw" }} />
                        ) : null}
                        <span
                          className="font-extrabold uppercase leading-none text-white [overflow-wrap:anywhere]"
                          style={{ fontSize: "6.2cqw", textShadow: "0 0.4cqw 1.2cqw rgb(0 0 0 / 0.6)" }}
                        >
                          {x.team_name}
                        </span>
                      </div>
                      <span className="absolute top-1 left-1 rounded-sm bg-black/55 px-1.5 text-[0.6rem] font-bold text-white">
                        {x.slot}.png
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 truncate text-[0.65rem]">
                      {t("broadcastKit.billboards.caption", { slot: x.slot ?? 0, team: x.team_name })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-1 text-[0.7rem]">{t("broadcastKit.billboards.hint")}</p>
              {/* What Room seating.txt in the zip says. */}
              <div className="bg-background mt-2 overflow-x-auto rounded-md p-2">
                <p className="text-muted-foreground mb-1 text-[0.65rem] font-semibold">Room seating.txt</p>
                <table className="w-full whitespace-nowrap font-mono text-[0.65rem]">
                  <thead className="text-muted-foreground text-left">
                    <tr>
                      <th className="pr-3 font-normal">{t("broadcastKit.colSlot")}</th>
                      <th className="pr-3 font-normal">{t("broadcastKit.colTeam")}</th>
                      <th className="pr-3 font-normal">{t("broadcastKit.colLetter")}</th>
                      <th className="font-normal">{t("broadcastKit.colFlag")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((x) => (
                      <tr key={x.tournament_team_id}>
                        <td className="pr-3">{x.slot}</td>
                        <td className="pr-3">{x.team_name}</td>
                        <td className="pr-3">{x.assigned_letter ?? "-"}</td>
                        <td>{x.flag_letter && x.headpic_id ? `${x.headpic_id}.png` : t("broadcastKit.none")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </KitSection>

        {/* 4. The title in the sky (EnvWeather/SkyboxPicture.png + the effect's switch folder). */}
        <KitSection
          title={t("broadcastKit.sky.title")}
          state={sky ? t(`broadcastKit.sky.state_${skyShape}`) : t("broadcastKit.zip.none")}
          isNew
          open={open.has("sky")}
          onToggle={() => toggle("sky")}
        >
          <FilePick
            label={t("broadcastKit.sky.choose")}
            accept="image/png,image/jpeg,image/webp"
            onPick={pickOne(setSky)}
            fileName={sky?.file.name}
            emptyText={t("broadcastKit.sky.noSky")}
            onClear={sky ? clearOne(setSky) : undefined}
            clearLabel={t("broadcastKit.remove")}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-[0.7rem]">{t("broadcastKit.sky.shape")}</span>
            <Segment<SkyShape>
              value={skyShape}
              onChange={setSkyShape}
              label={t("broadcastKit.sky.shape")}
              options={[
                { value: "title", label: t("broadcastKit.sky.shape_title") },
                { value: "logo", label: t("broadcastKit.sky.shape_logo") },
              ]}
            />
          </div>
          <div className="mt-2 rounded bg-[#0f1a2b] p-2">
            {sky ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sky.url}
                alt=""
                className="block w-full object-contain"
                style={{ aspectRatio: skyShape === "title" ? "2048 / 256" : "2048 / 512" }}
              />
            ) : (
              <p className="text-muted-foreground text-[0.7rem]">{t("broadcastKit.sky.empty")}</p>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-[0.7rem]">{t("broadcastKit.sky.hint")}</p>
        </KitSection>

        {/* 5. Panel backgrounds (HUD_PIC), by the game's own names. */}
        <KitSection
          title={t("broadcastKit.panels.title")}
          state={hudFiles.length
            ? t("broadcastKit.namedState", { used: hudMatch.used.length, total: names.hud_panels.length, left: hudMatch.unknown.length })
            : t("broadcastKit.zip.none")}
          isNew
          open={open.has("panels")}
          onToggle={() => toggle("panels")}
        >
          <FilePick
            label={t("broadcastKit.panels.choose")}
            accept="image/png"
            multiple
            onPick={(files) => setHudFiles(files)}
            onClear={hudFiles.length ? () => setHudFiles([]) : undefined}
            clearLabel={t("broadcastKit.clear")}
          />
          {hudFiles.length ? namedChips(hudMatch, "panels.noPanel") : null}
          <p className="text-muted-foreground mt-2 text-[0.7rem]">{t("broadcastKit.panels.hint")}</p>
        </KitSection>

        {/* 6. Map skins (PCTexture): billboards, plane, airdrops, vehicles. */}
        <KitSection
          title={t("broadcastKit.skins.title")}
          state={skinFiles.length
            ? t("broadcastKit.namedState", { used: skinMatch.used.length, total: names.map_skins.length, left: skinMatch.unknown.length })
            : t("broadcastKit.zip.none")}
          isNew
          open={open.has("skins")}
          onToggle={() => toggle("skins")}
        >
          <FilePick
            label={t("broadcastKit.skins.choose")}
            accept="image/png"
            multiple
            onPick={(files) => setSkinFiles(files)}
            onClear={skinFiles.length ? () => setSkinFiles([]) : undefined}
            clearLabel={t("broadcastKit.clear")}
          />
          {skinFiles.length ? namedChips(skinMatch, "skins.noSkin") : null}
          <p className="text-muted-foreground mt-2 text-[0.7rem]">{t("broadcastKit.skins.hint")}</p>
        </KitSection>

        {/* 7. Caster (unchanged fields). */}
        <KitSection
          title={t("broadcastKit.casterTitle")}
          state={casterName.trim() || t("broadcastKit.zip.none")}
          open={open.has("caster")}
          onToggle={() => toggle("caster")}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[0.65rem]">{t("broadcastKit.casterName")}</Label>
              <Input value={casterName} onChange={(e) => setCasterName(e.target.value)} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem]">{t("broadcastKit.casterUid")}</Label>
              <UidInput value={casterUid} onChange={(e) => setCasterUid(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
        </KitSection>

        {/* 8. What the zip holds, live from the choices above. */}
        <KitSection
          title={t("broadcastKit.zip.title")}
          state={t("broadcastKit.zip.parts", { count: zipRows.filter((r) => r.on).length })}
          isNew
          open={open.has("zip")}
          onToggle={() => toggle("zip")}
        >
          <div className="space-y-0.5 text-[0.7rem]">
            {zipRows.map((r) => (
              <div key={r.name} className="flex gap-2">
                <span className={cn("min-w-0 [overflow-wrap:anywhere]", r.on ? "font-medium" : "text-muted-foreground")}>{r.name}</span>
                <span className="text-muted-foreground ml-auto whitespace-nowrap">{r.value}</span>
              </div>
            ))}
          </div>
        </KitSection>
      </div>

      <Button size="sm" className="mt-3" onClick={download} disabled={downloading || teams.length === 0}>
        {downloading ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : <IconDownload className="mr-1 size-4" />}
        {t("broadcastKit.download")}
      </Button>
    </div>
  );
}
