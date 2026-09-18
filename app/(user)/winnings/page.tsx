"use client";

/**
 * app/(user)/winnings/page.tsx - what AFC owes the player, and the controls around it.
 *
 * NOT A WALLET (owner 2026-09-18, inbox #33): nothing is paid in here. Payouts and refunds land
 * in this balance; the only way out is a withdrawal to a bank account the bank itself confirmed.
 * Five tabs: Overview, Withdraw, History (the ledger with the true balance after every line),
 * Limits (stake caps, cool-off, self-exclusion), Verify (KYC-Lite on the profile's WhatsApp
 * number and the connected Discord).
 *
 * TALKS TO lib/api/wagers.ts: getWinnings, getLedger, listBanks, addBankAccount,
 * requestWithdrawal, cancelWithdrawal, setLimits, setCooloff, setSelfExclusion,
 * startWhatsAppKyc, verifyWhatsAppKyc.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NeedsAccount } from "@/components/NeedsAccount";
import { NewBadge } from "@/components/NewBadge";
import { LocalTime } from "@/components/LocalTime";
import { formatLocalTime } from "@/lib/i18n/time";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/lib/gating";
import { getErrorMessage } from "@/lib/http";
import {
  addBankAccount, cancelWithdrawal, getLedger, getWinnings, listBanks, naira, nairaToKobo, refusalOf,
  requestWithdrawal, setCooloff, setLimits, setSelfExclusion, startWhatsAppKyc, verifyWhatsAppKyc,
  type LedgerEntry, type Limits, type Winnings,
} from "@/lib/api/wagers";

type Tab = "overview" | "withdraw" | "history" | "limits" | "verify";
const TABS: Tab[] = ["overview", "withdraw", "history", "limits", "verify"];

function useRefusalToast() {
  const t = useTranslations("winnings");
  return (err: unknown) => {
    const refusal = refusalOf(err);
    const key = refusal?.code ? `errors.${refusal.code}` : "";
    toast.error(key && t.has(key) ? t(key) : getErrorMessage(err, t("errors.generic")));
  };
}

function WinningsPageInner() {
  const t = useTranslations("winnings");
  const search = useSearchParams();
  const { loading: sessionLoading, signedIn } = useViewer();
  const initial = (search.get("tab") as Tab) || "overview";
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : "overview");
  const [data, setData] = useState<Winnings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getWinnings());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, t("errors.generic")));
    }
  }, [t]);

  useEffect(() => {
    if (!sessionLoading && signedIn) void load();
  }, [load, sessionLoading, signedIn]);

  return (
    <div className="container py-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2">{t("title")}<NewBadge since="2026-09-18" /></span>}
        description={t("subtitle")}
      />
      {!sessionLoading && !signedIn ? (
        <NeedsAccount action={t("title").toLowerCase()} />
      ) : !data ? (
        error ? <p className="text-muted-foreground text-sm">{error}</p> : <Skeleton className="h-40 rounded-md" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="w-full max-w-2xl">
            {TABS.map((k) => (
              <TabsTrigger key={k} value={k}>{t(`tabs.${k}`)}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview" className="mt-4"><Overview data={data} onChange={load} goto={setTab} /></TabsContent>
          <TabsContent value="withdraw" className="mt-4"><Withdraw data={data} onChange={load} goto={setTab} /></TabsContent>
          <TabsContent value="history" className="mt-4"><History /></TabsContent>
          <TabsContent value="limits" className="mt-4"><LimitsTab limits={data.limits} onChange={load} /></TabsContent>
          <TabsContent value="verify" className="mt-4"><Verify data={data} onChange={load} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────────────────────
function Overview({ data, onChange, goto }: { data: Winnings; onChange: () => void; goto: (t: Tab) => void }) {
  const t = useTranslations("winnings");
  const a = data.account;
  return (
    <div className="flex flex-col gap-4">
      {a.frozen && <div className="bg-destructive/15 rounded-md px-4 py-3 text-sm">{t("overview.frozen", { reason: a.frozen_reason })}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-card rounded-md p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">{t("overview.balance")}</p>
          <p className="text-primary mt-1 text-3xl font-bold">{naira(a.balance_kobo)}</p>
        </div>
        <div className="bg-card rounded-md p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">{t("overview.available")}</p>
          <p className="mt-1 text-2xl font-bold">{naira(a.available_kobo)}</p>
        </div>
        <div className="bg-card rounded-md p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">{t("overview.held")}</p>
          <p className="mt-1 text-2xl font-bold">{naira(a.held_kobo)}</p>
        </div>
      </div>
      {!data.kyc.tier_lite && (
        <div className="bg-muted flex flex-wrap items-center justify-between gap-2 rounded-md px-4 py-3 text-sm">
          <span>{t("overview.verifyNudge")}</span>
          <Button size="sm" onClick={() => goto("verify")}>{t("overview.verifyLink")}</Button>
        </div>
      )}
      {a.pending_withdrawal && <PendingWithdrawal w={a.pending_withdrawal} onChange={onChange} />}
      <div className="bg-card rounded-md p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("overview.recent")}</h2>
          <Button variant="secondary" size="sm" onClick={() => goto("history")}>{t("overview.seeAll")}</Button>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">{t("overview.empty")}</p>
        ) : (
          <LedgerRows rows={data.recent} />
        )}
      </div>
    </div>
  );
}

function PendingWithdrawal({ w, onChange }: { w: NonNullable<Winnings["account"]["pending_withdrawal"]>; onChange: () => void }) {
  const t = useTranslations("winnings");
  const refuse = useRefusalToast();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    try {
      const out = await cancelWithdrawal(w.token);
      toast.success(t("withdraw.cancelled") || out.message);
      onChange();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bg-card rounded-md p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs">{t("overview.pending")}</p>
          <p className="text-lg font-semibold">{naira(w.amount_kobo)}</p>
          <p className="text-muted-foreground text-xs">{t("withdraw.to", { bank: w.bank.bank_name, number: w.bank.account_number_masked })}</p>
        </div>
        <Badge variant="pending">{t(`withdraw.status.${w.status}`)}</Badge>
      </div>
      {(w.status === "REQUESTED" || w.status === "PENDING_COSIGN") && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void cancel()} disabled={busy}>{t("withdraw.cancel")}</Button>
      )}
    </div>
  );
}

function LedgerRows({ rows }: { rows: LedgerEntry[] }) {
  const t = useTranslations("winnings");
  return (
    <div className="mt-3 flex flex-col">
      {rows.map((e, i) => {
        // A hold or release moves nothing in or out (amount 0): it only parks part of the balance,
        // so it reads "Held" / "Released", never "+" which would look like money arriving.
        const isHold = e.amount_kobo === 0;
        const sign = e.amount_kobo > 0 ? "+" : e.amount_kobo < 0 ? "-" : "";
        const shown = isHold
          ? t(e.held_delta_kobo >= 0 ? "history.held" : "history.released", { amount: naira(Math.abs(e.held_delta_kobo)) })
          : `${sign}${naira(Math.abs(e.amount_kobo))}`;
        return (
          <div key={e.id} className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${i % 2 ? "bg-muted/40" : ""}`}>
            <div className="min-w-0">
              <p className="font-medium">{t.has(`history.kind.${e.kind}`) ? t(`history.kind.${e.kind}`) : e.kind}</p>
              <p className="text-muted-foreground truncate text-xs">
                {[e.label, e.reason].filter(Boolean).join(" · ")}
                <span className={e.label || e.reason ? "ml-2" : ""}><LocalTime value={e.created_at} mode="datetime" /></span>
              </p>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${e.amount_kobo > 0 ? "text-primary" : isHold ? "text-muted-foreground" : ""}`}>{shown}</p>
              <p className="text-muted-foreground text-[11px]">{t("history.balanceAfter")} {naira(e.balance_after_kobo)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Withdraw ──────────────────────────────────────────────────────────────────────────────────
function Withdraw({ data, onChange, goto }: { data: Winnings; onChange: () => void; goto: (t: Tab) => void }) {
  const t = useTranslations("winnings");
  const refuse = useRefusalToast();
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState<string>(data.bank_accounts.find((b) => b.is_default)?.id.toString() || "");
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [number, setNumber] = useState("");
  const [adding, setAdding] = useState(data.bank_accounts.length === 0);
  const [busy, setBusy] = useState(false);
  const kobo = nairaToKobo(amount);
  const a = data.account;

  useEffect(() => {
    if (adding && banks.length === 0) listBanks().then(setBanks).catch(() => setBanks([]));
  }, [adding, banks.length]);

  if (!data.kyc.tier_lite) {
    return (
      <div className="bg-card rounded-md p-4 shadow-sm">
        <p className="text-sm">{t("withdraw.locked")}</p>
        <Button className="mt-3" onClick={() => goto("verify")}>{t("withdraw.goVerify")}</Button>
      </div>
    );
  }

  const confirmAccount = async () => {
    setBusy(true);
    try {
      const out = await addBankAccount(bankCode, number);
      toast.success(t("withdraw.accountConfirmed", { name: out.bank_account.account_name }));
      setBankId(out.bank_account.id.toString());
      setAdding(false);
      setBankCode("");
      setNumber("");
      onChange();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await requestWithdrawal(kobo, Number(bankId));
      toast.success(t("withdraw.requested"));
      setAmount("");
      onChange();
      goto("overview");
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm">
        <h2 className="font-semibold">{t("withdraw.title")}</h2>
        <p className="text-muted-foreground text-xs">{t("withdraw.intro", { min: naira(data.min_withdrawal_kobo) })}</p>
        {a.pending_withdrawal ? (
          <p className="text-sm">{t("errors.withdrawal_in_progress")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wd-amount">{t("withdraw.amount")}</Label>
              <div className="flex gap-2">
                <Input id="wd-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                <Button variant="secondary" onClick={() => setAmount(String(Math.floor(a.available_kobo / 100)))}>{t("withdraw.all")}</Button>
              </div>
              <p className="text-muted-foreground text-xs">{t("withdraw.available", { amount: naira(a.available_kobo) })}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("withdraw.bankAccount")}</Label>
              {data.bank_accounts.length === 0 && <p className="text-muted-foreground text-xs">{t("withdraw.none")}</p>}
              {data.bank_accounts.length > 0 && (
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={t("withdraw.bankAccount")} /></SelectTrigger>
                  <SelectContent>
                    {data.bank_accounts.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>{b.bank_name} {b.account_number_masked} · {b.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!adding && <Button variant="secondary" size="sm" className="self-start" onClick={() => setAdding(true)}>{t("withdraw.addAccount")}</Button>}
            </div>
            <Button disabled={busy || kobo < data.min_withdrawal_kobo || kobo > a.available_kobo || !bankId} onClick={() => void submit()}>
              {t("withdraw.submit", { amount: naira(kobo) })}
            </Button>
          </>
        )}
      </div>
      {adding && (
        <div className="bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm">
          <h2 className="font-semibold">{t("withdraw.addAccount")}</h2>
          <p className="text-muted-foreground text-xs">{t("withdraw.noAccounts")}</p>
          <div className="flex flex-col gap-1">
            <Label>{t("withdraw.bank")}</Label>
            <Select value={bankCode} onValueChange={setBankCode}>
              <SelectTrigger><SelectValue placeholder={t("withdraw.pickBank")} /></SelectTrigger>
              <SelectContent>
                {banks.map((b) => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="wd-number">{t("withdraw.accountNumber")}</Label>
            <Input id="wd-number" inputMode="numeric" maxLength={10} value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button disabled={busy || !bankCode || number.length !== 10} onClick={() => void confirmAccount()}>{t("withdraw.confirmAccount")}</Button>
        </div>
      )}
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────────────────────
function History() {
  const t = useTranslations("winnings");
  const [rows, setRows] = useState<LedgerEntry[] | null>(null);
  const [kind, setKind] = useState("all");
  const [next, setNext] = useState<number | null>(null);
  const kinds = ["PAYOUT", "VOID_REFUND", "CANCEL_REFUND", "WITHDRAWAL_HOLD", "WITHDRAWAL_PAID", "WITHDRAWAL_RELEASED", "ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT"];

  const load = useCallback(async (offset = 0) => {
    try {
      const data = await getLedger({ kind: kind === "all" ? undefined : kind, limit: 25, offset });
      setRows((prev) => (offset && prev ? [...prev, ...data.results] : data.results));
      setNext(data.next_offset);
    } catch {
      setRows([]);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="bg-card rounded-md p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("history.title")}</h2>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.allKinds")}</SelectItem>
            {kinds.map((k) => <SelectItem key={k} value={k}>{t(`history.kind.${k}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {rows === null ? <Skeleton className="mt-3 h-24" /> : rows.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">{t("history.empty")}</p>
      ) : (
        <>
          <LedgerRows rows={rows} />
          {next !== null && <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load(next)}>{t("history.loadMore")}</Button>}
        </>
      )}
    </div>
  );
}

// ── Limits ────────────────────────────────────────────────────────────────────────────────────
function LimitsTab({ limits, onChange }: { limits: Limits; onChange: () => void }) {
  const t = useTranslations("winnings");
  const locale = useLocale();
  const refuse = useRefusalToast();
  const toNaira = (kobo: number) => (kobo ? String(Math.floor(kobo / 100)) : "");
  const [daily, setDaily] = useState(toNaira(limits.daily_stake_cap_kobo));
  const [weekly, setWeekly] = useState(toNaira(limits.weekly_stake_cap_kobo));
  const [loss, setLoss] = useState(toNaira(limits.daily_loss_cap_kobo));
  const [days, setDays] = useState("7");
  const [months, setMonths] = useState("6");
  const [confirmExclude, setConfirmExclude] = useState(false);
  const [busy, setBusy] = useState(false);
  // `done` is a string, or a function of the server's answer when the toast quotes it (the date
  // a break or an exclusion ends), formatted in the viewer's zone through the datetime module.
  const run = async (fn: () => Promise<{ limits: Limits }>, done: string | ((out: { limits: Limits }) => string)) => {
    setBusy(true);
    try {
      const out = await fn();
      toast.success(typeof done === "string" ? done : done(out));
      onChange();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };
  const pending = (field: keyof Limits["pending"]) => limits.pending[field] as number | null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm">
        <h2 className="font-semibold">{t("limits.title")}</h2>
        <p className="text-muted-foreground text-xs">{t("limits.intro")}</p>
        {([["daily", daily, setDaily, "daily_stake_cap_kobo"], ["weekly", weekly, setWeekly, "weekly_stake_cap_kobo"], ["loss", loss, setLoss, "daily_loss_cap_kobo"]] as const).map(([key, value, set, field]) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`lim-${key}`}>{t(`limits.${key}`)}</Label>
            <Input id={`lim-${key}`} inputMode="numeric" placeholder={t("limits.none")} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} />
            {pending(field) !== null && limits.pending.effective_at && (
              <p className="text-muted-foreground text-xs">{t.rich("limits.pendingAt", { amount: naira(pending(field) as number), time: () => <LocalTime value={limits.pending.effective_at} mode="datetime" /> })}</p>
            )}
          </div>
        ))}
        <Button disabled={busy} onClick={() => void run(() => setLimits({
          daily_stake_cap_kobo: nairaToKobo(daily), weekly_stake_cap_kobo: nairaToKobo(weekly), daily_loss_cap_kobo: nairaToKobo(loss),
        }), t("limits.saved"))}>{t("limits.save")}</Button>
      </div>
      <div className="flex flex-col gap-4">
        <div className="bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm">
          <h2 className="font-semibold">{t("limits.cooloff")}</h2>
          <p className="text-muted-foreground text-xs">{t("limits.cooloffIntro")}</p>
          {limits.cooloff_until && new Date(limits.cooloff_until) > new Date() && (
            <p className="text-sm">{t.rich("limits.cooloffActive", { time: () => <LocalTime value={limits.cooloff_until} mode="datetime" /> })}</p>
          )}
          <div className="flex gap-2">
            <Input inputMode="numeric" aria-label={t("limits.cooloffDays")} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} className="w-28" />
            <Button variant="secondary" disabled={busy} onClick={() => void run(() => setCooloff(Number(days)), (out) => t("limits.cooloffSet", { time: formatLocalTime(out.limits.cooloff_until, "datetime", locale) }))}>{t("limits.cooloff")}</Button>
          </div>
        </div>
        <div className="bg-card flex flex-col gap-3 rounded-md p-4 shadow-sm">
          <h2 className="font-semibold">{t("limits.exclude")}</h2>
          <p className="text-muted-foreground text-xs">{t("limits.excludeIntro")}</p>
          {limits.self_excluded_until && new Date(limits.self_excluded_until) > new Date() && (
            <p className="text-sm">{t.rich("limits.excludeActive", { time: () => <LocalTime value={limits.self_excluded_until} mode="date" /> })}</p>
          )}
          <div className="flex gap-2">
            <Input inputMode="numeric" aria-label={t("limits.excludeMonths")} value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))} className="w-28" />
            <Button variant="destructive" disabled={busy} onClick={() => setConfirmExclude(true)}>{t("limits.exclude")}</Button>
          </div>
          <p className="text-muted-foreground text-xs">{t("limits.help")}</p>
        </div>
      </div>
      <AlertDialog open={confirmExclude} onOpenChange={setConfirmExclude}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("limits.excludeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("limits.excludeConfirmBody", { months })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("limits.excludeKeep")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void run(() => setSelfExclusion(Number(months)), (out) => t("limits.excludeSet", { time: formatLocalTime(out.limits.self_excluded_until, "date", locale) }))}>{t("limits.excludeConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Verify ────────────────────────────────────────────────────────────────────────────────────
// Module-level on purpose: defined inside Verify it would be a new component type on every render,
// so React would remount the row (and its code input, losing focus and the typed digits) on each
// keystroke and each toast.
function VerifyRow({ title, ok, children }: { title: string; ok: boolean; children: React.ReactNode }) {
  const t = useTranslations("winnings");
  return (
    <div className="bg-card flex flex-col gap-2 rounded-md p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant={ok ? "default" : "pending"}>{ok ? t("verify.stepDone") : t("verify.stepTodo")}</Badge>
      </div>
      {children}
    </div>
  );
}

function Verify({ data, onChange }: { data: Winnings; onChange: () => void }) {
  const t = useTranslations("winnings");
  const refuse = useRefusalToast();
  const k = data.kyc;
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const out = await startWhatsAppKyc();
      setChallenge(out.challenge_token);
      toast.success(out.sent ? t("verify.codeSent", { destination: out.destination }) : t("verify.codeAlready"));
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!challenge) return;
    setBusy(true);
    try {
      await verifyWhatsAppKyc(challenge, code);
      toast.success(t("verify.confirmed"));
      setChallenge(null);
      setCode("");
      onChange();
    } catch (err) {
      const refusal = refusalOf(err);
      if (refusal?.code?.startsWith("kyc_code_")) toast.error(t("verify.wrongCode"));
      else refuse(err);
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{k.tier_lite ? t("verify.done") : t("verify.intro")}</p>
      <VerifyRow title={t("verify.age")} ok={k.age_ok}>
        <p className="text-sm">{k.age_ok ? t("verify.ageOk", { min: k.min_age }) : k.date_of_birth_on_file ? t("verify.ageUnder", { min: k.min_age }) : t("verify.ageMissing")}</p>
        {!k.date_of_birth_on_file && <Button asChild variant="secondary" size="sm" className="self-start"><Link href="/profile">{t("verify.profile")}</Link></Button>}
      </VerifyRow>
      <VerifyRow title={t("verify.whatsapp")} ok={k.whatsapp_verified}>
        {k.whatsapp_verified ? (
          <p className="text-sm">{t("verify.whatsappConfirmed", { number: k.whatsapp_number })}</p>
        ) : !k.whatsapp_number ? (
          <>
            <p className="text-sm">{t("verify.whatsappMissing")}</p>
            <Button asChild variant="secondary" size="sm" className="self-start"><Link href="/profile">{t("verify.profile")}</Link></Button>
          </>
        ) : (
          <>
            <p className="text-sm">{t("verify.whatsappUnconfirmed", { number: k.whatsapp_number })}</p>
            {!challenge ? (
              <Button size="sm" className="self-start" disabled={busy} onClick={() => void send()}>{t("verify.sendCode")}</Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Input inputMode="numeric" maxLength={6} aria-label={t("verify.code")} placeholder={t("verify.code")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-36" />
                <Button size="sm" disabled={busy || code.length !== 6} onClick={() => void confirm()}>{t("verify.confirm")}</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void send()}>{t("verify.sendCode")}</Button>
              </div>
            )}
            <p className="text-muted-foreground text-xs">{t("verify.changeNumber")}</p>
          </>
        )}
      </VerifyRow>
      <VerifyRow title={t("verify.discord")} ok={k.discord_linked}>
        {k.discord_linked ? (
          <p className="text-sm">{t("verify.discordLinked")}</p>
        ) : (
          <>
            <p className="text-sm">{t("verify.discordMissing")}</p>
            <Button asChild variant="secondary" size="sm" className="self-start"><Link href="/profile">{t("verify.connectDiscord")}</Link></Button>
          </>
        )}
      </VerifyRow>
    </div>
  );
}

export default function WinningsPage() {
  return (
    <Suspense>
      <WinningsPageInner />
    </Suspense>
  );
}
