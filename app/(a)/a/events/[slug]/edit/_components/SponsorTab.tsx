"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IconLoader2, IconUserCheck } from "@tabler/icons-react";
import Link from "next/link";

interface SponsorForm {
  is_sponsored: boolean;
  sponsor_name: string;
  sponsor_username: string;
  requirement_description: string;
  uuid_label: string;
}

interface SponsorTabProps {
  slug: string;
  sponsorForm: SponsorForm;
  setSponsorForm: React.Dispatch<React.SetStateAction<SponsorForm>>;
  onSave: () => void;
  saving: boolean;
}

export default function SponsorTab({
  slug,
  sponsorForm,
  setSponsorForm,
  onSave,
  saving,
}: SponsorTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sponsor Requirement</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, players must complete a sponsor action before their
              registration is finalized.
            </p>
          </div>
          {sponsorForm.is_sponsored && (
            <div className="flex items-center gap-2">
              <Badge variant="default">Active</Badge>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/a/events/${slug}/sponsors`}>
                  <IconUserCheck className="size-3.5 mr-1" />
                  Review Sponsors
                </Link>
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="sponsor-toggle" className="text-base font-medium">
                Enable Sponsor Requirement
              </Label>
              <p className="text-sm text-muted-foreground">
                Players will be prompted to input their sponsor ID during
                registration.
              </p>
            </div>
            <Switch
              id="sponsor-toggle"
              checked={sponsorForm.is_sponsored}
              onCheckedChange={(v) =>
                setSponsorForm((p) => ({ ...p, is_sponsored: v }))
              }
            />
          </div>

          {sponsorForm.is_sponsored && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Sponsor Name</Label>
                <Input
                  placeholder="e.g. Garena, Supercell"
                  value={sponsorForm.sponsor_name}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      sponsor_name: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Sponsor Username</Label>
                <Input
                  placeholder="e.g. garena_official"
                  value={sponsorForm.sponsor_username}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      sponsor_username: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The platform username of the sponsor account.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Requirement Description</Label>
                <Textarea
                  placeholder="e.g. Download the Garena app, create an account, and enter your Garena UUID below."
                  value={sponsorForm.requirement_description}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      requirement_description: e.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Field Label</Label>
                <Input
                  placeholder="e.g. Garena UUID, Player ID, Account ID"
                  value={sponsorForm.uuid_label}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      uuid_label: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This label appears next to the input field players see during
                  registration.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving && <IconLoader2 className="size-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Sponsor Settings"}
        </Button>
      </div>
    </div>
  );
}
