"use client";

// ── AudienceBuilder - who does this broadcast go to? ──────────────────────────
//
// Owner backlog item 15 (2026-08-03): "Notifications settings: admins select specific teams and
// players, or filter by category (tier, country, others), for notification or bulk mail, and can
// send to the entire site."
//
// The DELIVERY half of broadcasting already existed (afc_auth.views.deliver_broadcast writes the
// in-app notifications, sends the branded email and records the SentBroadcast history). This
// component is the RECIPIENT SELECTION half, and it replaces the old bulk composer, which could
// only reach users the admin picked one by one from the already-loaded admin list.
//
// THE TWO RULES THAT SHAPE THIS WHOLE SCREEN. Both are enforced on the backend too, so neither
// can be bypassed by calling the API directly; the UI exists to make them impossible to trip over
// rather than to be the only guard:
//
//   1. COUNT BEFORE SEND. There is no undo on a broadcast. The recipient count is the loudest
//      thing on the screen, Send is disabled until a preview for the CURRENT selection has come
//      back, and the confirm dialog repeats the number. The send call passes that number as
//      confirmed_count; if the audience changed size in the meantime the server 409s and we show
//      the new number instead of sending.
//
//   2. EMAIL VOLUME IS REAL. AFC's mail goes through Microsoft 365: roughly 30 messages a minute
//      and 1,000 a day to people who have never received AFC mail. Emailing all ~6,800 users would
//      take hours and be throttled. So the preview carries a plain-English verdict which we show
//      as a banner, In-app is the DEFAULT channel and the only one offered without warning for a
//      large audience, a "slow" email blast needs an explicit confirmation checkbox, and an
//      over-the-daily-cap one has the Email options disabled entirely. We never silently queue
//      mail that cannot deliver.
//
// HOW THE SELECTION COMBINES (stated in the helper line on screen, so it must not drift from
// afc_auth/audience.py, which is the authority):
//   - "Everyone on AFC" wins outright.
//   - Otherwise: picked players + picked teams' members and owners + everyone matching the
//     category filters, all UNIONed.
//   - Within the categories the filters INTERSECT (tier AND country AND role AND language).
//   - Nothing selected is an empty audience, never an accidental send to all.
//
// HOW THIS CONNECTS TO THE REST OF THE SYSTEM:
//   - API: lib/broadcastAudience.ts -> /auth/admin/broadcast-audience/{options,preview,send}/
//     (afc_auth/views_broadcast_audience.py).
//   - Delivery goes through the same deliver_broadcast chokepoint as every other broadcast, so a
//     send from here appears in the existing "Sent broadcasts" history right below this card
//     (<BroadcastHistory scope="general" />) with no extra wiring.
//   - Deep links reuse <NotificationTargetSelector/>, the same control the other admin composers
//     use, so a "Take me there" button behaves identically wherever it was sent from.
//   - Pickers are the shared <TeamSearchSelect/> and <UserSearchSelect/> typeaheads.
//
// Design follows the AFC admin idiom: shadcn Card + Label + Select + Table, text-xs table density,
// outline rounded-full badges, sonner toasts, AlertDialog for the irreversible confirm. The sample
// table scrolls inside its own container so it never pushes the page sideways on a phone.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TeamSearchSelect, type PickedTeam } from "@/components/ui/team-search-select";
import { UserSearchSelect, type PickedUser } from "@/components/ui/user-search-select";
import {
  IconAlertTriangle,
  IconLoader2,
  IconMail,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  broadcastAudienceApi,
  type AudienceOptions,
  type AudiencePreview,
  type AudienceSpec,
} from "@/lib/broadcastAudience";
import {
  NotificationTargetSelector,
  EMPTY_TARGET,
  type NotificationTarget,
  type EventOption,
} from "@/app/(a)/a/_components/NotificationTargetSelector";

/** How many sample rows the "who is in this" table shows. Deliberately small: it is a sanity
 *  check that the filters caught the right people, not a user directory. */
const SAMPLE_LIMIT = 8;

/** Debounce on the preview call. The spec changes on every click in a multi-select, and each
 *  preview is a COUNT over the whole user table, so we let the admin finish clicking first. */
const PREVIEW_DEBOUNCE_MS = 400;

/** Toggle one value in a string filter list (the category multi-selects are click-to-toggle
 *  chips rather than Selects, because an admin routinely picks several countries at once). */
function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AudienceBuilder() {
  const { token } = useAuth();
  const t = useTranslations("notifyAudience");

  // ── Filter options, loaded once (countries/tiers/roles/languages WITH counts) ──
  const [options, setOptions] = useState<AudienceOptions | null>(null);

  // ── The audience selection ──
  const [everyone, setEveryone] = useState(false);
  // Teams: the picker gives numeric ids directly.
  const [teamIds, setTeamIds] = useState<number[]>([]);
  // Players: the picker is keyed by USERNAME but the API needs user_ids, so we keep a
  // username -> id map filled in as each pick arrives (the picker hands back the picked user).
  const [usernames, setUsernames] = useState<string[]>([]);
  const [userIdByUsername, setUserIdByUsername] = useState<Record<string, number>>({});
  const [tiers, setTiers] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [includeSuspended, setIncludeSuspended] = useState(false);

  // ── The message ──
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  // In-app is the default channel: it is the one that always delivers, at any audience size.
  const [delivery, setDelivery] = useState<"push" | "email" | "both">("push");
  const [confirmLargeEmail, setConfirmLargeEmail] = useState(false);
  const [target, setTarget] = useState<NotificationTarget>(EMPTY_TARGET);
  const [targetEvents, setTargetEvents] = useState<EventOption[]>([]);

  // ── Preview + send state ──
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // The spec sent to preview/send. Memoised on the selection so the preview effect below only
  // refires when the SELECTION changes, not when the admin is typing their message.
  const spec: AudienceSpec = useMemo(
    () => ({
      everyone,
      user_ids: usernames
        .map((u) => userIdByUsername[u])
        .filter((id): id is number => typeof id === "number"),
      team_ids: teamIds,
      tiers,
      countries,
      roles,
      languages,
      include_suspended: includeSuspended,
    }),
    [everyone, usernames, userIdByUsername, teamIds, tiers, countries, roles, languages, includeSuspended],
  );

  // Has the admin selected anything at all? An empty selection is never sent (and the backend
  // 400s it independently), so we skip the preview call entirely rather than show an error.
  const hasSelection =
    everyone ||
    (spec.user_ids?.length ?? 0) > 0 ||
    teamIds.length > 0 ||
    tiers.length > 0 ||
    countries.length > 0 ||
    roles.length > 0 ||
    languages.length > 0;

  // ── Load the filter options once ──
  useEffect(() => {
    if (!token) return;
    broadcastAudienceApi
      .options(token)
      .then(setOptions)
      .catch(() => toast.error(t("toast.optionsError")));
  }, [token, t]);

  // ── Preview whenever the SELECTION changes (debounced) ──
  // This is what makes "count before send" automatic: the number on screen always describes the
  // current selection, and clearing it while a new one is in flight stops a stale count from
  // being confirmable.
  useEffect(() => {
    if (!token) return;
    if (!hasSelection) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    setPreview(null);           // a stale count must never be sendable
    const timer = setTimeout(async () => {
      try {
        const res = await broadcastAudienceApi.preview(token, spec, { limit: SAMPLE_LIMIT });
        if (cancelled) return;
        setPreview(res);
        setPreviewError(null);
        // Follow the backend's recommendation for the channel default, so a large audience lands
        // on in-app rather than on a mail blast the provider would throttle. We only ever pull
        // the admin DOWN to push; if they deliberately chose email we leave their choice alone
        // unless the volume verdict makes it impossible (handled below).
        if (res.recommended_delivery === "push" && res.email_volume.blocked) {
          setDelivery("push");
        }
      } catch (err: any) {
        if (cancelled) return;
        setPreviewError(err?.response?.data?.message || t("toast.previewError"));
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, spec, hasSelection, t]);

  // A "blocked" verdict means the mail provider cannot deliver this many today, so the email
  // channels are taken off the table entirely rather than left to fail.
  const emailBlocked = !!preview?.email_volume.blocked;
  const emailNeedsConfirm = !!preview?.email_volume.requires_confirmation;
  const wantsEmail = delivery === "email" || delivery === "both";

  // Send is allowed only with: a message, a live preview for the CURRENT selection, and the
  // email confirmation when the volume verdict asks for one.
  const canSend =
    !!message.trim() &&
    !!preview &&
    !previewing &&
    preview.recipient_count > 0 &&
    !(wantsEmail && emailBlocked) &&
    !(wantsEmail && emailNeedsConfirm && !confirmLargeEmail);

  const resetAfterSend = () => {
    setTitle("");
    setMessage("");
    setTarget(EMPTY_TARGET);
    setTargetEvents([]);
    setConfirmLargeEmail(false);
  };

  // ── Send ──
  const handleSend = useCallback(async () => {
    if (!token || !preview) return;
    setSending(true);
    try {
      // Deep link: for the "event" type the admin may have picked several events (multi) -> send
      // a `targets` array; otherwise the single pair. "none" sends nothing. Same shape the other
      // admin composers use.
      const link: Record<string, unknown> = {};
      if (target.target_type === "event" && targetEvents.length > 0) {
        link.targets = targetEvents.map((e) => ({ target_type: "event", target_id: e.slug }));
      } else if (target.target_type !== "none") {
        link.target_type = target.target_type;
        link.target_id = target.target_id.trim();
      }

      const res = await broadcastAudienceApi.send(token, {
        audience: spec,
        title: title.trim() || undefined,
        message: message.trim(),
        delivery,
        // The number the admin just read on screen. A mismatch is a 409, handled below.
        confirmed_count: preview.recipient_count,
        confirm_large_email: confirmLargeEmail || undefined,
        ...link,
      });
      toast.success(res.message);
      resetAfterSend();
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && typeof data?.recipient_count === "number") {
        // The audience moved between preview and send. Show the NEW number and make the admin
        // look again rather than sending to a population they never agreed to.
        toast.error(t("toast.countChanged", { count: data.recipient_count }));
        setPreview((prev) =>
          prev ? { ...prev, recipient_count: data.recipient_count } : prev,
        );
      } else {
        toast.error(data?.message || t("toast.sendError"));
      }
    } finally {
      setSending(false);
    }
  }, [token, preview, spec, title, message, delivery, confirmLargeEmail, target, targetEvents, t]);

  // ── Chip row for one category filter ──
  // Click-to-toggle outline badges, because an admin routinely picks several countries at once
  // and a Select would make that four interactions instead of four clicks.
  const FilterChips = ({
    label,
    values,
    selected,
    onToggle,
    formatValue,
  }: {
    label: string;
    values: { value: string; count: number; label?: string }[];
    selected: string[];
    onToggle: (value: string) => void;
    formatValue?: (value: string) => string;
  }) => {
    if (values.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex flex-wrap gap-1.5">
          {values.map((option) => {
            const isOn = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                disabled={everyone}
                aria-pressed={isOn}
                className={cn(
                  // 44px on a phone (min-h-11), the smallest target a thumb hits reliably,
                  // dropping to 32px from sm: up where there is a mouse. Measured at 32px
                  // everywhere before this, which is too small for a wrapped grid of ~90
                  // chips: a mis-tap here silently retargets a broadcast to another country.
                  "min-h-11 sm:min-h-8 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40",
                  isOn
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {/* Countries send a `label` because the value is a canonical key
                    ("nigeria") that covers several stored spellings. Everything else
                    has no label and shows its value, formatted if the caller asked. */}
                {option.label ?? (formatValue ? formatValue(option.value) : option.value)}
                <span className="ml-1.5 opacity-60">{option.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUsers className="size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── 1. WHO ────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Send to the entire site. Kept first and visually distinct because it is the one
              option that ignores every other control, and the one with the largest blast radius. */}
          <label className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              checked={everyone}
              onCheckedChange={(v) => setEveryone(v === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("everyone.label")}</span>
              <span className="text-xs text-muted-foreground">
                {options
                  ? t("everyone.help", { count: options.total_users })
                  : t("everyone.helpLoading")}
              </span>
            </span>
          </label>

          {/* Everything below is ignored while "everyone" is on, so it is dimmed and disabled
              rather than removed: the admin can see their selection is still there if they
              untick. */}
          <div className={cn("space-y-4", everyone && "pointer-events-none opacity-50")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">{t("pick.teams")}</Label>
                <TeamSearchSelect
                  multiple
                  value={teamIds}
                  onChange={(ids: number[], _team?: PickedTeam) => setTeamIds(ids)}
                  placeholder={t("pick.teamsPlaceholder")}
                />
                <p className="text-[11px] text-muted-foreground">{t("pick.teamsHelp")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">{t("pick.players")}</Label>
                <UserSearchSelect
                  multiple
                  value={usernames}
                  onChange={(names: string[], lastUser?: PickedUser) => {
                    setUsernames(names);
                    // Remember the numeric id of each pick: the API keys off user_id, but the
                    // picker is keyed by username.
                    if (lastUser) {
                      setUserIdByUsername((prev) => ({
                        ...prev,
                        [lastUser.username]: lastUser.user_id,
                      }));
                    }
                  }}
                  placeholder={t("pick.playersPlaceholder")}
                />
                <p className="text-[11px] text-muted-foreground">{t("pick.playersHelp")}</p>
              </div>
            </div>

            {/* Category filters. Each chip carries its own count so the admin can see the size of
                a bucket before committing to it. */}
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-xs font-medium">{t("filters.title")}</p>
              <FilterChips
                label={t("filters.tier")}
                values={options?.tiers ?? []}
                selected={tiers}
                onToggle={(v) => setTiers((prev) => toggle(prev, v))}
                formatValue={(v) => t("filters.tierValue", { tier: v })}
              />
              <FilterChips
                label={t("filters.country")}
                values={options?.countries ?? []}
                selected={countries}
                onToggle={(v) => setCountries((prev) => toggle(prev, v))}
              />
              <FilterChips
                label={t("filters.role")}
                values={options?.roles ?? []}
                selected={roles}
                onToggle={(v) => setRoles((prev) => toggle(prev, v))}
              />
              <FilterChips
                label={t("filters.language")}
                values={options?.languages ?? []}
                selected={languages}
                onToggle={(v) => setLanguages((prev) => toggle(prev, v))}
              />
              <p className="text-[11px] text-muted-foreground">{t("filters.help")}</p>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={includeSuspended}
                onCheckedChange={(v) => setIncludeSuspended(v === true)}
              />
              <span className="text-xs text-muted-foreground">{t("includeSuspended")}</span>
            </label>
          </div>
        </div>

        {/* ── 2. HOW MANY - the count, before anything is sent ───────────────── */}
        {/* This block is the whole point of the screen. It is deliberately the loudest thing
            here, and Send stays disabled until it holds a number for the CURRENT selection. */}
        <div className="rounded-md border bg-muted/30 p-4">
          {!hasSelection ? (
            <p className="text-sm text-muted-foreground">{t("count.none")}</p>
          ) : previewing ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              {t("count.loading")}
            </p>
          ) : previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-bold text-primary">
                  {preview.recipient_count.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("count.recipients", { count: preview.recipient_count })}
                </span>
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                  {t("count.withEmail", { count: preview.email_recipient_count })}
                </Badge>
              </div>

              {/* Volume banner. The backend writes the sentence so the warning can never drift
                  from the rule that is actually enforced. */}
              {wantsEmail && preview.email_volume.level !== "ok" && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-3 text-xs",
                    emailBlocked
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-amber-500/50 bg-amber-500/10 text-amber-600",
                  )}
                >
                  <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-1">
                    <p>{preview.email_volume.message}</p>
                    {emailNeedsConfirm && !emailBlocked && (
                      <label className="flex items-center gap-2 pt-1">
                        <Checkbox
                          checked={confirmLargeEmail}
                          onCheckedChange={(v) => setConfirmLargeEmail(v === true)}
                        />
                        <span>{t("volume.confirmLabel")}</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* A small sample so the admin can spot a filter that caught the wrong people. */}
              {preview.sample.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-foreground">{t("sample.user")}</TableHead>
                        <TableHead className="text-foreground">{t("sample.country")}</TableHead>
                        <TableHead className="text-foreground">{t("sample.role")}</TableHead>
                        <TableHead className="text-foreground">{t("sample.email")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample.map((r) => (
                        <TableRow key={r.user_id}>
                          <TableCell className="p-2 text-xs font-medium">{r.username}</TableCell>
                          <TableCell className="p-2 text-xs text-muted-foreground">
                            {r.country || "-"}
                          </TableCell>
                          <TableCell className="p-2 text-xs text-muted-foreground">
                            {r.role}
                          </TableCell>
                          <TableCell className="p-2 text-xs text-muted-foreground">
                            {r.has_email ? t("sample.yes") : t("sample.no")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {preview.has_more && (
                <p className="text-[11px] text-muted-foreground">
                  {t("sample.more", {
                    shown: preview.sample.length,
                    total: preview.sample_total_count,
                  })}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* ── 3. WHAT ───────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aud-title">{t("compose.titleLabel")}</Label>
            <input
              id="aud-title"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("compose.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aud-message">{t("compose.messageLabel")}</Label>
            <textarea
              id="aud-message"
              className="min-h-[100px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("compose.messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Channel. In-app is first and is the default: it delivers instantly at any size.
              The email options carry the reason they might be unavailable right in their label. */}
          <div className="flex flex-col gap-2">
            <Label>{t("compose.deliveryLabel")}</Label>
            <Select
              value={delivery}
              onValueChange={(v) => setDelivery(v as "push" | "email" | "both")}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push">{t("compose.deliveryPush")}</SelectItem>
                <SelectItem value="email" disabled={emailBlocked}>
                  {t("compose.deliveryEmail")}
                </SelectItem>
                <SelectItem value="both" disabled={emailBlocked}>
                  {t("compose.deliveryBoth")}
                </SelectItem>
              </SelectContent>
            </Select>
            {emailBlocked && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                <IconMail className="size-3.5" />
                {t("compose.emailUnavailable")}
              </p>
            )}
          </div>

          {/* Optional deep link, same control as the other admin composers. */}
          <NotificationTargetSelector
            value={target}
            onChange={(next) => {
              setTarget(next);
              if (next.target_type !== "event") setTargetEvents([]);
            }}
            enableEventSearch
            selectedEvents={targetEvents}
            onSelectedEventsChange={setTargetEvents}
          />
        </div>

        {/* ── 4. SEND, behind a confirm that repeats the number ──────────────── */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!canSend || sending} className="gap-1.5">
              {sending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconSend className="size-4" />
              )}
              {sending
                ? t("send.sending")
                : preview
                  ? t("send.buttonWithCount", { count: preview.recipient_count })
                  : t("send.button")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("send.confirmTitle")}</AlertDialogTitle>
              {/* The confirm repeats the count and the channel in words. This is the last stop
                  before something that cannot be taken back. */}
              <AlertDialogDescription>
                {t("send.confirmBody", {
                  count: preview?.recipient_count ?? 0,
                  channel:
                    delivery === "push"
                      ? t("compose.deliveryPush")
                      : delivery === "email"
                        ? t("compose.deliveryEmail")
                        : t("compose.deliveryBoth"),
                })}
                {wantsEmail && preview && preview.email_volume.level !== "ok" && (
                  <span className="mt-2 block text-amber-600">
                    {preview.email_volume.message}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("send.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleSend}>{t("send.confirmAction")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
