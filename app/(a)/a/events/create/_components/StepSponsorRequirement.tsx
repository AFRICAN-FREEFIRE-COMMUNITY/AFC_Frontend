"use client";

import React, { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { IconLoader2 } from "@tabler/icons-react";
import axios from "axios";
import { EventFormType } from "./types";

interface Sponsor {
  id: number;
  full_name: string;
  username: string;
}

interface StepSponsorRequirementProps {
  form: UseFormReturn<EventFormType>;
}

export function StepSponsorRequirement({ form }: StepSponsorRequirementProps) {
  const sponsorRequired = form.watch("is_sponsored");
  const { token } = useAuth();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>("");

  useEffect(() => {
    if (!sponsorRequired || !token) return;
    const fetchSponsors = async () => {
      setSponsorsLoading(true);
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-sponsors/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSponsors(res.data.sponsors ?? []);
      } catch {
        // silently fail
      } finally {
        setSponsorsLoading(false);
      }
    };
    fetchSponsors();
  }, [sponsorRequired, token]);

  const handleSponsorSelect = (value: string) => {
    setSelectedSponsorId(value);
    const sponsor = sponsors.find((s) => String(s.id) === value);
    if (sponsor) {
      // @ts-ignore
      form.setValue("sponsor_name", sponsor.full_name);
      // @ts-ignore
      form.setValue("sponsor_username", sponsor.username);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 7: Sponsor Requirement</CardTitle>
        <CardDescription>
          Configure whether participants need to complete a sponsor action
          before registering.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="sponsor-toggle" className="text-base font-medium">
              Enable Sponsor Requirement
            </Label>
            <p className="text-sm text-muted-foreground">
              Require players to complete a sponsor task and submit a UUID
              before registering.
            </p>
          </div>
          <FormField
            // @ts-ignore
            control={form.control}
            name="is_sponsored"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Switch
                    id="sponsor-toggle"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {sponsorRequired && (
          <div className="space-y-4">
            {/* Sponsor Select */}
            <div className="flex flex-col gap-1.5">
              <Label>Sponsor</Label>
              {sponsorsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="size-4 animate-spin" />
                  Loading sponsors...
                </div>
              ) : (
                <Select
                  value={selectedSponsorId}
                  onValueChange={handleSponsorSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sponsor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sponsors.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.full_name} ({s.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Selecting a sponsor auto-fills the name and username below.
              </p>
            </div>

            {/* Sponsor Name (auto-filled) */}
            <FormField
              // @ts-ignore
              control={form.control}
              name="sponsor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsor Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sponsor Username (auto-filled) */}
            <FormField
              // @ts-ignore
              control={form.control}
              name="sponsor_username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsor Username</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. acmecorp_official" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    The platform username of the sponsor account.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Requirement Description */}
            <FormField
              // @ts-ignore
              control={form.control}
              name="sponsor_requirement_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirement Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Download our app on the App Store, create an account, and enter your Player UUID below."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* UUID Field Label */}
            <FormField
              // @ts-ignore
              control={form.control}
              name="sponsor_field_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UUID Field Label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Player UUID" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    This is the label shown next to the input field during
                    registration.
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
