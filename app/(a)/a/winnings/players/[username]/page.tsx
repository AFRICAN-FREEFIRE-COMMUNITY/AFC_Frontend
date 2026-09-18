"use client";

// ── Admin · Winnings · one player ────────────────────────────────────────────────────────────
// A player's whole money picture and every lever: balance / held / available, KYC facts,
// freeze or unfreeze (with a reason), credit or debit an adjustment (a reason, two keys above
// the threshold), set caps and a cool-off, and their wagers, ledger, withdrawals and
// adjustments. Reads GET /wagers/admin/users/<username>/; writes .../{freeze,adjust,limits}/.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconArrowLeft } from "@tabler/icons-react";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/api/wagers";
import { adjustUser, freezeUser, getUserDetail, setUserLimits, type UserDetail } from "@/lib/api/wagersAdmin";

import {
  koboToNairaInput, nairaInputToKobo, Panel, Stat, useAdminRefusal, WagerStatusBadge, WithdrawalStatusBadge,
} from "../../../wagers/_components/shared";
import { LedgerTab } from "../../_components/LedgerTab";

export default function AdminPlayerWinningsPage() {
  const t = useTranslations("wagersAdmin");
  const params = useParams<{ username: string }>();
  const refuse = useAdminRefusal();
  const [data, setData] = useState<UserDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [dialog, setDialog] = useState<"freeze" | "adjust" | "limits" | null>(null);
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [daily, setDaily] = useState("");
  const [weekly, setWeekly] = useState("");
  const [loss, setLoss] = useState("");
  const [cooloff, setCooloff] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const out = await getUserDetail(params.username);
      setData(out);
      setDaily(koboToNairaInput(out.account.limits?.daily_stake_cap_kobo));
      setWeekly(koboToNairaInput(out.account.limits?.weekly_stake_cap_kobo));
      setLoss(koboToNairaInput(out.account.limits?.daily_loss_cap_kobo));
    } catch (err) {
      refuse(err);
      setMissing(true);
    }
  }, [params.username]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const out = await fn();
      toast.success(out.message);
      setDialog(null);
      setReason("");
      setAmount("");
      await load();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  if (missing) return <p className="text-muted-foreground py-12 text-center text-sm">{t("errors.user_not_found")}</p>;
  if (!data) return <FullLoader />;

  const a = data.account;
  const k = a.kyc;
  const l = a.limits;
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link href="/a/winnings?tab=players"><IconArrowLeft />{t("common.backToPlayers")}</Link>
      </Button>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">{a.username}{a.frozen && <Badge variant="destructive">{t("players.frozen")}</Badge>}</span>}
        description={a.email}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={a.frozen ? "default" : "destructive"} onClick={() => setDialog("freeze")}>{a.frozen ? t("player.unfreeze") : t("player.freeze")}</Button>
            <Button size="sm" onClick={() => setDialog("adjust")}>{t("player.adjust")}</Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog("limits")}>{t("player.limits")}</Button>
          </div>
        }
      />
      {a.frozen && <p className="bg-destructive/15 text-destructive rounded-md px-4 py-3 text-sm">{t("player.frozenBecause", { reason: a.frozen_reason || "-" })}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("players.colBalance")} value={naira(a.balance_kobo)} tone="text-primary" />
        <Stat label={t("players.colHeld")} value={naira(a.held_kobo)} />
        <Stat label={t("player.available")} value={naira(a.balance_kobo - a.held_kobo)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("player.kycTitle")}>
          {k ? (
            <ul className="flex flex-col gap-1 text-sm">
              <li className="flex justify-between gap-2"><span>{t("kyc.colWhatsapp")}</span><span>{k.whatsapp_number || t("kyc.noNumber")} · <Badge variant={k.whatsapp_verified ? "default" : "pending"}>{k.whatsapp_verified ? t("kyc.confirmed") : t("kyc.notConfirmed")}</Badge></span></li>
              <li className="flex justify-between gap-2"><span>{t("kyc.colDiscord")}</span><Badge variant={k.discord_linked ? "default" : "pending"}>{k.discord_linked ? t("kyc.linked") : t("kyc.notLinked")}</Badge></li>
              <li className="flex justify-between gap-2"><span>{t("kyc.colAge")}</span><Badge variant={k.age_ok ? "default" : k.date_of_birth_on_file ? "destructive" : "pending"}>{k.age_ok ? t("kyc.ageOk", { min: k.min_age }) : k.date_of_birth_on_file ? t("kyc.underage") : t("kyc.noDob")}</Badge></li>
              <li className="flex justify-between gap-2"><span>{t("player.canWithdraw")}</span><Badge variant={k.tier_lite ? "default" : "pending"}>{k.tier_lite ? t("common.yes") : t("common.no")}</Badge></li>
              {k.forced && <li className="text-muted-foreground text-xs">{t("player.kycForced")}</li>}
            </ul>
          ) : <p className="text-muted-foreground text-xs">-</p>}
          <Link href="/a/winnings?tab=kyc" className="text-primary text-xs font-medium">{t("player.kycLink")}</Link>
        </Panel>
        <Panel title={t("player.limitsTitle")}>
          {l ? (
            <ul className="flex flex-col gap-1 text-sm">
              <li className="flex justify-between gap-2"><span>{t("settings.dailyCap")}</span><span>{l.effective.daily_stake_cap_kobo ? naira(l.effective.daily_stake_cap_kobo) : t("player.noCap")}</span></li>
              <li className="flex justify-between gap-2"><span>{t("settings.weeklyCap")}</span><span>{l.effective.weekly_stake_cap_kobo ? naira(l.effective.weekly_stake_cap_kobo) : t("player.noCap")}</span></li>
              <li className="flex justify-between gap-2"><span>{t("settings.lossCap")}</span><span>{l.effective.daily_loss_cap_kobo ? naira(l.effective.daily_loss_cap_kobo) : t("player.noCap")}</span></li>
              {l.pending.effective_at && <li className="text-muted-foreground text-xs">{t("player.pendingRaise")} <LocalTime value={l.pending.effective_at} mode="datetime" /></li>}
              <li className="flex justify-between gap-2"><span>{t("player.cooloff")}</span><span>{l.cooloff_until && new Date(l.cooloff_until).getTime() > now ? <LocalTime value={l.cooloff_until} mode="datetime" /> : t("common.no")}</span></li>
              <li className="flex justify-between gap-2"><span>{t("player.selfExcluded")}</span><span>{l.self_excluded_until && new Date(l.self_excluded_until).getTime() > now ? <LocalTime value={l.self_excluded_until} mode="date" /> : t("common.no")}</span></li>
            </ul>
          ) : <p className="text-muted-foreground text-xs">-</p>}
        </Panel>
      </div>

      <Tabs defaultValue="wagers">
        <TabsList className="w-full">
          <TabsTrigger value="wagers" className="w-full">{t("player.tabWagers", { n: data.wagers.length })}</TabsTrigger>
          <TabsTrigger value="ledger" className="w-full">{t("moneyTabs.ledger")}</TabsTrigger>
          <TabsTrigger value="withdrawals" className="w-full">{t("player.tabWithdrawals", { n: data.withdrawals.length })}</TabsTrigger>
          <TabsTrigger value="adjustments" className="w-full">{t("player.tabAdjustments", { n: data.adjustments.length })}</TabsTrigger>
        </TabsList>

        <TabsContent value="wagers" className="mt-4">
          {data.wagers.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">{t("player.noWagers")}</p> : (
            <div className="bg-card rounded-md p-2 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("markets.colTitle")}</TableHead><TableHead>{t("detail.colStatus")}</TableHead><TableHead>{t("detail.colLinesOn")}</TableHead>
                    <TableHead className="text-right">{t("detail.colStake")}</TableHead><TableHead className="text-right">{t("detail.colPayout")}</TableHead><TableHead>{t("detail.colPlaced")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.wagers.map((w, i) => (
                      <TableRow key={w.token} className={i % 2 ? "bg-muted/40" : ""}>
                        <TableCell className="font-medium">{w.market ? <Link href={`/a/wagers/${w.market.slug}`} className="hover:underline">{w.market.title}</Link> : "-"}</TableCell>
                        <TableCell><WagerStatusBadge status={w.status} /></TableCell>
                        <TableCell>{w.lines.map((ln) => `${naira(ln.stake_kobo)} ${t("detail.on")} ${ln.option}`).join(", ")}</TableCell>
                        <TableCell className="text-right">{naira(w.total_stake_kobo)}</TableCell>
                        <TableCell className="text-right">{w.payout_kobo ? naira(w.payout_kobo) : w.refund_kobo ? `${t("detail.refund")} ${naira(w.refund_kobo)}` : "-"}</TableCell>
                        <TableCell><LocalTime value={w.created_at} mode="datetime" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ledger" className="mt-4"><LedgerTab user={a.username} /></TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          {data.withdrawals.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">{t("withdrawals.empty")}</p> : (
            <div className="bg-card rounded-md p-2 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">{t("withdrawals.colAmount")}</TableHead><TableHead>{t("withdrawals.colBank")}</TableHead><TableHead>{t("withdrawals.colStatus")}</TableHead><TableHead>{t("withdrawals.colRequested")}</TableHead><TableHead>{t("withdrawals.colReviewed")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.withdrawals.map((w, i) => (
                      <TableRow key={w.token} className={i % 2 ? "bg-muted/40" : ""}>
                        <TableCell className="text-right font-semibold">{naira(w.amount_kobo)}</TableCell>
                        <TableCell>{w.bank.bank_name} {w.bank.account_number}<p className="text-muted-foreground text-[11px]">{w.bank.account_name}</p></TableCell>
                        <TableCell><WithdrawalStatusBadge status={w.status} />{w.reject_reason && <p className="text-muted-foreground mt-1 text-[11px]">{w.reject_reason}</p>}</TableCell>
                        <TableCell><LocalTime value={w.created_at} mode="datetime" /></TableCell>
                        <TableCell>{w.reviewed_by ?? "-"}{w.cosigned_by ? ` + ${w.cosigned_by}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <p className="text-muted-foreground mt-2 text-xs"><Link href="/a/winnings?tab=withdrawals" className="text-primary font-medium">{t("player.withdrawalsLink")}</Link></p>
        </TabsContent>

        <TabsContent value="adjustments" className="mt-4">
          {data.adjustments.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">{t("adjustments.empty")}</p> : (
            <div className="bg-card rounded-md p-2 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">{t("adjustments.colAmount")}</TableHead><TableHead>{t("adjustments.colReason")}</TableHead><TableHead>{t("adjustments.colStatus")}</TableHead><TableHead>{t("adjustments.colBy")}</TableHead><TableHead>{t("adjustments.colWhen")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.adjustments.map((adj, i) => (
                      <TableRow key={adj.id} className={i % 2 ? "bg-muted/40" : ""}>
                        <TableCell className={`text-right font-semibold ${adj.direction === "CREDIT" ? "text-primary" : ""}`}>{adj.direction === "CREDIT" ? "+" : "-"}{naira(adj.amount_kobo)}</TableCell>
                        <TableCell>{adj.reason}</TableCell>
                        <TableCell><Badge variant={adj.status === "EXECUTED" ? "default" : adj.status === "REJECTED" ? "destructive" : "pending"}>{t(`adjustmentStatus.${adj.status}`)}</Badge></TableCell>
                        <TableCell>{adj.submitted_by ?? "-"}{adj.cosigned_by ? ` + ${adj.cosigned_by}` : ""}</TableCell>
                        <TableCell><LocalTime value={adj.executed_at ?? adj.created_at} mode="datetime" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── freeze / unfreeze ── */}
      <Dialog open={dialog === "freeze"} onOpenChange={(v) => !busy && !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{a.frozen ? t("player.unfreeze") : t("player.freeze")}</DialogTitle>
            <DialogDescription>{a.frozen ? t("player.unfreezeIntro") : t("player.freezeIntro")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label>{t("player.reason")}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button variant={a.frozen ? "default" : "destructive"} disabled={busy || reason.trim().length < 3} onClick={() => void run(() => freezeUser(a.username, !a.frozen, reason.trim()))}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── adjustment ── */}
      <Dialog open={dialog === "adjust"} onOpenChange={(v) => !busy && !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("player.adjustTitle")}</DialogTitle>
            <DialogDescription>{t("player.adjustIntro")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>{t("player.direction")}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "CREDIT" | "DEBIT")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">{t("player.credit")}</SelectItem>
                  <SelectItem value="DEBIT">{t("player.debit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("player.amountNaira")}</Label>
              <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("player.reason")}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("player.adjustReasonPlaceholder")} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button disabled={busy || !Number(amount) || reason.trim().length < 3} onClick={() => void run(() => adjustUser(a.username, { direction, amount_kobo: nairaInputToKobo(amount), reason: reason.trim() }))}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── limits ── */}
      <Dialog open={dialog === "limits"} onOpenChange={(v) => !busy && !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("player.limitsTitle")}</DialogTitle>
            <DialogDescription>{t("player.limitsIntro")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1"><Label>{t("settings.dailyCap")}</Label><Input inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, ""))} /></div>
            <div className="flex flex-col gap-1"><Label>{t("settings.weeklyCap")}</Label><Input inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/\D/g, ""))} /></div>
            <div className="flex flex-col gap-1"><Label>{t("settings.lossCap")}</Label><Input inputMode="numeric" value={loss} onChange={(e) => setLoss(e.target.value.replace(/\D/g, ""))} /></div>
            <div className="flex flex-col gap-1"><Label>{t("player.cooloffDays")}</Label><Input inputMode="numeric" value={cooloff} onChange={(e) => setCooloff(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
          </div>
          <p className="text-muted-foreground text-xs">{t("settings.zeroMeansNone")}</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button disabled={busy} onClick={() => void run(() => setUserLimits(a.username, {
              daily_stake_cap_kobo: nairaInputToKobo(daily), weekly_stake_cap_kobo: nairaInputToKobo(weekly), daily_loss_cap_kobo: nairaInputToKobo(loss),
              ...(Number(cooloff) > 0 ? { cooloff_days: Number(cooloff) } : {}),
            }))}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
