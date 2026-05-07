"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { mockNow } from "@/lib/mock-wager/clock";
import { writeAudit } from "@/lib/mock-wager/handlers/markets";
import { MIN_WAGER_KOBO, RAKE_BPS, CANCEL_FEE_BPS } from "@/lib/utils";
import type { Market, MarketOption } from "@/lib/mock-wager/types";

const TEMPLATES = [
  { code: "match_winner", name: "Match Winner" },
  { code: "first_blood", name: "First Blood" },
  { code: "mvp", name: "Match MVP" },
  { code: "most_kills", name: "Most Kills" },
  { code: "most_damage", name: "Most Damage" },
  { code: "top_3", name: "Top 3 Placement" },
  { code: "booyah_count", name: "Booyah Count" },
  { code: "survival_time", name: "Survival Time" },
  { code: "custom", name: "Custom" },
];

interface OptionDraft {
  label: string;
  ref_team_id: string;
  sort_order: number;
}

function defaultLockAt(): string {
  const t = new Date(mockNow() + 60 * 60 * 1000);
  // Format YYYY-MM-DDTHH:MM (datetime-local)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export default function CreateMarketClient() {
  const router = useRouter();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventId, setEventId] = useState("");
  const [templateCode, setTemplateCode] = useState("match_winner");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lockAt, setLockAt] = useState(defaultLockAt());
  const [minStakeNgn, setMinStakeNgn] = useState<string>(
    String(MIN_WAGER_KOBO / 100),
  );
  const [maxPerUserNgn, setMaxPerUserNgn] = useState<string>("");
  const [options, setOptions] = useState<OptionDraft[]>([
    { label: "Team A", ref_team_id: "", sort_order: 0 },
    { label: "Team B", ref_team_id: "", sort_order: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const db = await getDB();
      const evs = await db.getAll("events");
      if (cancelled) return;
      setEvents(evs.map((e) => ({ id: e.id, name: e.name })));
      if (evs.length > 0) setEventId(evs[0].id);
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addOption = () =>
    setOptions((prev) => [
      ...prev,
      { label: `Option ${prev.length + 1}`, ref_team_id: "", sort_order: prev.length },
    ]);
  const removeOption = (idx: number) =>
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  const updateOption = (idx: number, patch: Partial<OptionDraft>) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));

  const valid =
    !!eventId &&
    title.trim().length >= 3 &&
    description.trim().length >= 5 &&
    !!lockAt &&
    options.length >= 2 &&
    options.every((o) => o.label.trim().length > 0);

  const save = async (publish: boolean) => {
    if (!valid) {
      toast.error("Fill all required fields and at least 2 options");
      return;
    }
    setSaving(true);
    try {
      const db = await getDB();
      const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const market: Market = {
        id,
        event_id: eventId,
        match_id: null,
        template_code: templateCode,
        title: title.trim(),
        description: description.trim(),
        status: publish ? "OPEN" : "DRAFT",
        opens_at: new Date(mockNow()).toISOString(),
        lock_at: new Date(lockAt).toISOString(),
        min_stake_kobo: Math.max(MIN_WAGER_KOBO, Math.round(Number(minStakeNgn) * 100)),
        max_per_user_kobo: maxPerUserNgn.trim()
          ? Math.round(Number(maxPerUserNgn) * 100)
          : null,
        cancel_fee_bps: CANCEL_FEE_BPS,
        rake_bps: RAKE_BPS,
        suggested_option_id: null,
        winning_option_id: null,
        total_pool_kobo: 0,
        total_lines: 0,
        options: [],
        created_by_admin_id: "head_admin_jay",
      };
      await db.put("markets", market);
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        const opt: MarketOption = {
          id: `${id}_o${i}`,
          market_id: id,
          label: o.label.trim(),
          ref_team_id: o.ref_team_id.trim() || null,
          ref_player_id: null,
          ref_numeric: null,
          image: null,
          sort_order: o.sort_order,
          cached_pool_kobo: 0,
          cached_wager_count: 0,
        };
        await db.put("market_options", opt);
      }
      await writeAudit({
        admin_user_id: "head_admin_jay",
        action_kind: publish ? "MARKET_CREATE_OPEN" : "MARKET_CREATE_DRAFT",
        target_type: "market",
        target_id: id,
        payload: { title, template_code: templateCode, options_count: options.length },
      });
      toast.success(publish ? "Market published" : "Draft saved");
      router.push(`/a/wagers/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Create Market"
        description="Define a new pari-mutuel wager market. Save as draft or publish immediately."
        back
      />

      <Card data-testid="create-market-client">
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Event">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger data-testid="event-select">
                  <SelectValue placeholder="Pick event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Template">
              <Select value={templateCode} onValueChange={setTemplateCode}>
                <SelectTrigger data-testid="template-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Title">
            <Input
              placeholder="Match 5 Winner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="title-input"
            />
          </Field>

          <Field label="Description">
            <Textarea
              placeholder="Pick the team that wins Match 5 of the AFC Champs Finals."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Lock at">
              <Input
                type="datetime-local"
                value={lockAt}
                onChange={(e) => setLockAt(e.target.value)}
              />
            </Field>
            <Field label="Min stake (₦)">
              <Input
                type="number"
                inputMode="numeric"
                value={minStakeNgn}
                onChange={(e) => setMinStakeNgn(e.target.value)}
              />
            </Field>
            <Field label="Max per user (₦, optional)">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="50,000"
                value={maxPerUserNgn}
                onChange={(e) => setMaxPerUserNgn(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Options ({options.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={addOption} data-testid="add-option">
                <Plus className="size-3.5" />
                Add option
              </Button>
            </div>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2" data-testid="option-row">
                <Input
                  placeholder="Label"
                  value={o.label}
                  onChange={(e) => updateOption(i, { label: e.target.value })}
                />
                <Input
                  placeholder="ref_team_id (optional)"
                  value={o.ref_team_id}
                  onChange={(e) => updateOption(i, { ref_team_id: e.target.value })}
                  className="max-w-[180px]"
                />
                {options.length > 2 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeOption(i)}
                  >
                    <Trash2 className="size-3.5 text-rose-400" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <CardDescription>
            Pari-mutuel pool: {RAKE_BPS / 100}% house rake on winnings,{" "}
            {CANCEL_FEE_BPS / 100}% pre-lock cancel fee.
          </CardDescription>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={!valid || saving}
              data-testid="save-draft"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save as Draft
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={!valid || saving}
              data-testid="publish"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
