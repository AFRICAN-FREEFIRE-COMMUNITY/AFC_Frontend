"use client";

/**
 * StartOrganization - the /organizations/start flow (open organizations, owner 16 Nov 2026, AFC inbox #582 #583;
 * approved mockup mockups/organizer-dashboard/mockup.src.html, startView).
 *
 * Four screens, as approved: a landing anyone can read (what hosting on AFC gives you, every tool free), step 1 (name
 * with a live check, the page address it will get, an optional logo, the main country), step 2 (about, contact email,
 * Instagram and Discord links, the organizer rules agreement, the bot check), and done (three first moves and the way
 * to the dashboard).
 *
 * HOW IT CONNECTS
 *   - AFC-B organizers/start/check-name/ (as the name is typed, 400 ms after the last key) and organizers/start/
 *     (multipart), both in afc_organizers/views_start.py, through lib/organizers.ts. The server is the authority on
 *     every rule (reserved names, taken names, limits, the bot check); this screen only says what it answered, in the
 *     viewer's language, through useServerMessage (serverMessages namespace).
 *   - The new organization is Community (AFC-B afc_organizers/badges.py): every tool works the same, its results do
 *     not count for the rankings until AFC gives the Verified tick.
 *   - After the start: AuthContext.refreshUser() (the account now holds the organizer role) and the organizer
 *     dashboard's selected organization (localStorage "organizer:selected-slug", the key
 *     app/(organizer)/organizer/layout.tsx reads) is the new one.
 *   - Signed out, the start button is <NeedsAccount> (R26): one sentence and a sign-in link back here.
 * Strings: orgStart (en/fr/pt). Countries: ISO 3166 codes, names from the browser in the viewer's language.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCheck,
  IconDeviceTv,
  IconPhotoScan,
  IconRosetteDiscountCheck,
  IconUsers,
} from "@tabler/icons-react";

import { BotCheck, type BotCheckHandle } from "@/components/BotCheck";
import { NeedsAccount } from "@/components/NeedsAccount";
import { NewBadge } from "@/components/NewBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useServerMessage } from "@/lib/i18n/serverMessage";
import { organizersApi } from "@/lib/organizers";
import { cn } from "@/lib/utils";

// The day this page goes live, for its NEW tag (owner rule: 5 days, date driven).
export const ORG_START_SINCE = "2026-11-21";
// AFC is African first: the 54 African countries, in ISO 3166 alpha-2. The server accepts any real code.
const COUNTRIES = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ",
  "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE",
  "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
];
const SELECTED_ORG_KEY = "organizer:selected-slug";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const FIELD = "bg-muted/40 border-0";

type NameState = { state: "idle" | "checking" | "ok" | "bad"; slug?: string; message?: string };

export function StartOrganization() {
  const t = useTranslations("orgStart");
  const serverMessage = useServerMessage();
  const locale = useLocale();
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [name, setName] = useState("");
  const [check, setCheck] = useState<NameState>({ state: "idle" });
  const [country, setCountry] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [about, setAbout] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [discord, setDiscord] = useState("");
  const [agree, setAgree] = useState(false);
  const [botToken, setBotToken] = useState("");
  const botRef = useRef<BotCheckHandle>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null);

  const countryNames = useMemo(() => {
    const dn = typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames([locale], { type: "region" })
      : null;
    return COUNTRIES.map((c) => ({ code: c, label: dn?.of(c) || c })).sort((a, b) =>
      a.label.localeCompare(b.label, locale),
    );
  }, [locale]);

  // ── the live name check: 400 ms after the last key, the server says free / reserved / taken ──
  useEffect(() => {
    const value = name.trim();
    if (!value) {
      setCheck({ state: "idle" });
      return;
    }
    setCheck({ state: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await organizersApi.startCheckName(value);
        setCheck(res.ok ? { state: "ok", slug: res.slug } : { state: "bad", message: serverMessage(res, t("failed")) });
      } catch (err: any) {
        setCheck({ state: "bad", message: serverMessage(err?.response?.data, t("failed")) });
      }
    }, 400);
    return () => clearTimeout(timer);
    // serverMessage and t are stable for a given locale; re-running on them would re-check on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const initials = (name.trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2) || "?").toUpperCase();
  const step1Ready = check.state === "ok" && !!country;

  async function create() {
    setCreating(true);
    const body = new FormData();
    body.append("name", name.trim());
    body.append("country", country);
    body.append("description", about.trim());
    if (email.trim()) body.append("email", email.trim());
    if (instagram.trim()) body.append("instagram", instagram.trim());
    if (discord.trim()) body.append("discord", discord.trim());
    if (logo) body.append("logo", logo);
    body.append("rules_accepted", agree ? "true" : "");
    body.append("cf_turnstile_response", botToken);
    try {
      const res = await organizersApi.startOrganization(body);
      setCreated({ slug: res.organization.slug, name: res.organization.name });
      try {
        localStorage.setItem(SELECTED_ORG_KEY, res.organization.slug);
      } catch {
        // Private windows can refuse storage; the dashboard then opens the first organization, which is this one.
      }
      await refreshUser();
      setStep(3);
      window.scrollTo(0, 0);
    } catch (err: any) {
      const data = err?.response?.data;
      toast.error(serverMessage(data, t("failed")));
      // A name problem belongs to step 1: go back there so the person sees the field it is about.
      if (typeof data?.code === "string" && data.code.startsWith("org_name")) setStep(1);
    } finally {
      // A Turnstile token is good for ONE post, sent or refused (known bug fe-botcheck-no-reset).
      botRef.current?.reset();
      setCreating(false);
    }
  }

  // ── landing ──
  if (step === 0) {
    const features: [typeof IconUsers, string][] = [
      [IconCalendarEvent, "signups"],
      [IconPhotoScan, "screenshots"],
      [IconDeviceTv, "stream"],
      [IconUsers, "helpers"],
      [IconRosetteDiscountCheck, "badge"],
    ];
    return (
      <div className="container py-10 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary flex flex-wrap items-center gap-2">
              {t("hero.title")}
              <NewBadge since={ORG_START_SINCE} />
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-xl">{t("hero.intro")}</p>
            <div className="mt-6">
              <NeedsAccount action={t("hero.action")}>
                <Button size="lg" onClick={() => setStep(1)}>
                  {t("hero.start")}
                  <IconArrowRight className="size-4" />
                </Button>
              </NeedsAccount>
            </div>
          </div>
          <Card className="py-4">
            <CardContent className="space-y-4">
              {features.map(([Icon, key]) => (
                <div key={key} className="flex gap-3">
                  <Icon className="size-5 shrink-0 text-primary mt-0.5" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{t(`features.${key}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`features.${key}.body`)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── done ──
  if (step === 3 && created) {
    return (
      <div className="container py-10 md:py-16 max-w-xl">
        <Card>
          <CardContent className="text-center space-y-4">
            <div className="mx-auto size-14 rounded-full bg-primary/15 text-primary grid place-items-center">
              <IconCheck className="size-7" aria-hidden />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary">{t("done.title", { name: created.name })}</h1>
            <p className="text-sm text-muted-foreground">{t("done.body", { slug: created.slug })}</p>
            <div className="text-left space-y-2 pt-2">
              {[
                [IconCalendarEvent, "firstEvent", "/organizer/events/create"],
                [IconUsers, "helpers", "/organizer/members"],
                [IconPhotoScan, "screenshots", "/organizer/events"],
              ].map(([Icon, key, href]) => {
                const I = Icon as typeof IconUsers;
                return (
                  <Link key={key as string} href={href as string}
                        className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-3 text-sm font-medium hover:bg-muted">
                    <I className="size-5 text-primary" aria-hidden />
                    {t(`done.${key as string}`)}
                  </Link>
                );
              })}
            </div>
            <Button size="lg" className="w-full" onClick={() => router.push("/organizer/overview")}>
              {t("done.dashboard")}
              <IconArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── steps 1 and 2 ──
  const stepNames = ["name", "about", "done"] as const;
  return (
    <div className="container py-10 md:py-14 max-w-2xl">
      <ol className="flex flex-wrap gap-2 mb-5" aria-label={t("hero.start")}>
        {stepNames.map((key, i) => (
          <li key={key}
              className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                i + 1 === step ? "bg-primary/15 text-primary" : i + 1 < step ? "bg-muted text-foreground"
                  : "bg-muted/40 text-muted-foreground")}
              aria-current={i + 1 === step ? "step" : undefined}>
            <span>{i + 1 < step ? <IconCheck className="size-3.5" aria-hidden /> : i + 1}</span>
            {t(`steps.${key}`)}
          </li>
        ))}
      </ol>
      <Card>
        <CardContent className="space-y-5">
          {step === 1 ? (
            <>
              <div>
                <h1 className="text-2xl font-bold text-primary">{t("step1.title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("step1.lead")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-name">{t("step1.nameLabel")}</Label>
                <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
                       placeholder={t("step1.namePlaceholder")} autoComplete="off" className={FIELD}
                       aria-invalid={check.state === "bad"} aria-describedby="org-name-state" />
                <p id="org-name-state" role="status"
                   className={cn("text-xs", check.state === "bad" ? "text-destructive" : "text-muted-foreground")}>
                  {check.state === "checking" && t("step1.checking")}
                  {check.state === "bad" && check.message}
                  {check.state === "ok" && t("step1.pageWillBe", { slug: check.slug || slugify(name) })}
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">{t("step1.logoLabel")}</span>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="size-14 rounded-full object-cover" />
                  ) : (
                    <span className="size-14 rounded-full bg-muted grid place-items-center font-bold" aria-hidden>
                      {initials}
                    </span>
                  )}
                  <Button type="button" variant="secondary" size="sm" onClick={() => logoInput.current?.click()}>
                    {logo ? t("step1.logoChange") : t("step1.logoButton")}
                  </Button>
                  <span className="text-xs text-muted-foreground">{t("step1.logoHint")}</span>
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                         onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-country">{t("step1.countryLabel")}</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="org-country" className={cn("w-full", FIELD)}>
                    <SelectValue placeholder={t("step1.countryPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {countryNames.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("step1.countryHint")}</p>
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>{t("back")}</Button>
                <Button type="button" disabled={!step1Ready} onClick={() => setStep(2)}>
                  {t("next")}
                  <IconArrowRight className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold text-primary">{t("step2.title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("step2.lead")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-about">{t("step2.aboutLabel")}</Label>
                <Textarea id="org-about" value={about} maxLength={1000} onChange={(e) => setAbout(e.target.value)}
                          placeholder={t("step2.aboutPlaceholder")} className={FIELD} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">{t("step2.emailLabel")}</Label>
                <Input id="org-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                       placeholder={t("step2.emailPlaceholder")} className={FIELD} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-ig">{t("step2.instagramLabel")}</Label>
                  <Input id="org-ig" type="url" value={instagram} onChange={(e) => setInstagram(e.target.value)}
                         placeholder={t("step2.linkPlaceholder")} className={FIELD} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-dc">{t("step2.discordLabel")}</Label>
                  <Input id="org-dc" type="url" value={discord} onChange={(e) => setDiscord(e.target.value)}
                         placeholder={t("step2.linkPlaceholder")} className={FIELD} />
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-md bg-muted/40 p-3 text-sm cursor-pointer">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                <span>{t("step2.agree")}</span>
              </label>
              <BotCheck ref={botRef} onToken={setBotToken} />
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={creating}>{t("back")}</Button>
                <Button type="button" disabled={!agree || creating} onClick={create}>
                  {creating ? t("creating") : t("create")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
