"use client";

// ─────────────────────────────────────────────────────────────────────────────
// User-facing Glossary page (/glossary).
//
// What it renders: a searchable, category-filterable dictionary of esports +
// Free Fire terms so newcomers can decode the platform. Each term shows the
// word (bold, primary-tinted), an outline category Badge, the definition, and
// an optional "also:" line.
//
// Where the content lives: ALL term content is authored in lib/glossary-data.ts
// (GLOSSARY array + GLOSSARY_CATEGORIES + GlossaryTerm/GlossaryCategory types).
// This file is UI only - it consumes that data and never defines term copy.
//
// How it connects to the rest of the system:
//   - Reached from the site nav (homeNavLinks + homeNavLinksMobile in
//     constants/nav-links.ts -> rendered by _components/Header.tsx +
//     _components/MobileNavbar.tsx). The route /glossary lives under the (user)
//     route group, so it inherits app/(user)/layout.tsx (Header, container,
//     Footer).
//   - Uses the shared shadcn primitives (PageHeader, Card, Input, Badge, Tabs)
//     so it reads as the same designer's work as /about, /rankings, etc.
//
// Design notes (AFC constants): DM Sans + green primary heading via PageHeader,
// pill Tabs (bg-muted/h-9, active bg-background) NOT underline, rounded-md cards,
// compact text-sm/text-xs, outline rounded-full badges. No em/en dashes in copy.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  type GlossaryTerm,
  type GlossaryCategory,
} from "@/lib/glossary-data";

// "All" is the default filter; every real value comes from GLOSSARY_CATEGORIES.
type Filter = "All" | GlossaryCategory;

export default function GlossaryPage() {
  // Live search text (matched against term name, alias `also`, and definition).
  const [query, setQuery] = useState("");
  // Active category pill. "All" renders every category as a labeled section.
  const [filter, setFilter] = useState<Filter>("All");

  // ── Filtered result set ────────────────────────────────────────────────────
  // Applies the category pill first, then the case-insensitive text search.
  // Recomputed only when query or filter change (cheap over 60 terms).
  const results = useMemo(() => {
    return GLOSSARY.filter((t) => {
      // Category gate: "All" lets everything through.
      if (filter !== "All" && t.category !== filter) return false;

      // Text gate: shared matchesSearch over name/alias/definition. Using the
      // shared helper (not raw .includes) makes search punctuation- and
      // fancy-font-insensitive (so "ve" finds "V-E") and handles the empty
      // query by returning true. matchesSearch re-normalizes, so passing the
      // raw `query` state is fine.
      return matchesSearch([t.term, t.also, t.definition], query);
    });
  }, [query, filter]);

  // ── Group results by category (only used in the "All" view) ────────────────
  // Preserves the GLOSSARY_CATEGORIES order so sections read top to bottom in a
  // sensible "Getting Started" -> "Esports Business" flow. Empty categories are
  // dropped so a narrow search does not leave dangling headings.
  const grouped = useMemo(() => {
    return GLOSSARY_CATEGORIES.map((cat) => ({
      category: cat,
      terms: results.filter((t) => t.category === cat),
    })).filter((g) => g.terms.length > 0);
  }, [results]);

  const hasResults = results.length > 0;

  return (
    <div>
      {/* Green primary title + cheerful, beginner-friendly subtitle (no em dashes). */}
      <PageHeader
        title="Glossary"
        description="Plain-language definitions for esports and Free Fire terms. New here? Start with Getting Started."
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
            placeholder="Search terms..."
            className="h-9 pl-8"
            aria-label="Search glossary terms"
          />
        </div>

        {/* shadcn pill Tabs (bg-muted, h-9, active bg-background). The list can
            overflow horizontally on small screens, so it scrolls rather than
            wrapping into the search field. */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="h-9 w-max">
              <TabsTrigger value="All" className="px-3">
                All
              </TabsTrigger>
              {GLOSSARY_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="px-3">
                  {cat}
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
          <p className="font-semibold">No terms match your search.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try a different word, or switch the category back to All.
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
                {group.category}
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
function TermGrid({ terms }: { terms: GlossaryTerm[] }) {
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
function TermCard({ term, index }: { term: GlossaryTerm; index: number }) {
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
              {term.category}
            </Badge>
          </div>

          {/* Definition: compact, muted. */}
          <p className="text-sm text-muted-foreground">{term.definition}</p>

          {/* Optional alias / short form line. */}
          {term.also && (
            <p className="text-xs text-muted-foreground/80">
              also: {term.also}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
