"use client";

// ── TieBreakersPanel (owner 2026-07-02) ──────────────────────────────────────
// "A tie breaker place for leaderboards, with apply-to-all or per stage/group just like maps."
// The admin arranges TEAM tie-breaker criteria (booyahs, kills, placement points, ..., Map MVPs won)
// exactly like the MVP criteria; equal-POINT teams are then ordered by this chain everywhere the
// standings render (round_robin.apply_tie_breakers: group > stage > event default > legacy chain).
//
// CONNECTS TO: GET/POST events/<event_id>/tie-breakers/ (views_mvp.event_tie_breakers). Scope:
// "all" saves the event default (+ optional wipe of overrides), "stage"/"group" save an override
// for the CURRENTLY SELECTED stage/group passed in by the host page. Mounted on the leaderboard
// edit page's Scoring Config tab. Admin surface — English.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
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
import {
  IconArrowDown,
  IconArrowUp,
  IconLoader2,
  IconScale,
  IconX,
} from "@tabler/icons-react";

interface CatalogItem {
  key: string;
  label: string;
}

const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

export default function TieBreakersPanel({
  eventId,
  stageId,
  stageName,
  groupId,
  groupName,
}: {
  eventId: number | string;
  stageId?: string | number | null;
  stageName?: string | null;
  groupId?: string | number | null;
  groupName?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [config, setConfig] = useState<any>({});
  const [scope, setScope] = useState<"all" | "stage" | "group">("all");
  // The arranged, ACTIVE criteria for the chosen scope (subset of the catalog, ordered).
  const [criteria, setCriteria] = useState<string[]>([]);

  // Pull the scope's saved arrangement out of the config blob.
  const arrangementFor = useCallback(
    (cfg: any, sc: string) => {
      if (sc === "stage" && stageId) return (cfg?.stages ?? {})[String(stageId)] ?? [];
      if (sc === "group" && groupId) return (cfg?.groups ?? {})[String(groupId)] ?? [];
      return cfg?.default ?? [];
    },
    [stageId, groupId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/tie-breakers/`,
        { headers: authHeaders() },
      );
      setCatalog(res.data.catalog ?? []);
      setConfig(res.data.tie_breakers ?? {});
      setCriteria(arrangementFor(res.data.tie_breakers ?? {}, "all"));
      setScope("all");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not load the tie-breakers.");
    } finally {
      setLoading(false);
    }
  }, [eventId, arrangementFor]);

  useEffect(() => {
    load();
  }, [load]);

  const changeScope = (sc: "all" | "stage" | "group") => {
    setScope(sc);
    setCriteria(arrangementFor(config, sc));
  };

  const move = (idx: number, dir: -1 | 1) => {
    setCriteria((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const addCriterion = (key: string) => {
    setCriteria((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeCriterion = (key: string) => {
    setCriteria((prev) => prev.filter((c) => c !== key));
  };

  const save = async (replaceAll = false) => {
    setSaving(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/tie-breakers/`,
        {
          criteria,
          scope,
          stage_id: scope === "stage" ? stageId : undefined,
          group_id: scope === "group" ? groupId : undefined,
          replace_all: replaceAll,
        },
        { headers: authHeaders() },
      );
      setConfig(res.data.tie_breakers ?? {});
      toast.success(
        replaceAll
          ? "Tie-breakers applied to the whole event (overrides cleared)."
          : "Tie-breakers saved.",
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not save the tie-breakers.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
        <IconLoader2 className="size-4 animate-spin" />
        Loading tie-breakers...
      </div>
    );
  }

  const unused = catalog.filter((c) => !criteria.includes(c.key));
  const labelOf = (k: string) => catalog.find((c) => c.key === k)?.label || k;

  return (
    <Card data-tour="leaderboard-tie-breakers">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconScale className="text-primary size-5" />
          Tie-breakers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-xs">
          When teams finish on EQUAL points, they are ordered by this arrangement (first criterion,
          then the next on a tie, and so on). Leave it empty to keep the default chain
          (booyahs, then kills). Like maps, it can apply to the whole event or be overridden per
          stage or per group.
        </p>

        {/* Scope: whole event / the currently selected stage / the currently selected group. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Applies to</Label>
            <Select value={scope} onValueChange={(v) => changeScope(v as typeof scope)}>
              <SelectTrigger className="h-8 w-64 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">The whole event</SelectItem>
                {stageId ? (
                  <SelectItem value="stage">
                    This stage{stageName ? ` (${stageName})` : ""}
                  </SelectItem>
                ) : null}
                {groupId ? (
                  <SelectItem value="group">
                    This group{groupName ? ` (${groupName})` : ""}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          {unused.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Add criterion</Label>
              <Select value="" onValueChange={addCriterion}>
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue placeholder="Add a criterion..." />
                </SelectTrigger>
                <SelectContent>
                  {unused.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* The arranged chain. */}
        {criteria.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">
            No custom arrangement for this scope - the default chain (booyahs, then kills) applies.
          </p>
        ) : (
          <div className="max-w-md space-y-1.5">
            {criteria.map((key, i) => (
              <div
                key={key}
                className="bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                <span className="text-muted-foreground w-5 text-xs font-bold">{i + 1}.</span>
                <span className="text-sm">{labelOf(key)}</span>
                <div className="ml-auto flex gap-0.5">
                  <Button
                    type="button" variant="ghost" size="icon" className="size-6"
                    onClick={() => move(i, -1)} disabled={i === 0}
                  >
                    <IconArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon" className="size-6"
                    onClick={() => move(i, 1)} disabled={i === criteria.length - 1}
                  >
                    <IconArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon" className="size-6"
                    onClick={() => removeCriterion(key)}
                  >
                    <IconX className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={() => save(false)} disabled={saving}>
            {saving ? <IconLoader2 className="size-4 animate-spin" /> : null}
            Save for this scope
          </Button>
          {scope === "all" ? (
            <Button size="sm" variant="outline" onClick={() => save(true)} disabled={saving}>
              Apply to ALL (clear stage/group overrides)
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
