// app/(root)/page.tsx - the public landing page ("/").
//
// A SERVER component since 2026-10-16 (Search Console Core Web Vitals: LCP 5.9 s on phones, lab
// 14.1 s). It used to be a client page whose whole hero sat at opacity-0 until React hydrated and
// then faded in for a second, so the largest text appeared last; it also downloaded EVERY team
// (GET team/get-all-teams/, 426 KB) only to print how many there are. Now the HTML arrives with
// the hero and the numbers already in it.
//
// THE NUMBERS ARE REAL. The stats row used to print hard-coded "1,200+ tournaments held" and
// "$500K+ prize pool distributed" while production held 175 events; the owner's rule is no
// invented numbers and no fake money on the site. It now prints three counts from
// GET /auth/get-total-number-of-users/ (AFC-B afc_auth/views.py get_total_number_of_users:
// verified_users, total_teams, events_held), cached for 10 minutes, and shows NO stats row at all
// when that answer cannot be read, rather than a made-up figure.
//
// CONNECTS TO: (user)/_components/Header + _components/Footer (client chrome), LandingTransfers
// (client, its own fetch), messages/<locale>/home.json (landing.*).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import {
  Trophy,
  Users,
  Calendar,
  Star,
  Target,
  Shield,
  Award,
} from "lucide-react";
import { formatNumber } from "@/lib/i18n/number";
import { env } from "@/lib/env";
import { Footer } from "../_components/Footer";
import { Header } from "../(user)/_components/Header";
import { LandingTransfers } from "./_components/LandingTransfers";

// The three counts the stats row prints, or null when they cannot be read (then no row shows).
type SiteCounts = { verified_users: number; total_teams: number; events_held: number };

async function getSiteCounts(): Promise<SiteCounts | null> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-total-number-of-users/`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    // Type checks, never truthiness: a real 0 is a real answer (the falsy-zero trap).
    const ok = ["verified_users", "total_teams", "events_held"].every((k) => typeof j?.[k] === "number");
    return ok ? (j as SiteCounts) : null;
  } catch {
    return null;
  }
}

const page = async () => {
  // Translations for the public landing page (namespace == messages/en/home.json).
  const t = await getTranslations("home");
  const locale = await getLocale();
  const counts = await getSiteCounts();

  const features = [
    {
      icon: Trophy,
      title: t("landing.features.tournaments.title"),
      description: t("landing.features.tournaments.description"),
    },
    {
      icon: Users,
      title: t("landing.features.teamManagement.title"),
      description: t("landing.features.teamManagement.description"),
    },
    {
      icon: Target,
      title: t("landing.features.rankings.title"),
      description: t("landing.features.rankings.description"),
    },
    {
      icon: Calendar,
      title: t("landing.features.scheduling.title"),
      description: t("landing.features.scheduling.description"),
    },
    {
      icon: Shield,
      title: t("landing.features.fairPlay.title"),
      description: t("landing.features.fairPlay.description"),
    },
    {
      icon: Award,
      title: t("landing.features.achievements.title"),
      description: t("landing.features.achievements.description"),
    },
  ];

  // Exact counts, no "+": they are the real numbers, not a floor someone typed in.
  const stats = counts
    ? [
        { label: t("landing.stats.activePlayers"), value: formatNumber(counts.verified_users, undefined, locale), icon: Users },
        { label: t("landing.stats.teamsRegistered"), value: formatNumber(counts.total_teams, undefined, locale), icon: Shield },
        { label: t("landing.stats.eventsHeld"), value: formatNumber(counts.events_held, undefined, locale), icon: Trophy },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-gold/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />

        <div className="container mx-auto py-24 relative z-10">
          {/* Visible from the first byte: no fade-in (it held the largest text back until
              hydration, and decorative motion is banned house style). */}
          <div className="text-center">
            {/* Season tagline. Was a breathing glow (animate-pulse plus a coloured text-shadow)
                until 2026-09-04; both are banned house style, and a headline that throbs is the
                single clearest tell of a generated page. The emphasis now comes from weight,
                colour and letter-spacing, which is what the glow was standing in for. */}
            <div className="mb-6 flex justify-center">
              <span className="text-sm md:text-base font-bold uppercase tracking-[0.25em] text-primary">
                {t("landing.hero.seasonBadge")}
              </span>
            </div>

            {/* Tighter tracking and leading for display-size type (Apple fix 11, inbox #381). */}
            <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-[-0.025em] leading-[1.02]">
              <span className="bg-gradient-to-r from-primary via-gold to-primary bg-clip-text text-transparent">
                {t("landing.hero.titleHighlight")}
              </span>
              <br />
              <span className="text-foreground">
                {t("landing.hero.titleRest")}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t("landing.hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {/* <Link href="/create-account">
                <Button

                  className="bg-gradient-to-r from-primary to-[var(--gold)] hover:from-primary/90 hover:to-[hsl(var(--gold))]/90 text-primary-foreground px-8 py-6 text-lg"
                >
                  <GamepadIcon className="w-5 h-5 mr-2" />
                  Start Competing
                </Button>
              </Link>
              <Link href="/tournaments">
                <Button

                  variant="outline"
                  className="text-primary hover:bg-primary/10 px-8 py-6 text-lg bg-primary/5"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  View Tournaments
                </Button>
              </Link> */}
              <Link href="/create-account">
                <Button variant="gradient">
                  <Star />
                  {t("landing.hero.createAccount")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section: three real counts (see the header comment), or nothing at all. */}
      {stats.length > 0 && (
        <section className="py-16 bg-gradient-to-r from-background via-primary/5 to-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-3 gap-4 md:gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/20 text-gold mb-4">
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-gold mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground text-xs md:text-sm">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Who's moving (owner-approved 2026-09-30, inbox #93 / #96): the latest player moves, public,
          under the stats and before the feature pitch. */}
      <LandingTransfers />

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-primary">
                {t("landing.features.headingHighlight")}
              </span>{" "}
              {t("landing.features.headingRest")}
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("landing.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-background/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:bg-primary/10"
              >
                <CardContent>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/20 text-gold mb-4 transition-transform hover:scale-110">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-background to-gold/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t("landing.cta.headingPrefix")}{" "}
              <span className="text-primary">
                {t("landing.cta.headingHighlight")}
              </span>{" "}
              {t("landing.cta.headingSuffix")}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-4">
              {t("landing.cta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create-account">
                <Button variant="gradient" className="w-full">
                  <Star className="w-5 h-5 mr-2" />
                  {t("landing.cta.createAccount")}
                </Button>
              </Link>
              <Link href="/about">
                <Button variant="outline" className="w-full">
                  {t("landing.cta.learnMore")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default page;
