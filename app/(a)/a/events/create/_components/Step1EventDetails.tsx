"use client";

import React, { useRef, useState } from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import Image from "next/image";
import { countries, REGIONS_MAP } from "@/constants";
import { RequiredConnectionsPicker } from "@/components/events/RequiredConnectionsPicker";
import { InfoTip } from "@/components/ui/info-tip";
// Shared "require letter avatars" control, also rendered by the edit form (BasicInfoTab).
import { LetterAvatarRequirement } from "./LetterAvatarRequirement";
import CountryPaymentRulesEditor from "@/components/CountryPaymentRulesEditor";
import { type HelpId } from "@/lib/help-content";
import { EventFormType, REGISTRATION_FEE_CURRENCIES } from "./types";
// Shared per-event Discord registration gate (guild id + invite + verify + require +
// invite link). Same control the edit form (BasicInfoTab) uses, so create + edit can't
// drift. See DiscordRegistrationGate.tsx for the full invite->verify->require flow.
import { DiscordRegistrationGate } from "./DiscordRegistrationGate";

interface Step1Props {
  form: UseFormReturn<EventFormType>;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  previewUrl: string;
  setPreviewUrl: (url: string) => void;
  // When true, the internal/external Event Type select is dropped. AFC-only field;
  // the organizer create flow passes this and defaults event_type to "external".
  hideEventType?: boolean;
  // When true, the "Registration Link (Required for External)" field is dropped.
  // Organizer events are always external, but the registration link is an AFC-only
  // concern, so the organizer create flow passes this. Defaults false (AFC admin
  // create still shows + collects it as before).
  hideRegistrationLink?: boolean;
}

export function Step1EventDetails({
  form,
  selectedFile,
  setSelectedFile,
  previewUrl,
  setPreviewUrl,
  hideEventType = false,
  hideRegistrationLink = false,
}: Step1Props) {
  // next-intl translator for this step's namespace (keys live in messages/*/evStep1.json).
  // These builder components are shared: rendered by BOTH the admin event wizard and the
  // organizer create/edit portal, so translating them localizes both surfaces at once.
  const t = useTranslations("evStep1");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { fields: streamFields, append: appendStream, remove: removeStream } = useFieldArray({
    control: form.control,
    name: "stream_channels",
  });

  const selectedCountries = form.watch("selected_locations") || [];
  const eventType = form.watch("event_type") === "external";
  // Drives the Registration sub-block: when "paid", reveal the fee + currency inputs.
  const isPaidRegistration = form.watch("registration_type") === "paid";

  const toggleCountry = (country: string) => {
    const current = new Set(selectedCountries);
    current.has(country) ? current.delete(country) : current.add(country);
    form.setValue("selected_locations", Array.from(current));
  };

  const toggleRegion = (regionName: string, regionCountries: string[]) => {
    const current = new Set(selectedCountries);
    const allSelected = regionCountries.every((c) => current.has(c));
    regionCountries.forEach((c) => (allSelected ? current.delete(c) : current.add(c)));
    form.setValue("selected_locations", Array.from(current));
  };

  const handleFileDrop = (file: File) => {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast.error(t("invalidFileType"));
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          {t("section")}
          <InfoTip id="events.create.step1._section" className="ml-1.5" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Event Name */}
        <FormField
          // @ts-ignore
          control={form.control}
          name="event_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("eventName")}</FormLabel>
              <Input placeholder={t("eventNamePlaceholder")} {...field} />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── What the tournament IS, in the organizer's words ─────────────────────────────
            Mirrors the edit form's control exactly (edit/_components/BasicInfoTab.tsx): same
            Textarea, same rows, same optional-ness, so the field somebody meets when creating an
            event is the field they meet again when editing it. It was absent here until
            2026-08-26, which meant the only way to describe an event was to create it and then go
            and edit it (owner report).
            Written into RHF as event_description and hand-appended to the create FormData by BOTH
            create pages, admin and organizer. create_event stores it on Event.event_description
            (views.py:2269), the public tournament page renders it as the About block, and the
            translate-on-read layer serves it in the reader's own language. */}
        <FormField
          // @ts-ignore
          control={form.control}
          name={"event_description" as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("eventDescription")}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={(field.value as string) ?? ""}
                  rows={5}
                  placeholder={t("eventDescriptionPlaceholder")}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {t("eventDescriptionHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type Selects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              name: "competition_type" as const,
              label: t("competitionType"),
              // `tip` keys the centralized help copy so each select carries a why.
              tip: "events.create.competition_type" as HelpId,
              options: [
                { value: "tournament", label: t("competition.tournament") },
                { value: "scrims", label: t("competition.scrims") },
              ],
            },
            {
              name: "participant_type" as const,
              label: t("participantType"),
              tip: "events.create.participant_type" as HelpId,
              options: [
                { value: "solo", label: t("participant.solo") },
                { value: "duo", label: t("participant.duo") },
                { value: "squad", label: t("participant.squad") },
              ],
            },
            {
              name: "event_type" as const,
              label: t("eventType"),
              tip: "events.create.event_type" as HelpId,
              options: [
                { value: "internal", label: t("eventTypeOption.internal") },
                { value: "external", label: t("eventTypeOption.external") },
              ],
            },
            {
              name: "is_public" as const,
              label: t("eventPrivacy"),
              tip: "events.create.is_public" as HelpId,
              options: [
                { value: "True", label: t("privacy.public") },
                { value: "False", label: t("privacy.private") },
              ],
            },
          ]
            // Organizer flow: drop the AFC-only Event Type select.
            .filter((f) => !(hideEventType && f.name === "event_type"))
            .map(({ name, label, tip, options }) => (
            <FormField
              key={name}
              // @ts-ignore
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {label}
                    <InfoTip id={tip} className="ml-1" />
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectTypePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* Max Teams */}
        <FormField
          // @ts-ignore
          control={form.control}
          name="max_teams_or_players"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("maxTeamsPlayers")}
                <InfoTip id="events.create.max_teams_or_players" className="ml-1" />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={
                    field.value === undefined || field.value === null || field.value === 0
                      ? ""
                      : field.value.toString()
                  }
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={t("maxTeamsPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* External Registration Link, AFC-only; organizer flow hides it
            (hideRegistrationLink) since the link isn't needed for org events. */}
        {eventType && !hideRegistrationLink && (
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registrationLink")}</FormLabel>
                <Input {...field} placeholder="https://registration.example.com" />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Registration Dates & Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_open_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("registrationOpens")}
                  <InfoTip id="events.create.registration_open" className="ml-1" />
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registrationCloses")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registrationStartTime")}<InfoTip id="events.create.registration_time" className="ml-1" /></FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registrationEndTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Registration: Free vs Paid ────────────────────────────────────────
            Sits with the registration-window fields above. A Free/Paid RadioGroup
            writes registration_type; when "paid" we reveal the fee amount +
            currency. FREE is the default, so a free event sends no fee and the
            existing flow is unchanged. These three fields (registration_type /
            registration_fee / registration_fee_currency) map 1:1 onto the backend
            create-event + edit-event contract. The actual charge is a later phase. */}
        <div className="space-y-4">
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("registration")}
                  {/* Inline copy (no centralized HelpId needed): explains paid +
                      the escrow / post-event payout. No em/en dashes. */}
                  <InfoTip
                    text={t("registrationTip")}
                    className="ml-1"
                  />
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value ?? "free"}
                    onValueChange={field.onChange}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="free" id="registration_type_free" />
                      <Label htmlFor="registration_type_free">{t("free")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="paid" id="registration_type_paid" />
                      <Label htmlFor="registration_type_paid">{t("paid")}</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Fee + currency only when Paid. Hidden (and not collected) for Free. */}
          {isPaidRegistration && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                // @ts-ignore
                control={form.control}
                name="registration_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("entryFee")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t("entryFeePlaceholder")}
                        value={
                          field.value === undefined || field.value === null
                            ? ""
                            : field.value.toString()
                        }
                        onChange={(e) =>
                          // Empty string clears the fee; otherwise hand the raw
                          // string to the schema (z.coerce.number handles parsing).
                          field.onChange(
                            e.target.value === "" ? null : e.target.value,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                // @ts-ignore
                control={form.control}
                name="registration_fee_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("currency")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "USD"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCurrency")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REGISTRATION_FEE_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Per-country payment rules (owner 2026-06-24): only for paid events. Lets the creator
              pick which countries pay / join free + optional per-country amount overrides. Controlled
              editor wired straight to the RHF field; backend re-validates via _parse_country_payment_rules. */}
          {isPaidRegistration && (
            <CountryPaymentRulesEditor
              value={form.watch("country_payment_rules")}
              onChange={(next) =>
                form.setValue("country_payment_rules", next, {
                  shouldDirty: true,
                })
              }
              baseCurrency={form.watch("registration_fee_currency") ?? "USD"}
              baseFee={form.watch("registration_fee")}
            />
          )}
        </div>

        {/* Event Dates & Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            // @ts-ignore
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("eventStartDate")}
                  <InfoTip id="events.create.event_dates" className="ml-1" />
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // @ts-ignore
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("eventEndDate")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // @ts-ignore
            control={form.control}
            name="event_start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("eventStartTime")}<InfoTip id="events.create.event_time" className="ml-1" /></FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // @ts-ignore
            control={form.control}
            name="event_end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("eventEndTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Banner Upload */}
        <FormField
          // @ts-ignore
          control={form.control}
          name="banner"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("banner")}</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  {!previewUrl ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileDrop(file);
                      }}
                      className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                        isDragging ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                          <IconPhoto size={32} className="text-primary dark:text-white" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("dropImagePrefix")}{" "}
                          <span className="text-primary font-medium hover:underline">{t("browse")}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("supports")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full aspect-video bg-gray-50 border rounded-md overflow-hidden">
                        <Image
                          width={1000}
                          height={1000}
                          src={previewUrl}
                          alt={t("featuredImageAlt")}
                          className="aspect-video size-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl("");
                            field.onChange("");
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <IconX size={16} className="mr-2" /> {t("remove")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <IconUpload size={16} className="mr-2" /> {t("replace")}
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileDrop(file);
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Stream Channels */}
        <div className="space-y-3">
          <FormLabel>{t("streamLinks")}</FormLabel>
          {streamFields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <FormField
                // @ts-ignore
                control={form.control}
                name={`stream_channels.${index}`}
                render={({ field }) => (
                  <Input {...field} className="flex-1" placeholder="https://..." />
                )}
              />
              {streamFields.length > 1 && (
                <Button type="button" variant="destructive" size="sm" onClick={() => removeStream(index)}>
                  {t("remove")}
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendStream("")}>
            {t("addStreamLink")}
          </Button>
        </div>

        <Separator />

        {/* Registration Restrictions */}
        <FormField
          // @ts-ignore
          control={form.control}
          name="registration_restriction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("restrictions")}</FormLabel>
              <FormDescription>
                {t("restrictionsDescription")}
              </FormDescription>
              <FormControl>
                <div className="space-y-6">
                  <RadioGroup
                    value={form.watch("registration_restriction") ?? "none"}
                    onValueChange={(val) =>
                      form.setValue(
                        "registration_restriction",
                        val as "none" | "by_region" | "by_country",
                      )
                    }
                    className="flex gap-4"
                  >
                    {["none", "by_region", "by_country"].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <RadioGroupItem value={type} id={type} />
                        <Label htmlFor={type} className="capitalize">
                          {/* Dynamic key built from the restriction-type value. All three
                              (none / by_region / by_country) are enumerated in evStep1.json,
                              but we still guard with t.has() so a missing key never throws
                              MISSING_MESSAGE, falling back to the raw English wording. */}
                          {t.has(`restrictionType.${type}`)
                            ? t(`restrictionType.${type}`)
                            : type.replace("_", " ")}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {form.watch("registration_restriction") !== "none" && (
                    <div className="p-4 border rounded-lg bg-card space-y-4">
                      <Label className="text-destructive">{t("restrictionMode")}</Label>
                      <RadioGroup
                        value={form.watch("restriction_mode") ?? "allow_only"}
                        className="flex gap-4"
                        onValueChange={(val) =>
                          form.setValue("restriction_mode", val as "allow_only" | "block_selected")
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="allow_only" id="allow_only" />
                          <Label htmlFor="allow_only" className="text-green-500">
                            {t("allowOnly")}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="block_selected" id="block_selected" />
                          <Label htmlFor="block_selected" className="text-red-500">
                            {t("blockSelected")}
                          </Label>
                        </div>
                      </RadioGroup>

                      {form.watch("registration_restriction") === "by_region" ? (
                        <Accordion type="multiple" className="w-full">
                          {Object.entries(REGIONS_MAP).map(([region, regionCountries]) => (
                            <AccordionItem value={region} key={region}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={regionCountries.every((c) =>
                                      selectedCountries.includes(c),
                                    )}
                                    onCheckedChange={() => toggleRegion(region, regionCountries)}
                                  />
                                  <span>
                                    {t("regionCountryCount", {
                                      region,
                                      count: regionCountries.length,
                                    })}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="flex flex-wrap gap-2 pt-2">
                                {regionCountries.map((c) => (
                                  <Badge
                                    key={c}
                                    variant={selectedCountries.includes(c) ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => toggleCountry(c)}
                                  >
                                    {c}
                                  </Badge>
                                ))}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {countries.map((c) => (
                            <Badge
                              key={c}
                              variant={selectedCountries.includes(c) ? "default" : "outline"}
                              className={`cursor-pointer ${selectedCountries.includes(c) ? "bg-green-600" : ""}`}
                              onClick={() => toggleCountry(c)}
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
              {form.watch("registration_restriction") !== "none" && (
                <div className="flex flex-wrap gap-1 mt-2.5">
                  <span className="text-muted-foreground text-sm">{t("selectedLocations")}</span>{" "}
                  {selectedCountries.map((country) => (
                    <Badge key={country} variant="secondary">
                      {country}
                    </Badge>
                  ))}
                </div>
              )}
            </FormItem>
          )}
        />
        {/* ── Registration requirements (owner 2026-06-20: moved to STEP 1 so creators see them
            first). Per-event criteria the backend enforces at registration (register_for_event):
            teams need a logo, and every registering player needs the toggled assets (esport image /
            profile image / Free Fire UID). This is a shared step-1 field set, so BOTH the admin and
            organizer create wizards get them here. (Previously lived in the later waitlist step.) */}
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <Label>
              {t("requirements")}
              <InfoTip id="events.create.registration_requirements._section" className="ml-1" />
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("requirementsDescription")}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-team-logo">{t("requireTeamLogo")}<InfoTip id="events.create.require_team_logo" className="ml-1" /></Label>
              <p className="text-xs text-muted-foreground">
                {t("requireTeamLogoDesc")}
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field
              control={form.control}
              name={"require_team_logo" as never}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      id="require-team-logo"
                      checked={(field.value as unknown as boolean) ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-esport-images">{t("requireEsportImages")}<InfoTip id="events.create.require_esport_images" className="ml-1" /></Label>
              <p className="text-xs text-muted-foreground">
                {t("requireEsportImagesDesc")}
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field
              control={form.control}
              name={"require_esport_images" as never}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      id="require-esport-images"
                      checked={(field.value as unknown as boolean) ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-player-profile-image">{t("requireProfileImage")}<InfoTip id="events.create.require_player_profile_image" className="ml-1" /></Label>
              <p className="text-xs text-muted-foreground">
                {t("requireProfileImageDesc")}
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field
              control={form.control}
              name={"require_player_profile_image" as never}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      id="require-player-profile-image"
                      checked={(field.value as unknown as boolean) ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-player-uid">{t("requireUid")}<InfoTip id="events.create.require_player_uid" className="ml-1" /></Label>
              <p className="text-xs text-muted-foreground">
                {t("requireUidDesc")}
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field
              control={form.control}
              name={"require_player_uid" as never}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      id="require-player-uid"
                      checked={(field.value as unknown as boolean) ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          {/* ── Require WhatsApp number (owner 2026-08-03) ────────────────────────────────────
              Blocks registration until every registering player has a WhatsApp number on their
              profile (afc_auth.UserProfile.whatsapp_number). Exists because AFC sends room ID /
              password over WhatsApp and almost no player has a number on file, so an event that
              relies on those messages can demand one instead of the site nagging everybody.
              Written into RHF as require_whatsapp, hand-appended to the create payload by BOTH
              create pages (admin + organizer), stored on Event.require_whatsapp, enforced in
              register_for_event via _missing_registration_assets, and shown to players by
              EventRequirementsCard + the roster-requirements panel. Mirrors the toggles above. */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-whatsapp">{t("requireWhatsapp")}<InfoTip id="events.create.require_whatsapp" className="ml-1" /></Label>
              <p className="text-xs text-muted-foreground">
                {t("requireWhatsappDesc")}
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field
              control={form.control}
              name={"require_whatsapp" as never}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      id="require-whatsapp"
                      checked={(field.value as unknown as boolean) ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          {/* ── Required connected accounts (owner 2026-08-26) ─────────────────────────────────
              Blocks registration until every registering player has the selected outside accounts
              linked to their AFC profile (afc_auth.ConnectedAccount). The choices come from the
              BACKEND registry, so an organizer cannot require a provider this deployment has no
              credentials for. Discord is NOT offered here: require_discord above is its own switch
              and means more (connected AND a member of the event's server).
              Written into RHF as required_connections (string[]), hand-appended to the create
              payload by BOTH create pages exactly like require_whatsapp above, stored on
              Event.required_connections, enforced in register_for_event via
              _missing_registration_assets, and shown to players by EventRequirementsCard + the
              roster-requirements panel. */}
          <FormField
            // @ts-ignore - shared optional field, same pattern as require_whatsapp above
            control={form.control}
            name={"required_connections" as never}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RequiredConnectionsPicker
                    value={(field.value as unknown as string[]) ?? []}
                    onChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {/* ── Require letter avatars (feature #7, owner 2026-06-29) ──────────────────────────
              Block registration until a team/player has at least N Free Fire letter avatars (A-Z)
              AVAILABLE. A team's available letters are the live union of its members' owned letters
              plus the team's manual extras; a solo player's are their own. The control is the SHARED
              LetterAvatarRequirement (also rendered by the edit form's BasicInfoTab), which owns the
              on/off Switch and the 1-26 count input; both write the single number field
              min_letter_avatars (0 = off). Sent by the create/edit pages to create_event/edit_event;
              enforced in register_for_event; rehydrated from get_event_details. Mirrors the
              require_* toggles above. */}
          <FormField
            // @ts-ignore - shared optional field
            control={form.control}
            name={"min_letter_avatars" as never}
            render={({ field }) => (
              <FormItem className="space-y-0">
                <LetterAvatarRequirement
                  id="require-letter-avatars"
                  value={field.value as unknown as number}
                  onChange={(next) => field.onChange(next)}
                  label={t("requireLetterAvatars")}
                  description={t("requireLetterAvatarsDesc")}
                  infoTipText={t("requireLetterAvatarsTip")}
                />
              </FormItem>
            )}
          />
        </div>

        {/* ── Discord registration gate ──────────────────────────────────────────
            The full invite -> verify -> require -> invite-link flow, encapsulated in the
            shared DiscordRegistrationGate (also used by the edit form's BasicInfoTab).
            When ON, register_for_event/ rejects any participant who isn't connected to
            Discord AND a member of the event's server (403 code:"discord_required",
            handled on the public tournament page). Writes require_discord +
            discord_server_id + discord_invite_link onto the form; all three are appended
            to the create payload by the admin + organizer create pages. */}
        <DiscordRegistrationGate form={form} />
      </CardContent>
    </Card>
  );
}
