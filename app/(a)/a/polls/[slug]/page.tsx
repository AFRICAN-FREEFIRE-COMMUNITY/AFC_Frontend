"use client";

// ── Admin · Poll builder (/a/polls/[slug]) ───────────────────────────────────
// Five tabs, in the order somebody actually builds a poll: what it is, what it asks,
// who may answer, what an answer leads to, and what came back.
//
//   Basics      title, description, edition, the visibility and results switches, the dates
//   Questions   the whole question list with its options, saved as ONE replace
//   Who can vote the audience spec, using the SAME preview endpoint the broadcast composer
//               uses, so the audience an admin picks for a poll is literally the audience
//               they would pick for a broadcast (that reuse is why polls extended
//               afc_auth/audience.py rather than writing a second engine)
//   Branching   a flat list of readable sentences: "When Q1 is X, show Q3"
//   Results     the numbers, the published winner per question, and "announce this poll"
//
// TWO RULES THE UI HAS TO SURFACE RATHER THAN HIDE
//   1. QUESTIONS LOCK ONCE PEOPLE HAVE ANSWERED. The backend refuses the save with a 409,
//      because editing the questions under an existing response set silently changes what
//      those people were asked. The tab says so up front instead of letting somebody type
//      for ten minutes into a form that cannot save.
//   2. ANONYMITY IS A ONE-WAY SWITCH and is mutually exclusive with the voter list. Both
//      are enforced server-side in _apply_poll_fields; the switches here explain why rather
//      than silently ignoring a change.
//
// TALKS TO lib/polls.ts -> backend afc_polls/views.py, and lib/broadcastAudience.ts ->
// afc_auth/views_broadcast_audience.py for the audience counts.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { ANSWER_TYPES, BRANCHABLE_TYPES, pollsApi, type BranchRule } from "@/lib/polls";
import { describeRule } from "@/lib/pollBranching";
import { broadcastAudienceApi, type AudienceOptions } from "@/lib/broadcastAudience";

type BuilderQuestion = {
  question_id?: number;
  prompt: string;
  help_text: string;
  answer_type: string;
  required: boolean;
  config: Record<string, any>;
  options: { option_id?: number; label: string; description?: string }[];
  published_winner_option_id?: number | null;
  published_winner_votes?: number | null;
};

export default function PollBuilderPage() {
  const t = useTranslations("adminPolls");
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const { token } = useAuth();

  const [poll, setPoll] = useState<any>(null);
  const [questions, setQuestions] = useState<BuilderQuestion[]>([]);
  const [rules, setRules] = useState<BranchRule[]>([]);
  const [audience, setAudience] = useState<Record<string, any>>({});
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await pollsApi.adminGet(slug);
      setPoll(data);
      setQuestions(data.questions || []);
      setRules(data.branch_rules || []);
      setAudience(data.eligibility || {});
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    broadcastAudienceApi.options(token).then(setOptions).catch(() => setOptions(null));
  }, [token]);

  const saveBasics = async (patch: Record<string, any>) => {
    setSaving(true);
    try {
      await pollsApi.adminUpdate(slug, patch);
      toast.success(t("edit.saved"));
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("edit.failed"));
    } finally {
      setSaving(false);
    }
  };

  const saveQuestions = async () => {
    setSaving(true);
    try {
      await pollsApi.adminSaveQuestions(slug, questions, rules);
      toast.success(t("questions.saved"));
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("edit.failed"));
    } finally {
      setSaving(false);
    }
  };

  const previewAudience = async () => {
    if (!token) return;
    try {
      const preview = await broadcastAudienceApi.preview(token, audience as any, { limit: 1 });
      setAudienceCount(preview.recipient_count);
    } catch (error: any) {
      // A spec that selects nobody is a 400 by design, so an empty audience is reported as zero
      // rather than as a failure: "nothing selected" is a real answer an admin needs to see.
      setAudienceCount(0);
      if (error?.response?.status !== 400) {
        toast.error(error?.response?.data?.message || t("edit.failed"));
      }
    }
  };

  if (loading) return <FullLoader />;
  if (!poll) {
    return (
      <div className="py-10">
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="text-center text-sm text-muted-foreground">
            {t("notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-8">
      <Link
        href="/a/polls"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        {t("backToList")}
      </Link>

      <PageHeader title={poll.title} description={`/polls/${poll.slug}`} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
          {t(`visibility.${poll.visibility}`)}
        </Badge>
        {poll.has_responses && (
          <Badge
            variant="outline"
            className="rounded-full border-gold/50 px-2 py-0.5 text-xs text-gold"
          >
            {t("questions.locked")}
          </Badge>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/polls/${poll.slug}`}>{t("viewPublic")}</Link>
        </Button>
      </div>

      <Tabs defaultValue="basics" className="mt-6 w-full">
        {/* Scrolls rather than wrapping at 390px: five tabs do not fit on a phone, and a wrapped
            tab list pushes the whole page down. */}
        <div className="overflow-x-auto">
          <TabsList className="h-9 bg-muted">
            <TabsTrigger value="basics">{t("tabs.basics")}</TabsTrigger>
            <TabsTrigger value="questions">{t("tabs.questions")}</TabsTrigger>
            <TabsTrigger value="audience">{t("tabs.audience")}</TabsTrigger>
            <TabsTrigger value="branching">{t("tabs.branching")}</TabsTrigger>
            <TabsTrigger value="results">{t("tabs.results")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="basics" className="mt-6">
          <BasicsTab poll={poll} saving={saving} onSave={saveBasics} />
        </TabsContent>

        <TabsContent value="questions" className="mt-6">
          <QuestionsTab
            questions={questions}
            setQuestions={setQuestions}
            locked={poll.has_responses}
            saving={saving}
            onSave={saveQuestions}
          />
        </TabsContent>

        <TabsContent value="audience" className="mt-6">
          <AudienceTab
            audience={audience}
            setAudience={setAudience}
            options={options}
            count={audienceCount}
            onPreview={previewAudience}
            saving={saving}
            onSave={() => saveBasics({ eligibility: audience })}
          />
        </TabsContent>

        <TabsContent value="branching" className="mt-6">
          <BranchingTab
            questions={questions}
            rules={rules}
            setRules={setRules}
            saving={saving}
            onSave={saveQuestions}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ResultsTab slug={slug} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Basics ───────────────────────────────────────────────────────────────────

function BasicsTab({
  poll,
  saving,
  onSave,
}: {
  poll: any;
  saving: boolean;
  onSave: (patch: Record<string, any>) => void;
}) {
  const t = useTranslations("adminPolls");
  const [form, setForm] = useState<Record<string, any>>({ ...poll });

  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm">
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>{t("fields.title")}</Label>
          <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("fields.description")}</Label>
          <Textarea
            rows={3}
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("fields.visibility")}</Label>
            <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["draft", "public", "link_only", "preview_only"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`visibility.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("fields.resultsVisibility")}</Label>
            <Select
              value={form.results_visibility}
              onValueChange={(v) => setForm({ ...form, results_visibility: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["admins_only", "after_close", "after_announcement", "always"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`resultsVisibility.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.results_visibility === "after_announcement" && (
              <p className="text-xs text-muted-foreground">{t("fields.afterAnnouncementHint")}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("fields.opensAt")}</Label>
            <Input
              type="datetime-local"
              value={toLocalInput(form.opens_at)}
              onChange={(e) => setForm({ ...form, opens_at: fromLocalInput(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">{t("fields.opensHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("fields.closesAt")}</Label>
            <Input
              type="datetime-local"
              value={toLocalInput(form.closes_at)}
              onChange={(e) => setForm({ ...form, closes_at: fromLocalInput(e.target.value) })}
            />
          </div>
        </div>

        <SwitchRow
          label={t("switches.allowEdit")}
          hint={t("switches.allowEditHint")}
          checked={!!form.allow_edit_until_close}
          onChange={(checked) => setForm({ ...form, allow_edit_until_close: checked })}
        />
        <SwitchRow
          label={t("switches.anonymous")}
          // One-way, and it says so. It may be turned on while no response exists and off only
          // while no response exists, because turning it off later would leave the responses
          // already collected with no respondent to restore.
          hint={
            poll.has_responses
              ? t("switches.anonymousLocked")
              : form.anonymous && form.allow_edit_until_close
                ? t("switches.anonymousEditableCaveat")
                : t("switches.anonymousHint")
          }
          checked={!!form.anonymous}
          disabled={poll.has_responses}
          onChange={(checked) =>
            setForm({ ...form, anonymous: checked, show_voter_list: checked ? false : form.show_voter_list })
          }
        />
        <SwitchRow
          label={t("switches.voterList")}
          hint={form.anonymous ? t("switches.voterListBlocked") : t("switches.voterListHint")}
          checked={!!form.show_voter_list}
          disabled={!!form.anonymous}
          onChange={(checked) => setForm({ ...form, show_voter_list: checked })}
        />

        {form.subject === "team" && (
          <div className="space-y-4 rounded-md border border-border p-3">
            <p className="text-xs font-semibold text-foreground">{t("team.heading")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("fields.quorum")}</Label>
                <Select
                  value={form.team_quorum}
                  onValueChange={(v) => setForm({ ...form, team_quorum: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["any", "half", "all"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`quorum.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("fields.quorumHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.tiePolicy")}</Label>
                <Select
                  value={form.team_tie_policy}
                  onValueChange={(v) => setForm({ ...form, team_tie_policy: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["captain", "none", "earliest"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`tiePolicy.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SwitchRow
              label={t("switches.captainOverride")}
              hint={t("switches.captainOverrideHint")}
              checked={!!form.captain_override_allowed}
              onChange={(checked) => setForm({ ...form, captain_override_allowed: checked })}
            />
            <SwitchRow
              label={t("switches.showRollup")}
              hint={t("switches.showRollupHint")}
              checked={!!form.show_rollup_while_open}
              onChange={(checked) => setForm({ ...form, show_rollup_while_open: checked })}
            />
          </div>
        )}

        <div className="flex justify-end">
          <Button disabled={saving} onClick={() => onSave(form)}>
            {saving ? t("create.saving") : t("edit.button")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

// ── Questions ────────────────────────────────────────────────────────────────

function QuestionsTab({
  questions,
  setQuestions,
  locked,
  saving,
  onSave,
}: {
  questions: BuilderQuestion[];
  setQuestions: (next: BuilderQuestion[]) => void;
  locked: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("adminPolls");

  const patch = (index: number, changes: Partial<BuilderQuestion>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...changes };
    setQuestions(next);
  };

  return (
    <div className="space-y-4">
      {locked && (
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="text-xs text-muted-foreground">{t("questions.lockedHint")}</CardContent>
        </Card>
      )}

      {questions.map((question, index) => (
        <Card key={question.question_id ?? `new-${index}`} className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  value={question.prompt}
                  disabled={locked}
                  placeholder={t("questions.promptPlaceholder")}
                  onChange={(e) => patch(index, { prompt: e.target.value })}
                />
                <Input
                  value={question.help_text || ""}
                  disabled={locked}
                  placeholder={t("questions.helpPlaceholder")}
                  onChange={(e) => patch(index, { help_text: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={question.answer_type}
                    disabled={locked}
                    onValueChange={(value) => patch(index, { answer_type: value })}
                  >
                    <SelectTrigger className="w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANSWER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`answerType.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={question.required}
                      disabled={locked}
                      onCheckedChange={(checked) => patch(index, { required: checked })}
                    />
                    {t("questions.required")}
                  </label>
                  {question.answer_type === "multiple_choice" && (
                    <Input
                      type="number"
                      className="w-32"
                      disabled={locked}
                      placeholder={t("questions.maxChoices")}
                      value={question.config?.max_choices ?? ""}
                      onChange={(e) =>
                        patch(index, {
                          config: { ...question.config, max_choices: Number(e.target.value) || undefined },
                        })
                      }
                    />
                  )}
                  {question.answer_type === "rating" && (
                    <Input
                      type="number"
                      className="w-32"
                      disabled={locked}
                      placeholder={t("questions.scalePoints")}
                      value={question.config?.scale_points ?? ""}
                      onChange={(e) =>
                        patch(index, {
                          config: { ...question.config, scale_points: Number(e.target.value) || undefined },
                        })
                      }
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={locked}
                    onClick={() => setQuestions(questions.filter((_, i) => i !== index))}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Options only exist for the choice family. A rating or a free-text question
                    has no options, so showing an empty option editor there would invite an
                    admin to fill in something the answer type cannot use. */}
                {["single_choice", "multiple_choice", "ranking"].includes(question.answer_type) && (
                  <div className="space-y-1.5 border-l border-border pl-3">
                    {question.options.map((option, optionIndex) => (
                      <div key={option.option_id ?? `new-${optionIndex}`} className="flex gap-2">
                        <Input
                          value={option.label}
                          disabled={locked}
                          placeholder={t("questions.optionPlaceholder")}
                          onChange={(e) => {
                            const next = [...question.options];
                            next[optionIndex] = { ...next[optionIndex], label: e.target.value };
                            patch(index, { options: next });
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={locked}
                          onClick={() =>
                            patch(index, {
                              options: question.options.filter((_, i) => i !== optionIndex),
                            })
                          }
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={locked}
                      onClick={() => patch(index, { options: [...question.options, { label: "" }] })}
                    >
                      <IconPlus className="mr-1 h-3.5 w-3.5" />
                      {t("questions.addOption")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          disabled={locked}
          onClick={() =>
            setQuestions([
              ...questions,
              {
                prompt: "",
                help_text: "",
                answer_type: "single_choice",
                required: false,
                config: {},
                options: [{ label: "" }, { label: "" }],
              },
            ])
          }
        >
          <IconPlus className="mr-1.5 h-4 w-4" />
          {t("questions.addQuestion")}
        </Button>
        <Button disabled={locked || saving} onClick={onSave}>
          {saving ? t("create.saving") : t("questions.save")}
        </Button>
      </div>
    </div>
  );
}

// ── Who can vote ─────────────────────────────────────────────────────────────

function AudienceTab({
  audience,
  setAudience,
  options,
  count,
  onPreview,
  saving,
  onSave,
}: {
  audience: Record<string, any>;
  setAudience: (next: Record<string, any>) => void;
  options: AudienceOptions | null;
  count: number | null;
  onPreview: () => void;
  saving: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("adminPolls");

  const toggle = (key: string, value: string) => {
    const current: string[] = audience[key] || [];
    setAudience({
      ...audience,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="space-y-5">
          <SwitchRow
            label={t("audience.everyone")}
            hint={t("audience.everyoneHint")}
            checked={!!audience.everyone}
            onChange={(checked) => setAudience({ ...audience, everyone: checked })}
          />

          {!audience.everyone && (
            <>
              <ChipGroup
                label={t("audience.countries")}
                values={options?.countries?.slice(0, 24).map((o) => ({ value: o.value, label: o.label || o.value })) || []}
                selected={audience.countries || []}
                onToggle={(value) => toggle("countries", value)}
              />
              {/* TWO tier systems, never merged behind one control, and neither ever shows its raw
                  number: team tier 1 is the BEST while season tier 0 (Elite) is the best, so an
                  admin who read "tier 3" off one and applied it to the other would get the
                  opposite of what they meant. */}
              <ChipGroup
                label={t("audience.teamTiers")}
                hint={t("audience.teamTiersHint")}
                values={["1", "2", "3"].map((value) => ({ value, label: `Tier ${value}` }))}
                selected={audience.tiers || []}
                onToggle={(value) => toggle("tiers", value)}
              />
              <SeasonTierPicker audience={audience} setAudience={setAudience} />
              <ChipGroup
                label={t("audience.teamRoles")}
                hint={t("audience.teamRolesHint")}
                values={[
                  { value: "team_captain", label: t("teamRole.team_captain") },
                  { value: "vice_captain", label: t("teamRole.vice_captain") },
                  { value: "member", label: t("teamRole.member") },
                  { value: "coach", label: t("teamRole.coach") },
                  { value: "manager", label: t("teamRole.manager") },
                  { value: "analyst", label: t("teamRole.analyst") },
                ]}
                selected={audience.team_roles || []}
                onToggle={(value) => toggle("team_roles", value)}
              />
              {(audience.tiers?.length > 0 || audience.season_tiers?.values?.length > 0) &&
                audience.tiers?.length > 0 &&
                audience.season_tiers?.values?.length > 0 && (
                  <p className="rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-gold">
                    {t("audience.intersectWarning")}
                  </p>
                )}
            </>
          )}

          {/* Its own card, OUTSIDE the audience filters and unaffected by "Everyone on AFC".
              A person with an empty UID IS the audience, they simply cannot vote yet, so this
              never shrinks the count: ticking one and watching the number stay put is the
              visible form of that argument. */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium text-foreground">{t("audience.beforeTheyVote")}</p>
            <p className="text-xs text-muted-foreground">{t("audience.beforeTheyVoteHint")}</p>
            <ChipGroup
              label=""
              values={[
                { value: "uid", label: t("profileField.uid") },
                { value: "country", label: t("profileField.country") },
              ]}
              selected={audience.require_profile_fields || []}
              onToggle={(value) => toggle("require_profile_fields", value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {count === null ? t("audience.noCount") : t("audience.count", { count })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onPreview}>
                {t("audience.preview")}
              </Button>
              <Button size="sm" disabled={saving} onClick={onSave}>
                {saving ? t("create.saving") : t("edit.button")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SeasonTierPicker({
  audience,
  setAudience,
}: {
  audience: Record<string, any>;
  setAudience: (next: Record<string, any>) => void;
}) {
  const t = useTranslations("adminPolls");
  const block = audience.season_tiers || { scope: "team", values: [] };
  const toggle = (value: number) => {
    const values: number[] = block.values || [];
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    setAudience({
      ...audience,
      season_tiers: next.length ? { ...block, values: next } : undefined,
    });
  };

  return (
    <div className="space-y-1.5">
      <Label>{t("audience.seasonTiers")}</Label>
      {/* Frozen at poll open, and the hint says so: a live rank or tier rule would show somebody
          a ballot on Monday and refuse their submission on Tuesday. */}
      <p className="text-xs text-muted-foreground">{t("audience.seasonTiersHint")}</p>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              (block.values || []).includes(value)
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground"
            }`}
          >
            {t(`seasonTier.${value}`)}
          </button>
        ))}
      </div>
      {(block.values || []).length > 0 && (
        <Select
          value={block.scope || "team"}
          onValueChange={(scope) => setAudience({ ...audience, season_tiers: { ...block, scope } })}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">{t("audience.scopeTeam")}</SelectItem>
            <SelectItem value="player">{t("audience.scopePlayer")}</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function ChipGroup({
  label,
  hint,
  values,
  selected,
  onToggle,
}: {
  label: string;
  hint?: string;
  values: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {values.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              selected.includes(option.value)
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Branching ────────────────────────────────────────────────────────────────

function BranchingTab({
  questions,
  rules,
  setRules,
  saving,
  onSave,
}: {
  questions: BuilderQuestion[];
  rules: BranchRule[];
  setRules: (next: BranchRule[]) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("adminPolls");
  // Only saved questions can be watched or targeted: a rule points at an id, and an unsaved
  // question does not have one yet.
  const saved = useMemo(() => questions.filter((q) => q.question_id), [questions]);
  const watchable = saved.filter((q) => BRANCHABLE_TYPES.includes(q.answer_type as any));

  return (
    <div className="space-y-4">
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>{t("branching.intro")}</p>
          <p>{t("branching.watchable")}</p>
        </CardContent>
      </Card>

      {rules.map((rule, index) => {
        const watched = saved.find((q) => q.question_id === rule.when_question_id);
        return (
          <Card key={index} className="bg-card rounded-md border py-6 shadow-sm">
            <CardContent className="space-y-3">
              {/* The whole logic of a poll reads as a list of sentences. That readability is the
                  entire reason branching is a flat rule list rather than a node graph. */}
              <p className="text-xs font-medium text-foreground">
                {describeRule(rule, saved as any)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("branching.when")}</Label>
                  <Select
                    value={String(rule.when_question_id || "")}
                    onValueChange={(value) => {
                      const next = [...rules];
                      next[index] = { ...rule, when_question_id: Number(value), value: {} };
                      setRules(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("branching.pickQuestion")} />
                    </SelectTrigger>
                    <SelectContent>
                      {watchable.map((question) => (
                        <SelectItem key={question.question_id} value={String(question.question_id)}>
                          {question.prompt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("branching.operator")}</Label>
                  <Select
                    value={rule.operator}
                    onValueChange={(value) => {
                      const next = [...rules];
                      next[index] = { ...rule, operator: value as BranchRule["operator"] };
                      setRules(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["is", "is_not", "is_any_of", "gte", "lte"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`branching.op.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {rule.operator === "gte" || rule.operator === "lte" ? (
                <div className="space-y-1.5">
                  <Label>{t("branching.rating")}</Label>
                  <Input
                    type="number"
                    className="w-32"
                    value={rule.value?.rating ?? ""}
                    onChange={(e) => {
                      const next = [...rules];
                      next[index] = { ...rule, value: { rating: Number(e.target.value) } };
                      setRules(next);
                    }}
                  />
                </div>
              ) : (
                <ChipGroup
                  label={t("branching.answer")}
                  values={(watched?.options || [])
                    .filter((o) => o.option_id)
                    .map((o) => ({ value: String(o.option_id), label: o.label }))}
                  selected={(rule.value?.option_ids || []).map(String)}
                  onToggle={(value) => {
                    const current = rule.value?.option_ids || [];
                    const id = Number(value);
                    const next = [...rules];
                    next[index] = {
                      ...rule,
                      value: {
                        option_ids: current.includes(id)
                          ? current.filter((v) => v !== id)
                          : [...current, id],
                      },
                    };
                    setRules(next);
                  }}
                />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("branching.action")}</Label>
                  <Select
                    value={rule.action}
                    onValueChange={(value) => {
                      const next = [...rules];
                      next[index] = { ...rule, action: value as BranchRule["action"] };
                      setRules(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show">{t("branching.show")}</SelectItem>
                      <SelectItem value="hide">{t("branching.hide")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("branching.target")}</Label>
                  <Select
                    value={String(rule.target_question_id || "")}
                    onValueChange={(value) => {
                      const next = [...rules];
                      next[index] = { ...rule, target_question_id: Number(value), target_section_id: null };
                      setRules(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("branching.pickQuestion")} />
                    </SelectTrigger>
                    <SelectContent>
                      {saved
                        .filter((q) => q.question_id !== rule.when_question_id)
                        .map((question) => (
                          <SelectItem key={question.question_id} value={String(question.question_id)}>
                            {question.prompt}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRules(rules.filter((_, i) => i !== index))}
                >
                  <IconTrash className="mr-1 h-3.5 w-3.5" />
                  {t("branching.remove")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          disabled={watchable.length === 0 || saved.length < 2}
          onClick={() =>
            setRules([
              ...rules,
              {
                when_question_id: watchable[0]?.question_id as number,
                operator: "is",
                value: { option_ids: [] },
                action: "show",
                target_question_id: null,
                target_section_id: null,
              },
            ])
          }
        >
          <IconPlus className="mr-1.5 h-4 w-4" />
          {t("branching.addRule")}
        </Button>
        <Button disabled={saving} onClick={onSave}>
          {saving ? t("create.saving") : t("branching.save")}
        </Button>
      </div>
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────

function ResultsTab({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const t = useTranslations("adminPolls");
  const [results, setResults] = useState<any>(null);
  const [announcing, setAnnouncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setResults(await pollsApi.adminResults(slug));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("loadFailed"));
    }
  }, [slug, t]);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (questionId: number, optionId: number, votes: number | null) => {
    try {
      await pollsApi.adminPublishWinner(slug, {
        question_id: questionId,
        option_id: optionId,
        votes,
      });
      toast.success(t("results.published"));
      await load();
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("edit.failed"));
    }
  };

  const announce = async () => {
    setAnnouncing(true);
    try {
      const result = await pollsApi.adminAnnounce(slug, { delivery: "push" });
      toast.success(t("results.announced", { count: result.pushed }));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("edit.failed"));
    } finally {
      setAnnouncing(false);
    }
  };

  if (!results) return <FullLoader />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t("results.responses")} value={results.headline.responses} />
        <StatTile label={t("results.eligible")} value={results.headline.eligible_count ?? "-"} />
        <StatTile
          label={t("results.turnout")}
          value={
            results.headline.turnout_percent == null ? "-" : `${results.headline.turnout_percent}%`
          }
        />
      </div>

      {/* Removed rather than merely restricted on an anonymous poll: a breakdown by team over 18
          Tier 1 teams identifies people whatever a small-cell floor says, and an anonymous poll
          promised that would not happen. */}
      {!results.breakdowns_available && (
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="text-xs text-muted-foreground">
            {t("results.anonymousNote")}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={announcing} onClick={announce}>
          {announcing ? t("create.saving") : t("results.announce")}
        </Button>
      </div>

      {results.questions.map((question: any) => (
        <Card key={question.question_id} className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{question.prompt}</p>
            {question.options.map((option: any) => (
              <div key={option.option_id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="tabular-nums text-muted-foreground">{option.votes ?? 0}</span>
                <Button
                  size="sm"
                  variant={
                    question.published_winner_option_id === option.option_id ? "default" : "outline"
                  }
                  onClick={() => publish(question.question_id, option.option_id, option.votes ?? null)}
                >
                  {question.published_winner_option_id === option.option_id
                    ? t("results.isWinner")
                    : t("results.publishWinner")}
                </Button>
              </div>
            ))}
            {/* Not a tally: publishing is an editorial act with a date on it, and for the 2025
                ballots the published number was transcribed rather than counted. */}
            {question.published_winner_votes != null && (
              <p className="text-xs text-muted-foreground">
                {t("results.publishedVotes", { count: question.published_winner_votes })}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {results.team_results?.length > 0 && (
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{t("results.teamResults")}</p>
            {results.team_results.map((row: any, index: number) => (
              <div key={index} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{row.team_name}</span>
                <span className="text-muted-foreground">
                  {row.answered_count} / {row.playing_roster_size}
                </span>
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                  {row.winning_option_label || t(`team.resolution.${row.resolution}`)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

// ── datetime-local <-> ISO. The backend is UTC; the input is local with no zone. ──
function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
