"use client";

// ─────────────────────────────────────────────────────────────────────────────
// User-facing Glossary page (/glossary).
//
// What it renders: a searchable, category-filterable dictionary of esports +
// Free Fire terms so newcomers can decode the platform. Each term shows the
// word (bold, primary-tinted), an outline category Badge, the definition, and
// an optional "also:" line.
//
// Where the content lives: the glossary STRUCTURE (ordered term list, stable
// i18n keys, category order) is in lib/glossary-data.ts. All translatable copy
// (category labels, definitions, alias "also" text) is in the "glossary" i18n
// namespace: messages/{en,fr,pt}/glossary.json. This file resolves each term's
// label/definition/alias from that namespace at render time, then feeds the
// localized rows to search + grouping. It never defines term copy itself.
//
// How it connects to the rest of the system:
//   - Reached from the site nav (homeNavLinks + homeNavLinksMobile in
//     constants/nav-links.ts -> rendered by _components/Header.tsx +
//     _components/MobileNavbar.tsx). The route /glossary lives under the (user)
//     route group, so it inherits app/(user)/layout.tsx (Header, container,
//     Footer).
//   - Uses the shared shadcn primitives (PageHeader, Card, Input, Badge, Tabs)
//     so it reads as the same designer's work as /about, /rankings, etc.
//   - i18n: chrome strings (title, search, empty state, "also:" wrapper) come
//     from the "teamsplayers" namespace under glossary.*; term content comes
//     from the dedicated "glossary" namespace. Both via next-intl useTranslations.
//
// Design notes (AFC constants): DM Sans + green primary heading via PageHeader,
// pill Tabs (bg-muted/h-9, active bg-background) NOT underline, rounded-md cards,
// compact text-sm/text-xs, outline rounded-full badges. No em/en dashes in copy.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchesSearch } from "@/lib/search";
import { IconSearch, IconMoodEmpty } from "@tabler/icons-react";
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  CATEGORY_I18N_KEYS,
  type GlossaryCategory,
} from "@/lib/glossary-data";

// "All" is the default filter; every real value comes from GLOSSARY_CATEGORIES.
type Filter = "All" | GlossaryCategory;

// A glossary row with its translatable fields already resolved for the active
// locale. `term` stays the untranslated acronym / proper noun; everything else
// (categoryLabel, definition, also) is pulled from the "glossary" namespace.
type LocalizedTerm = {
  term: string;
  key: string;
  category: GlossaryCategory;
  categoryLabel: string;
  definition: string;
  also?: string;
};

export default function GlossaryPage() {
  // i18n: user-facing chrome strings for /glossary (messages/en/teamsplayers.json
  // -> "glossary": title, search, empty state, "also:" wrapper).
  const t = useTranslations("teamsplayers");
  // i18n: term content (category labels, definitions, alias text) from the
  // dedicated "glossary" namespace (messages/{en,fr,pt}/glossary.json).
  const g = useTranslations("glossary");
  // Live search text (matched against term name, alias `also`, and definition).
  const [query, setQuery] = useState("");
  // Active category pill. "All" renders every category as a labeled section.
  const [filter, setFilter] = useState<Filter>("All");

  // ── Localize every term for the active locale ──────────────────────────────
  // Resolves category label, definition, and alias from the "glossary" namespace
  // once per render so search + grouping (below) operate on translated text.
  const localized = useMemo<LocalizedTerm[]>(() => {
    return GLOSSARY.map((item) => ({
      term: item.term,
      key: item.key,
      category: item.category,
      categoryLabel: g(`categories.${CATEGORY_I18N_KEYS[item.category]}`),
      definition: g(`definitions.${item.key}`),
      also: item.hasAlias ? g(`aliases.${item.key}`) : undefined,
    }));
  }, [g]);

  // ── Filtered result set ────────────────────────────────────────────────────
  // Applies the category pill first, then the case-insensitive text search.
  // Recomputed only when the localized rows, query, or filter change.
  const results = useMemo(() => {
    return localized.filter((item) => {
      // Category gate: "All" lets everything through.
      if (filter !== "All" && item.category !== filter) return false;

      // Text gate: shared matchesSearch over name/alias/definition. Using the
      // shared helper (not raw .includes) makes search punctuation- and
      // fancy-font-insensitive (so "ve" finds "V-E") and handles the empty
      // query by returning true. matchesSearch re-normalizes, so passing the
      // raw `query` state is fine. Searches the LOCALIZED definition/alias so
      // results match what the reader actually sees.
      return matchesSearch([item.term, item.also, item.definition], query);
    });
  }, [localized, query, filter]);

  // ── Group results by category (only used in the "All" view) ────────────────
  // Preserves the GLOSSARY_CATEGORIES order so sections read top to bottom in a
  // sensible "Getting Started" -> "Esports Business" flow. Empty categories are
  // dropped so a narrow search does not leave dangling headings. The section
  // label is the localized category name.
  const grouped = useMemo(() => {
    return GLOSSARY_CATEGORIES.map((cat) => ({
      category: cat,
      label: g(`categories.${CATEGORY_I18N_KEYS[cat]}`),
      terms: results.filter((item) => item.category === cat),
    })).filter((group) => group.terms.length > 0);
  }, [results, g]);

  const hasResults = results.length > 0;

  return (
    <div>
      {/* Green primary title + cheerful, beginner-friendly subtitle (no em dashes). */}
      <PageHeader
        title={t("glossary.pageTitle")}
        description={t("glossary.pageDescription")}
      />

      {/* ── Controls: live search + category pill filter ─────────────────────── */}
      <div className="mb-6 flex flex-col gap-3">
        {/* Search input mirrors the rankings SearchBar idiom: relative wrapper,
            absolutely-positioned IconSearch, Input with h-9 + left padding. */}
        <div className="relative w-full sm:max-w-sm">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("glossary.searchPlaceholder")}
            className="h-9 pl-8"
            aria-label={t("glossary.searchAriaLabel")}
          />
        </div>

        {/* shadcn pill Tabs (bg-muted, h-9, active bg-background). The list can
            overflow horizontally on small screens, so it scrolls rather than
            wrapping into the search field. Category labels are localized via the
            "glossary" namespace; the pill `value` stays the stable enum. */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="h-9 w-max">
              <TabsTrigger value="All" className="px-3">
                {t("glossary.all")}
              </TabsTrigger>
              {GLOSSARY_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="px-3">
                  {g(`categories.${CATEGORY_I18N_KEYS[cat]}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {!hasResults ? (
        // Empty state when the search/filter combination matches nothing.
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <IconMoodEmpty className="size-10 text-muted-foreground" />
          <p className="font-semibold">{t("glossary.noTermsTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("glossary.noTermsBody")}
          </p>
        </div>
      ) : filter === "All" ? (
        // "All" view: render each non-empty category as a labeled section so the
        // glossary stays scannable end to end.
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.category}>
              {/* Category section heading: white/foreground, compact. */}
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                {group.label}
              </h2>
              <TermGrid terms={group.terms} />
            </section>
          ))}
        </div>
      ) : (
        // Single-category view: one flat grid, no per-section headings (the pill
        // already names the category).
        <TermGrid terms={results} />
      )}
    </div>
  );
}

// ── Responsive card grid: 1 col mobile, 2 cols md, 3 cols xl ──────────────────
function TermGrid({ terms }: { terms: LocalizedTerm[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {terms.map((t, i) => (
        <TermCard key={`${t.category}-${t.term}`} term={t} index={i} />
      ))}
    </div>
  );
}

// ── Single term card ──────────────────────────────────────────────────────────
// AFC card idiom: rounded-md border bg-card. Light, tasteful fade-up entrance
// via framer-motion; the stagger is capped so a full category never feels slow.
function TermCard({ term, index }: { term: LocalizedTerm; index: number }) {
  // Local namespace handle for the one piece of chrome copy in the card ("also:").
  const t = useTranslations("teamsplayers");
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Card className="h-full gap-2 py-4">
        <div className="flex flex-col gap-2 px-3 md:px-4">
          {/* Term name + category badge on one row. */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-primary">{term.term}</h3>
            <Badge variant="outline" className="shrink-0 rounded-full">
              {term.categoryLabel}
            </Badge>
          </div>

          {/* Definition: compact, muted. */}
          <p className="text-sm text-muted-foreground">{term.definition}</p>

          {/* Optional alias / short form line. */}
          {term.also && (
            <p className="text-xs text-muted-foreground/80">
              {t("glossary.also", { alias: term.also })}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
