"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

interface BasicInfoTabProps {
  eventDetails: EventDetails;
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
        <CardTitle>Event Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="event_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Name</FormLabel>
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
                  Max Teams/Players
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
                    placeholder="e.g., 128"
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
                  Competition Type
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
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="scrims">Scrims</SelectItem>
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
                  Participant Type
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
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="solo">Solo</SelectItem>
                    <SelectItem value="duo">Duo</SelectItem>
                    <SelectItem value="squad">Squad</SelectItem>
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
                  Event Mode
                  <InfoTip id="events.create.event_mode" className="ml-1" />
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="physical">Physical (LAN)</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
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
                  Event Type
                  <InfoTip id="events.create.event_type" className="ml-1" />
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="internal">Internal event</SelectItem>
                    <SelectItem value="external">External event</SelectItem>
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
                  Event Privacy
                  <InfoTip id="events.create.is_public" className="ml-1" />
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value} // ✅ Add this line
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="True">Public</SelectItem>
                    <SelectItem value="False">Private</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Registration Link — AFC-only; organizer edit hides it (hideRegistrationLink).
            The value persists in form state and is re-sent on save. */}
        {eventType && !hideRegistrationLink && (
          <FormField
            control={form.control}
            name="registration_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Registration Link (Required for External)
                </FormLabel>
                <Input
                  {...field}
                  placeholder="https://registration.example.com"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-2">
          <FormLabel>Streaming Channel Links</FormLabel>
          {streamFields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-center">
              <FormField
                control={form.control}
                name={`stream_channels.${index}`}
                render={({ field }) => (
                  <Input
                    {...field}
                    className="flex-1"
                    placeholder="https://..."
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
                <span className="hidden md:inline-block">Remove</span>
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStreamChannel}
          >
            + Add Streaming Link
          </Button>
        </div>

        <FormField
          control={form.control}
          name="banner"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tournament Banner</FormLabel>
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
                            toast.error(
                              "Only PNG, JPG, JPEG, or WEBP files are supported.",
                            );
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
                          Drop your image here, or{" "}
                          <span className="text-primary font-medium hover:underline">
                            browse
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supports: PNG, JPG, JPEG, WEBP
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
                          alt="Featured image"
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
                          Remove
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <IconUpload size={16} className="mr-2" />
                          Replace
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
                        toast.error(
                          "Only PNG, JPG, JPEG, or WEBP files are supported.",
                        );
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
                  Registration Opens
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
                <FormLabel>Registration Closes</FormLabel>
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
                <FormLabel>Registration Start Time <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
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
                <FormLabel>Registration End Time <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
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
                  Registration
                  {/* Inline copy (no centralized HelpId): explains paid + escrow /
                      post-event payout. No em/en dashes. */}
                  <InfoTip
                    text="Choose whether players pay to register. Paid entry fees are held in escrow by the payment processor and released to the organizer after the event runs."
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
                      <Label htmlFor="edit_registration_type_free">Free</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="paid"
                        id="edit_registration_type_paid"
                      />
                      <Label htmlFor="edit_registration_type_paid">Paid</Label>
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
                    <FormLabel>Entry Fee</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g., 5"
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
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "USD"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
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
        </div>

        {/* Event Dates & Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Event Start Date
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
                <FormLabel>Event End Date</FormLabel>
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
                <FormLabel>Event Start Time <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
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
                <FormLabel>Event End Time <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
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
              <FormLabel>Registration Restrictions</FormLabel>
              <FormDescription>
                Control who can register for this event based on their location
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
                      {["none", "by_region", "by_country"].map((type) => (
                        <div
                          key={type}
                          className="flex items-center space-x-2"
                        >
                          <RadioGroupItem value={type} id={type} />
                          <Label htmlFor={type} className="capitalize">
                            {type.replace("_", " ")}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {registrationRestriction !== "none" && (
                    <div className="p-4 border rounded-lg bg-card space-y-4">
                      <Label className="text-destructive">
                        Restriction Mode
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
                            Allow Only Selected
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
                            Block Selected
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
                                      {region} ({regionCountries.length}{" "}
                                      countries)
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
                      Selected locations:
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
          <FormLabel>Publish Options</FormLabel>
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
                  Publish to Tournaments
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
                  Save as Draft
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
            <Loader text="Saving..." />
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
