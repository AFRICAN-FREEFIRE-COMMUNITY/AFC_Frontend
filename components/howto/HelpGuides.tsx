"use client";

// ── components/howto/HelpGuides.tsx ─────────────────────────────────────────────────────────────
// The body of the player Help Center, /help (inbox #255, mockups/help-page/ approved 2026-10-16):
// a search box, the topic pills, one card per how-to clip, an empty state, and the way to people.
//
// DATA: lib/howto-guides.ts (which clips, topics and audiences), the clips' own captions for every
// word a guide says (messages/<loc>/howto.json), the page's words in helpPage.json.
// SEARCH: the shared matchesSearch (lib/search.ts), the same as the admin and organizer Help Center
// (components/help-center/HelpCenter.tsx) and every list page, over a guide's title, summary and steps.
// MOUNTED BY: app/(user)/help/page.tsx (a Server Component that owns the title and the metadata).
// Design: the existing Help Center's idiom (pill Tabs, filled cards, outline Badges, which are flat
// tints), no outlines, no glow (owner rules).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconMoodEmpty, IconSearch } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HowtoGuideCard } from "@/components/howto/HowtoGuideCard";
import { HOWTO_GUIDES, HOWTO_TOPICS, type HowtoTopic } from "@/lib/howto-guides";
import { matchesSearch } from "@/lib/search";

type TopicFilter = "all" | HowtoTopic;

export function HelpGuides() {
  const t = useTranslations("helpPage");
  const tc = useTranslations("howto");
  const [query, setQuery] = React.useState("");
  const [topic, setTopic] = React.useState<TopicFilter>("all");

  const shown = React.useMemo(
    () =>
      HOWTO_GUIDES.filter((g) => {
        if (topic !== "all" && g.topic !== topic) return false;
        // sql-safe: next-intl t.raw reads a message object, not SQL
        const steps = Object.values(tc.raw(`clips.${g.messages}.steps`) as Record<string, string>);
        return matchesSearch([tc(`clips.${g.messages}.title`), tc(`clips.${g.messages}.summary`), ...steps], query);
      }),
    [topic, query, tc],
  );

  return (
    <div>
      {/* ── Search, then the topics ── */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-md">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.ariaLabel")}
            className="h-9 pl-8"
          />
        </div>
        {/* The pills can be wider than a phone, so they scroll inside their own row. */}
        <Tabs value={topic} onValueChange={(v) => setTopic(v as TopicFilter)}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="h-9 w-max">
              <TabsTrigger value="all" className="px-3">{t("topics.all")}</TabsTrigger>
              {HOWTO_TOPICS.map((tp) => (
                <TabsTrigger key={tp} value={tp} className="px-3">{t(`topics.${tp}`)}</TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* ── The guides ── */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-card px-4 py-12 text-center">
          <IconMoodEmpty className="size-10 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((g) => (
            <HowtoGuideCard key={g.clip} guide={g} />
          ))}
        </div>
      )}

      {/* ── The way to a person, always last ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-card px-4 py-4 text-sm text-muted-foreground shadow-sm md:px-5">
        <span>{t("stuck.body")}</span>
        <Button asChild variant="secondary">
          <Link href="/support">{t("stuck.button")}</Link>
        </Button>
      </div>
    </div>
  );
}
