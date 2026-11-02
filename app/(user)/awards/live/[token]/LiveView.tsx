"use client";

/**
 * app/(user)/awards/live/[token]/LiveView.tsx - Garena's live vote page (inbox #457).
 *
 * Reads GET polls/live/<token>/ (afc_polls/views.py live_view) on load and then every minute, and
 * draws one card per award: each nominee's votes and share, and the countries and regions the votes
 * came from. Places with fewer than five votes arrive already folded into "Other" (the server's
 * small-cell rule), so nothing on this page can point at a single voter. No sign-in: the token is
 * the key. A turned-off or replaced link answers 404 (code live_view_not_found) and the page says
 * the link is not active; any other failure keeps the last numbers on screen and tries again.
 *
 * No AFC branding inside the content (owner, 1 Nov 2026: the KOL Awards are Garena's); the site's
 * own header and footer stay. Country names come from the browser in the viewer's language
 * (lib/i18n/countryName.ts); times through LocalTime.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryName } from "@/lib/i18n/countryName";
import { formatNumber } from "@/lib/i18n/number";
import { pollsApi, type LiveBucket, type LiveView as LiveViewData } from "@/lib/polls";

const REFRESH_MS = 60_000;
const TOP_PLACES = 3;

export function LiveView({ token }: { token: string }) {
  const t = useTranslations("awardsLive");
  const locale = useLocale();
  const [data, setData] = useState<LiveViewData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notFound" | "error">("loading");
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await pollsApi.liveView(token);
      if (!alive.current) return;
      setData(next);
      setState("ok");
    } catch (error: any) {
      if (!alive.current) return;
      setState(error?.response?.data?.code === "live_view_not_found" ? "notFound" : "error");
    }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
  }, [load]);

  const places = (rows: LiveBucket[], kind: "country" | "region") => {
    const names = rows.slice(0, TOP_PLACES).map((row) => {
      if (row.other) return `${t("other")} (${formatNumber(row.votes)})`;
      const country = countryName(kind === "country" ? row.code : row.country, locale) || t("unknown");
      const name = kind === "country" ? country : `${row.region}, ${country}`;
      return `${name} (${formatNumber(row.votes)})`;
    });
    return names.length ? names.join(" · ") : t("unknown");
  };

  if (state === "loading" && !data) return <FullLoader />;

  if (state === "notFound") {
    return (
      <div className="container py-16">
        <p className="text-center text-sm text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-primary md:text-4xl">{t("title")}</h1>
        {data && <p className="text-lg font-semibold text-foreground">{data.edition.title}</p>}
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("private")}</p>
        {data && (
          <p className="text-xs text-muted-foreground">
            {t("updated")} <LocalTime value={data.updated_at} mode="time" />
            {data.edition.voting_closes_at && (
              <>
                {" · "}
                {t("closes")} <LocalTime value={data.edition.voting_closes_at} />
              </>
            )}
          </p>
        )}
        {state === "error" && <p className="text-xs text-destructive">{t("error")}</p>}
      </header>

      {data?.polls.map((poll) => (
        <section key={poll.title} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-foreground">{poll.title}</h2>
            <span className="text-xs text-muted-foreground">{t("ballots", { count: poll.ballots })}</span>
          </div>
          {poll.questions.map((question) => (
            <Card key={question.prompt} className="bg-card rounded-md py-4 shadow-sm">
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{question.prompt}</h3>
                  <span className="text-xs text-muted-foreground">{t("votes", { count: question.total_votes })}</span>
                </div>
                {question.total_votes === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noVotes")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-10 p-2 text-xs text-foreground">{t("col.rank")}</TableHead>
                          <TableHead className="h-10 p-2 text-xs text-foreground">{t("col.nominee")}</TableHead>
                          <TableHead className="h-10 p-2 text-right text-xs text-foreground">{t("col.votes")}</TableHead>
                          <TableHead className="h-10 p-2 text-xs text-foreground">{t("col.share")}</TableHead>
                          <TableHead className="h-10 p-2 text-xs text-foreground">{t("col.countries")}</TableHead>
                          <TableHead className="h-10 p-2 text-xs text-foreground">{t("col.regions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {question.options.map((option, index) => (
                          <TableRow key={option.label}>
                            <TableCell className="p-2 text-xs tabular-nums">#{index + 1}</TableCell>
                            <TableCell className="p-2 text-xs font-medium text-foreground">{option.label}</TableCell>
                            <TableCell className="p-2 text-right text-xs tabular-nums">{formatNumber(option.votes)}</TableCell>
                            <TableCell className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 rounded-sm bg-muted sm:w-32" aria-hidden>
                                  <div
                                    className="h-2 rounded-sm bg-primary"
                                    style={{ width: `${Math.min(100, Math.max(0, option.percent))}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground">{option.percent}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-48 p-2 text-xs text-muted-foreground">{places(option.countries, "country")}</TableCell>
                            <TableCell className="min-w-48 p-2 text-xs text-muted-foreground">{places(option.regions, "region")}</TableCell>
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
      ))}

      <p className="text-xs text-muted-foreground">
        {t("placesNote")}{" "}
        <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline">
          {t("attribution")}
        </a>
      </p>
    </div>
  );
}
