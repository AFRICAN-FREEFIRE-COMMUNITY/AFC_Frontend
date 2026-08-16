"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { HomeBoxes } from "../_components/HomeBoxes";
// Pinned public notices (backlog item 22). A notice is a NEWS post an admin pinned to the homepage
// with an expiry, so it takes itself down; there is no second publishing surface. Renders nothing
// when none are live. See _components/HomeNotices.tsx.
import { HomeNotices } from "../_components/HomeNotices";
// Two compact blocks (latest events + latest player-market posts) added below the
// stat boxes per the approved home-additions mockup.
import { HomeLatestSections } from "../_components/HomeLatestSections";
import { LatestNews } from "../_components/LatestNews";
import { FeaturedShop } from "../_components/FeaturedShop";
// Live "Rankings and Tiers" card (owner backlog #9 / #20, 2026-08-03). This block used to be
// two inline tables fed by the hardcoded `teamRankings` / `quarterlyTiers` arrays in
// constants/index.ts, so the home page showed a frozen snapshot of a past quarter forever.
// It now reads the same public /rankings/ API the /rankings page reads and refreshes itself
// on the site-wide live tick. See the component header for the endpoints and publish gates.
import { HomeRankingsTiers } from "../_components/HomeRankingsTiers";
import { ProtectedRoute } from "../_components/ProtectedRoute";

// The old SponsorRedirectModal ("Sponsor Dashboard Available - go now?") lived here and re-asked
// on EVERY /home visit. Replaced (owner 2026-06-12) by the one-time DashboardIntroCoachmark in the
// Header, which points at the menu where the dashboard lives instead of navigating away.

export default function HomePage() {
  // Translations for the authed home/dashboard landing (namespace == messages/en/home.json).
  const t = useTranslations("home");
  return (
    <ProtectedRoute>
      <PageHeader
        title={t("dashboard.pageTitle")}
        description={t("dashboard.pageDescription")}
        dataTour="home-header"
      />
      {/* Notices sit directly under the header, ABOVE the stat boxes: an announcement below the
          fold is not an announcement. The block is absent entirely when nothing is pinned, so the
          page is unchanged on a quiet week. */}
      <HomeNotices />
      {/* data-tour anchor (home-boxes): guided-tour "Home" stop points here at the quick-stat
          boxes so a new player sees where their at-a-glance numbers live. */}
      <div data-tour="home-boxes">
        <HomeBoxes />
      </div>
      <div className="grid gap-2 md:grid-cols-2 mb-4">
        <div>
          <LatestNews />
        </div>

        <div>
          {/* Real, live storefront teaser (was a mock list behind a "Coming Soon"
              overlay). Fetches active products from the public shop endpoint. */}
          <FeaturedShop />
        </div>
      </div>
      {/* Latest events + player-market posts sit below the News/Shop row and above
          the Rankings & Tiers table, per the approved layout. */}
      <HomeLatestSections />
      <HomeRankingsTiers />
    </ProtectedRoute>
  );
}
