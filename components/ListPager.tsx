"use client";

// ListPager: numbered paging for a list the SERVER pages (inbox #161, owner 2026-10-05: the
// transfers page had "no pagination", and the new Players tab needs the same).
//
// Used by components/teams/PlayersDirectory.tsx (GET player/directory/) and
// components/news/TransferFeed.tsx (GET team/transfers/). Both endpoints take limit + offset and
// answer total_count, so this only needs the page, the page size and the total; the caller turns
// the page into an offset and fetches.
//
// "1 ... 4 5 6 ... 20": the first, the last and the pages either side of the current one, so the
// row stays short on a phone. Previous / Next keep their words from sm up and become arrows below
// it; every button is h-9 (36px) or larger for a thumb. Strings: messages/<locale>/common.json "pager".
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/number";

/** The page numbers to show, with null where a run of pages is skipped. */
function pageItems(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export function ListPager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations("common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("pager.showing", { start: formatNumber(start), end: formatNumber(end), total: formatNumber(total) })}
      </p>
      {pages > 1 && (
        <nav aria-label={t("pager.label")} className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 min-w-9"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label={t("pager.previous")}
          >
            <IconChevronLeft className="size-4" />
            <span className="hidden sm:inline">{t("pager.previous")}</span>
          </Button>
          {pageItems(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                ...
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "secondary"}
                size="sm"
                className="h-9 min-w-9 tabular-nums"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
              >
                {formatNumber(p)}
              </Button>
            ),
          )}
          <Button
            variant="secondary"
            size="sm"
            className="h-9 min-w-9"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            aria-label={t("pager.next")}
          >
            <span className="hidden sm:inline">{t("pager.next")}</span>
            <IconChevronRight className="size-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
