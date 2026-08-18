"use client";

/**
 * app/(a)/a/bot/page.tsx - manage the AFC Discord bot without a shell.
 *
 * WHY THIS PAGE EXISTS (backlog item 31, owner 2026-08-18)
 *   The bot is a separate process in a separate repo. Until now everything about it was changed by
 *   editing bot.py and restarting, or by running upload_docs.py on the box it lives on, which meant
 *   only somebody with shell access could add a document, move an announcement channel or find out
 *   why it had gone quiet.
 *
 * HOW IT IS ORGANISED, AND WHY
 *   Four tabs, in the order somebody actually needs them:
 *     Status      is it alive, which AI is answering, are the loops running. The question people
 *                 open this page with.
 *     Knowledge   the documents it answers from. The thing that gets changed most often.
 *     Settings    channels, roles and intervals. Rarely, and carefully.
 *     Approvals   scrim announcements waiting on a mod, the same gate as the Discord buttons.
 *
 * THE BOT BEING UNREACHABLE IS A STATE, NOT AN ERROR
 *   A 503 renders as an explained panel with a retry, because this is the page an admin opens when
 *   the bot looks wrong. A toast that fades would be exactly the wrong answer.
 *
 * Everything here proxies through the AFC backend (afc_bot/views.py); the bot's control token never
 * reaches the browser. Head admins only, enforced server-side as well as by the nav gate.
 *
 * Strings: messages/{en,fr,pt}/adminBot.json.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  botApi,
  type BotApproval,
  type BotConfigField,
  type BotDocument,
  type BotStatus,
} from "@/lib/botAdmin";

/** Seconds to a short human string. The Status tab is scanned, not read. */
function since(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function AdminBotPage() {
  const t = useTranslations("adminBot");

  const [status, setStatus] = useState<BotStatus | null>(null);
  const [fields, setFields] = useState<BotConfigField[]>([]);
  const [documents, setDocuments] = useState<BotDocument[]>([]);
  const [approvals, setApprovals] = useState<BotApproval[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** The bot being unreachable. Held as state so it renders as an explained panel with a retry,
   *  rather than a toast that fades before the admin has read it. */
  const [unreachable, setUnreachable] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, k, a] = await Promise.all([
        botApi.status(),
        botApi.config().catch(() => ({ fields: [] })),
        botApi.knowledge().catch(() => ({ documents: [], total_chars: 0 })),
        botApi.approvals().catch(() => ({ pending: [] })),
      ]);
      setStatus(s);
      setFields(c.fields ?? []);
      setDocuments(k.documents ?? []);
      setApprovals(a.pending ?? []);
      // A field's draft starts as its current value, so the inputs show what is live.
      const next: Record<string, string> = {};
      for (const f of c.fields ?? []) {
        next[f.name] = Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "");
      }
      setDraft(next);
      setUnreachable(null);
    } catch (error: any) {
      setUnreachable(error?.response?.data?.message || t("unreachable.body"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  /** Save only the settings whose input actually differs from what is live. Sending the untouched
   *  ones back would mark every field "overridden" the first time anybody pressed Save. */
  const saveSettings = async () => {
    const values: Record<string, number | number[]> = {};
    for (const field of fields) {
      const raw = (draft[field.name] ?? "").trim();
      const live = Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? "");
      if (raw === live) continue;
      values[field.name] =
        field.kind === "ids"
          ? raw.split(",").map((piece) => Number(piece.trim())).filter((n) => !Number.isNaN(n))
          : Number(raw);
    }
    if (Object.keys(values).length === 0) {
      toast.info(t("settings.nothingChanged"));
      return;
    }
    setBusy(true);
    try {
      const res = await botApi.saveConfig(values);
      toast.success(res?.message || t("saved"));
      await load();
    } catch (error: any) {
      // The bot's own sentence, which names the setting and its bounds.
      toast.error(error?.response?.data?.message || t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<any>, fallback: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res?.message || fallback);
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || fallback);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <FullLoader text={t("loading")} />;

  // ── The bot is not answering ─────────────────────────────────────────────
  if (unreachable) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} description={t("description")} />
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconAlertTriangle className="size-4 text-gold" aria-hidden />
              {t("unreachable.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{unreachable}</p>
            <p className="text-xs">{t("unreachable.hint")}</p>
            <Button size="sm" onClick={load}>
              <IconRefresh className="mr-1.5 size-4" aria-hidden /> {t("action.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loopNames = Object.keys(status?.loops ?? {});

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")}
            <NewBadge since="2026-08-18" />
          </span>
        }
        description={t("description")}
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={busy}>
            <IconRefresh className="mr-1.5 size-4" aria-hidden /> {t("action.refresh")}
          </Button>
        }
      />

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">{t("tab.status")}</TabsTrigger>
          <TabsTrigger value="knowledge">{t("tab.knowledge")}</TabsTrigger>
          <TabsTrigger value="settings">{t("tab.settings")}</TabsTrigger>
          <TabsTrigger value="approvals">
            {t("tab.approvals")}
            {approvals.length > 0 && (
              <Badge variant="outline" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px]">
                {approvals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── STATUS ────────────────────────────────────────────────────── */}
        <TabsContent value="status" className="mt-4 space-y-4">
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {/* A solid dot, never a pulsing one. */}
                <span
                  className={`inline-block size-2 rounded-full ${
                    status?.online ? "bg-primary" : "bg-destructive"
                  }`}
                  aria-hidden
                />
                {status?.online ? t("status.online") : t("status.offline")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t("status.account")} value={status?.user ?? "-"} />
              <Stat label={t("status.uptime")} value={since(status?.uptime_secs ?? 0)} />
              <Stat
                label={t("status.knowledge")}
                value={t("status.chars", { n: status?.knowledge_chars ?? 0 })}
              />
              <Stat
                label={t("status.listening")}
                value={t("status.channels", {
                  channels: status?.listening_channels ?? 0,
                  categories: status?.listening_categories ?? 0,
                })}
              />
            </CardContent>
          </Card>

          {/* Which AI is actually answering. "Answering" and "answering on the last-resort free
              tier" look identical from Discord and cost very different things. */}
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("status.providers")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("status.providersHint")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(status?.providers ?? []).map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{p.model || "-"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("status.loops")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("status.loopsHint")}</p>
            </CardHeader>
            <CardContent>
              {loopNames.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("status.noLoopsYet")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="h-10 text-left text-foreground">
                        <th className="p-2 font-medium">{t("status.loop")}</th>
                        <th className="p-2 font-medium">{t("status.lastRun")}</th>
                        <th className="p-2 font-medium">{t("status.cycles")}</th>
                        <th className="p-2 font-medium">{t("status.errors")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loopNames.map((name, i) => {
                        const loop = status!.loops[name];
                        return (
                          <tr key={name} className={i % 2 ? "bg-muted/40" : undefined}>
                            <td className="p-2 text-foreground">{name}</td>
                            <td className="p-2 text-muted-foreground">
                              {loop.last_run_at ? (
                                <LocalTime value={new Date(loop.last_run_at * 1000).toISOString()} />
                              ) : (
                                t("status.never")
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground">{loop.runs}</td>
                            <td className="p-2">
                              {loop.errors > 0 ? (
                                <span className="text-destructive">{loop.errors}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── KNOWLEDGE ─────────────────────────────────────────────────── */}
        <TabsContent value="knowledge" className="mt-4 space-y-4">
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("knowledge.title")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("knowledge.hint")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild disabled={busy}>
                  <label className="cursor-pointer">
                    <IconUpload className="mr-1.5 size-4" aria-hidden />
                    {t("knowledge.addPublic")}
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.pdf,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) act(() => botApi.uploadDocument(file, "public"), t("saved"));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <Button size="sm" variant="outline" asChild disabled={busy}>
                  <label className="cursor-pointer">
                    <IconUpload className="mr-1.5 size-4" aria-hidden />
                    {t("knowledge.addStaff")}
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.pdf,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) act(() => botApi.uploadDocument(file, "staff"), t("saved"));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => act(botApi.rescrape, t("knowledge.rescraped"))}
                >
                  <IconRefresh className="mr-1.5 size-4" aria-hidden />
                  {t("knowledge.rescrape")}
                </Button>
              </div>

              {documents.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t("knowledge.empty")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="h-10 text-left text-foreground">
                        <th className="p-2 font-medium">{t("knowledge.document")}</th>
                        <th className="p-2 font-medium">{t("knowledge.scope")}</th>
                        <th className="p-2 font-medium">{t("knowledge.updated")}</th>
                        <th className="p-2 text-right font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc, i) => (
                        <tr key={`${doc.scope}-${doc.name}`} className={i % 2 ? "bg-muted/40" : undefined}>
                          <td className="p-2 text-foreground">{doc.name}</td>
                          <td className="p-2 text-muted-foreground">
                            {doc.scope === "staff" ? t("knowledge.staffOnly") : t("knowledge.everyone")}
                          </td>
                          <td className="p-2 text-muted-foreground">
                            <LocalTime value={new Date(doc.modified * 1000).toISOString()} />
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              disabled={busy}
                              onClick={() =>
                                act(() => botApi.removeDocument(doc.name, doc.scope), t("saved"))
                              }
                            >
                              <IconTrash className="size-3.5" aria-hidden />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SETTINGS ──────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("settings.title")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("settings.hint")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((field) => {
                const isDefault =
                  (draft[field.name] ?? "") ===
                  (Array.isArray(field.default) ? field.default.join(", ") : String(field.default ?? ""));
                return (
                  <div key={field.name} className="space-y-1">
                    <Label className="flex flex-wrap items-center gap-2 text-xs">
                      {field.name}
                      {field.overridden && (
                        <Badge
                          variant="outline"
                          className="rounded-full px-2 py-0 text-[10px] text-gold"
                        >
                          {t("settings.changed")}
                        </Badge>
                      )}
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="h-9 flex-1 text-xs"
                        value={draft[field.name] ?? ""}
                        inputMode={field.kind === "int" ? "numeric" : "text"}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                      />
                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={busy}
                          onClick={() => act(() => botApi.resetConfig(field.name), t("saved"))}
                        >
                          {t("settings.reset")}
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {field.kind === "ids"
                        ? t("settings.idsHint")
                        : field.bounds
                          ? t("settings.rangeHint", { low: field.bounds[0], high: field.bounds[1] })
                          : t("settings.idHint")}
                      {" "}
                      {t("settings.default", {
                        value: Array.isArray(field.default)
                          ? field.default.join(", ")
                          : String(field.default ?? "-"),
                      })}
                    </p>
                  </div>
                );
              })}
              <Button size="sm" disabled={busy} onClick={saveSettings}>
                {t("action.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── APPROVALS ─────────────────────────────────────────────────── */}
        <TabsContent value="approvals" className="mt-4 space-y-4">
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("approvals.title")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("approvals.hint")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {approvals.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t("approvals.empty")}
                </p>
              ) : (
                approvals.map((item) => (
                  <div
                    key={item.message_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.event_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.competition_type}
                        {item.organization_name ? ` · ${item.organization_name}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={busy}
                        onClick={() =>
                          act(() => botApi.decide(item.message_id, "approve"), t("saved"))
                        }
                      >
                        <IconCheck className="mr-1 size-3.5" aria-hidden />
                        {t("approvals.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-destructive"
                        disabled={busy}
                        onClick={() =>
                          act(() => botApi.decide(item.message_id, "reject"), t("saved"))
                        }
                      >
                        <IconX className="mr-1 size-3.5" aria-hidden />
                        {t("approvals.reject")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
