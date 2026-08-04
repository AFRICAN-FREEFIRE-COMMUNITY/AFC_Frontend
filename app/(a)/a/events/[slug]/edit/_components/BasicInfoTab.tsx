"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
// i18n: this Basic Info tab is shared by the admin + organizer event-edit wizards. All copy is
// internationalized via the "evEditTabs" namespace (messages/{en,fr,pt}/evEditTabs.json).
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
// Switch powers the per-event "Require Discord to register" toggle added below
// (mirrors the create wizard's require_* toggles in Step1EventDetails).
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  IconPhoto,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { Loader } from "@/components/Loader";
import { countries, REGIONS_MAP } from "@/constants";
import { InfoTip } from "@/components/ui/info-tip";
import type { EventFormType, EventDetails } from "../types";
// Single source of truth for the paid-registration currency options (defined with the
// create-flow form constants); reused here so create + edit can't drift.
import { REGISTRATION_FEE_CURRENCIES } from "@/app/(a)/a/events/create/_components/types";
import CountryPaymentRulesEditor from "@/components/CountryPaymentRulesEditor";
// Shared per-event Discord registration gate (guild id + invite + verify + require +
// invite link) - same control the create wizard's Step1EventDetails uses.
import { DiscordRegistrationGate } from "@/app/(a)/a/events/create/_components/DiscordRegistrationGate";

// The registration-requirement toggles (owner correction 2026-06-22: these belong on Basic Info,
// not the Waitlist tab). Each blocks registration until satisfied; the register flow points players
// at exactly what they're missing. The keys match the backend's require_* fields and the
// waitlistForm state the edit page persists via saveWaitlistSettings. Adding a row here is all a new
// per-player requirement needs on this tab (require_whatsapp, owner 2026-08-03, was added that way).
// i18n: labelKey/helpKey resolve into the "evEditTabs" namespace at render (fully enumerated,
// so every one of these keys exists in messages/{en,fr,pt}/evEditTabs.json).
const REQUIREMENT_TOGGLES: { key: string; labelKey: string; helpKey: string }[] = [
  {
    key: "require_team_logo",
    labelKey: "basicInfo.requireTeamLogoLabel",
    helpKey: "basicInfo.requireTeamLogoHelp",
  },
  {
    key: "require_esport_images",
    labelKey: "basicInfo.requireEsportImagesLabel",
    helpKey: "basicInfo.requireEsportImagesHelp",
  },
  {
    key: "require_player_profile_image",
    labelKey: "basicInfo.requireProfileImageLabel",
    helpKey: "basicInfo.requireProfileImageHelp",
  },
  {
    key: "require_player_uid",
    labelKey: "basicInfo.requireUidLabel",
    helpKey: "basicInfo.requireUidHelp",
  },
  {
    key: "require_whatsapp",
    labelKey: "basicInfo.requireWhatsappLabel",
    helpKey: "basicInfo.requireWhatsappHelp",
  },
];

interface BasicInfoTabProps {
  eventDetails: EventDetails;
  // Registration-requirement toggles state (owner correction 2026-06-22). These MOVED from
  // the Waitlist tab to Basic Info, but they are still backed by the edit page's waitlistForm
  // state + saved by saveWaitlistSettings - the edit page passes that exact state/setter here
  // (typed loosely) so the field bindings + save are unchanged. Only the rendering location moved.
  requirementsForm: Record<string, any>;
  setRequirementsForm: React.Dispatch<React.SetStateAction<any>>;
  previewUrl: string;
  setPreviewUrl: (url: string) => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  streamFields: any[];
  appendStream: () => void;
  removeStream: (index: number) => void;
  setPendingParticipantType: (v: string | null) => void;
  setShowParticipantTypeWarning: (v: boolean) => void;
  onSaveChanges: () => void;
  loadingEvent: boolean;
  pendingSubmit: boolean;
  // When true, the internal/external Event Type selector is hidden. The organizer
  // edit flow passes this (organizer events are always external to AFC, so the field
  // is AFC-admin-only). Defaults to false so the admin flow is unchanged.
  hideEventType?: boolean;
  // When true, the "Registration Link (Required for External)" field is hidden. The
  // organizer edit flow passes this (the link is an AFC-only concern). Defaults false
  // so the admin flow still shows it. The existing value stays in form state and is
  // re-sent on save, so hiding never clears it.
  hideRegistrationLink?: boolean;
}

export default function BasicInfoTab({
  eventDetails,
  requirementsForm,
  setRequirementsForm,
  previewUrl,
  setPreviewUrl,
  selectedFile,
  setSelectedFile,
  isDragging,
  setIsDragging,
  fileInputRef,
  streamFields,
  appendStream,
  removeStream,
  setPendingParticipantType,
  setShowParticipantTypeWarning,
  onSaveChanges,
  loadingEvent,
  pendingSubmit,
  hideEventType = false,
  hideRegistrationLink = false,
}: BasicInfoTabProps) {
  const form = useFormContext<EventFormType>();
  const t = useTranslations("evEditTabs");
  // The team-result switch reads from the namespace that also holds the two screens it turns on
  // (the team's submit panel and the organizer's queue), so the wording cannot drift apart from
  // what an organizer sees after enabling it.
  const tr = useTranslations("teamResults");
  // Guarded translate: used for the few keys built from a variable (requirement-toggle keys and the
  // registration-restriction type). Falls back to the English key stem if a key is ever missing, so a
  // dynamic lookup can never throw a MISSING_MESSAGE at render.
  const tg = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

  const selectedCountries = form.watch("selected_locations") || [];
  const restrictionMode = form.watch("restriction_mode");
  const registrationRestriction = form.watch("registration_restriction");

  const eventType = form.watch("event_type") === "external";
  // Drives the Registration sub-block: when "paid", reveal the fee + currency inputs.
  const isPaidRegistration = form.watch("registration_type") === "paid";
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  const addStreamChannel = () => appendStream();

  const removeStreamChannel = (index: number) => {
    if (streamFields.length <= 1) return;
    removeStream(index);
  };

  const toggleCountry = (country: string) => {
    const current = new Set(selectedCountries);
    if (current.has(country)) {
      current.delete(country);
    } else {
      current.add(country);
    }
    form.setValue("selected_locations", Array.from(current));
  };

  const toggleRegion = (regionName: string, regionCountries: string[]) => {
    const current = new Set(selectedCountries);
    const allInRegionSelected = regionCountries.every((c) => current.has(c));
    regionCountries.forEach((c) => {
      if (allInRegionSelected) {
        current.delete(c);
      } else {
        current.add(c);
      }
    });
    form.setValue("selected_locations", Array.from(current));
  };

  return (
    <Card className="">
      <CardHeader>
        <CardTitle>{t("basicInfo.cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="event_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("basicInfo.eventName")}</FormLabel>
              <Input {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="max_teams_or_players"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.maxTeamsPlayers")}
                  {/* Reuse the create-wizard copy - identical field. */}
                  <InfoTip
                    id="events.create.max_teams_or_players"
                    className="ml-1"
                  />
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={
                      field.value === undefined ||
                      field.value === null ||
                      field.value === 0
                        ? ""
                        : field.value.toString()
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val);
                    }}
                    placeholder={t("basicInfo.maxPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="competition_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.competitionType")}
                  <InfoTip
                    id="events.create.competition_type"
                    className="ml-1"
                  />
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("basicInfo.selectType")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="tournament">{t("basicInfo.compTournament")}</SelectItem>
                    <SelectItem value="scrims">{t("basicInfo.compScrims")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="participant_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.participantType")}
                  <InfoTip
                    id="events.create.participant_type"
                    className="ml-1"
                  />
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    const hasRegistered =
                      (eventDetails?.registered_competitors?.length ?? 0) > 0 ||
                      (eventDetails?.tournament_teams?.length ?? 0) > 0;
                    if (hasRegistered && value !== field.value) {
                      setPendingParticipantType(value);
                      setShowParticipantTypeWarning(true);
                    } else {
                      field.onChange(value);
                    }
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("basicInfo.selectType")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="solo">{t("basicInfo.participantSolo")}</SelectItem>
                    <SelectItem value="duo">{t("basicInfo.participantDuo")}</SelectItem>
                    <SelectItem value="squad">{t("basicInfo.participantSquad")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="event_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.eventMode")}
                  <InfoTip id="events.create.event_mode" className="ml-1" />
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("basicInfo.selectMode")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="virtual">{t("basicInfo.modeVirtual")}</SelectItem>
                    <SelectItem value="physical">{t("basicInfo.modePhysical")}</SelectItem>
                    <SelectItem value="hybrid">{t("basicInfo.modeHybrid")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Internal/External is AFC-only; the organizer flow hides it (hideEventType)
              and the page defaults event_type to "external". */}
          {!hideEventType && (
          <FormField
            control={form.control}
            name="event_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.eventType")}
                  <InfoTip id="events.create.event_type" className="ml-1" />
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("basicInfo.selectType")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="internal">{t("basicInfo.etypeInternal")}</SelectItem>
                    <SelectItem value="external">{t("basicInfo.etypeExternal")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          )}
          <FormField
            control={form.control}
            name="is_public"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.eventPrivacy")}
                  <InfoTip id="events.create.is_public" className="ml-1" />
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value} // ✅ Add this line
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("basicInfo.selectType")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="True">{t("basicInfo.privacyPublic")}</SelectItem>
                    <SelectItem value="False">{t("basicInfo.privacyPrivate")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Registration requirements (owner correction 2026-06-22) ──────────────────
            ALL per-event registration gates live on Basic Info (grouped together), NOT on
            the Waitlist tab. These four asset toggles (team logo / esport image / profile
            image / Free Fire UID) MOVED here from WaitlistTab. They are driven by the SAME
            waitlistForm state + setter the edit page already owns, so saving is unchanged
            (saveWaitlistSettings still persists them). The Discord gate (below) is the
            fifth registration requirement and sits with them. */}
        {/* ── Teams filing their own map results (owner backlog item 6, 2026-08-04) ──────
            Its OWN block rather than a sixth row in REQUIREMENT_TOGGLES below, because those
            all mean "block registration until this is satisfied" and this means the opposite
            kind of thing: it hands a job to teams. Grouping it with them would misdescribe it
            to the organizer reading the screen.
            Backed by the same requirementsForm state and the same Save, so an organizer does
            not have to find a second button. Off by default. Copy lives in the teamResults
            namespace beside the two screens it switches on. */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="allow-team-results">{tr("settings.label")}</Label>
              <p className="text-xs text-muted-foreground">{tr("settings.help")}</p>
            </div>
            <Switch
              id="allow-team-results"
              checked={Boolean(requirementsForm.allow_team_result_submissions)}
              onCheckedChange={(v) =>
                setRequirementsForm((p: any) => ({ ...p, allow_team_result_submissions: v }))
              }
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <Label>{t("basicInfo.requirementsTitle")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("basicInfo.requirementsHelp")}
            </p>
          </div>
          {REQUIREMENT_TOGGLES.map((req) => (
            <div
              key={req.key}
              className="flex items-center justify-between"
            >
              <div className="space-y-0.5">
                {/* labelKey/helpKey are fully enumerated in evEditTabs; tg guards anyway so a missing
                    key can never throw at render. */}
                <Label htmlFor={`req-${req.key}`}>{tg(req.labelKey, req.labelKey)}</Label>
                <p className="text-xs text-muted-foreground">{tg(req.helpKey, req.helpKey)}</p>
              </div>
              <Switch
                id={`req-${req.key}`}
                checked={Boolean(requirementsForm[req.key])}
                onCheckedChange={(v) =>
                  setRequirementsForm((p: any) => ({ ...p, [req.key]: v }))
                }
              />
            </div>
          ))}
          {/* ── Require letter avatars (feature #7, owner 2026-06-29) ──────────────────────────
              UNLIKE the four boolean toggles above, this gate is a NUMBER: 0 = off, 1-26 = the
              required minimum. Mirrors the create wizard's Step1EventDetails control. Backed by the
              SAME requirementsForm (the edit page's waitlistForm) state + saved by saveWaitlistSettings,
              which appends min_letter_avatars to edit_event. Blocks registration until a team/player
              has at least N Free Fire letter avatars available (enforced in register_for_event). */}
          {(() => {
            // 0 (or unset) = OFF. Any value > 0 reveals the 1-26 count input and turns the gate on.
            const current = Number(requirementsForm.min_letter_avatars ?? 0) || 0;
            const enabled = current > 0;
            return (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="req-min-letter-avatars">
                    {t("basicInfo.requireLettersLabel")}
                    <InfoTip
                      text={t("basicInfo.requireLettersInfoTip")}
                      className="ml-1"
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("basicInfo.requireLettersHelp")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Count input only when the gate is on. Clamped 1-26 (26 letters exist). */}
                  {enabled && (
                    <Input
                      type="number"
                      min={1}
                      max={26}
                      value={current}
                      onChange={(e) =>
                        setRequirementsForm((p: any) => ({
                          ...p,
                          min_letter_avatars: Math.max(
                            1,
                            Math.min(26, Number(e.target.value) || 1),
                          ),
                        }))
                      }
                      className="w-20"
                    />
                  )}
                  <Switch
                    id="req-min-letter-avatars"
                    checked={enabled}
                    // Toggling on seeds a sensible default of 1; off clears to 0.
                    onCheckedChange={(on) =>
                      setRequirementsForm((p: any) => ({
                        ...p,
                        min_letter_avatars: on ? 1 : 0,
                      }))
                    }
                  />
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Discord registration gate (per-event) ────────────────────────────────
            Edit-side use of the shared DiscordRegistrationGate (same control as the create
            wizard's Step1EventDetails). When ON, register_for_event/ rejects any participant
            who isn't Discord-connected + a member of the event's server (403
            code:"discord_required", handled on the public tournament page). Rehydrated from
            eventDetails.require_discord / discord_server_id / discord_invite_link (see edit
            page form.reset) and re-sent on save. initiallyVerified=true when the event
            already has a saved invite link, so the admin isn't forced to re-verify just to
            keep the gate on. */}
        <DiscordRegistrationGate
          // @ts-ignore - the edit form's EventFormType is structurally compatible for the
          // three Discord keys this control touches (require_discord / discord_server_id /
          // discord_invite_link), but is a distinct schema type from the create EventFormType
          // the component is typed against. Same widening the rest of this file casts away.
          form={form}
          initiallyVerified={Boolean(eventDetails.discord_invite_link)}
        />

        {/* Registration Link - AFC-only; organizer edit hides it (hideRegistrationLink).
            The value persists in form state and is re-sent on save. */}
        {eventType && !hideRegistrationLink && (
          <FormField
            control={form.control}
            name="registration_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.registrationLink")}
                </FormLabel>
                <Input
                  {...field}
                  placeholder={t("basicInfo.registrationLinkPlaceholder")}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-2">
          <FormLabel>{t("basicInfo.streamingLinks")}</FormLabel>
          {streamFields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-center">
              <FormField
                control={form.control}
                name={`stream_channels.${index}`}
                render={({ field }) => (
                  <Input
                    {...field}
                    className="flex-1"
                    placeholder={t("basicInfo.streamPlaceholder")}
                  />
                )}
              />
              <Button
                type="button"
                variant="destructive"
                // size="md"
                className="size-9 md:h-11 md:w-auto"
                onClick={() => removeStreamChannel(index)}
              >
                <IconTrash />
                <span className="hidden md:inline-block">{t("basicInfo.remove")}</span>
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStreamChannel}
          >
            {t("basicInfo.addStreamingLink")}
          </Button>
        </div>

        <FormField
          control={form.control}
          name="banner"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("basicInfo.banner")}</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  {!previewUrl ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          if (
                            ![
                              "image/png",
                              "image/jpeg",
                              "image/jpg",
                              "image/webp",
                            ].includes(file.type)
                          ) {
                            toast.error(t("basicInfo.toastImageType"));
                            return;
                          }
                          setSelectedFile(file);
                          setPreviewUrl(URL.createObjectURL(file));
                        }
                      }}
                      className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-gray-300 bg-gray-50"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center">
                          <IconPhoto
                            size={32}
                            className="text-primary dark:text-white"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("basicInfo.dropImage")}{" "}
                          <span className="text-primary font-medium hover:underline">
                            {t("basicInfo.browse")}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("basicInfo.supportsImages")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex items-center justify-center overflow-hidden">
                        <Image
                          width={1000}
                          height={1000}
                          src={previewUrl}
                          alt={t("basicInfo.imageAlt")}
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
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                        >
                          <IconX size={16} className="mr-2" />
                          {t("basicInfo.remove")}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <IconUpload size={16} className="mr-2" />
                          {t("basicInfo.replace")}
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
                      if (!file) return;

                      if (
                        ![
                          "image/png",
                          "image/jpeg",
                          "image/jpg",
                          "image/webp",
                        ].includes(file.type)
                      ) {
                        toast.error(t("basicInfo.toastImageType"));
                        return;
                      }

                      setSelectedFile(file);
                      setPreviewUrl(URL.createObjectURL(file));
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Registration Dates & Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="registration_open_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.registrationOpens")}
                  <InfoTip
                    id="events.create.registration_open"
                    className="ml-1"
                  />
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="registration_end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicInfo.registrationCloses")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="registration_start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicInfo.registrationStartTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="registration_end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicInfo.registrationEndTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Registration: Free vs Paid ────────────────────────────────────────
            Edit-flow mirror of the create wizard's Registration block
            (Step1EventDetails). Pre-filled from the fetched event detail
            (registration_type / registration_fee / registration_fee_currency) in
            the page's form.reset, and re-sent on Save. FREE is the default so
            editing an existing free event is unchanged. Charge is a later phase. */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="registration_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.registration")}
                  {/* Inline copy (no centralized HelpId): explains paid + escrow /
                      post-event payout. No em/en dashes. */}
                  <InfoTip
                    text={t("basicInfo.registrationInfoTip")}
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
                      <RadioGroupItem
                        value="free"
                        id="edit_registration_type_free"
                      />
                      <Label htmlFor="edit_registration_type_free">{t("basicInfo.free")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="paid"
                        id="edit_registration_type_paid"
                      />
                      <Label htmlFor="edit_registration_type_paid">{t("basicInfo.paid")}</Label>
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
                control={form.control}
                name="registration_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("basicInfo.entryFee")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t("basicInfo.entryFeePlaceholder")}
                        value={
                          field.value === undefined || field.value === null
                            ? ""
                            : field.value.toString()
                        }
                        onChange={(e) =>
                          // Empty clears the fee; otherwise hand the raw string to
                          // the schema (z.coerce.number handles parsing).
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
                control={form.control}
                name="registration_fee_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("basicInfo.currency")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "USD"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("basicInfo.selectCurrency")} />
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

          {/* Per-country payment rules (owner 2026-06-24): edit which countries pay / join free +
              optional per-country amount overrides. Controlled editor wired to the RHF field; rehydrated
              from the event's country_payment_rules (get-event-details echo). Backend re-validates. */}
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
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("basicInfo.eventStartDate")}
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
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicInfo.eventEndDate")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="event_start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicInfo.eventStartTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="event_end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicInfo.eventEndTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <FormField
          control={form.control}
          name="registration_restriction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("basicInfo.registrationRestrictions")}</FormLabel>
              <FormDescription>
                {t("basicInfo.restrictionsDesc")}
              </FormDescription>
              <FormControl>
                <div className="space-y-6">
                  {/* TOP TOGGLES */}
                  <div className="flex flex-col gap-4">
                    <RadioGroup
                      value={field.value || "none"}
                      onValueChange={(val) =>
                        form.setValue("registration_restriction", val as "none" | "by_region" | "by_country")
                      }
                      className="flex gap-4"
                    >
                      {/* Restriction types are a fixed enum; the i18n key for each is enumerated in
                          evEditTabs. tg guards the variable-built key so a lookup can never throw. */}
                      {(
                        [
                          ["none", "basicInfo.restrictionNone"],
                          ["by_region", "basicInfo.restrictionByRegion"],
                          ["by_country", "basicInfo.restrictionByCountry"],
                        ] as const
                      ).map(([type, labelKey]) => (
                        <div
                          key={type}
                          className="flex items-center space-x-2"
                        >
                          <RadioGroupItem value={type} id={type} />
                          <Label htmlFor={type} className="capitalize">
                            {tg(labelKey, type.replace("_", " "))}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {registrationRestriction !== "none" && (
                    <div className="p-4 border rounded-lg bg-card space-y-4">
                      <Label className="text-destructive">
                        {t("basicInfo.restrictionMode")}
                      </Label>
                      <RadioGroup
                        value={restrictionMode || "allow_only"}
                        className="flex gap-4"
                        onValueChange={(val) =>
                          form.setValue("restriction_mode", val as "allow_only" | "block_selected")
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="allow_only" id="allow_only" />
                          <Label
                            htmlFor="allow_only"
                            className="text-green-500"
                          >
                            {t("basicInfo.allowOnlySelected")}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="block_selected"
                            id="block_selected"
                          />
                          <Label
                            htmlFor="block_selected"
                            className="text-red-500"
                          >
                            {t("basicInfo.blockSelected")}
                          </Label>
                        </div>
                      </RadioGroup>

                      {/* CONDITIONAL RENDERING */}
                      {registrationRestriction === "by_region" ? (
                        <Accordion type="multiple" className="w-full">
                          {Object.entries(REGIONS_MAP).map(
                            ([region, regionCountries]) => (
                              <AccordionItem value={region} key={region}>
                                <AccordionTrigger className="hover:no-underline">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={regionCountries.every((c) =>
                                        selectedCountries.includes(c),
                                      )}
                                      onCheckedChange={() =>
                                        toggleRegion(region, regionCountries)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span>
                                      {t("basicInfo.regionCountries", {
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
                                      variant={
                                        selectedCountries.includes(c)
                                          ? "default"
                                          : "outline"
                                      }
                                      className="cursor-pointer"
                                      onClick={() => toggleCountry(c)}
                                    >
                                      {c}
                                    </Badge>
                                  ))}
                                </AccordionContent>
                              </AccordionItem>
                            ),
                          )}
                        </Accordion>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {countries.map((c) => (
                            <Badge
                              key={c}
                              variant={
                                selectedCountries.includes(c)
                                  ? "default"
                                  : "outline"
                              }
                              className={`cursor-pointer ${
                                selectedCountries.includes(c)
                                  ? "bg-green-600"
                                  : ""
                              }`}
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
              {registrationRestriction !== "none" &&
                selectedCountries.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    <span className="text-muted-foreground text-sm">
                      {t("basicInfo.selectedLocations")}
                    </span>
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

        <Separator />

        <div className="space-y-3">
          <FormLabel>{t("basicInfo.publishOptions")}</FormLabel>
          <FormField
            control={form.control}
            name="publish_to_tournaments"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={saveToDraftsWatch}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">
                  {t("basicInfo.publishToTournaments")}
                  <InfoTip
                    id="events.create.publish_to_tournaments"
                    className="ml-1"
                  />
                </FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="save_to_drafts"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={publishToTournamentsWatch || publishToNewsWatch}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">
                  {t("basicInfo.saveAsDraft")}
                  <InfoTip id="events.create.save_to_drafts" className="ml-1" />
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        <Button
          type="button"
          onClick={onSaveChanges}
          disabled={loadingEvent || pendingSubmit}
        >
          {loadingEvent || pendingSubmit ? (
            <Loader text={t("basicInfo.saving")} />
          ) : (
            t("basicInfo.saveChanges")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
