"use client";

// ── Organizer portal: AI key ──────────────────────────────────────────────────
// OCR on the organization's own AI key (owner 2026-09-12).
//
// WHAT IT DOES, in plain English: result screenshots are read by an AI engine. AFC pays for ONE
// such read per organization, ever, so the organizer can see how it works; after that the
// organization connects its own key from any provider that can read an image, and its provider
// bills it. This page is where that key is connected: pick a provider, follow the plain-text
// guide, paste the key, Test it on a built-in sample screenshot, Save. Connected: the provider,
// the last four characters, who added it and when, what it has read this month and all time.
//
// RULES THE PAGE KEEPS
//   - The key is sent once and never comes back: the backend seals it and returns last_four only.
//   - Save is enabled only after a passing test (the backend tests again before it stores).
//   - Only the organization's owner or a member who manages the organization
//     (can_manage_members) may change it; anyone else sees the lock notice.
//
// HOW IT CONNECTS
//   - lib/api/aiKey.ts -> afc_organizers/views_ai_key.py (GET / PUT / DELETE / test / history).
//   - The provider list, the recommended models, the keys-page links and the dated cost lines
//     come from the backend registry (afc_ocr/services/providers/registry.py), so page and
//     server never disagree about what is offered. The guide STEPS, the key hints and the
//     free-tier lines are prose, so they live in messages/*/aiKey.json under guides.<provider>,
//     hand-written in English, French and Portuguese like every other user-facing string.
//   - The OCR upload pages point here through lib/api/ocrKeyGate.ts when a read is refused.
//   - Copy: messages/{en,fr,pt}/aiKey.json, hand-written.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconKey, IconLock, IconLoader2, IconExternalLink } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { cn } from "@/lib/utils";
import {
  aiKeyApi, aiKeyErrorMessage,
  type AiKeyEvent, type AiKeyState, type AiKeyTestResult, type AiProvider, type ProviderId,
} from "@/lib/api/aiKey";
import { useOrganizer } from "../_components/OrganizerContext";

// The day this page went live (NEW badge, 5 days, self-expiring).
const SINCE = "2026-09-12";

function money(usd: number): string {
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd > 0) return "<$0.01";
  return "$0.00";
}

export default function AiKeyPage() {
  const t = useTranslations("aiKey");
  const { slug, membership, isOwner } = useOrganizer();
  const canManage = isOwner || Boolean(membership?.permissions?.can_manage_members);

  const [state, setState] = useState<AiKeyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AiKeyEvent[]>([]);

  // the form
  const [providerId, setProviderId] = useState<ProviderId>("gemini");
  const [keyInput, setKeyInput] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [editing, setEditing] = useState(false);       // "Change key" on a connected org
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [verdict, setVerdict] = useState<AiKeyTestResult | null>(null);
  // The key + provider + model the last PASSING test ran on: Save is enabled only while the
  // form still matches it, so nobody saves a key that was never tested.
  const [passed, setPassed] = useState<{ provider: ProviderId; key: string; model: string; base_url: string } | null>(null);

  const providers = state?.providers ?? [];
  const provider: AiProvider | undefined = useMemo(
    () => providers.find((p) => p.id === providerId), [providers, providerId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await aiKeyApi.get(slug);
      setState(s);
      if (s.key) {
        setProviderId(s.key.provider);
        setModel(s.key.model);
        setBaseUrl(s.key.base_url);
      }
      const h = await aiKeyApi.history(slug);
      setHistory(h.events);
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("toastLoadFailed")));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    if (canManage) load();
    else setLoading(false);
  }, [canManage, load]);

  // Picking a provider pre-fills its recommended model (a saved key keeps its own).
  const pickProvider = (id: ProviderId) => {
    setProviderId(id);
    const p = providers.find((x) => x.id === id);
    setModel(state?.key && state.key.provider === id ? state.key.model : (p?.recommended_model ?? ""));
    setBaseUrl(id === "custom" ? (state?.key?.base_url ?? "") : "");
    setVerdict(null);
    setPassed(null);
  };

  const formMatchesPass =
    passed !== null && passed.provider === providerId && passed.key === keyInput.trim() &&
    passed.model === model.trim() && passed.base_url === baseUrl.trim();

  const handleTest = async () => {
    setTesting(true);
    setVerdict(null);
    try {
      const r = await aiKeyApi.test(slug, {
        provider: providerId, key: keyInput.trim(), model: model.trim() || undefined,
        base_url: providerId === "custom" ? baseUrl.trim() : undefined,
      });
      setVerdict(r);
      setPassed({ provider: providerId, key: keyInput.trim(), model: model.trim() || (r.model ?? ""), base_url: baseUrl.trim() });
      if (r.model && !model.trim()) setModel(r.model);
    } catch (err) {
      // A failing test answers 400 with the provider's own message: show it as the verdict.
      const data = (err as { response?: { data?: AiKeyTestResult } })?.response?.data;
      setVerdict(data && typeof data.message === "string" ? { ...data, ok: false } : { ok: false, message: aiKeyErrorMessage(err, t("toastTestFailed")), rows: 0, ms: 0 });
      setPassed(null);
    } finally {
      setTesting(false);
    }
  };

  const handleTestSaved = async () => {
    setTesting(true);
    try {
      const r = await aiKeyApi.test(slug, {});
      toast.success(r.message);
      await load();
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("toastTestFailed")));
      await load();
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formMatchesPass) return;
    setSaving(true);
    try {
      const r = await aiKeyApi.connect(slug, {
        provider: providerId, key: keyInput.trim(), model: model.trim() || undefined,
        base_url: providerId === "custom" ? baseUrl.trim() : undefined,
      });
      toast.success(t("toastSaved", { provider: provider?.name ?? providerId }));
      setKeyInput("");
      setVerdict(null);
      setPassed(null);
      setEditing(false);
      if (r.key && r.usage && state) setState({ ...state, key: r.key, usage: r.usage });
      await load();
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("toastSaveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t("confirmDisconnect"))) return;
    setDisconnecting(true);
    try {
      await aiKeyApi.disconnect(slug);
      toast.success(t("toastDisconnected"));
      setEditing(false);
      setKeyInput("");
      setVerdict(null);
      setPassed(null);
      await load();
    } catch (err) {
      toast.error(aiKeyErrorMessage(err, t("toastDisconnectFailed")));
    } finally {
      setDisconnecting(false);
    }
  };

  // ── locked: not the owner, not a manager ──
  if (!canManage) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("title")} description={t("description")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">{t("lockNotice")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("title")} description={t("description")} />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" /> {t("loading")}
        </p>
      </div>
    );
  }

  const key = state.key;
  const usage = state.usage;
  const showForm = !key || editing;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} description={t("description")} />

      {/* ── 1. what this is ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconKey className="size-4" />
            {t("whatTitle")}
            <NewBadge since={SINCE} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("what1")}</p>
          <p>{t("what2")}</p>
          <p>{t("what3")}</p>
          <p>{t("what4")}</p>
          {usage.ocr_disabled ? (
            <p className="font-medium text-destructive">{t("ocrDisabledByAdmin")}</p>
          ) : !key ? (
            <p className="font-medium text-foreground">
              {usage.free_reads_left > 0
                ? t("freeReadsLeft", { count: usage.free_reads_left })
                : t("freeReadsGone")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ── 2. connected state ── */}
      {key && !editing && (
        <Card>
          <CardHeader>
            <CardTitle>{t("connectedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted/30 p-4 text-sm">
              <p className="font-medium">
                {t("connectedLine", { provider: key.provider_name, last4: key.last_four })}
              </p>
              <p className="text-muted-foreground">
                {t("connectedBy", { who: key.added_by ?? t("someone") })}{" "}
                {key.added_at && <LocalTime value={key.added_at} />}
              </p>
              <p className="text-muted-foreground">{t("modelLine", { model: key.model })}</p>
              {key.last_tested_at && (
                <p className={cn("mt-1", key.last_test_ok ? "text-primary" : "text-destructive")}>
                  {key.last_test_ok ? t("lastTestOk") : t("lastTestFailed", { error: key.last_error })}{" "}
                  <LocalTime value={key.last_tested_at} />
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("usageMonth")}</p>
                <p className="text-xl font-bold tabular-nums">{usage.month.reads}</p>
                <p className="text-xs text-muted-foreground">{t("usageSpend", { usd: money(usage.month.estimated_usd) })}</p>
              </div>
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("usageAllTime")}</p>
                <p className="text-xl font-bold tabular-nums">{usage.all_time.reads}</p>
                <p className="text-xs text-muted-foreground">{t("usageSpend", { usd: money(usage.all_time.estimated_usd) })}</p>
              </div>
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("usageLast")}</p>
                <p className="text-sm font-medium">
                  {usage.last_read_at ? <LocalTime value={usage.last_read_at} /> : t("never")}
                </p>
                {usage.last_read_at && (
                  <p className={cn("text-xs", usage.last_read_ok ? "text-muted-foreground" : "text-destructive")}>
                    {usage.last_read_ok ? t("lastReadOk") : usage.last_read_error}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handleTestSaved} disabled={testing || disconnecting}>
                {testing ? t("testing") : t("testAgain")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditing(true); pickProvider(key.provider); }} disabled={testing || disconnecting}>
                {t("changeKey")}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={handleDisconnect} disabled={testing || disconnecting}>
                {disconnecting ? t("disconnecting") : t("disconnect")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 3. pick a provider + the guide + paste and test ── */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{key ? t("changeTitle") : t("connectTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t("pickProvider")}</Label>
              <div className="flex flex-wrap gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProvider(p.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      p.id === providerId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                    aria-pressed={p.id === providerId}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {provider && (
              <div className="space-y-3 rounded-md bg-muted/30 p-4">
                <p className="text-sm font-medium">{t("guideTitle", { provider: provider.name })}</p>
                <ol className="space-y-2 text-sm">
                  {(t.raw(`guides.${provider.id}.steps`) as string[]).map((step, i) => (
                    <li key={i} className="grid grid-cols-[28px_1fr] gap-2">
                      <span className="grid size-6 place-items-center rounded-full bg-background text-xs font-bold tabular-nums">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {provider.keys_url && (
                  <a
                    href={provider.keys_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    {t("openKeysPage", { provider: provider.name })} <IconExternalLink className="size-4" />
                  </a>
                )}
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p><span className="font-medium text-foreground">{t("keyLooksLike")}</span> {t(`guides.${provider.id}.keyHint`)}</p>
                  <p><span className="font-medium text-foreground">{t("freeTier")}</span> {t(`guides.${provider.id}.freeTier`)}</p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-foreground">{t("cost")}</span>{" "}
                    {t("costLine", { usd: provider.cost_per_image_usd.toFixed(3), date: provider.checked_on })}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t("wrongTitle")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>{t("wrong1")}</li>
                    <li>{t("wrong2")}</li>
                    <li>{t("wrong3")}</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("reportStep")}{" "}
                  <a href="/organizer/help" className="font-medium text-primary">{t("reportStepLink")}</a>
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ai-key-input">{t("keyLabel")}</Label>
                <Input
                  id="ai-key-input"
                  type="password"
                  autoComplete="off"
                  placeholder={provider ? t("keyPlaceholder", { hint: t(`guides.${provider.id}.keyHint`) }) : ""}
                  value={keyInput}
                  onChange={(e) => { setKeyInput(e.target.value); setVerdict(null); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-key-model">{t("modelLabel")}</Label>
                <Input
                  id="ai-key-model"
                  value={model}
                  onChange={(e) => { setModel(e.target.value); setVerdict(null); }}
                  placeholder={provider?.recommended_model ?? ""}
                />
                <p className="text-xs text-muted-foreground">{t("modelHelp")}</p>
              </div>
              {providerId === "custom" && (
                <div className="space-y-1.5">
                  <Label htmlFor="ai-key-base">{t("baseUrlLabel")}</Label>
                  <Input
                    id="ai-key-base"
                    value={baseUrl}
                    onChange={(e) => { setBaseUrl(e.target.value); setVerdict(null); }}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleTest} disabled={testing || saving || keyInput.trim().length < 8}>
                {testing ? t("testing") : t("testKey")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!formMatchesPass || saving || testing}>
                {saving ? t("saving") : t("save")}
              </Button>
              {key && (
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setKeyInput(""); setVerdict(null); setPassed(null); }}>
                  {t("cancel")}
                </Button>
              )}
              {!formMatchesPass && !verdict && (
                <span className="text-xs text-muted-foreground">{t("saveNeedsTest")}</span>
              )}
            </div>

            {verdict && (
              <div
                role="status"
                className={cn("rounded-md p-3 text-sm", verdict.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-foreground")}
              >
                <p className="font-medium">{verdict.ok ? t("verdictOk") : t("verdictFailed")}</p>
                <p>{verdict.message}</p>
                {!verdict.ok && <p className="mt-1 text-xs text-muted-foreground">{t("verdictFailedHelp")}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 4. privacy, in plain words ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("privacyTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("privacy1")}</p>
          <p>{t("privacy2")}</p>
          <p>{t("privacy3")}</p>
        </CardContent>
      </Card>

      {/* ── 5. history ── */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("historyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {history.map((e, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 rounded-md px-2 py-1.5 odd:bg-muted/30">
                  <span className="text-xs text-muted-foreground"><LocalTime value={e.at} /></span>
                  <span className="font-medium">{t(`action.${e.action}`)}</span>
                  {e.provider && <span className="text-muted-foreground">{e.provider}{e.last_four ? ` ····${e.last_four}` : ""}</span>}
                  {e.actor && <span className="text-muted-foreground">{t("byWho", { who: e.actor })}</span>}
                  {e.detail && <span className="text-muted-foreground">{e.detail}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
