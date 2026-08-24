"use client";

/**
 * PrivateEventInvitesCard - invite links for a PRIVATE event, on the Teams tab.
 *
 * WHY IT LIVES HERE NOW (owner 2026-08-22, Option A)
 *   Invites decide WHO CAN REGISTER, which makes them part of managing an event's teams. They used
 *   to sit on /a/events/<slug>, the page that is otherwise read-only, and that was one of only two
 *   reasons an admin still had to bounce between two pages to do one job. Moving them here is what
 *   lets that page become purely something you READ.
 *
 * SELF-CONTAINED ON PURPOSE. It fetches its own links and owns its own state rather than being
 * handed them, so it can be dropped into any tab without threading five pieces of state and three
 * handlers through the page that renders it. That is also why the move did not become a 200-line
 * copy between two large files.
 *
 * ONLY FOR PRIVATE EVENTS. A public event needs no invite to register, so the card renders nothing
 * rather than showing an empty list that looks like something failed.
 *
 * BACKEND
 *   get-all-invite-links-for-private-event/                  list
 *   generate-single-use-invite-link-for-private-event/       one link
 *   generate-multiple-single-use-invite-links-for-private-event/   many at once
 */

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { IconLink } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";

type InviteLink = {
  invite_link: string;
  created_at: string;
  created_by: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  is_shared?: boolean;
  expires_at?: string | null;
};

type Props = {
  eventId: number;
  token: string;
  /** A public event needs no invites, so the card renders nothing. */
  isPublic: boolean;
};

export default function PrivateEventInvitesCard({ eventId, token, isPublic }: Props) {
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [bulkCount, setBulkCount] = useState("5");

  const auth = {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };

  const load = useCallback(async () => {
    if (!eventId || !token || isPublic) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-invite-links-for-private-event/`,
        { event_id: eventId },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } },
      );
      setLinks(res.data.invite_links || []);
    } catch {
      // Non-fatal: the rest of the Teams tab still works, and the empty state below says so.
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token, isPublic]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateOne() {
    setWorking(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/generate-single-use-invite-link-for-private-event/`,
        { event_id: eventId.toString() },
        auth,
      );
      toast.success("Invite link generated");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not generate an invite link");
    } finally {
      setWorking(false);
    }
  }

  async function generateMany() {
    const count = parseInt(bulkCount, 10);
    // The backend caps this too; refusing here saves a round trip and says the limit out loud.
    if (isNaN(count) || count < 1 || count > 100) {
      toast.error("Enter a number between 1 and 100");
      return;
    }
    setWorking(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/generate-multiple-single-use-invite-links-for-private-event/`,
        { event_id: eventId.toString(), count },
        auth,
      );
      toast.success(`${count} invite links generated`);
      setBulkCount("5");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not generate the invite links");
    } finally {
      setWorking(false);
    }
  }

  function copy(link: string) {
    navigator.clipboard?.writeText(link);
    toast.success("Link copied");
  }

  if (isPublic) return null;

  const used = links.filter((l) => l.is_used).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <IconLink className="size-4" />
          Invite links
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This event is private, so a team can only register through an invite link. Each link
          works once.
        </p>

        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3">
          <Button size="sm" onClick={generateOne} disabled={working}>
            Generate one
          </Button>
          <span className="text-xs text-muted-foreground">or</span>
          <Input
            type="number"
            min={1}
            max={100}
            value={bulkCount}
            onChange={(e) => setBulkCount(e.target.value)}
            className="h-9 w-20"
            aria-label="How many invite links to generate"
          />
          <Button size="sm" variant="outline" onClick={generateMany} disabled={working}>
            Generate that many
          </Button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading invite links...</p>
        ) : links.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No invite links yet. Generate one above and send it to the team you want to let in.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {links.length} link{links.length === 1 ? "" : "s"}, {used} already used
            </p>
            <div className="space-y-1.5">
              {links.map((l) => (
                <div
                  key={l.invite_link}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-2.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {l.invite_link}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {l.is_used ? `used by ${l.used_by || "someone"}` : "unused"}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => copy(l.invite_link)}>
                      Copy
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
