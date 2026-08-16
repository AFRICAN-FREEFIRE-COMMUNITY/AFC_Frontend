"use client";

/**
 * app/(user)/awards/page.tsx - the AWARDS section, front door.
 *
 * WHAT THIS IS
 *   The grand awards surface, showing whichever awards season is leading right now. The moment the
 *   season is in (nominees announced / voting / counting / winners) is a property of the DATA, not
 *   of the URL, so there is ONE page and four states. All of that lives in AwardsExperience; this
 *   file only decides WHICH edition it renders and handles the section's own edges.
 *
 * WHAT IT REPLACED, and why
 *   Until now this page was a hand-typed list of the NFCA 2025 winners: 28 categories, every name
 *   and every vote count written into the source. That is why the polls engine exists, and why its
 *   `import_awards_winners` management command was written - the winners are now rows in
 *   afc_polls (AwardsEdition -> Poll -> PollQuestion -> PollOption), the same tables a live ballot
 *   uses, so next year's season needs no code change at all and the 2025 archive keeps working.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/polls/editions/            -> afc_polls.views.list_editions   (via lib/polls.ts)
 *   GET {BACKEND}/polls/editions/<slug>/     -> afc_polls.views.edition_detail  (inside AwardsExperience)
 *   Titles, taglines and category prompts arrive ALREADY TRANSLATED for the viewer's locale
 *   (backend translate-on-read). Nominee NAMES deliberately do not: "SCARLETT" and "V-ENT ESPORTS"
 *   are names, not prose. Only the static chrome here reads messages/<locale>/awards.json.
 *
 * WHICH EDITION LEADS
 *   The first row the backend returns. AwardsEdition.Meta.ordering is ["order", "-year",
 *   "-edition_id"], so newest-first by default with an explicit `order` column for an owner running
 *   two seasons at once. The choice is deliberately NOT made here: a rule about which season leads
 *   belongs next to the data, and the admin editions screen is where somebody changes it.
 *
 * THE LEGACY ANCHORS (polls-spec 7.3)
 *   /awards was one page with two tabs, shared for a year as /awards#content-creators and
 *   /awards#esports-awards. Those links still arrive here, hash attached. A server-side redirect
 *   can never see a fragment, so the mapping has to happen on mount, in the browser. It sends the
 *   visitor to the ballot page for that section, which is the closest thing to what the link named.
 *   (This map used to sit on /polls, aimed at a /awards -> /polls redirect that was never added, so
 *   it could not fire. It lives here now, on the page those links actually land on.)
 *
 * Related: app/(user)/awards/[edition]/page.tsx (one named season, for a shareable per-year link),
 * app/(user)/awards/layout.tsx (the section metadata, because this file is a Client Component and
 * cannot export any), app/(user)/polls (every ballot and community poll as a plain list).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { Card, CardContent } from "@/components/ui/card";
import { pollsApi, type AwardsEdition } from "@/lib/polls";

import { AwardsExperience } from "./_components/AwardsExperience";

// Old hash -> the poll that section became. Both slugs are created by the
// `import_awards_winners` management command, so they are stable rather than incidental.
const LEGACY_ANCHORS: Record<string, string> = {
  "content-creators": "nfca-2025-content-creators",
  "esports-awards": "nfca-2025-esports",
};

export default function AwardsPage() {
  // Namespace "awards" (messages/{en,fr,pt}/awards.json). AwardsExperience reads the same one.
  const t = useTranslations("awards");
  const router = useRouter();

  const [editions, setEditions] = useState<AwardsEdition[]>([]);
  const [loading, setLoading] = useState(true);

  // Legacy anchors first: this navigates away, so there is no point waiting on the fetch.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const target = LEGACY_ANCHORS[hash];
    if (target) router.replace(`/polls/${target}`);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    pollsApi
      .listEditions()
      .then((res) => {
        if (!cancelled) setEditions(res.results || []);
      })
      // A listing that cannot load shows the empty state rather than an error wall: there is
      // nothing the visitor can do about it, and the nav around it still works.
      .catch(() => {
        if (!cancelled) setEditions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <FullLoader />;

  // No season yet. This is also what a fresh deployment shows until somebody runs
  // `python manage.py import_awards_winners`, which is what puts the 2025 archive in the database.
  if (editions.length === 0) {
    return (
      <div className="py-10">
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-primary md:text-4xl">
              {t("index.empty.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("index.empty.body")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [leading, ...rest] = editions;

  return (
    <div>
      <AwardsExperience editionSlug={leading.slug} />

      {/* Earlier seasons, only once there IS an earlier season. Links rather than a client-side
          switcher, so every year keeps a URL somebody can share. */}
      {rest.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-foreground">{t("index.otherEditions")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rest.map((edition) => (
              <Link
                key={edition.slug}
                href={`/awards/${edition.slug}`}
                className="rounded-full border border-input px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {edition.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
