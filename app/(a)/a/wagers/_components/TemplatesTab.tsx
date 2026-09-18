"use client";

// ── Admin · Wagers · Templates tab ───────────────────────────────────────────────────────────
// The kinds of market: each pairs an option source (who can be picked) with a settle rule (how
// the winner is read off the match stats). Edit in a dialog; a new one starts inactive until
// its code and name are in. Reads GET /wagers/admin/templates/, writes POST / PATCH.

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createTemplate, listTemplates, saveTemplate, type MarketTemplate, type OptionSource, type SettleRule,
} from "@/lib/api/wagersAdmin";

import { useAdminRefusal } from "./shared";

const SOURCES: OptionSource[] = ["teams_in_match", "players_in_match", "custom", "over_under"];
const RULES: SettleRule[] = ["team_placement_1", "team_most_kills", "player_most_kills", "match_mvp", "total_kills_over_under", "manual"];

const EMPTY: Partial<MarketTemplate> = { code: "", name: "", description: "", option_source: "teams_in_match", settle_rule: "team_placement_1", needs_match: true, is_active: true, sort_order: 0 };

export function TemplatesTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<MarketTemplate[] | null>(null);
  const [editing, setEditing] = useState<Partial<MarketTemplate> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listTemplates());
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const out = isNew ? await createTemplate(editing) : await saveTemplate(editing.code!, editing);
      toast.success(out.message);
      setEditing(null);
      await load();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof MarketTemplate>(k: K, v: MarketTemplate[K]) => setEditing((e) => ({ ...e, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t("templates.intro")}</p>
        <Button size="sm" onClick={() => { setIsNew(true); setEditing({ ...EMPTY }); }}><IconPlus />{t("templates.new")}</Button>
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("templates.colName")}</TableHead>
                  <TableHead>{t("templates.colCode")}</TableHead>
                  <TableHead>{t("templates.colSource")}</TableHead>
                  <TableHead>{t("templates.colRule")}</TableHead>
                  <TableHead>{t("templates.colActive")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.code} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium">{r.name}<p className="text-muted-foreground text-[11px] font-normal">{r.description}</p></TableCell>
                    <TableCell><code className="text-[11px]">{r.code}</code></TableCell>
                    <TableCell>{t(`sources.${r.option_source}`)}</TableCell>
                    <TableCell>{t(`rules.${r.settle_rule}`)}</TableCell>
                    <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? t("common.on") : t("common.off")}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="secondary" onClick={() => { setIsNew(false); setEditing({ ...r }); }}>{t("common.edit")}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(v) => !busy && !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isNew ? t("templates.new") : t("templates.editTitle", { name: editing?.name ?? "" })}</DialogTitle></DialogHeader>
          {editing && (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label>{t("templates.colCode")}</Label>
                  <Input value={editing.code ?? ""} disabled={!isNew} onChange={(e) => set("code", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("templates.colName")}</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => set("name", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>{t("templates.description")}</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label>{t("templates.colSource")}</Label>
                  <Select value={editing.option_source} onValueChange={(v) => set("option_source", v as OptionSource)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{t(`sources.${s}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("templates.colRule")}</Label>
                  <Select value={editing.settle_rule} onValueChange={(v) => set("settle_rule", v as SettleRule)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RULES.map((r) => <SelectItem key={r} value={r}>{t(`rules.${r}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.needs_match} onCheckedChange={(v) => set("needs_match", v)} />{t("templates.needsMatch")}</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.is_active} onCheckedChange={(v) => set("is_active", v)} />{t("templates.colActive")}</label>
                <div className="flex items-center gap-2 text-sm">
                  <Label className="whitespace-nowrap">{t("templates.sortOrder")}</Label>
                  <Input inputMode="numeric" className="w-20" value={String(editing.sort_order ?? 0)} onChange={(e) => set("sort_order", Number(e.target.value.replace(/\D/g, "")) || 0)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button onClick={() => void save()} disabled={busy || !editing?.code || !editing?.name}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
