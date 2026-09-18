"use client";

// ── Admin · Wagers · Settings tab (head_admin) ───────────────────────────────────────────────
// The one WagerSettings row. The kill switch stops new stakes at once (open markets stay
// visible, cancels and withdrawals keep working); the rates and minimums are the defaults a
// new market copies; the thresholds decide when a second admin has to co-sign; the default
// caps apply to any player who set none. Reads GET / writes PATCH /wagers/admin/settings/,
// sending only the fields the server names (EDITABLE_FIELDS), never the whole object.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAdminSettings, saveAdminSettings, type WagerSettings } from "@/lib/api/wagersAdmin";

import { bpsToPercentInput, koboToNairaInput, nairaInputToKobo, Panel, percentInputToBps, useAdminRefusal } from "./shared";

type Form = {
  wagering_enabled: boolean; maintenance_message: string;
  rake: string; cancelFee: string; minStake: string; maxStakePerUser: string; maxPool: string;
  paymentExpiry: string; minWithdrawal: string; cosignThreshold: string; minAge: string;
  dailyCap: string; weeklyCap: string; lossCap: string;
};

const toForm = (s: WagerSettings): Form => ({
  wagering_enabled: s.wagering_enabled,
  maintenance_message: s.maintenance_message,
  rake: bpsToPercentInput(s.rake_bps),
  cancelFee: bpsToPercentInput(s.cancel_fee_bps),
  minStake: koboToNairaInput(s.min_stake_kobo),
  maxStakePerUser: koboToNairaInput(s.max_stake_per_user_kobo),
  maxPool: koboToNairaInput(s.max_pool_kobo),
  paymentExpiry: String(s.payment_expiry_minutes),
  minWithdrawal: koboToNairaInput(s.min_withdrawal_kobo),
  cosignThreshold: koboToNairaInput(s.cosign_threshold_kobo),
  minAge: String(s.min_age),
  dailyCap: koboToNairaInput(s.default_daily_stake_cap_kobo),
  weeklyCap: koboToNairaInput(s.default_weekly_stake_cap_kobo),
  lossCap: koboToNairaInput(s.default_daily_loss_cap_kobo),
});

const toPatch = (f: Form): Partial<WagerSettings> => ({
  wagering_enabled: f.wagering_enabled,
  maintenance_message: f.maintenance_message,
  rake_bps: percentInputToBps(f.rake),
  cancel_fee_bps: percentInputToBps(f.cancelFee),
  min_stake_kobo: nairaInputToKobo(f.minStake),
  max_stake_per_user_kobo: nairaInputToKobo(f.maxStakePerUser),
  max_pool_kobo: nairaInputToKobo(f.maxPool),
  payment_expiry_minutes: Number(f.paymentExpiry) || 0,
  min_withdrawal_kobo: nairaInputToKobo(f.minWithdrawal),
  cosign_threshold_kobo: nairaInputToKobo(f.cosignThreshold),
  min_age: Number(f.minAge) || 0,
  default_daily_stake_cap_kobo: nairaInputToKobo(f.dailyCap),
  default_weekly_stake_cap_kobo: nairaInputToKobo(f.weeklyCap),
  default_daily_loss_cap_kobo: nairaInputToKobo(f.lossCap),
});

export function SettingsTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [settings, setSettings] = useState<WagerSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminSettings().then((s) => { setSettings(s); setForm(toForm(s)); }).catch(refuse);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form || !settings) return <Skeleton className="h-64 w-full" />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const num = (k: keyof Form, allowDecimal = false) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, e.target.value.replace(allowDecimal ? /[^\d.]/g : /\D/g, "") as Form[typeof k]);

  const save = async () => {
    setBusy(true);
    try {
      const out = await saveAdminSettings(toPatch(form));
      toast.success(out.message);
      setSettings(out.settings);
      setForm(toForm(out.settings));
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t("settings.switchTitle")}>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={form.wagering_enabled} onCheckedChange={(v) => set("wagering_enabled", v)} />
          <span>{form.wagering_enabled ? t("settings.enabledOn") : t("settings.enabledOff")}</span>
        </label>
        <p className="text-muted-foreground text-xs">{t("settings.switchHint")}</p>
        <div className="flex flex-col gap-1">
          <Label>{t("settings.maintenance")}</Label>
          <Textarea rows={2} value={form.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)} placeholder={t("settings.maintenancePlaceholder")} />
        </div>
      </Panel>

      <Panel title={t("settings.defaultsTitle")}>
        <p className="text-muted-foreground text-xs">{t("settings.defaultsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsField value={form.rake} onChange={num("rake", true)} label={t("settings.rake")} hint={t("settings.rakeHint")} />
          <SettingsField value={form.cancelFee} onChange={num("cancelFee", true)} label={t("settings.cancelFee")} hint={t("settings.cancelFeeHint")} />
          <SettingsField value={form.minStake} onChange={num("minStake")} label={t("settings.minStake")} />
          <SettingsField value={form.maxStakePerUser} onChange={num("maxStakePerUser")} label={t("settings.maxStakePerUser")} hint={t("settings.zeroMeansNone")} />
          <SettingsField value={form.maxPool} onChange={num("maxPool")} label={t("settings.maxPool")} hint={t("settings.zeroMeansNone")} />
          <SettingsField value={form.paymentExpiry} onChange={num("paymentExpiry")} label={t("settings.paymentExpiry")} hint={t("settings.paymentExpiryHint")} />
        </div>
      </Panel>

      <Panel title={t("settings.moneyTitle")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsField value={form.minWithdrawal} onChange={num("minWithdrawal")} label={t("settings.minWithdrawal")} />
          <SettingsField value={form.cosignThreshold} onChange={num("cosignThreshold")} label={t("settings.cosignThreshold")} hint={t("settings.cosignHint")} />
          <SettingsField value={form.minAge} onChange={num("minAge")} label={t("settings.minAge")} />
        </div>
      </Panel>

      <Panel title={t("settings.capsTitle")}>
        <p className="text-muted-foreground text-xs">{t("settings.capsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsField value={form.dailyCap} onChange={num("dailyCap")} label={t("settings.dailyCap")} hint={t("settings.zeroMeansNone")} />
          <SettingsField value={form.weeklyCap} onChange={num("weeklyCap")} label={t("settings.weeklyCap")} hint={t("settings.zeroMeansNone")} />
          <SettingsField value={form.lossCap} onChange={num("lossCap")} label={t("settings.lossCap")} hint={t("settings.zeroMeansNone")} />
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {settings.updated_at ? <>{t("settings.updated")} <LocalTime value={settings.updated_at} mode="datetime" /></> : null}
        </p>
        <Button onClick={() => void save()} disabled={busy}>{t("common.save")}</Button>
      </div>
    </div>
  );
}

function SettingsField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={value} onChange={onChange} />
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}
