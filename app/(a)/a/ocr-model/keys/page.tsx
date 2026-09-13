"use client";

// ── Admin: OCR keys ─────────────────────────────────────────────────────────
// Which organizations read screenshots on their own AI key (owner 2026-09-12), what they read
// this month and all time, how many free reads AFC still pays for each, and a switch to turn
// OCR off for an organization. Never the key itself: the backend returns last four only.
//
// HOW IT CONNECTS
//   - lib/api/aiKey.ts adminList / adminSetAllowance / adminSetDisabled ->
//     afc_organizers/views_ai_key.py admin_* (platform org admins only).
//   - Linked from the OCR Model dashboard (app/(a)/a/ocr-model/page.tsx) and the admin nav.
//   - Copy: messages/{en,fr,pt}/aiKey.json under "admin" (admin surfaces are in scope for
//     i18n per the owner's override).

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NewBadge } from "@/components/NewBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { aiKeyApi, aiKeyErrorMessage, type AdminAiKeyRow } from "@/lib/api/aiKey";

const SINCE = "2026-09-12";

function money(usd: number): string {
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd > 0) return "<$0.01";
  return "$0.00";
}

export default function OcrKeysAdminPage() {
  const t = useTranslations("aiKey");
  const [rows, setRows] = useState<AdminAiKeyRow[] | null>(null);
  const [afc, setAfc] = useState<{ reads: number; estimated_usd: number }>({ reads: 0, estimated_usd: 0 });
  const [allowance, setAllowance] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await aiKeyApi.adminList();
      setRows(r.organizations);
      setAfc(r.afc_key_month);
      setAllowance(Object.fromEntries(r.organizations.map((o) => [o.organization_id, String(o.free_reads_left)])));
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("admin.loadFailed")));
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAllowance = async (org: AdminAiKeyRow) => {
    const n = Number(allowance[org.organization_id]);
    if (!Number.isInteger(n) || n < 0) return;
    setBusy(org.organization_id);
    try {
      const r = await aiKeyApi.adminSetAllowance(org.organization_id, n);
      toast.success(r.message || t("admin.allowanceSaved"));
      await load();
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("admin.loadFailed")));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (org: AdminAiKeyRow) => {
    setBusy(org.organization_id);
    try {
      const r = await aiKeyApi.adminSetDisabled(org.organization_id, !org.ocr_disabled);
      toast.success(r.message);
      await load();
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("admin.loadFailed")));
    } finally {
      setBusy(null);
    }
  };

  if (rows === null) return <FullLoader />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("admin.title")} description={t("admin.description")} />
      <Card>
        <CardContent className="py-4 text-sm">
          <span className="inline-flex items-center gap-2">
            {t("admin.afcMonth", { reads: afc.reads, usd: money(afc.estimated_usd) })}
            <NewBadge since={SINCE} />
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto py-2">
          <Table>
            <TableHeader>
              <TableRow className="h-10">
                <TableHead className="text-foreground">{t("admin.colOrg")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colProvider")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colModel")}</TableHead>
                <TableHead className="text-foreground text-right">{t("admin.colMonth")}</TableHead>
                <TableHead className="text-foreground text-right">{t("admin.colAll")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colFree")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colOcr")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.organization_id} className="text-xs odd:bg-muted/30">
                  <TableCell className="p-2 font-medium">{o.name}</TableCell>
                  <TableCell className="p-2">
                    {o.provider ? (
                      <span className={cn(o.last_test_ok === false && "text-destructive")}>
                        {o.provider} ····{o.last_four}
                        {o.last_test_ok === false && o.last_error && (
                          <span className="block text-muted-foreground">{t("admin.lastError", { error: o.last_error })}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t("admin.notConnected")}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-2 text-muted-foreground">{o.model ?? ""}</TableCell>
                  <TableCell className="p-2 text-right tabular-nums">
                    {o.reads_month}
                    <span className="block text-muted-foreground">{money(o.estimated_usd_month)}</span>
                  </TableCell>
                  <TableCell className="p-2 text-right tabular-nums">{o.reads_all_time}</TableCell>
                  <TableCell className="p-2">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-20"
                        aria-label={t("admin.colFree")}
                        value={allowance[o.organization_id] ?? ""}
                        onChange={(e) => setAllowance((a) => ({ ...a, [o.organization_id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        disabled={busy === o.organization_id || String(o.free_reads_left) === (allowance[o.organization_id] ?? "")}
                        onClick={() => saveAllowance(o)}
                      >
                        {t("admin.setAllowance")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="p-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", o.ocr_disabled ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
                        {o.ocr_disabled ? t("admin.off") : t("admin.on")}
                      </span>
                      <Button size="sm" variant="ghost" className="h-8" disabled={busy === o.organization_id} onClick={() => toggle(o)}>
                        {o.ocr_disabled ? t("admin.switchOn") : t("admin.switchOff")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
