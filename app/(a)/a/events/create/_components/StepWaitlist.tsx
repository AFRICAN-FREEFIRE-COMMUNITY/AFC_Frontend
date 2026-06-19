"use client";

import { UseFormReturn } from "react-hook-form";
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
  // @ts-ignore
  const waitlistEnabled = form.watch("is_waitlist_enabled");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Step 8: Waitlist
          <InfoTip id="events.create.waitlist._section" className="ml-1.5" />
        </CardTitle>
        <CardDescription>
          Allow players to join a waitlist if the event reaches max capacity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="waitlist-toggle">
              Enable Waitlist
              <InfoTip id="events.create.is_waitlist_enabled" className="ml-1" />
            </Label>
            <p className="text-xs text-muted-foreground">
              When the event is full, players can join a waitlist and be
              admitted if spots open up.
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

        {/* ── Media registration requirements (owner 2026-06-12) ──────────────────
            Two per-event criteria enforced by the backend at registration time
            (register_for_event): teams need an uploaded logo, and every registering
            player (solo, or each roster member) needs their ESPORT IMAGE uploaded
            (profile edit -> Esport Image). Rendered here because this shared step
            already hosts the event's registration behaviour toggles, so BOTH the
            admin and organizer wizards get them from one place. */}
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <Label>Registration requirements</Label>
            <p className="text-xs text-muted-foreground">
              Block registration until competitors have uploaded the media you need for
              graphics and broadcasts.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-team-logo">Require team logo</Label>
              <p className="text-xs text-muted-foreground">
                Teams cannot register until their team logo is uploaded.
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field, mirrors the waitlist toggle idiom above.
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
              <Label htmlFor="require-esport-images">Require player esport images</Label>
              <p className="text-xs text-muted-foreground">
                Every registering player must have their esport image uploaded on their
                profile.
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field, mirrors the waitlist toggle idiom above.
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
          {/* F3 (owner 2026-06-19): two more per-player gates. Profile image is distinct from the
              esport image above; UID is the player's Free Fire UID. When on, registration is
              blocked until every registering player satisfies them (per-player pointer on the
              register flow). */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-player-profile-image">Require player profile image</Label>
              <p className="text-xs text-muted-foreground">
                Every registering player must have a profile image uploaded.
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field, mirrors the toggle idiom above.
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
              <Label htmlFor="require-player-uid">Require player Free Fire UID</Label>
              <p className="text-xs text-muted-foreground">
                Every registering player must have their Free Fire UID set on their profile.
              </p>
            </div>
            <FormField
              // @ts-ignore - shared optional field, mirrors the toggle idiom above.
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
        </div>

        {waitlistEnabled && (
          <div className="space-y-4">
            {/* Slot-assignment MODE (owner 2026-06-17): how a no-show's slot is filled. Shown to
                players on the event page so they know the rule. */}
            <div className="space-y-2">
              <Label>How open slots are filled</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: "first_registered", label: "Earliest registered", help: "The team/player who joined the waitlist first gets the open slot." },
                    { value: "fcfs_room", label: "First to join room", help: "All waitlist teams get the room ID + password; first to join the room claims the slot." },
                    { value: "manual_admin", label: "You pick", help: "You manually choose which waitlist team/player takes each open slot." },
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
                      <span className="block font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {/* @ts-ignore */}
                {{ first_registered: "The team/player who joined the waitlist first gets the open slot.", fcfs_room: "All waitlist teams get the room ID + password; first to join the room claims the slot. You confirm who got in.", manual_admin: "You manually choose which waitlist team/player takes each open slot." }[(form.watch("waitlist_mode") as string) || "first_registered"]}
              </p>
            </div>

            <FormField
              // @ts-ignore
              control={form.control}
              name="waitlist_capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Waitlist Capacity
                    <InfoTip id="events.create.waitlist_capacity" className="ml-1" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 20"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Maximum number of players allowed on the waitlist.
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
                    <FormLabel>Waitlist Discord Role ID <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 123456789012345678" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Discord role assigned to players on the waitlist.
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
