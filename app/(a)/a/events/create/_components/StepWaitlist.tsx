"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/ui/info-tip";
import { EventFormType } from "./types";

interface StepWaitlistProps {
  form: UseFormReturn<EventFormType>;
  // ── Discord omission (organizer parity) ─────────────────────────────────────
  // When true, the optional "Waitlist Discord Role ID" input is hidden. The
  // organizer create flow (app/(organizer)/organizer/events/create/page.tsx)
  // passes hideDiscord so organizers never see/submit a Discord role id - AFC's
  // Discord role automation is an admin-only concern for now. Defaults to false so
  // the admin wizard (which DOES manage Discord roles) renders the field unchanged.
  hideDiscord?: boolean;
}

export function StepWaitlist({ form, hideDiscord = false }: StepWaitlistProps) {
  const t = useTranslations("evSteps");
  // @ts-ignore
  const waitlistEnabled = form.watch("is_waitlist_enabled");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          {t("waitlist.title")}
          <InfoTip id="events.create.waitlist._section" className="ml-1.5" />
        </CardTitle>
        <CardDescription>
          {t("waitlist.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="waitlist-toggle">
              {t("waitlist.enable")}
              <InfoTip id="events.create.is_waitlist_enabled" className="ml-1" />
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("waitlist.enableHelp")}
            </p>
          </div>
          <FormField
            // @ts-ignore
            control={form.control}
            name="is_waitlist_enabled"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Switch
                    id="waitlist-toggle"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {waitlistEnabled && (
          <div className="space-y-4">
            {/* Slot-assignment MODE (owner 2026-06-17): how a no-show's slot is filled. Shown to
                players on the event page so they know the rule. */}
            <div className="space-y-2">
              <Label>{t("waitlist.howFilled")}</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  // opt.value drives the translated waitlist.modeLabel.* / modeDesc.* keys;
                  // opt.label stays as the English fallback for the t.has guard below.
                  [
                    { value: "first_registered", label: "Earliest registered" },
                    { value: "fcfs_room", label: "First to join room" },
                    { value: "manual_admin", label: "You pick" },
                  ] as const
                ).map((opt) => {
                  // @ts-ignore - optional field, mirrors the toggle idiom
                  const selected = (form.watch("waitlist_mode") || "first_registered") === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      // @ts-ignore
                      onClick={() => form.setValue("waitlist_mode", opt.value)}
                      className={
                        "rounded-md border p-3 text-left text-xs transition-colors " +
                        (selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")
                      }
                    >
                      {/* opt.value ∈ {first_registered, fcfs_room, manual_admin} (hardcoded), so all
                          three waitlist.modeLabel.* keys exist; t.has guards with the English label. */}
                      <span className="block font-medium">
                        {t.has(`waitlist.modeLabel.${opt.value}`)
                          ? t(`waitlist.modeLabel.${opt.value}`)
                          : opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {/* Selected-mode description. Key built from waitlist_mode; guarded so an
                    unknown mode renders nothing (matches the previous undefined behaviour). */}
                {(() => {
                  const mode = (form.watch("waitlist_mode") as string) || "first_registered";
                  return t.has(`waitlist.modeDesc.${mode}`)
                    ? t(`waitlist.modeDesc.${mode}`)
                    : "";
                })()}
              </p>
            </div>

            <FormField
              // @ts-ignore
              control={form.control}
              name="waitlist_capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("waitlist.capacity")}
                    <InfoTip id="events.create.waitlist_capacity" className="ml-1" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder={t("waitlist.capacityPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("waitlist.capacityHelp")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discord role for waitlisted players - omitted in the organizer flow
                (hideDiscord) since organizers don't drive AFC's Discord automation. */}
            {!hideDiscord && (
              <FormField
                // @ts-ignore
                control={form.control}
                name="waitlist_discord_role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("waitlist.discordRoleId")} <span className="text-muted-foreground font-normal">{t("waitlist.optional")}</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 123456789012345678" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("waitlist.discordRoleHelp")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
