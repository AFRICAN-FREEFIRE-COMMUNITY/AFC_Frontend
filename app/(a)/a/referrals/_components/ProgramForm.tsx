"use client";

/**
 * app/(a)/a/referrals/_components/ProgramForm.tsx
 * Create or edit a referral program (inbox #47; approved mockup screen 5). Head admins only (the page
 * sits in the admin layout, the nav entry is head_admin, and the backend refuses anyone else).
 *
 * Four sections: the program (name, text, dates in the admin's own time zone), who can refer
 * (everyone / countries or regions / teams / chosen players), what counts (the rule, an optional
 * event, an optional shared program code) and the prizes (any mix of milestones, top-referrer places
 * and welcome prizes; shop items and diamonds are picked from the live shop, never typed).
 *
 * The server validates every field and answers a code (afc_referrals/views.py _parse_program); the
 * form shows that code's sentence from messages/<loc>/referralsAdmin.json.
 * Callers: app/(a)/a/referrals/new/page.tsx, app/(a)/a/referrals/[slug]/edit/page.tsx.
 * Writes: POST / PATCH referrals/admin/programs/ via lib/referrals.ts referralsAdmin.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { countries as ALL_COUNTRIES, REGIONS_MAP } from "@/constants";
import { env } from "@/lib/env";
import { getBrowserTimeZone } from "@/lib/i18n/time";
import {
  errorCode,
  referralsAdmin,
  type AdminProgram,
  type CountRule,
  type PrizeInput,
  type PrizeKind,
  type PrizeType,
  type ProgramInput,
  type Scope,
} from "@/lib/referrals";

// ISO -> <input type="datetime-local"> in the admin's own time (the same pair the event check-in card
// uses, app/(a)/a/events/[slug]/edit/_components/CheckinSettingsCard.tsx), and back.
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

type Variant = { sku: string; label: string };
const SCOPES: Scope[] = ["everyone", "countries", "teams", "users"];
const RULES: CountRule[] = ["signup", "team", "event", "purchase"];
const TYPES: PrizeType[] = ["diamonds", "shop_item", "coupon", "cash", "custom"];

function Choice({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Tag({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-1 pl-3 text-sm">
      <b className="font-semibold">{label}</b>
      <button type="button" onClick={onRemove} aria-label={`${removeLabel} ${label}`} className="grid size-5 place-items-center rounded-full bg-background text-muted-foreground">
        &times;
      </button>
    </span>
  );
}

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    // A filled surface, no outline (design rule 2026-08-17; the approved mockup)
    <section className="space-y-4 rounded-xl bg-card p-5 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {help && <p className="mt-1 text-sm text-muted-foreground">{help}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, help, children }: { id?: string; label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

const selectClass = "h-10 w-full rounded-md bg-muted px-3 text-sm";

export function ProgramForm({ existing }: { existing?: AdminProgram }) {
  const t = useTranslations("referralsAdmin");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [form, setForm] = useState<ProgramInput>(() => ({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    starts_at: existing?.starts_at ?? "",
    ends_at: existing?.ends_at ?? "",
    is_published: existing?.is_published ?? false,
    scope: existing?.scope ?? "everyone",
    countries: existing?.countries ?? [],
    teams: existing?.teams ?? [],
    users: existing?.users ?? [],
    count_rule: existing?.count_rule ?? "signup",
    count_event: existing?.count_event?.slug ?? "",
    program_code: existing?.program_code ?? "",
    prizes: (existing?.prizes ?? []).map((p) => ({
      prize_id: p.prize_id,
      kind: p.kind,
      threshold: p.threshold,
      rank: p.rank,
      prize_type: p.prize_type,
      product_variant: p.product_variant,
      coupon_discount_type: p.coupon_discount_type ?? "percent",
      coupon_discount_value: p.coupon_discount_value,
      cash_amount: p.cash_amount,
      custom_text: p.custom_text,
    })),
  }));
  const [teamDraft, setTeamDraft] = useState("");
  const [userDraft, setUserDraft] = useState("");
  const set = <K extends keyof ProgramInput>(key: K, value: ProgramInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  // The live shop's sellable variants, for shop-item and diamond prizes (GET shop/view-active-products/)
  useEffect(() => {
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-active-products/`)
      .then((res) =>
        setVariants(
          (res.data?.products ?? []).flatMap((p: { name: string; variants?: { sku: string; title: string }[] }) =>
            (p.variants ?? []).map((v) => ({ sku: v.sku, label: v.title ? `${p.name}: ${v.title}` : p.name })),
          ),
        ),
      )
      .catch(() => setVariants([]));
  }, []);

  const regions = useMemo(() => Object.keys(REGIONS_MAP) as (keyof typeof REGIONS_MAP)[], []);

  const addCountryOrRegion = (value: string) => {
    if (!value) return;
    const add = value.startsWith("region:") ? REGIONS_MAP[value.slice(7) as keyof typeof REGIONS_MAP] ?? [] : [value];
    set("countries", Array.from(new Set([...form.countries, ...add])).sort());
  };
  const addName = (key: "teams" | "users", draft: string, clear: () => void) => {
    const name = draft.trim();
    if (!name || form[key].includes(name)) return clear();
    set(key, [...form[key], name]);
    clear();
  };

  const updatePrize = (i: number, patch: Partial<PrizeInput>) =>
    set("prizes", form.prizes.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addPrize = (kind: PrizeKind) =>
    set("prizes", [
      ...form.prizes,
      {
        kind,
        prize_type: kind === "welcome" ? "coupon" : "diamonds",
        threshold: kind === "milestone" ? 5 : null,
        rank: kind === "rank" ? form.prizes.filter((p) => p.kind === "rank").length + 1 : null,
        coupon_discount_type: "percent",
        coupon_discount_value: kind === "welcome" ? "10" : null,
      },
    ]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = existing ? await referralsAdmin.update(existing.slug, form) : await referralsAdmin.create(form);
      toast.success(t("form.saved"));
      router.push(`/a/referrals/${saved.slug}`);
    } catch (err) {
      const code = errorCode(err);
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Section title={t("form.sectionProgram")}>
        <Field id="ref-name" label={t("form.name")}>
          <Input id="ref-name" value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field id="ref-desc" label={t("form.description")} help={t("form.descriptionHelp")}>
          <Textarea id="ref-desc" value={form.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="ref-start" label={t("form.starts")} help={t("form.tzHelp", { tz: getBrowserTimeZone() })}>
            <Input id="ref-start" type="datetime-local" value={isoToLocalInput(form.starts_at)} onChange={(e) => set("starts_at", localInputToIso(e.target.value))} />
          </Field>
          <Field id="ref-end" label={t("form.ends")}>
            <Input id="ref-end" type="datetime-local" value={isoToLocalInput(form.ends_at)} onChange={(e) => set("ends_at", localInputToIso(e.target.value))} />
          </Field>
        </div>
      </Section>

      <Section title={t("form.sectionWho")}>
        <div className="flex flex-wrap gap-1.5">
          {SCOPES.map((s) => (
            <Choice key={s} on={form.scope === s} onClick={() => set("scope", s)}>
              {t(`scope.${s}`)}
            </Choice>
          ))}
        </div>
        {form.scope === "countries" && (
          <>
            <Field id="ref-country" label={t("form.addRegionOrCountry")} help={t("form.countryHelp")}>
              <select id="ref-country" className={selectClass} value="" onChange={(e) => addCountryOrRegion(e.target.value)}>
                <option value="">{t("form.pick")}</option>
                {regions.map((r) => (
                  <option key={r} value={`region:${r}`}>
                    {t("form.regionAdds", { region: r, count: REGIONS_MAP[r].length })}
                  </option>
                ))}
                {ALL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              {form.countries.map((c) => (
                <Tag key={c} label={c} removeLabel={t("form.remove")} onRemove={() => set("countries", form.countries.filter((x) => x !== c))} />
              ))}
            </div>
          </>
        )}
        {(form.scope === "teams" || form.scope === "users") && (
          <>
            <Field id="ref-names" label={form.scope === "teams" ? t("form.addTeam") : t("form.addPlayer")}>
              <div className="flex gap-2">
                <Input
                  id="ref-names"
                  value={form.scope === "teams" ? teamDraft : userDraft}
                  onChange={(e) => (form.scope === "teams" ? setTeamDraft(e.target.value) : setUserDraft(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (form.scope === "teams") addName("teams", teamDraft, () => setTeamDraft(""));
                    else addName("users", userDraft, () => setUserDraft(""));
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    form.scope === "teams" ? addName("teams", teamDraft, () => setTeamDraft("")) : addName("users", userDraft, () => setUserDraft(""))
                  }
                >
                  {t("form.add")}
                </Button>
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              {(form.scope === "teams" ? form.teams : form.users).map((n) => (
                <Tag
                  key={n}
                  label={n}
                  removeLabel={t("form.remove")}
                  onRemove={() =>
                    form.scope === "teams" ? set("teams", form.teams.filter((x) => x !== n)) : set("users", form.users.filter((x) => x !== n))
                  }
                />
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title={t("form.sectionCounts")}>
        <div className="flex flex-wrap gap-1.5">
          {RULES.map((r) => (
            <Choice key={r} on={form.count_rule === r} onClick={() => set("count_rule", r)}>
              {t(`ruleShort.${r}`)}
            </Choice>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="ref-code" label={t("form.programCode")} help={t("form.programCodeHelp")}>
            <Input
              id="ref-code"
              className="font-mono"
              value={form.program_code}
              maxLength={20}
              onChange={(e) => set("program_code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
          </Field>
          {form.count_rule === "event" && (
            <Field id="ref-event" label={t("form.event")} help={t("form.eventHelp")}>
              <Input id="ref-event" value={form.count_event} onChange={(e) => set("count_event", e.target.value.trim())} />
            </Field>
          )}
        </div>
      </Section>

      <Section title={t("form.sectionPrizes")} help={t("form.prizesHelp")}>
        {form.prizes.length === 0 && <p className="text-sm text-muted-foreground">{t("form.noPrizes")}</p>}
        {form.prizes.map((prize, i) => (
          <div key={prize.prize_id ?? `new-${i}`} className="grid gap-3 rounded-lg bg-muted p-3 md:grid-cols-[150px_110px_minmax(0,1fr)_auto] md:items-end">
            <Field label={t("form.prizeWhen")}>
              <p className="flex h-10 items-center rounded-md bg-background px-3 text-sm">{t(`kind.${prize.kind}`)}</p>
            </Field>
            <Field id={`prize-n-${i}`} label={prize.kind === "rank" ? t("form.position") : prize.kind === "milestone" ? t("form.count") : " "}>
              {prize.kind === "welcome" ? (
                <p className="flex h-10 items-center rounded-md bg-background px-3 text-sm text-muted-foreground">{t("form.each")}</p>
              ) : (
                <Input
                  id={`prize-n-${i}`}
                  type="number"
                  min={1}
                  className="bg-background"
                  value={(prize.kind === "rank" ? prize.rank : prize.threshold) ?? ""}
                  onChange={(e) =>
                    updatePrize(i, prize.kind === "rank" ? { rank: Number(e.target.value) || null } : { threshold: Number(e.target.value) || null })
                  }
                />
              )}
            </Field>
            <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
              <Field id={`prize-t-${i}`} label={t("form.prize")}>
                <select
                  id={`prize-t-${i}`}
                  className={`${selectClass} bg-background`}
                  value={prize.prize_type}
                  onChange={(e) => updatePrize(i, { prize_type: e.target.value as PrizeType })}
                >
                  {TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`type.${ty}`)}
                    </option>
                  ))}
                </select>
              </Field>
              {prize.prize_type === "diamonds" || prize.prize_type === "shop_item" ? (
                <Field id={`prize-v-${i}`} label={t("form.shopItem")}>
                  <select
                    id={`prize-v-${i}`}
                    className={`${selectClass} bg-background`}
                    value={prize.product_variant ?? ""}
                    onChange={(e) => updatePrize(i, { product_variant: e.target.value })}
                  >
                    <option value="">{t("form.pick")}</option>
                    {variants.map((v) => (
                      <option key={v.sku} value={v.sku}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : prize.prize_type === "coupon" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field id={`prize-ck-${i}`} label={t("form.couponKind")}>
                    <select
                      id={`prize-ck-${i}`}
                      className={`${selectClass} bg-background`}
                      value={prize.coupon_discount_type ?? "percent"}
                      onChange={(e) => updatePrize(i, { coupon_discount_type: e.target.value as "percent" | "fixed" })}
                    >
                      <option value="percent">{t("form.couponPercent")}</option>
                      <option value="fixed">{t("form.couponFixed")}</option>
                    </select>
                  </Field>
                  <Field id={`prize-cv-${i}`} label={t("form.couponValue")}>
                    <Input
                      id={`prize-cv-${i}`}
                      inputMode="decimal"
                      className="bg-background"
                      value={prize.coupon_discount_value ?? ""}
                      onChange={(e) => updatePrize(i, { coupon_discount_value: e.target.value })}
                    />
                  </Field>
                </div>
              ) : prize.prize_type === "cash" ? (
                <Field id={`prize-c-${i}`} label={t("form.cashAmount")}>
                  <Input
                    id={`prize-c-${i}`}
                    inputMode="decimal"
                    className="bg-background"
                    value={prize.cash_amount ?? ""}
                    onChange={(e) => updatePrize(i, { cash_amount: e.target.value })}
                  />
                </Field>
              ) : (
                <Field id={`prize-x-${i}`} label={t("form.customText")}>
                  <Input
                    id={`prize-x-${i}`}
                    maxLength={200}
                    className="bg-background"
                    value={prize.custom_text ?? ""}
                    onChange={(e) => updatePrize(i, { custom_text: e.target.value })}
                  />
                </Field>
              )}
            </div>
            <Button type="button" size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => set("prizes", form.prizes.filter((_, j) => j !== i))}>
              {t("form.remove")}
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => addPrize("milestone")}>
            {t("form.addMilestone")}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => addPrize("rank")}>
            {t("form.addRank")}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => addPrize("welcome")}>
            {t("form.addWelcome")}
          </Button>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 md:p-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => set("is_published", e.target.checked)} className="size-4" />
            {t("form.publish")}
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              {t("form.cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t("form.saving") : t("form.save")}
            </Button>
          </div>
      </div>
    </div>
  );
}
