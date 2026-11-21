"use client";

/**
 * OrgBadgePanel - the Badge tab of the admin organization page (open organizations, owner 16 Nov 2026, AFC inbox
 * #590; approved mockup mockups/organizer-dashboard/, the admin view's side panel).
 *
 * Shows the organization's badge, the six Verified rules with their real values (two of them ticked by an AFC admin
 * here), a note sent with the decision, the actions the badge allows (give the Verified tick only when every rule is
 * met, make AFC Partner, remove the tick, end the partnership), the partner perk switches, and the history.
 *
 * HOW IT CONNECTS
 *   - Data: the detail payload of GET organizers/admin/get-organization/<slug>/ (organization.badge, .perks,
 *     verified_rules, badge_history), fetched by the page; `onChanged` asks the page to fetch it again.
 *   - Writes: organizersApi.adminSetBadge / adminSetPerk / adminSetRuleTick -> AFC-B afc_organizers/views_admin.py
 *     admin_set_badge / admin_set_perk / admin_set_rule_tick (every change logged by afc_organizers/badges.py; the
 *     owners get a notification and an email). Refusals carry a code, translated through useServerMessage.
 * Strings: adminOrgBadges (en/fr/pt). Suspending stays on the Profile tab, as before.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconCheck, IconRosetteDiscountCheck, IconStar } from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { OrgBadge } from "@/components/OrgBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useServerMessage } from "@/lib/i18n/serverMessage";
import { formatNumber } from "@/lib/i18n/number";
import { ORG_PERKS, type OrgBadgeKind, type OrgRule, organizersApi } from "@/lib/organizers";
import { cn } from "@/lib/utils";

export const ORG_BADGES_SINCE = "2026-11-21";

export type BadgeHistoryRow = {
  action: string;
  from_badge: string;
  to_badge: string;
  note: string;
  by: string | null;
  at: string;
};

type Props = {
  slug: string;
  badge: OrgBadgeKind;
  perks: Record<string, boolean>;
  rules: OrgRule[];
  history: BadgeHistoryRow[];
  onChanged: () => void;
};

export function OrgBadgePanel({ slug, badge, perks, rules, history, onChanged }: Props) {
  const t = useTranslations("adminOrgBadges");
  const tb = useTranslations("orgStart");
  const serverMessage = useServerMessage();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const allMet = rules.length > 0 && rules.every((r) => r.met);

  async function run(key: string, call: () => Promise<unknown>, clearNote = false) {
    setBusy(key);
    try {
      await call();
      toast.success(t("panel.saved"));
      if (clearNote) setNote("");
      onChanged();
    } catch (err: any) {
      toast.error(serverMessage(err?.response?.data, err?.message || ""));
    } finally {
      setBusy(null);
    }
  }
  const setBadge = (to: OrgBadgeKind) =>
    run("badge:" + to, () => organizersApi.adminSetBadge(slug, { badge: to, note: note.trim() }), true);

  const ruleValue = (r: OrgRule) => {
    switch (r.key) {
      case "events":
        return t("panel.value.events", { n: formatNumber(Number(r.value) || 0) });
      case "rating":
        return r.value == null ? t("panel.value.noRating") : t("panel.value.rating", { n: String(r.value) });
      case "reports":
        return t("panel.value.reports", { n: formatNumber(Number(r.value) || 0) });
      case "profile":
        return r.met ? t("panel.value.profileYes") : t("panel.value.profileNo");
      default:
        return r.met ? t("panel.value.ticked") : t("panel.value.notTicked");
    }
  };
  const badgeName = (b: string) => (b ? tb(`badge.${b}` as "badge.community") : "");
  const historyLine = (h: BadgeHistoryRow) => {
    if (h.action === "badge") return t("panel.action.badge", { from: badgeName(h.from_badge), to: badgeName(h.to_badge) });
    if (h.action === "perk_on" || h.action === "perk_off")
      return t(`panel.action.${h.action}`, { perk: t(`panel.perk.${h.note}` as "panel.perk.promo") });
    if (h.action === "tick_on" || h.action === "tick_off") {
      const rule = h.note.split(":")[0];
      return t(`panel.action.${h.action}`, { rule: t(`panel.rule.${rule}` as "panel.rule.trophies") });
    }
    return t("panel.action.started");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t("panel.title")}
          <OrgBadge badge={badge} />
          <NewBadge since={ORG_BADGES_SINCE} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("panel.lead")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("panel.rules")}</h3>
          <ul className="mt-2 space-y-1.5">
            {rules.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
                <span className={cn("size-5 rounded-full grid place-items-center shrink-0",
                  r.met ? "bg-primary text-primary-foreground" : "bg-muted")} aria-hidden>
                  {r.met && <IconCheck className="size-3.5" />}
                </span>
                <span className="flex-1 min-w-[10rem]">
                  <span className="block text-sm font-semibold">{t(`panel.rule.${r.key}`)}</span>
                  <span className="block text-xs text-muted-foreground">{ruleValue(r)}</span>
                </span>
                {(r.key === "trophies" || r.key === "community") && (
                  <Button size="sm" variant="secondary" disabled={busy !== null}
                          onClick={() => run("tick:" + r.key, () => organizersApi.adminSetRuleTick(slug, {
                            rule: r.key as "trophies" | "community", on: !r.met, note: note.trim(),
                          }))}>
                    {r.met ? t("panel.untick") : t("panel.tick")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <Label htmlFor="badge-note">{t("panel.noteLabel")}</Label>
          <Textarea id="badge-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
                    placeholder={t("panel.notePlaceholder")} className="bg-muted/40 border-0" />
          <div className="flex flex-wrap gap-2 pt-1">
            {badge === "community" && (
              <Button disabled={!allMet || busy !== null} onClick={() => setBadge("verified")}>
                <IconRosetteDiscountCheck className="size-4" />
                {t("panel.giveVerified")}
              </Button>
            )}
            {badge === "verified" && (
              <>
                <Button disabled={busy !== null} onClick={() => setBadge("partner")}>
                  <IconStar className="size-4" />
                  {t("panel.makePartner")}
                </Button>
                <Button variant="secondary" disabled={busy !== null} onClick={() => setBadge("community")}>
                  {t("panel.removeTick")}
                </Button>
              </>
            )}
            {badge === "partner" && (
              <Button variant="secondary" disabled={busy !== null} onClick={() => setBadge("verified")}>
                {t("panel.endPartnership")}
              </Button>
            )}
          </div>
          {badge === "community" && !allMet && (
            <p className="text-xs text-muted-foreground">{t("panel.notEligible")}</p>
          )}
        </section>

        {badge === "partner" && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("panel.perks")}</h3>
            <ul className="mt-2 space-y-1.5">
              {ORG_PERKS.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                  {/* A sentence, not a field label: plain text (the site's Label is set in capitals). */}
                  <span id={`perk-label-${k}`} className="text-sm">{t(`panel.perk.${k}`)}</span>
                  <Switch id={`perk-${k}`} aria-labelledby={`perk-label-${k}`} checked={!!perks[k]} disabled={busy !== null}
                          onCheckedChange={(on) => run("perk:" + k, () => organizersApi.adminSetPerk(slug, { perk: k, on }))} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("panel.history")}</h3>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("panel.noHistory")}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {history.map((h, i) => (
                <li key={i} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{historyLine(h)}</span>
                  <span className="block text-xs text-muted-foreground">
                    <LocalTime value={h.at} />
                    {h.by ? " " + t("panel.by", { name: h.by }) : ""}
                    {h.note && h.action === "badge" ? ": " + h.note : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
