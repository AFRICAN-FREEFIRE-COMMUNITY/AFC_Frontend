"use client";

// ── DebuggerBackfillPanel (owner 2026-07-02) ─────────────────────────────────
// "Uploading the debugger file even when not live can still give all the needed data" — this panel
// is that upload. The operator drops the 3D-room client's Debugger/debugger-*.log (one file spans a
// whole session = several rounds); we DRY-RUN parse it server-side, list every detected round with
// its player/kill counts, let the operator map each round to the right MATCH (same UX as the
// multi-map .log upload), then APPLY: the mapped matches' player rows get deaths / knockdowns /
// headshots / revives / survival time filled by UID. That unlocks the 3D-room MVP criteria + design
// columns for the event.
//
// CONNECTS TO: POST events/<event_id>/debugger-backfill/ (debugger_ingest.py; dry run without
// `apply`, fill with it). Mounted on the admin leaderboard edit page's Upload Results tab
// (app/(a)/a/leaderboards/[id]/edit). Admin surface — English.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconFileUpload, IconLoader2, IconDatabaseImport } from "@tabler/icons-react";

interface ParsedRound {
  round_index: number;
  started_at: string;
  player_count: number;
  matched_accounts: number;
  total_kills: number;
}

// The stage/group/match tree the edit page already holds; we only need match options.
export interface MatchOption {
  match_id: number;
  label: string; // e.g. "QUALIFIERS · Group A · Match 2 (Purgatory)"
}

const NONE = "__skip__";

export default function DebuggerBackfillPanel({
  eventId,
  matchOptions,
}: {
  eventId: number | string;
  matchOptions: MatchOption[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rounds, setRounds] = useState<ParsedRound[]>([]);
  // round_index -> match_id (or NONE to skip).
  const [mapping, setMapping] = useState<Record<number, string>>({});

  const post = async (apply?: { round_index: number; match_id: number }[]) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (apply) fd.append("apply", JSON.stringify(apply));
    const res = await axios.post(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/debugger-backfill/`,
      fd,
      { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } },
    );
    return res.data;
  };

  const parse = async () => {
    if (!file) {
      toast.error("Pick a debugger-*.log file first.");
      return;
    }
    setBusy(true);
    try {
      const data = await post();
      setRounds(data.rounds ?? []);
      setMapping({});
      toast.success(`Found ${data.rounds?.length ?? 0} rounds in the log.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not parse the log.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const entries = Object.entries(mapping)
      .filter(([, m]) => m && m !== NONE)
      .map(([ri, m]) => ({ round_index: Number(ri), match_id: Number(m) }));
    if (!entries.length) {
      toast.error("Map at least one round to a match first.");
      return;
    }
    setBusy(true);
    try {
      const data = await post(entries);
      const updated = (data.applied ?? []).reduce(
        (s: number, a: any) => s + (a.updated_rows || 0),
        0,
      );
      toast.success(
        `Rich stats filled on ${updated} player rows across ${entries.length} matches.`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not apply the backfill.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-tour="leaderboard-debugger-backfill">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconDatabaseImport className="text-primary size-5" />
          Debugger log (3D-room rich stats)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-xs">
          Upload the observer PC&apos;s <code>Free Fire_64_Data\Debugger\debugger-*.log</code> to
          backfill deaths, knockdowns, headshots, revives and survival time for matches that were
          NOT captured live. One file covers a whole session: map each detected round to its match,
          then apply. Players are matched by their Free Fire UID.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".log,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <Button size="sm" onClick={parse} disabled={busy || !file}>
            {busy ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconFileUpload className="size-4" />
            )}
            Parse log
          </Button>
        </div>

        {rounds.length > 0 ? (
          <div className="space-y-2">
            {rounds.map((r) => (
              <div
                key={r.round_index}
                className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 text-xs">
                  <p className="font-semibold">
                    Round {r.round_index + 1}
                    <span className="text-muted-foreground ml-2 font-normal">
                      {r.player_count} players · {r.total_kills} kills ·{" "}
                      {r.matched_accounts} matched accounts
                    </span>
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Label className="text-xs">Match</Label>
                  <Select
                    value={mapping[r.round_index] ?? NONE}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [r.round_index]: v }))
                    }
                  >
                    <SelectTrigger className="h-8 w-72 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Skip this round</SelectItem>
                      {matchOptions.map((m) => (
                        <SelectItem key={m.match_id} value={String(m.match_id)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <Button onClick={apply} disabled={busy}>
              {busy ? <IconLoader2 className="size-4 animate-spin" /> : null}
              Apply rich stats to the mapped matches
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
