"use client";

/**
 * app/(user)/fantasy/page.tsx - Free Fire Fantasy League, coming soon.
 *
 * WHAT THIS PAGE IS FOR
 *   The feature is not built. This page exists to say so honestly and to answer one question the
 *   owner needs answered before building it: does anybody want it? A tick is one signed-in person
 *   (enforced by a unique row, not by trusting this page), so the number underneath is a count of
 *   PEOPLE rather than clicks.
 *
 * WHY IT EXPLAINS THE GAME RATHER THAN JUST SAYING "SOON"
 *   Most people reading this have never played a fantasy league. "Coming soon" to somebody who does
 *   not know what is coming is not an invitation, and the tick is worth nothing if the people
 *   ticking do not know what they are agreeing to. Three short lines of "here is how it works" is
 *   the difference between a number the owner can act on and a number that flatters.
 *
 * WHAT IT TALKS TO
 *   GET  {BACKEND}/auth/feature-interest/?feature=fantasy_league   (public, so the count renders
 *                                                                   for a signed-out reader)
 *   POST {BACKEND}/auth/feature-interest/                          (login required to tick)
 *   Backend: afc_auth/feature_interest.py.
 *
 * Strings: messages/{en,fr,pt}/fantasy.json. The section layout carries the page metadata, because
 * a "use client" page cannot export any.
 */

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconTrophy, IconUsers, IconChartBar, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

// The key the backend allow-lists (afc_auth.feature_interest.KNOWN_FEATURES). A typo here answers
// 400 rather than quietly counting into a second bucket nobody reads.
const FEATURE = "fantasy_league";

// The day this page goes live, for the self-expiring NEW tag.
const LIVE_SINCE = "2026-08-16";

export default function FantasyPage() {
  // Namespace "fantasy" (messages/{en,fr,pt}/fantasy.json).
  const t = useTranslations("fantasy");
  const { token } = useAuth();

  const [interested, setInterested] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/feature-interest/`;

  const load = useCallback(async () => {
    try {
      const res = await axios.get(url, {
        params: { feature: FEATURE },
        headers: authHeaders(),
      });
      setInterested(!!res.data?.interested);
      setCount(res.data?.count ?? 0);
    } catch {
      // A count that will not load leaves the tick usable and the number hidden. Nothing here is
      // worth an error wall on a page whose whole job is to say "not yet".
      setCount(null);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load, token]);

  const toggle = async (next: boolean) => {
    if (!token) {
      toast.error(t("signInFirst"));
      return;
    }
    setSaving(true);
    // Optimistic: the tick answers instantly and is corrected by the response. On a phone on a slow
    // connection a checkbox that waits a second for the server feels broken.
    setInterested(next);
    try {
      const res = await axios.post(
        url,
        { feature: FEATURE, interested: next },
        { headers: authHeaders() },
      );
      setInterested(!!res.data?.interested);
      setCount(res.data?.count ?? null);
      if (next) toast.success(t("thanks"));
    } catch (error: any) {
      setInterested(!next); // put it back: the server did not record it
      toast.error(error?.response?.data?.message || t("failed"));
    } finally {
      setSaving(false);
    }
  };

  const HOW = [
    { icon: IconUsers, key: "pick" },
    { icon: IconChartBar, key: "score" },
    { icon: IconTrophy, key: "win" },
  ];

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("title")}
            <NewBadge since={LIVE_SINCE} />
          </span>
        }
        description={t("subtitle")}
      />

      {/* The status, said plainly and first. Somebody who reads nothing else should still leave
          knowing this does not exist yet. */}
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">
            {t("comingSoon")}
          </p>
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">{t("headline")}</h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">{t("blurb")}</p>
        </CardContent>
      </Card>

      {/* How it works, because "coming soon" means nothing to somebody who has never played one. */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {HOW.map(({ icon: Icon, key }) => (
          <Card key={key} className="bg-card rounded-md border py-6 shadow-sm">
            <CardContent className="space-y-2">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">{t(`how.${key}.title`)}</p>
              <p className="text-xs text-muted-foreground">{t(`how.${key}.body`)}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* The one thing to do on this page. */}
      <Card className="mt-6 bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="space-y-3">
          <label
            htmlFor="fantasy-interest"
            className="flex cursor-pointer items-start gap-3"
          >
            <Checkbox
              id="fantasy-interest"
              checked={interested}
              disabled={saving}
              onCheckedChange={(v) => toggle(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                {t("interest.label")}
              </span>
              <span className="block text-xs text-muted-foreground">{t("interest.hint")}</span>
            </span>
          </label>

          {/* The count is only shown once it is known: "0 people" while a request is in flight
              reads as "nobody wants this", which is a different and wrong message. */}
          {count !== null && (
            <p className="inline-flex items-center text-xs text-muted-foreground">
              {interested && <IconCheck className="mr-1 h-3.5 w-3.5 text-primary" aria-hidden />}
              {t("interest.count", { count })}
            </p>
          )}

          {!token && (
            <p className="text-xs text-muted-foreground">
              {t("signInPrompt")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("signInLink")}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
