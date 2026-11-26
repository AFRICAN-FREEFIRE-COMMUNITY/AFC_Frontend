"use client";

/**
 * app/(user)/awards/live/[token]/NominationsLive.tsx - the KOL creators' nomination round on Garena's private live
 * page (inbox #641, owner 26 Nov 2026: "their own page", built as the round on the link Garena already has, #457).
 *
 * Draws the `nominations` block of GET polls/live/<token>/ (AFC-B afc_polls/kol_nominations.py live_block), which
 * LiveView.tsx loads and refreshes every minute: the round's state and dates, how many creators have nominated, and
 * per award every creator with at least one pick, most picks first. Counts only: the server sends no creator id, no
 * voter and nothing that says who picked whom. Each award's explanation is the one the creators read on their
 * ballot (awardsKol.nominate.awardHelp.<key>), so Garena reads the same words. Times through LocalTime.
 */
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/i18n/number";
import { GARENA_ACCESS_SINCE } from "@/lib/kolNominations";
import type { LiveNominations } from "@/lib/polls";

export function NominationsLive({ data }: { data: LiveNominations }) {
  const t = useTranslations("awardsLive");
  // The awards' explanations live with the creators' ballot (one text for every page that names an award)
  const tk = useTranslations("awardsKol");

  return (
    <section className="space-y-3" aria-labelledby="live-nominations-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="live-nominations-title" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          {t("nom.title")}
          <NewBadge since={GARENA_ACCESS_SINCE} />
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("nom.ballots", { count: data.ballots, voters: data.voters })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
          {t(`nom.state.${data.state}`)}
        </Badge>
        {data.state === "not_open" && data.opens_at && (
          <span>
            {t("nom.opens")} <LocalTime value={data.opens_at} />
          </span>
        )}
        {data.state !== "not_open" && data.closes_at && (
          <span>
            {t(data.state === "closed" ? "nom.closed" : "nom.closes")} <LocalTime value={data.closes_at} />
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("nom.note")}</p>

      {data.awards.map((award) => (
        <Card key={award.key || award.name} className="bg-card rounded-md py-4 shadow-sm">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{award.name}</h3>
              <span className="text-xs text-muted-foreground">{t("nom.picks", { count: award.total_picks })}</span>
            </div>
            {award.key && tk.has(`nominate.awardHelp.${award.key}`) && (
              <p className="text-xs text-muted-foreground">{tk(`nominate.awardHelp.${award.key}`)}</p>
            )}
            {award.candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("nom.noPicks")}</p>
            ) : (
              // The table scrolls inside its card on a phone instead of widening the page
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-10 p-2 text-xs text-foreground">{t("nom.col.rank")}</TableHead>
                      <TableHead className="h-10 p-2 text-xs text-foreground">{t("nom.col.creator")}</TableHead>
                      <TableHead className="h-10 p-2 text-right text-xs text-foreground">{t("nom.col.picks")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {award.candidates.map((candidate, index) => (
                      <TableRow key={`${candidate.handle}-${index}`}>
                        <TableCell className="p-2 text-xs tabular-nums">#{index + 1}</TableCell>
                        {/* Country and "added by a creator" ride under the name, so the picks stay in view on a phone */}
                        <TableCell className="p-2 text-xs whitespace-normal">
                          <span className="font-medium text-foreground">{candidate.name}</span>
                          <span className="block text-muted-foreground">
                            @{candidate.handle}
                            {/* A person added by a creator comes with no country: nothing is said rather than "Unknown" */}
                            {candidate.country && <> · {candidate.country}</>}
                            {candidate.write_in && <> · {t("nom.writeIn")}</>}
                          </span>
                        </TableCell>
                        <TableCell className="p-2 text-right text-xs tabular-nums">{formatNumber(candidate.picks)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
