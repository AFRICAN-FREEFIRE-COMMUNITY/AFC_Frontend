"use client";

/**
 * ResultsTab - every way results get into this event, in one place.
 *
 * WHY THIS EXISTS (owner report 2026-08-22: "some options are in places that it takes time to get
 * to and others are not duplicated in places they should be")
 *
 *   Entering or reviewing results was spread across FOUR screens on THREE pages, and nothing told
 *   an admin which one they wanted:
 *
 *     /a/leaderboards/<event_id>/edit    enter and correct results by hand
 *     /a/events/<slug>/ocr               read them off the organiser's screenshots
 *     /a/events/<slug>/team-results      review what the TEAMS filed themselves
 *     /a/events/<slug>/edit?tab=...      import another tournament's published results
 *
 *   The third of those was linked from NOWHERE: a scan of every .ts/.tsx outside node_modules
 *   found it to be the one unreachable admin page of 68, so the feature it serves did not work end
 *   to end. Teams filed results and no screen ever surfaced the queue.
 *
 * THE ORGANISING IDEA is that an admin does not think "which page", they think "how did the
 * numbers arrive": somebody typed them, a screenshot exists, a team filed them, another
 * tournament published them. So the routes are labelled by the SHAPE OF THE SOURCE, and each says
 * what it is for rather than only what it is called.
 *
 * The import is rendered INLINE rather than linked, because it is the only one of the four that is
 * a self-contained form rather than a screen of its own. The other three are large editors with
 * their own URLs, which stay where they are and are launched from here; moving them is a later
 * stage of the same reshape.
 *
 * CONNECTS TO
 *   - ResultsImportTab (sibling), rendered inline as the "another tournament" route.
 *   - Event.allow_team_result_submissions decides whether the team-queue route is offered at all;
 *     on an event that does not accept submissions the queue is guaranteed empty.
 *   - eventDetails.event_id keys the leaderboard editor route, which is numeric, not the slug.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  IconChartBar,
  IconClipboardCheck,
  IconFileSpreadsheet,
  IconPhoto,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import ResultsImportTab from "./ResultsImportTab";

type Props = {
  slug: string;
  token: string;
  apiBase: string;
  eventDetails: any;
};

export default function ResultsTab({ slug, token, apiBase, eventDetails }: Props) {
  const t = useTranslations("evEditPage");
  const eventId = eventDetails?.event_id;

  /** The routes that live on their own screens. Order is how often they are used. */
  const routes = [
    {
      key: "manual",
      href: eventId ? `/a/leaderboards/${eventId}/edit` : null,
      Icon: IconChartBar,
      show: true,
    },
    {
      key: "ocr",
      href: `/a/events/${slug}/ocr`,
      Icon: IconPhoto,
      show: true,
    },
    {
      key: "teams",
      href: `/a/events/${slug}/team-results`,
      Icon: IconClipboardCheck,
      // Offered only when the event accepts team submissions: otherwise the queue cannot contain
      // anything, and a permanent dead end is its own kind of clutter.
      show: Boolean(eventDetails?.allow_team_result_submissions),
    },
  ].filter((r) => r.show && r.href);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("results.explainer")}</p>

          <div className="space-y-2">
            {routes.map(({ key, href, Icon }) => (
              <div
                key={key}
                className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {t(`results.routes.${key}.title`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`results.routes.${key}.body`)}
                    </span>
                  </span>
                </div>
                <Button size="sm" variant="outline" asChild className="shrink-0">
                  <Link href={href as string}>{t(`results.routes.${key}.action`)}</Link>
                </Button>
              </div>
            ))}

            {/* The fourth route, inline, because it is a form rather than a screen. */}
            <div className="flex items-start gap-2.5 rounded-md bg-muted/50 p-3">
              <IconFileSpreadsheet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t("results.routes.import.title")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("results.routes.import.body")}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ResultsImportTab slug={slug} token={token} apiBase={apiBase} />
    </div>
  );
}
