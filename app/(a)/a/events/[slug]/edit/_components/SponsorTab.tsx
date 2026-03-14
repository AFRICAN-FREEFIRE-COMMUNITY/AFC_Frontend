"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { IconLoader2, IconUserCheck } from "@tabler/icons-react";
import axios from "axios";
import Link from "next/link";

interface Sponsor {
  user_id: number;
  full_name: string;
  username: string;
  email: string;
}

export interface SponsorForm {
  is_sponsored: boolean;
  sponsor_name: string;
  sponsor_usernames: string[];
  requirement_description: string;
  sponsor_field_label: string;
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
  const { token } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(false);

  useEffect(() => {
    if (!sponsorForm.is_sponsored || !token) return;
    setSponsorsLoading(true);
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-sponsors/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setSponsors(res.data ?? []))
      .catch(() => {})
      .finally(() => setSponsorsLoading(false));
  }, [sponsorForm.is_sponsored, token]);

  const toggleSponsor = (username: string) => {
    setSponsorForm((p) => ({
      ...p,
      sponsor_usernames: p.sponsor_usernames.includes(username)
        ? p.sponsor_usernames.filter((u) => u !== username)
        : [...p.sponsor_usernames, username],
    }));
  };

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
              <Label htmlFor="sponsor-toggle">Enable Sponsor Requirement</Label>
              <p className="text-xs text-muted-foreground">
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
              {/* Sponsor / Company Name */}
              <div className="space-y-1.5">
                <Label>Sponsor / Company Name</Label>
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

              {/* Sponsor Accounts Multi-Select */}
              <div className="space-y-1.5">
                <Label>Sponsor Accounts</Label>
                <p className="text-xs text-muted-foreground">
                  Select one or more sponsor accounts to associate with this
                  event.
                </p>
                {sponsorsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <IconLoader2 className="size-4 animate-spin" />
                    Loading sponsors...
                  </div>
                ) : sponsors.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    No sponsors available.
                  </p>
                ) : (
                  <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                    {sponsors.map((s) => (
                      <label
                        key={s.user_id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={sponsorForm.sponsor_usernames.includes(
                            s.username,
                          )}
                          onCheckedChange={() => toggleSponsor(s.username)}
                        />
                        <span className="text-sm">
                          {s.full_name}{" "}
                          <span className="text-muted-foreground">
                            (@{s.username})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {sponsorForm.sponsor_usernames.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {sponsorForm.sponsor_usernames.length} sponsor
                    {sponsorForm.sponsor_usernames.length !== 1 ? "s" : ""}{" "}
                    selected
                  </p>
                )}
              </div>

              {/* Requirement Description */}
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

              {/* Field Label */}
              <div className="space-y-1.5">
                <Label>Field Label</Label>
                <Input
                  placeholder="e.g. Garena UUID, Player ID, Account ID"
                  value={sponsorForm.sponsor_field_label}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      sponsor_field_label: e.target.value,
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
