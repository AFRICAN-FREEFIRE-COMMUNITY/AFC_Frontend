"use client";

/**
 * app/(a)/a/polls/_components/KolNominationsAdmin.tsx - the "Nominations" tab of /a/polls: the KOL creators'
 * nomination round, admin side (owner, 25 to 26 Nov 2026, AFC inbox #633 / #634). AFC poll admins only.
 *
 * WHAT AN ADMIN DOES HERE
 *   1. Pick the KOL edition (themed "detty-royale" editions only), set the open and close times, "Set up the round"
 *      (idempotent on the server: AFC-B afc_polls/kol_nominations.py ensure_round).
 *   2. "Make codes for everyone without one" downloads a CSV: name, @handle, country, code, personal link and a
 *      ready-to-send message in the creator's language. The codes exist in plain text ONLY in that file (the server
 *      keeps a hash), so it is downloaded, never shown on screen. Layo and Garena send the lines themselves.
 *   3. Per creator: switch them off (their code stops at once, they leave every ballot and the tally) or give them a
 *      new code (a one-row CSV; the old code and its cookie stop working).
 *   4. Read who has voted (yes / no) and the picks per creator in each award. Who picked whom is never shown.
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
import { kolNominationsAdminApi, type NominationAdmin, type NominationAdminCreator } from "@/lib/kolNominations";
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

export function KolNominationsAdmin({ editions }: { editions: AwardsEdition[] }) {
  const t = useTranslations("adminPolls");
  const kol = useMemo(() => editions.filter((e) => e.theme === "detty-royale"), [editions]);
  const [slug, setSlug] = useState(kol[0]?.slug || "");
  const [data, setData] = useState<NominationAdmin | null>(null);
  const [loading, setLoading] = useState(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);

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

  if (kol.length === 0) return <p className="text-sm text-muted-foreground">{t("kolNom.noEdition")}</p>;

  const creators = data?.creators ?? [];
  const active = creators.filter((c) => c.active);
  const stats = [
    { label: t("kolNom.statCreators"), value: formatNumber(active.length) },
    { label: t("kolNom.statCodes"), value: formatNumber(active.filter((c) => c.has_code).length) },
    { label: t("kolNom.statVoted"), value: formatNumber(active.filter((c) => c.voted).length) },
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    {creators.map((c) => (
                      <TableRow key={c.creator_id} className={c.active ? "" : "opacity-60"}>
                        <TableCell className="p-2">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="block text-muted-foreground">@{c.handle}</span>
                        </TableCell>
                        <TableCell className="p-2">{c.country}</TableCell>
                        <TableCell className="p-2">{c.sheet_status}</TableCell>
                        <TableCell className="p-2">{c.has_code ? t("kolNom.yes") : t("kolNom.no")}</TableCell>
                        <TableCell className="p-2">{c.voted ? t("kolNom.yes") : t("kolNom.no")}</TableCell>
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
                          {c.active && data.round && (
                            <Button size="sm" variant="outline" onClick={() => newCode(c)} disabled={busy}>
                              {confirming === c.creator_id ? t("kolNom.confirmNewCode") : t("kolNom.newCode")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

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
