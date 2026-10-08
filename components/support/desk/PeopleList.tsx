"use client";

/**
 * PeopleList - the desk's left column: PEOPLE, not tickets (inbox #169 / #174).
 *
 * Somebody who wrote five times is one row: their name and country, the most urgent status among
 * their requests, "N requests, M open", when they last wrote and what they last said. A flat dot
 * (never a pulse or a glow) marks a person who wrote last on something still open. Tick boxes pick
 * people for one shared answer (the page opens BulkReplyDialog).
 *
 * Data: SupportPerson rows from GET support/people/ (lib/api/support.ts getSupportPeople), passed
 * in by components/support/desk/SupportDesk.tsx, which also owns the selection and the picked set.
 */
import { useTranslations } from "next-intl";
import { IconInbox, IconSend } from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import type { SupportPerson } from "@/lib/api/support";
import { CountryFlag } from "@/lib/countryFlag";
import { cn } from "@/lib/utils";

export const STATUS_PILL: Record<string, string> = {
  open: "bg-primary/15 text-primary",
  waiting: "bg-amber-500/15 text-amber-500",
  resolved: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

export function PeopleList({
  people,
  loading,
  error,
  selected,
  onSelect,
  picked,
  onTogglePick,
  onBulkReply,
  onClearPicked,
  emptyText,
  hasMore,
  onLoadMore,
  selectable = true,
}: {
  people: SupportPerson[];
  loading: boolean;
  error: string;
  selected: string | null;
  onSelect: (key: string) => void;
  picked: Set<string>;
  onTogglePick: (key: string) => void;
  onBulkReply: () => void;
  onClearPicked: () => void;
  emptyText: string;
  hasMore: boolean;
  onLoadMore: () => void;
  /** False on a read-only desk (inbox #175): nobody to bulk-reply as, so no tick boxes. */
  selectable?: boolean;
}) {
  const t = useTranslations("support");

  if (loading && !people.length) return <Loader text={t("loading")} />;
  if (error) return <p className="text-destructive p-3 text-sm">{error}</p>;
  if (!people.length) {
    return (
      <div className="px-4 py-10 text-center">
        <IconInbox className="text-muted-foreground mx-auto mb-2 size-7" />
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {picked.size > 0 ? (
        <div className="bg-primary/10 mb-1.5 flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2 text-sm">
          <span className="flex-1">{t("desk.picked", { count: picked.size })}</span>
          <Button size="sm" onClick={onBulkReply}>
            <IconSend className="mr-1 size-4" /> {t("desk.replyAll")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClearPicked}>
            {t("desk.clear")}
          </Button>
        </div>
      ) : null}

      {people.map((p) => (
        <div
          key={p.key}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(p.key)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(p.key)}
          className={cn(
            "grid cursor-pointer items-start gap-2.5 rounded-md p-2.5",
            selectable ? "grid-cols-[auto_auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]",
            p.key === selected ? "bg-primary/10" : "hover:bg-muted/60",
          )}
        >
          {selectable ? (
            <input
              type="checkbox"
              className="accent-primary mt-2.5 size-4"
              checked={picked.has(p.key)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onTogglePick(p.key)}
              aria-label={t("desk.pick", { name: p.name })}
            />
          ) : null}
          <div className="bg-muted flex size-9 items-center justify-center rounded-full text-sm font-bold">
            {(p.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {p.needs_reply ? (
                <span className="bg-primary size-2 shrink-0 rounded-full" title={t("desk.needsReply")} />
              ) : null}
              <span className="truncate text-sm font-semibold">{p.name}</span>
              {p.country_name ? <CountryFlag country={p.country_name} className="shrink-0" /> : null}
              <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                <LocalTime value={p.last_at} mode="relative" />
              </span>
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_PILL[p.status] ?? "bg-muted")}>
                {t(`status.${p.status}`)}
              </span>
              {t("desk.requests", { count: p.ticket_count, open: p.open_count })}
            </div>
            {p.snippet ? <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{p.snippet}</p> : null}
          </div>
        </div>
      ))}

      {hasMore ? (
        <div className="pt-2 text-center">
          <Button size="sm" variant="ghost" onClick={onLoadMore} disabled={loading}>
            {t("desk.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
