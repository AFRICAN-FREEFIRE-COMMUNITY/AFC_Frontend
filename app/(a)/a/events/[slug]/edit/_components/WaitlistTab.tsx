"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconLoader2 } from "@tabler/icons-react";

export interface WaitlistForm {
  is_waitlist_enabled: boolean;
  waitlist_capacity: string;
  waitlist_discord_role_id: string;
}

interface WaitlistTabProps {
  waitlistForm: WaitlistForm;
  setWaitlistForm: React.Dispatch<React.SetStateAction<WaitlistForm>>;
  onSave: () => void;
  saving: boolean;
}

export default function WaitlistTab({
  waitlistForm,
  setWaitlistForm,
  onSave,
  saving,
}: WaitlistTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Waitlist</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Allow players to join a waitlist when the event reaches max
            capacity.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="waitlist-toggle">Enable Waitlist</Label>
              <p className="text-xs text-muted-foreground">
                Players can join the waitlist when the event is full and be
                admitted if spots open up.
              </p>
            </div>
            <Switch
              id="waitlist-toggle"
              checked={waitlistForm.is_waitlist_enabled}
              onCheckedChange={(v) =>
                setWaitlistForm((p) => ({ ...p, is_waitlist_enabled: v }))
              }
            />
          </div>

          {waitlistForm.is_waitlist_enabled && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-capacity">Waitlist Capacity</Label>
                <Input
                  id="waitlist-capacity"
                  type="number"
                  min={1}
                  placeholder="e.g. 20"
                  value={waitlistForm.waitlist_capacity}
                  onChange={(e) =>
                    setWaitlistForm((p) => ({
                      ...p,
                      waitlist_capacity: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of players allowed on the waitlist.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="waitlist-discord-role">
                  Waitlist Discord Role ID
                </Label>
                <Input
                  id="waitlist-discord-role"
                  placeholder="e.g. 123456789012345678"
                  value={waitlistForm.waitlist_discord_role_id}
                  onChange={(e) =>
                    setWaitlistForm((p) => ({
                      ...p,
                      waitlist_discord_role_id: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Discord role assigned to players on the waitlist.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving && <IconLoader2 className="size-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Waitlist Settings"}
        </Button>
      </div>
    </div>
  );
}
