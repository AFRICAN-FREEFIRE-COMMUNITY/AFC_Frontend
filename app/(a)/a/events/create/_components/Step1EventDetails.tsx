"use client";

import React, { useRef, useState } from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
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
import { EventFormType } from "./types";

interface Step1Props {
  form: UseFormReturn<EventFormType>;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  previewUrl: string;
  setPreviewUrl: (url: string) => void;
}

export function Step1EventDetails({
  form,
  selectedFile,
  setSelectedFile,
  previewUrl,
  setPreviewUrl,
}: Step1Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { fields: streamFields, append: appendStream, remove: removeStream } = useFieldArray({
    control: form.control,
    name: "stream_channels",
  });

  const selectedCountries = form.watch("selected_locations") || [];
  const eventType = form.watch("event_type") === "external";

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
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Event Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Event Name */}
        <FormField
          // @ts-ignore
          control={form.control}
          name="event_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Name</FormLabel>
              <Input placeholder="Enter event name" {...field} />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type Selects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              name: "competition_type" as const,
              label: "Competition Type",
              options: [
                { value: "tournament", label: "Tournament" },
                { value: "scrims", label: "Scrims" },
              ],
            },
            {
              name: "participant_type" as const,
              label: "Participant Type",
              options: [
                { value: "solo", label: "Solo" },
                { value: "duo", label: "Duo" },
                { value: "squad", label: "Squad" },
              ],
            },
            {
              name: "event_type" as const,
              label: "Event Type",
              options: [
                { value: "internal", label: "Internal event" },
                { value: "external", label: "External event" },
              ],
            },
            {
              name: "is_public" as const,
              label: "Event Privacy",
              options: [
                { value: "True", label: "Public" },
                { value: "False", label: "Private" },
              ],
            },
          ].map(({ name, label, options }) => (
            <FormField
              key={name}
              // @ts-ignore
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
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
              <FormLabel>Max Teams/Players</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={
                    field.value === undefined || field.value === null || field.value === 0
                      ? ""
                      : field.value.toString()
                  }
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="e.g., 128"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* External Registration Link */}
        {eventType && (
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registration Link (Required for External)</FormLabel>
                <Input {...field} placeholder="https://registration.example.com" />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Registration Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            // @ts-ignore
            control={form.control}
            name="registration_open_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registration Opens</FormLabel>
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
                <FormLabel>Registration Closes</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Event Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            // @ts-ignore
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Start Date</FormLabel>
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
                <FormLabel>Event End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
              <FormLabel>Tournament Banner</FormLabel>
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
                          Drop your image here, or{" "}
                          <span className="text-primary font-medium hover:underline">browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supports: PNG, JPG, JPEG, WEBP
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
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <IconX size={16} className="mr-2" /> Remove
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <IconUpload size={16} className="mr-2" /> Replace
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
          <FormLabel>Streaming Channel Links</FormLabel>
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
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendStream("")}>
            + Add Streaming Link
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
              <FormLabel>Registration Restrictions</FormLabel>
              <FormDescription>
                Control who can register for this event based on their location
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
                          {type.replace("_", " ")}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {form.watch("registration_restriction") !== "none" && (
                    <div className="p-4 border rounded-lg bg-card space-y-4">
                      <Label className="text-destructive">Restriction Mode</Label>
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
                            Allow Only Selected
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="block_selected" id="block_selected" />
                          <Label htmlFor="block_selected" className="text-red-500">
                            Block Selected
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
                                    {region} ({regionCountries.length} countries)
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
                  <span className="text-muted-foreground text-sm">Selected locations:</span>{" "}
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
      </CardContent>
    </Card>
  );
}
