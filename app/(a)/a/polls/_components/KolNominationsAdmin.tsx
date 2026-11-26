"use client";

/**
 * app/(a)/a/polls/_components/KolNominationsAdmin.tsx - the "Nominations" tab of /a/polls: the KOL creators'
 * nomination round, admin side (owner, 25 to 26 Nov 2026, AFC inbox #633 / #634). AFC poll admins, and Garena's KOL
 * admins (#641, role kol_admin), who see this tab and nothing else of /a/polls.
 *
 * WHAT AN ADMIN DOES HERE
 *   1. Pick the KOL edition (themed "detty-royale" editions only), set the open and close times, "Set up the round"
 *      (idempotent on the server: AFC-B afc_polls/kol_nominations.py ensure_round).
 *   2. "Make codes for everyone without one" downloads a CSV: name, @handle, country, code, personal link and a
 *      ready-to-send message in the creator's language. Nothing is shown on screen; since #640 a code can be copied
 *      again (point 6), from a sealed copy beside the hash. Layo and Garena send the lines themselves.
 *   3. Per creator: switch them off (their code stops at once, they leave every ballot and the tally) or give them a
 *      new code (a one-row CSV; the old code and its cookie stop working).
 *   4. Read who has voted (yes / no) and the picks per creator in each award. Who picked whom is never shown.
 *   5. WRITE-INS (owner, 26 Nov 2026, #637): people a creator added by TikTok handle are listed with an "Added by a
 *      creator" badge. They are candidates, never voters (no code, no "New code"). Junk is switched off like anybody;
 *      a duplicate of somebody already in the round is MERGED into them (pick "Same person as", press Merge twice):
 *      its picks move there and a ballot that held both keeps one, so nobody counts twice in one award. Who added a
 *      write-in is never shown, only how many people each creator added.
 *   6. COPY A CODE (#640, owner 26 Nov 2026: "Should be able to copy codes from the site"): "Copy code" and "Copy
 *      message" per creator read the code back from its sealed copy on the server (readCode) and put it on the
 *      clipboard. Nothing is shown on screen and nothing is kept in the page.
 *   7. SPARE CODES (#639: codes "not linked to anybody" for creators found later): make 1 to 50, copy each with its
 *      message in the chosen language, see who used it, revoke one. The first person to open one says who they are.
 *   8. Each award's explanation (#638) under its name in "Picks so far", the same text the creators read
 *      (awardsKol.nominate.awardHelp.<key>).
 *   9. GARENA'S LIVE LINK (#641, owner 26 Nov 2026: "Both"): the edition's private no-sign-in link
 *      (GarenaLiveLink.tsx), whose page /awards/live/<token> shows the picks so far in every award.
 *
 * Creators are loaded by `manage.py kol_import_creators` (from the private sheet), not from this page.
 * CALLS: lib/kolNominations.ts kolNominationsAdminApi (GET/POST polls/admin/kol-nominations/<edition>/, POST
 * .../codes/, PATCH .../creators/<id>/). Mounted by app/(a)/a/polls/page.tsx.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import axios from "axios";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isoToLocalInput } from "@/lib/i18n/time";
import { formatNumber } from "@/lib/i18n/number";
import {
  GARENA_ACCESS_SINCE,
  kolNominationsAdminApi,
  type NominationAdmin,
  type NominationAdminCreator,
} from "@/lib/kolNominations";
import { GarenaLiveLink } from "./GarenaLiveLink";

type CopyLanguage = "en" | "fr" | "pt";
import type { AwardsEdition } from "@/lib/polls";

const TALLY_ROWS = 8;
const CONFIRM_MS = 8000;

/** A datetime-local value (the admin's own wall clock) as a UTC ISO string, or null when empty. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Data rows in a CSV text (the header not counted). Quote-aware: each message cell holds line breaks, so counting
 *  raw lines would count every message three times. */
function countCsvRows(text: string): number {
  let rows = 0;
  let quoted = false;
  let sawContent = false;
  for (const ch of text.replace(/^﻿/, "")) {
    if (ch === '"') quoted = !quoted;
    if (ch === "\n" && !quoted) {
      if (sawContent) rows += 1;
      sawContent = false;
    } else if (ch !== "\r") {
      sawContent = true;
    }
  }
  if (sawContent) rows += 1;
  return Math.max(0, rows - 1);
}

/** Save a Blob as a file the browser downloads. */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// `editions`: every awards edition for an AFC admin (the page's editions list), or the editions that have a round for a
// KOL admin (#641, kolNominationsAdminApi.editions). Only the themed KOL ones are offered either way.
export function KolNominationsAdmin({ editions }: { editions: Pick<AwardsEdition, "slug" | "title" | "theme">[] }) {
  const t = useTranslations("adminPolls");
  // The awards' explanations live with the creators' ballot (one text for both pages).
  const tk = useTranslations("awardsKol");
  const kol = useMemo(() => editions.filter((e) => e.theme === "detty-royale"), [editions]);
  const [slug, setSlug] = useState(kol[0]?.slug || "");
  const [data, setData] = useState<NominationAdmin | null>(null);
  const [loading, setLoading] = useState(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  // Merge control per write-in row: the chosen "same person as" candidate, and which row waits for its 2nd press.
  const [mergeTarget, setMergeTarget] = useState<Record<number, string>>({});
  const [confirmingMerge, setConfirmingMerge] = useState<number | null>(null);
  const [spareCount, setSpareCount] = useState("5");
  const [spareLang, setSpareLang] = useState<CopyLanguage>("en");
  const [confirmingRevoke, setConfirmingRevoke] = useState<number | null>(null);

  // The refusals of these endpoints, translated (adminPolls.kolNom.errors), else the server's own sentence.
  const refusal = useCallback(
    (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { code?: string; message?: string } | Blob | undefined;
        const code = body && !(body instanceof Blob) ? body.code : undefined;
        if (code && t.has(`kolNom.errors.${code}`)) return t(`kolNom.errors.${code}`);
        if (body && !(body instanceof Blob) && body.message) return body.message;
      }
      return t("kolNom.failed");
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const next = await kolNominationsAdminApi.get(slug);
      setData(next);
      setOpensAt(isoToLocalInput(next.round?.opens_at));
      setClosesAt(isoToLocalInput(next.round?.closes_at));
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setLoading(false);
    }
  }, [slug, refusal]);

  useEffect(() => {
    void load();
  }, [load]);

  const setUp = async () => {
    setBusy(true);
    try {
      const next = await kolNominationsAdminApi.setUp(slug, {
        opens_at: fromLocalInput(opensAt),
        closes_at: fromLocalInput(closesAt),
      });
      setData(next);
      toast.success(t("kolNom.roundSaved"));
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadCodes = async (creatorIds?: number[]) => {
    setBusy(true);
    try {
      const blob = await kolNominationsAdminApi.codes(slug, creatorIds);
      const rows = countCsvRows(await blob.text());
      if (rows === 0) {
        toast.info(t("kolNom.noneToMake"));
      } else {
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        saveFile(blob, `kol-codes-${slug}-${stamp}.csv`);
        toast.success(t("kolNom.codesMade", { n: rows }));
      }
      await load();
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const newCode = (creator: NominationAdminCreator) => {
    // Two presses: a new code revokes the old one, which the creator may already have.
    if (confirming !== creator.creator_id) {
      setConfirming(creator.creator_id);
      setTimeout(() => setConfirming((c) => (c === creator.creator_id ? null : c)), CONFIRM_MS);
      return;
    }
    void downloadCodes([creator.creator_id]);
  };

  const setActive = async (creator: NominationAdminCreator, active: boolean) => {
    try {
      await kolNominationsAdminApi.setActive(slug, creator.creator_id, active);
      toast.success(active ? t("kolNom.switchedOn", { name: creator.name }) : t("kolNom.switchedOff", { name: creator.name }));
      await load();
    } catch (err) {
      toast.error(refusal(err));
    }
  };

  // ── copy a code or its ready message (#640): read back from the server, straight to the clipboard ──
  const copyCode = async (codeId: number, what: "code" | "message", lang?: CopyLanguage) => {
    try {
      const copy = await kolNominationsAdminApi.readCode(slug, codeId, lang);
      await navigator.clipboard.writeText(what === "code" ? copy.code : copy.message);
      toast.success(t("kolNom.copied"));
    } catch (err) {
      toast.error(axios.isAxiosError(err) ? refusal(err) : t("kolNom.copyFailed"));
    }
  };

  // ── spare codes (#639) ──
  const makeSpare = async () => {
    // Checked here too: a refusal of a file download arrives as a Blob, so the server's sentence would be lost.
    const count = Number(spareCount);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      toast.error(t("kolNom.errors.kol_bad_spare_count"));
      return;
    }
    setBusy(true);
    try {
      const blob = await kolNominationsAdminApi.spareCodes(slug, count);
      const rows = countCsvRows(await blob.text());
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      saveFile(blob, `kol-spare-codes-${slug}-${stamp}.csv`);
      toast.success(t("kolNom.codesMade", { n: rows }));
      await load();
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (codeId: number) => {
    // Two presses: whoever holds the code is shut out at once.
    if (confirmingRevoke !== codeId) {
      setConfirmingRevoke(codeId);
      setTimeout(() => setConfirmingRevoke((c) => (c === codeId ? null : c)), CONFIRM_MS);
      return;
    }
    setBusy(true);
    try {
      await kolNominationsAdminApi.revokeCode(slug, codeId);
      toast.success(t("kolNom.revoked"));
      await load();
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setBusy(false);
      setConfirmingRevoke(null);
    }
  };

  const merge = async (creator: NominationAdminCreator, target: NominationAdminCreator) => {
    // Two presses: the picks move for good (the duplicate can be switched back on, but its picks stay moved).
    if (confirmingMerge !== creator.creator_id) {
      setConfirmingMerge(creator.creator_id);
      setTimeout(() => setConfirmingMerge((c) => (c === creator.creator_id ? null : c)), CONFIRM_MS);
      return;
    }
    setBusy(true);
    try {
      await kolNominationsAdminApi.merge(slug, creator.creator_id, target.creator_id);
      toast.success(t("kolNom.merged", { name: creator.name, target: target.name }));
      await load();
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setBusy(false);
      setConfirmingMerge(null);
    }
  };

  if (kol.length === 0) return <p className="text-sm text-muted-foreground">{t("kolNom.noEdition")}</p>;

  const creators = data?.creators ?? [];
  const byId = new Map(creators.map((c) => [c.creator_id, c]));
  const active = creators.filter((c) => c.active);
  // Voters are the creators on the KOL List; write-ins (#637) are candidates only, counted on their own.
  const voters = active.filter((c) => c.origin !== "write-in");
  const stats = [
    { label: t("kolNom.statCreators"), value: formatNumber(voters.length) },
    { label: t("kolNom.statCodes"), value: formatNumber(voters.filter((c) => c.has_code).length) },
    { label: t("kolNom.statVoted"), value: formatNumber(voters.filter((c) => c.voted).length) },
    { label: t("kolNom.statWriteIns"), value: formatNumber(active.length - voters.length) },
    { label: t("kolNom.statWrong"), value: formatNumber(data?.failed_attempts ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("kolNom.intro")}</p>

      <div className="max-w-sm space-y-2">
        <Label>{t("kolNom.pickEdition")}</Label>
        <Select value={slug} onValueChange={setSlug}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kol.map((edition) => (
              <SelectItem key={edition.slug} value={edition.slug}>
                {edition.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !data && <FullLoader />}

      {data && (
        <>
          <Card className="bg-card rounded-md py-6 shadow-sm">
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">{t("kolNom.roundTitle")}</h3>
                {data.round && (
                  <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                    {t(`kolNom.state.${data.round.state}`)}
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kol-nom-opens">{t("kolNom.opensAt")}</Label>
                  <Input id="kol-nom-opens" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kol-nom-closes">{t("kolNom.closesAt")}</Label>
                  <Input id="kol-nom-closes" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void setUp()} disabled={busy}>
                  {data.round ? t("kolNom.saveDates") : t("kolNom.setUp")}
                </Button>
                {data.round && (
                  <Button variant="outline" onClick={() => void downloadCodes()} disabled={busy}>
                    {t("kolNom.makeCodes")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("kolNom.codesNote")}</p>
            </CardContent>
          </Card>

          {/* Garena's private live link of this edition (#641): the same link as the Metrics tab's. */}
          {data.round && (
            <GarenaLiveLink
              editionSlug={slug}
              initialToken={data.edition.live_view_token || ""}
              intro={t("kolNom.liveIntro")}
              newSince={GARENA_ACCESS_SINCE}
            />
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {stats.map((s) => (
              <Card key={s.label} className="bg-card rounded-md py-6 shadow-sm">
                <CardContent>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{t("kolNom.creatorsTitle")}</h3>
            {creators.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("kolNom.noCreators")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="text-foreground">{t("kolNom.colName")}</TableHead>
                      <TableHead className="text-foreground">{t("kolNom.colCountry")}</TableHead>
                      <TableHead className="text-foreground">{t("kolNom.colStatus")}</TableHead>
                      <TableHead className="text-foreground">{t("kolNom.colCode")}</TableHead>
                      <TableHead className="text-foreground">{t("kolNom.colVoted")}</TableHead>
                      <TableHead className="text-foreground">{t("kolNom.colLastUsed")}</TableHead>
                      <TableHead className="text-foreground">{t("kolNom.colOn")}</TableHead>
                      <TableHead className="text-foreground" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creators.map((c) => {
                      const writeIn = c.origin === "write-in";
                      const mergedInto = c.merged_into ? byId.get(c.merged_into) : undefined;
                      const others = active.filter((o) => o.creator_id !== c.creator_id);
                      const target = byId.get(Number(mergeTarget[c.creator_id]));
                      return (
                      <TableRow key={c.creator_id} className={c.active ? "" : "opacity-60"}>
                        <TableCell className="p-2">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="block text-muted-foreground">@{c.handle}</span>
                          {writeIn && (
                            <Badge variant="outline" className="mt-1 rounded-full px-2 py-0.5 text-xs text-gold">
                              {t("kolNom.writeIn")}
                            </Badge>
                          )}
                          {mergedInto && (
                            <span className="block text-muted-foreground">{t("kolNom.mergedInto", { name: mergedInto.name })}</span>
                          )}
                          {!writeIn && c.write_ins_added > 0 && (
                            <span className="block text-muted-foreground">{t("kolNom.addedCount", { n: c.write_ins_added })}</span>
                          )}
                        </TableCell>
                        <TableCell className="p-2">{c.country}</TableCell>
                        <TableCell className="p-2">{c.sheet_status}</TableCell>
                        <TableCell className="p-2">
                          {writeIn ? t("kolNom.notVoter") : c.has_code ? t("kolNom.yes") : t("kolNom.no")}
                        </TableCell>
                        <TableCell className="p-2">
                          {writeIn ? t("kolNom.notVoter") : c.voted ? t("kolNom.yes") : t("kolNom.no")}
                        </TableCell>
                        <TableCell className="p-2">
                          {c.last_used_at ? <LocalTime value={c.last_used_at} mode="relative" /> : t("kolNom.never")}
                        </TableCell>
                        <TableCell className="p-2">
                          <Switch
                            checked={c.active}
                            onCheckedChange={(v) => void setActive(c, v)}
                            aria-label={t("kolNom.toggleLabel", { name: c.name })}
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          {c.active && data.round && !writeIn && (
                            <div className="flex items-center justify-end gap-2">
                              {c.code_id && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => void copyCode(c.code_id!, "code")}>
                                    {t("kolNom.copyCode")}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => void copyCode(c.code_id!, "message")}>
                                    {t("kolNom.copyMessage")}
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="outline" onClick={() => newCode(c)} disabled={busy}>
                                {confirming === c.creator_id ? t("kolNom.confirmNewCode") : t("kolNom.newCode")}
                              </Button>
                            </div>
                          )}
                          {c.active && data.round && writeIn && (
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={mergeTarget[c.creator_id] ?? ""}
                                onValueChange={(v) => {
                                  setMergeTarget((m) => ({ ...m, [c.creator_id]: v }));
                                  setConfirmingMerge(null);
                                }}
                              >
                                <SelectTrigger className="h-8 w-44 text-xs" aria-label={t("kolNom.mergeLabel", { name: c.name })}>
                                  <SelectValue placeholder={t("kolNom.mergePick")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {others.map((o) => (
                                    <SelectItem key={o.creator_id} value={String(o.creator_id)}>
                                      {o.name} (@{o.handle})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => target && void merge(c, target)}
                                disabled={busy || !target}
                              >
                                {confirmingMerge === c.creator_id ? t("kolNom.confirmMerge") : t("kolNom.merge")}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {data.round && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">{t("kolNom.spareTitle")}</h3>
              <p className="max-w-3xl text-xs text-muted-foreground">{t("kolNom.spareNote")}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="kol-nom-spare-count">{t("kolNom.spareCount")}</Label>
                  <Input
                    id="kol-nom-spare-count"
                    type="number"
                    min={1}
                    max={50}
                    className="w-24"
                    value={spareCount}
                    onChange={(e) => setSpareCount(e.target.value)}
                  />
                </div>
                <Button onClick={() => void makeSpare()} disabled={busy}>
                  {t("kolNom.makeSpare")}
                </Button>
                <div className="space-y-2">
                  <Label>{t("kolNom.spareLang")}</Label>
                  <Select value={spareLang} onValueChange={(v) => setSpareLang(v as CopyLanguage)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("kolNom.langEn")}</SelectItem>
                      <SelectItem value="fr">{t("kolNom.langFr")}</SelectItem>
                      <SelectItem value="pt">{t("kolNom.langPt")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {data.spare_codes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("kolNom.spareNone")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="h-10">
                        <TableHead className="text-foreground">{t("kolNom.colSpare")}</TableHead>
                        <TableHead className="text-foreground">{t("kolNom.colMade")}</TableHead>
                        <TableHead className="text-foreground">{t("kolNom.colUsedBy")}</TableHead>
                        <TableHead className="text-foreground" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.spare_codes.map((spare, i) => (
                        <TableRow key={spare.code_id}>
                          <TableCell className="p-2 font-medium text-foreground">{t("kolNom.spareNumber", { n: i + 1 })}</TableCell>
                          <TableCell className="p-2">
                            <LocalTime value={spare.created_at} mode="relative" />
                          </TableCell>
                          <TableCell className="p-2">
                            {spare.claimed_by ? (
                              <>
                                <span className="font-medium text-foreground">{spare.claimed_by.name}</span>
                                <span className="block text-muted-foreground">@{spare.claimed_by.handle}</span>
                              </>
                            ) : (
                              t("kolNom.spareUnused")
                            )}
                          </TableCell>
                          <TableCell className="p-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => void copyCode(spare.code_id, "code", spareLang)}>
                                {t("kolNom.copyCode")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void copyCode(spare.code_id, "message", spareLang)}>
                                {t("kolNom.copyMessage")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void revoke(spare.code_id)} disabled={busy}>
                                {confirmingRevoke === spare.code_id ? t("kolNom.confirmRevoke") : t("kolNom.revoke")}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {data.round && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">{t("kolNom.tallyTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("kolNom.tallyNote")}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {data.round.awards.map((award) => {
                  const rows = data.tally[String(award.question_id)] ?? [];
                  return (
                    <Card key={award.question_id} className="bg-card rounded-md py-6 shadow-sm">
                      <CardContent className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">{award.prompt}</p>
                        {award.key && tk.has(`nominate.awardHelp.${award.key}`) && (
                          <p className="text-xs text-muted-foreground">{tk(`nominate.awardHelp.${award.key}`)}</p>
                        )}
                        {rows.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("kolNom.noPicks")}</p>
                        ) : (
                          <ol className="space-y-1 text-xs">
                            {rows.slice(0, TALLY_ROWS).map((row, i) => (
                              <li key={row.creator_id} className="flex justify-between gap-3">
                                <span>
                                  #{i + 1} {row.name}
                                </span>
                                <span className="tabular-nums text-muted-foreground">
                                  {t("kolNom.picks", { n: row.picks })}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
