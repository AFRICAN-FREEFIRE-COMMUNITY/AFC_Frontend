"use client";

/**
 * app/(a)/a/polls/_components/VoteFlags.tsx
 *
 * The safety flag review of one poll (inbox #453, deck Revision 9 slide 06: "every flag is reviewed
 * before the count, and the reason for every removal is recorded").
 *
 * A flag is a reason to LOOK, never proof: a cyber cafe puts many honest voters on one connection,
 * and a VPN moves a country. So nothing is removed automatically. An admin picks a status (To review,
 * Looks fine, Removed, All), reads each flagged ballot (why it was flagged, where it came from, its
 * picks, its history) and decides:
 *   Looks fine        -> review_state "cleared", still counts
 *   Remove from count -> needs a written reason (5 to 1000 characters); leaves every tally
 *   Put back in count -> undoes a removal; the removal stays in the history
 *
 * TALKS TO lib/polls.ts adminPollFlags + adminReviewResponse, which hit afc_polls/views.py
 * admin_poll_flags + admin_review_response (AFC poll admins only). Mounted by VoteTracking.tsx
 * PollTracking, once per poll on the Metrics tab. `onReviewed` lets the parent reload its numbers.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { countryName } from "@/lib/i18n/countryName";
import { formatNumber } from "@/lib/i18n/number";
import { pollsApi, VOTE_TRACKING_LIVE_SINCE, type FlaggedBallot, type FlagsPage } from "@/lib/polls";

const STATES = ["to_review", "cleared", "removed", "all"] as const;
type State = (typeof STATES)[number];
const PAGE_SIZE = 20;
// Same bounds the server enforces (afc_polls/views.py REVIEW_REASON_MIN / MAX).
const REASON_MIN = 5;
const REASON_MAX = 1000;

export function VoteFlags({ pollSlug, summary }: { pollSlug: string; summary: any }) {
  const t = useTranslations("adminPolls");
  const locale = useLocale();
  const [state, setState] = useState<State>("to_review");
  const [page, setPage] = useState<FlagsPage | null>(null);
  const [rows, setRows] = useState<FlaggedBallot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [removing, setRemoving] = useState<FlaggedBallot | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      try {
        const next = await pollsApi.adminPollFlags(pollSlug, { state, limit: PAGE_SIZE, offset });
        setPage(next);
        setRows((prev) => (offset === 0 ? next.results : [...prev, ...next.results]));
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [pollSlug, state, t],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const decide = async (ballot: FlaggedBallot, action: "clear" | "remove" | "restore", why = "") => {
    setBusy(ballot.response_id);
    try {
      await pollsApi.adminReviewResponse(pollSlug, ballot.response_id, { action, reason: why });
      toast.success(t(`flags.done.${action}`));
      setRemoving(null);
      setReason("");
      await load(0);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("flags.failed"));
    } finally {
      setBusy(null);
    }
  };

  const thresholds = page?.thresholds || summary?.thresholds;
  const flagLabel = (key: string) =>
    t(`flags.name.${key}`, {
      count:
        key === "shared_connection" ? thresholds?.shared_connection ?? 0
          : key === "shared_device" ? thresholds?.shared_device ?? 0
            : key === "new_account" ? thresholds?.new_account_days ?? 0
              : 0,
    });
  const place = (ballot: FlaggedBallot) => {
    const country = countryName(ballot.details.ip_country, locale);
    if (!country) return t("tracking.unknown");
    return ballot.details.ip_region ? `${ballot.details.ip_region}, ${country}` : country;
  };

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {t("flags.title")}
        <NewBadge since={VOTE_TRACKING_LIVE_SINCE} />
      </h4>
      <p className="text-xs text-muted-foreground">{t("flags.intro")}</p>
      {summary && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.by_flag || {}).map(([key, count]) => (
            <Badge key={key} variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">
              {flagLabel(key)}: {formatNumber(count as number)}
            </Badge>
          ))}
        </div>
      )}
      <Tabs value={state} onValueChange={(value) => setState(value as State)}>
        <TabsList className="h-9 max-w-full justify-start overflow-x-auto bg-muted">
          {STATES.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`flags.state.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading && rows.length === 0 && <FullLoader />}
      {!loading && rows.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("flags.empty")}</p>
      )}

      <div className="space-y-3">
        {rows.map((ballot) => (
          <Card key={ballot.response_id} className="bg-card rounded-md py-4 shadow-sm">
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {ballot.voter || t("flags.anonymous", { id: ballot.response_id })}
                </p>
                {ballot.submitted_at && (
                  <span className="text-xs text-muted-foreground">
                    <LocalTime value={ballot.submitted_at} />
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {ballot.flags.map((key) => (
                  <Badge key={key} variant="outline" className="rounded-full px-2 py-0.5 text-xs text-gold">
                    {flagLabel(key)}
                  </Badge>
                ))}
              </div>
              <ul className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <li>{t("flags.detail.from", { place: place(ballot) })}</li>
                <li>
                  {t("flags.detail.profile", {
                    country: countryName(ballot.details.profile_country, locale) || t("tracking.unknown"),
                  })}
                </li>
                <li>{t("flags.detail.connection", { count: ballot.details.connection_ballots })}</li>
                <li>{t("flags.detail.device", { count: ballot.details.device_ballots })}</li>
                {ballot.details.account_age_days != null && (
                  <li>{t("flags.detail.age", { count: ballot.details.account_age_days })}</li>
                )}
                <li>{t("flags.detail.failed", { count: ballot.details.failed_checks })}</li>
              </ul>
              {ballot.picks.length > 0 && (
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="mb-1 text-xs font-semibold text-foreground">{t("flags.picks")}</p>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {ballot.picks.map((pick) => (
                      <li key={`${pick.award}-${pick.nominee}`}>
                        {pick.award}: <span className="text-foreground">{pick.nominee}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ballot.log.length > 0 && (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">{t("flags.history")}</p>
                  {ballot.log.map((entry, index) => (
                    <p key={index}>
                      <LocalTime value={entry.at} />{" "}
                      {t(`flags.log.${entry.action}`, { who: entry.reviewed_by || "", reason: entry.reason })}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {ballot.review_state !== "removed" && ballot.review_state !== "cleared" && (
                  <Button size="sm" variant="secondary" disabled={busy === ballot.response_id} onClick={() => decide(ballot, "clear")}>
                    {t("flags.looksFine")}
                  </Button>
                )}
                {ballot.review_state !== "removed" && (
                  <Button size="sm" variant="destructive" disabled={busy === ballot.response_id} onClick={() => setRemoving(ballot)}>
                    {t("flags.remove")}
                  </Button>
                )}
                {ballot.review_state === "removed" && (
                  <Button size="sm" variant="secondary" disabled={busy === ballot.response_id} onClick={() => decide(ballot, "restore")}>
                    {t("flags.restore")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {page?.has_more && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => load(page.next_offset)}>
            {t("flags.loadMore")}
          </Button>
        </div>
      )}

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("flags.removeTitle")}</DialogTitle>
            <DialogDescription>{t("flags.removeBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="flagReason">{t("flags.reasonLabel")}</Label>
            <Textarea
              id="flagReason"
              value={reason}
              maxLength={REASON_MAX}
              placeholder={t("flags.reasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
            {reason.trim().length > 0 && reason.trim().length < REASON_MIN && (
              <p className="text-xs text-destructive">{t("flags.reasonTooShort")}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t("flags.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!removing || reason.trim().length < REASON_MIN || busy === removing?.response_id}
              onClick={() => removing && decide(removing, "remove", reason.trim())}
            >
              {t("flags.confirmRemove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
