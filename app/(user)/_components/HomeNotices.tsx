"use client";

// ── HomeNotices ──────────────────────────────────────────────────────────────────────────────
// The homepage notices block (backlog item 22, owner 2026-08-08: "Homepage section for public
// notices and important announcements").
//
// A NOTICE IS JUST A NEWS POST THAT HAS BEEN PINNED. There is deliberately no second publishing
// surface: News already has categories, scheduling, translation, an author and an editor, and a
// separate notices screen would mean two places to look when something is wrong - and the one used
// less often is the one that rots. An admin pins a post from the ordinary News form
// (app/(a)/a/news/create + [slug]/edit) by turning on "Pin to homepage" and picking an expiry.
//
// IT TAKES ITSELF DOWN. The pin carries an expiry date, so a notice disappears on its own the way
// the NEW badge does. Nothing here has to be remembered or cleaned up later.
//
// Data source:
//   GET /auth/get-pinned-news/   (backend afc_auth/views.py get_pinned_news)
//   Public, no auth. Returns at most HOME_PINNED_NOTICES_LIMIT (3) posts, newest published first,
//   already localized to the viewer's language by the translate-on-read layer. When several posts
//   are pinned the three newest win; the rest stay pinned and readable at /news and surface here
//   as the newer ones expire.
//
// Renders NOTHING when there are no live notices - an empty "Notices" shell on the dashboard would
// be worse than no block at all.
//
// Placement: directly under the page header on app/(user)/home, above the stat boxes, because an
// announcement that sits below the fold is not an announcement. Each card links through to the full
// article, which stays readable at /news/<slug> after it unpins.
//
// Related:
//   • Card / CardHeader idiom  : matches HomeLatestSections + LatestNews, so /home reads as one page.
//   • Excerpt                  : components/text-editor/RenderDescription (the Tiptap doc -> text
//                                helpers the news list already uses).
//   • Date                     : components/LocalTime.tsx (viewer's timezone + language).
//   • NEW tag                  : components/NewBadge.tsx, self-expiring.
//   • Strings                  : messages/{en,fr,pt}/home.json, namespace "home", key `notices`.

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconPinned, IconArrowRight } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import {
  extractTiptapText,
  truncateText,
} from "@/components/text-editor/RenderDescription";
import { env } from "@/lib/env";
// Live refresh (owner 2026-07-02): the site-wide heartbeat, so a notice pinned (or expiring)
// while somebody has the dashboard open appears/disappears without a reload.
import { useLiveTick } from "@/hooks/useLiveTick";

// The day this surface goes LIVE, for the self-expiring NEW tag (owner rule: 5 days, date-driven).
// The block was written on 2026-08-08 but sat unshipped, and that date would have expired before a
// single reader saw it - which is precisely what a self-expiring badge must never do.
const NOTICES_LIVE_SINCE = "2026-08-16";

type Notice = {
  news_id: number;
  slug: string;
  news_title: string;
  content: string;
  category: string;
  images_url: string | null;
  created_at: string;
  pinned_until: string;
};

export function HomeNotices() {
  // Namespace "home" (messages/{en,fr,pt}/home.json); keys below live under `notices`.
  const t = useTranslations("home");
  const [notices, setNotices] = useState<Notice[]>([]);
  const tick = useLiveTick();

  useEffect(() => {
    // GET /auth/get-pinned-news/ - the cap and the ordering are applied server-side, so there is
    // no .slice() here that could drift from the rule. A failure leaves the block hidden rather
    // than showing an error on the dashboard: a missing notice is not worth a red toast on a page
    // the user came to for something else.
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-pinned-news/`)
      .then((res) => setNotices(res.data?.notices ?? []))
      .catch(() => setNotices([]));
  }, [tick]);

  // No live notices -> no block. See the header.
  if (notices.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconPinned className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("notices.title")}
          {/* Self-expiring NEW tag: this block did not exist before the date above. */}
          <NewBadge since={NOTICES_LIVE_SINCE} />
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{t("notices.subtitle")}</p>
      </CardHeader>

      <CardContent>
        {/* One column on a phone, up to three across on a desktop - the same grid step the rest of
            /home uses, and it matches the server-side cap of three so a full row is never ragged. */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {notices.map((notice) => (
            <Link
              key={notice.news_id}
              href={`/news/${notice.slug}`}
              className="group flex flex-col rounded-md border bg-card p-3 transition-colors hover:border-primary/50"
            >
              <h3 className="font-semibold text-sm leading-tight group-hover:text-primary line-clamp-2">
                {notice.news_title}
              </h3>
              <p className="mt-1 line-clamp-2 flex-grow break-words text-xs text-muted-foreground">
                {truncateText(extractTiptapText(notice.content), 160)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <LocalTime value={notice.created_at} mode="date" />
                <span className="inline-flex items-center font-medium text-primary">
                  {t("notices.readMore")}
                  <IconArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
