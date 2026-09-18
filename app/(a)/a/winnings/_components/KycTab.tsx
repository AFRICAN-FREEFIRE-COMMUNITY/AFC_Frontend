"use client";

// ── Admin · Winnings · KYC tab ───────────────────────────────────────────────────────────────
// Who has a confirmed WhatsApp number and a linked Discord (the two facts a withdrawal needs),
// and the hand override: force-verify or un-verify with a reason, recorded with the admin's
// name. Reads GET /wagers/admin/kyc/; writes .../<username>/force/.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconSearch, IconX } from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { forceKyc, listKyc, type KycRow } from "@/lib/api/wagersAdmin";

import { Pager, useAdminRefusal } from "../../wagers/_components/shared";

const LIMIT = 25;

export function KycTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<KycRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<{ username: string; verified: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await listKyc({ q: q.trim() || undefined, limit: LIMIT, offset });
      setRows(page.results);
      setTotal(page.total_count);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [q, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [q]);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const out = await forceKyc(target.username, target.verified, reason.trim());
      toast.success(out.message);
      setTarget(null);
      setReason("");
      await load();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">{t("kyc.intro")}</p>
      <div className="relative">
        <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("kyc.search")} className="pl-9" aria-label={t("kyc.search")} />
        {q && <button type="button" className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2" onClick={() => setQ("")} aria-label={t("markets.clearSearch")}><IconX className="size-4" /></button>}
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{t("kyc.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("players.colPlayer")}</TableHead>
                  <TableHead>{t("kyc.colWhatsapp")}</TableHead>
                  <TableHead>{t("kyc.colDiscord")}</TableHead>
                  <TableHead>{t("kyc.colAge")}</TableHead>
                  <TableHead>{t("kyc.colForced")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.username} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium"><Link href={`/a/winnings/players/${r.username}`} className="hover:underline">{r.username}</Link></TableCell>
                    <TableCell>
                      <Badge variant={r.whatsapp_verified ? "default" : "pending"}>{r.whatsapp_verified ? t("kyc.confirmed") : t("kyc.notConfirmed")}</Badge>
                      <p className="text-muted-foreground mt-1 text-[11px]">{r.whatsapp_number || t("kyc.noNumber")}{r.whatsapp_verified_at && <> · <LocalTime value={r.whatsapp_verified_at} mode="datetime" /></>}</p>
                    </TableCell>
                    <TableCell><Badge variant={r.discord_linked ? "default" : "pending"}>{r.discord_linked ? t("kyc.linked") : t("kyc.notLinked")}</Badge></TableCell>
                    <TableCell><Badge variant={r.age_ok ? "default" : r.date_of_birth_on_file ? "destructive" : "pending"}>{r.age_ok ? t("kyc.ageOk", { min: r.min_age }) : r.date_of_birth_on_file ? t("kyc.underage") : t("kyc.noDob")}</Badge></TableCell>
                    <TableCell>{r.forced ? <>{r.forced_by ?? "-"}<p className="text-muted-foreground text-[11px]">{r.force_reason}</p></> : "-"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {r.whatsapp_verified
                          ? <Button size="sm" variant="secondary" onClick={() => setTarget({ username: r.username, verified: false })}>{t("kyc.unverify")}</Button>
                          : <Button size="sm" onClick={() => setTarget({ username: r.username, verified: true })}>{t("kyc.forceVerify")}</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />

      <Dialog open={target !== null} onOpenChange={(v) => !busy && !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.verified ? t("kyc.forceVerify") : t("kyc.unverify")}</DialogTitle>
            <DialogDescription>{target && t("kyc.forceIntro", { user: target.username })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label>{t("kyc.reason")}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("kyc.reasonPlaceholder")} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button onClick={() => void confirm()} disabled={busy || reason.trim().length < 3}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
