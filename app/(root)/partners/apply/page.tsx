"use client";

/**
 * app/(root)/partners/apply/page.tsx - the public "become an AFC partner" form.
 *
 * WHY IT IS HERE AND NOT BEHIND A LOGIN: the people filling this in are organisations who have
 * never had an AFC account and have no reason to make one. Requiring a player account to ask for
 * a partner integration would exclude exactly the audience this exists for.
 *
 * WHY (root) AND NOT (user): the (root) group is AFC's set of pages a stranger can land on with
 * no session (privacy policy, terms, rules, invite). This is one of those. It renders the same
 * Header + PageHeader + Footer chrome as app/(root)/rules/page.tsx so it does not read as a
 * bolted-on form.
 *
 * HOW AN ORGANISATION FINDS IT: the partner integration guide (WEBSITE/docs, section 2) now
 * names this URL instead of only an email address, and the guide is the document AFC sends and
 * that partners pass around. The email address still works and is on the page, because somebody
 * with an unusual case should not be forced through a form.
 *
 * WHAT THIS FORM DOES NOT ASK FOR: any scope, any share_* toggle. What data a partner receives
 * is AFC's decision, taken at review time from the two prose answers below. The long version of
 * that reasoning is on PartnerApplication.use_case in backend/afc_partner_apply/models.py.
 *
 * Backend: POST /partner-apply/applications/ (backend/afc_partner_apply/views_public.py
 * submit_application) through submitApplication() in lib/partnerApply.ts. The applicant's own
 * follow-up pages are ./status and ./credentials.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
// The same phone control the profile edit screen uses, so this app has ONE phone input rather
// than a second hand-rolled dial-code list. It emits a single E.164 string.
import * as RPNInput from "react-phone-number-input";
import {
  IconArrowRight,
  IconCircleCheck,
  IconFileDownload,
  IconUpload,
} from "@tabler/icons-react";

import { Header } from "@/app/(user)/_components/Header";
import { Footer } from "@/app/_components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// The SAME country list the profile screen writes User.country from, so a partner row and a
// player row spell a country the same way.
import { countries } from "@/constants";
import { CountrySelect, FlagComponent, PhoneInput } from "@/components/PhoneNumberInput";
import { Textarea } from "@/components/ui/textarea";
// The guide download is a plain anchor to the API origin, so it needs the base URL. Every other
// call on this page goes through lib/partnerApply.ts, which is why env was not imported before.
import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/http";
import { submitApplication } from "@/lib/partnerApply";

/** The shape the form holds locally. Kept flat and all-strings (plus the two product booleans)
 * because every value goes into a FormData, and FormData carries strings anyway. */
interface FormState {
  organisation_name: string;
  display_name: string;
  homepage_url: string;
  country: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  /** E.164 straight from RPNInput, e.g. "+2348051234567". The backend normalises again and
   *  refuses what it cannot read, so this being loose is fine; it is never a dial code plus a
   *  separate number, because the control emits one joined string. */
  contact_whatsapp: string;
  /** Always true. The Data API option was removed from this form (owner 2026-08-05), so every
   *  application is a Sign in with AFC application. Kept in the payload because the backend row
   *  still carries it, and an admin can still grant Data API access at approval. */
  wants_sso: boolean;
  wants_data_api: boolean;
  redirect_uris: string;
  post_logout_redirect_uris: string;
  deletion_webhook_url: string;
  use_case: string;
  data_needed: string;
}

const EMPTY: FormState = {
  organisation_name: "",
  display_name: "",
  homepage_url: "",
  country: "",
  contact_name: "",
  contact_email: "",
  contact_role: "",
  contact_whatsapp: "",
  // No longer a choice: the picker card is gone and every application is Sign in with AFC. The
  // backend forces the same two values rather than trusting these, so a caller cannot post
  // wants_sso=false to skip the redirect URI rules.
  wants_sso: true,
  wants_data_api: false,
  redirect_uris: "",
  post_logout_redirect_uris: "",
  deletion_webhook_url: "",
  use_case: "",
  data_needed: "",
};

export default function PartnerApplyPage() {
  // messages/{en,fr,pt}/partnerApply.json. One namespace covers this page, the status page, the
  // credentials page and the admin queue, because they are one feature and the copy cross
  // references itself ("we emailed you a link", "open the link in that email").
  const t = useTranslations("partnerApply");
  const locale = useLocale();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [logo, setLogo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once the application lands. The form is replaced by the reference rather than reset, so
  // an applicant cannot double-submit by pressing the button again on a form that looks empty.
  const [reference, setReference] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    // Client-side checks are a courtesy only: every one of them is enforced again server-side,
    // because the client is a public web page. They exist so the applicant is not charged a
    // rate-limit slot for something we can see is incomplete.
    if (!form.country.trim()) {
      toast.error(t("form.errors.countryRequired"));
      return;
    }
    // Unconditional now: there is only one product, so redirect URIs are always needed.
    if (!form.redirect_uris.trim()) {
      toast.error(t("form.errors.redirectRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        data.append(key, typeof value === "boolean" ? String(value) : value);
      });
      // The language they read the form in. Every decision email comes back in it, so a French
      // organisation is not answered in English.
      data.append("locale", locale);
      if (logo) data.append("logo", logo);

      const result = await submitApplication(data);
      setReference(result.reference);
      // `already_pending` is not an error: this contact email already has an open application,
      // which nearly always means a double-clicked button.
      toast.success(result.already_pending ? t("form.alreadyPending") : t("form.sent"));
    } catch (err) {
      // The server's message names the offending value ("Redirect URI '...' contains '*'"), so it
      // is shown as-is rather than replaced with something vaguer.
      toast.error(getErrorMessage(err, t("form.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container py-8">
        <PageHeader title={t("apply.title")} description={t("apply.description")} />

        {reference ? (
          // ── Submitted ──────────────────────────────────────────────────────────────────
          // The reference is shown large and on its own because it is the one thing the
          // applicant may need to quote back, and because the email carrying the link can be
          // slow or land in spam.
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <IconCircleCheck className="size-5" />
                {t("apply.doneTitle")}
              </CardTitle>
              <CardDescription>
                {t("apply.doneBody", { email: form.contact_email })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">{t("apply.referenceLabel")}</p>
                <p className="font-mono text-xl font-bold text-primary">{reference}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t("apply.doneNote")}</p>
              <Button asChild variant="outline" className="self-start">
                <Link href="/partners/apply/status">
                  {t("apply.openStatus")}
                  <IconArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
            {/* ── 1. What this is, and the guide ────────────────────────────────────────
                The product picker that used to sit here is gone (owner 2026-08-05): the Data API
                option was removed, so every application is a Sign in with AFC application and
                there is nothing left to choose. In its place, what they are applying for and the
                document that describes it, because an organisation deciding whether to apply is
                exactly who needs to read the guide. The download is public and ungated
                (backend partner-apply/integration-guide/), so it works before they have any
                account at all. */}
            <Card>
              <CardHeader>
                <CardTitle>{t("form.intro.title")}</CardTitle>
                <CardDescription>{t("form.intro.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={`${env.NEXT_PUBLIC_BACKEND_API_URL}/partner-apply/integration-guide/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:border-primary/50 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                >
                  <IconFileDownload className="text-primary size-4" />
                  {t("form.intro.guideCta")}
                </a>
              </CardContent>
            </Card>

            {/* ── 2. Who you are ──────────────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>{t("form.org.title")}</CardTitle>
                <CardDescription>{t("form.org.description")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="organisation_name"
                  label={t("form.org.name")}
                  required
                  value={form.organisation_name}
                  onChange={(v) => set("organisation_name", v)}
                />
                <Field
                  id="display_name"
                  label={t("form.org.displayName")}
                  hint={t("form.org.displayNameHint")}
                  value={form.display_name}
                  onChange={(v) => set("display_name", v)}
                />
                <Field
                  id="homepage_url"
                  label={t("form.org.website")}
                  required
                  type="url"
                  placeholder="https://"
                  value={form.homepage_url}
                  onChange={(v) => set("homepage_url", v)}
                />
                {/* Country is REQUIRED as of 2026-08-05 (owner), and a picked value rather than
                    free text. Free text is how User.country ended up holding the same country
                    under several spellings ("Nigeria" and "NG" both, thousands of rows each),
                    which quietly halves any count or filter that groups by it. The list is the
                    shared one the profile screen already uses, so a partner's country matches a
                    player's. NOT the Field helper: that wraps a plain Input. */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="country">
                    {t("form.org.country")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.country}
                    onValueChange={(v) => set("country", v)}
                  >
                    <SelectTrigger id="country" className="w-full">
                      <SelectValue placeholder={t("form.org.countryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="logo">{t("form.org.logo")}</Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                  />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <IconUpload className="size-3.5" />
                    {t("form.org.logoHint")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── 3. Who AFC talks to ─────────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>{t("form.contact.title")}</CardTitle>
                <CardDescription>{t("form.contact.description")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="contact_name"
                  label={t("form.contact.name")}
                  required
                  value={form.contact_name}
                  onChange={(v) => set("contact_name", v)}
                />
                <Field
                  id="contact_email"
                  label={t("form.contact.email")}
                  required
                  type="email"
                  hint={t("form.contact.emailHint")}
                  value={form.contact_email}
                  onChange={(v) => set("contact_email", v)}
                />
                <Field
                  id="contact_role"
                  label={t("form.contact.role")}
                  value={form.contact_role}
                  onChange={(v) => set("contact_role", v)}
                />
                {/* WhatsApp number (owner 2026-08-04). NOT a Field: that helper wraps a plain
                    Input, and this needs the country picker glued to the number, so it follows
                    the logo block's pattern of its own labelled div. The control is the SAME
                    PhoneNumberInput the profile edit screen uses, so there is one phone control
                    in this app rather than two, and it emits a single E.164 string, which is why
                    there is no separate dial-code field in FormState. */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contact_whatsapp">{t("form.contact.whatsapp")}</Label>
                  <RPNInput.default
                    id="contact_whatsapp"
                    className="flex rounded-md shadow-xs"
                    international
                    flagComponent={FlagComponent}
                    countrySelectComponent={CountrySelect}
                    inputComponent={PhoneInput}
                    value={form.contact_whatsapp}
                    // RPNInput hands back undefined when the field is cleared; FormState is all
                    // strings because every value ends up in a FormData.
                    onChange={(v) => set("contact_whatsapp", v ?? "")}
                  />
                  <p className="text-muted-foreground text-xs">{t("form.contact.whatsappHint")}</p>
                </div>
              </CardContent>
            </Card>

            {/* ── 4. The technical values ───────────────────────────────────────────────
                Always shown now. This used to be hidden for a Data API only application, on the
                reasoning that asking a broadcaster for a redirect URI teaches people to type
                something meaningless. With the Data API option gone, every applicant needs it. */}
            <Card>
              <CardHeader>
                <CardTitle>{t("form.technical.title")}</CardTitle>
                <CardDescription>{t("form.technical.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="redirect_uris">
                    {t("form.technical.redirectUris")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="redirect_uris"
                    rows={3}
                    placeholder="https://your-site.example/auth/afc/callback"
                    value={form.redirect_uris}
                    onChange={(e) => set("redirect_uris", e.target.value)}
                  />
                  {/* The rules, stated up front. The server enforces them and its refusal
                      names the offending URI, but an applicant who reads this first never
                      sees the refusal. */}
                  <p className="text-xs text-muted-foreground">
                    {t("form.technical.redirectHint")}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="post_logout_redirect_uris">
                    {t("form.technical.postLogout")}
                  </Label>
                  <Textarea
                    id="post_logout_redirect_uris"
                    rows={2}
                    value={form.post_logout_redirect_uris}
                    onChange={(e) => set("post_logout_redirect_uris", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("form.technical.postLogoutHint")}
                  </p>
                </div>
                <Field
                  id="deletion_webhook_url"
                  label={t("form.technical.webhook")}
                  type="url"
                  placeholder="https://"
                  hint={t("form.technical.webhookHint")}
                  value={form.deletion_webhook_url}
                  onChange={(v) => set("deletion_webhook_url", v)}
                />
            </CardContent>
            </Card>

            {/* ── 5. The two questions the decision turns on ───────────────────────────
                This is where the scope checklist would have been, and is not. See the header. */}
            <Card>
              <CardHeader>
                <CardTitle>{t("form.about.title")}</CardTitle>
                <CardDescription>{t("form.about.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="use_case">
                    {t("form.about.useCase")} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="use_case"
                    rows={4}
                    placeholder={t("form.about.useCasePlaceholder")}
                    value={form.use_case}
                    onChange={(e) => set("use_case", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="data_needed">
                    {t("form.about.dataNeeded")} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="data_needed"
                    rows={4}
                    placeholder={t("form.about.dataNeededPlaceholder")}
                    value={form.data_needed}
                    onChange={(e) => set("data_needed", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("form.about.dataNeededHint")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{t("form.footnote")}</p>
              <Button type="submit" disabled={submitting} className="sm:w-auto">
                {submitting ? t("form.sending") : t("form.submit")}
              </Button>
            </div>
          </form>
        )}
      </div>
      <Footer />
    </>
  );
}

/**
 * One labelled text input. Local to this file rather than shared: it exists only to keep the
 * three field-heavy cards above readable, and a shared version would immediately grow props for
 * cases no other page has.
 */
function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
