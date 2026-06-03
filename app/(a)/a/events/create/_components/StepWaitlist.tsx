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
}

export function StepWaitlist({ form }: StepWaitlistProps) {
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

        {waitlistEnabled && (
          <div className="space-y-4">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
