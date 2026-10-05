"use client";

// NewsCategoryPicker: the admin News form's category field, one or several at once (inbox #160,
// owner 2026-10-05: "an article or post can be under several categories simultaneously").
//
// Used by app/(a)/a/news/create/page.tsx and app/(a)/a/news/[slug]/edit/page.tsx, bound to the
// react-hook-form field `categories` (string[], lib/zodSchemas.tsx). The keys and the NEW dates come
// from `newsCategories` in @/constants, the same list the old single select read; the labels come
// from messages/<locale>/news.json categories.*, so an admin sees the words readers see. The forms
// send each key as a repeated `categories` field to create_news / edit_news (AFC-B
// afc_auth/views.py _read_news_categories), which keeps this order and stores the first as the
// post's main `category`, so a pick is added at the end.
//
// Filled chips, the picked ones in the brand fill; never an outline (owner design rule). A real
// <button> with aria-pressed each, so a keyboard and a screen reader get on / off for free.
import { useTranslations } from "next-intl";
import { newsCategories } from "@/constants";
import { NewBadge } from "@/components/NewBadge";
import { cn } from "@/lib/utils";

export function NewsCategoryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("news");
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="flex flex-wrap gap-2">
      {newsCategories.map((category) => {
        const on = value.includes(category.value);
        return (
          <button
            key={category.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(category.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {t.has(`categories.${category.value}`) ? t(`categories.${category.value}`) : category.label}
            {/* A recently added category keeps its self-expiring NEW tag, as in the old select. On
                a picked chip the tag's own green would vanish into the green fill, so it takes
                the chip's text colour there instead. */}
            {category.newSince && (
              <NewBadge
                since={category.newSince}
                className={on ? "bg-primary-foreground/15 text-primary-foreground" : undefined}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
