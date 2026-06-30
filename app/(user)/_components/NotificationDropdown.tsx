"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  IconBell,
  IconArrowRight,
  IconTrophy,
  IconNews,
  IconUsers,
  IconUser,
  IconShoppingBag,
  IconBuilding,
} from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LocalTime } from "@/components/LocalTime";
import axios from "axios";
import { env } from "@/lib/env";
// Shared-chrome strings live in messages/en/common.json under "common".
import { useTranslations } from "next-intl";
import { LinkifiedText } from "@/components/LinkifiedText";

// ── Notification shape ────────────────────────────────────────────────────────
// Mirrors what GET /auth/get-notifications/ returns (fetched in Header.tsx and
// passed down). `title` + `message` are already localized to the viewer's locale by
// the backend (translate-on-read). `created_at` is a UTC instant rendered in the
// viewer's timezone via <LocalTime>. `links` is the multi deep-link array (owner
// 2026-06-17): one entry per linked entity, each with a computed relative `link`
// plus its target_type/target_id; `link` (singular) is kept for back-compat and
// equals the first link. We render one "View" button per links[] entry (so a
// broadcast tied to several events shows several View buttons).
interface NotificationLink {
  link: string;
  target_type?: string | null;
  target_id?: string | number | null;
}
interface AppNotification {
  id: number | string;
  title?: string | null;
  message: string;
  is_read: boolean;
  created_at?: string | null;
  target_type?: string | null;
  target_id?: string | number | null;
  link?: string | null;
  links?: NotificationLink[];
  [key: string]: any;
}

interface NotificationDropdownProps {
  notifications: AppNotification[];
  unreadCount: number;
  onNotificationUpdate: () => void;
}

// Icon per target type — gives each notification an at-a-glance source. Default bell
// for general/unknown types. Tabler icons (same set the rest of the chrome uses).
const TYPE_ICON: Record<string, typeof IconBell> = {
  event: IconTrophy,
  news: IconNews,
  team: IconUsers,
  player: IconUser,
  shop: IconShoppingBag,
  organizer: IconBuilding,
};

// Known type keys that have an i18n label under notifications.types.*; everything
// else falls back to the neutral "none"/Update label.
const KNOWN_TYPES = [
  "event",
  "news",
  "team",
  "player",
  "shop",
  "organizer",
  "custom",
  "none",
  "message",
];

// Turn a slug/username into a readable button label (e.g. "dynasty-cup" -> "Dynasty Cup").
function humanizeSlug(s: string) {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onNotificationUpdate,
}: NotificationDropdownProps) {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations("common");
  // Controlled Sheet so a "View" tap can close the panel before routing (App Router
  // navigation keeps the Header mounted, so the Sheet would otherwise stay open).
  const [open, setOpen] = useState(false);

  // Mark a notification read on the backend (idempotent) and refresh the list so the
  // unread accent + count update. Safe on an already-read row (skips the POST).
  const markRead = async (notification: AppNotification) => {
    if (notification.is_read || !token) return;
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/view-notification/`,
        { notification_id: notification.id.toString() },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      onNotificationUpdate();
    } catch (error) {}
  };

  // A "View" button marks the notification read, closes the panel, then routes to the
  // linked entity. stopPropagation so the card's own (mark-read) click doesn't double-fire.
  const openLink = async (notification: AppNotification, url: string) => {
    await markRead(notification);
    setOpen(false);
    router.push(url);
  };

  // Resolve the link list: prefer the multi `links[]`, fall back to the single `link`.
  const linksFor = (n: AppNotification): NotificationLink[] => {
    if (Array.isArray(n.links) && n.links.length > 0) return n.links;
    if (n.link) return [{ link: n.link, target_type: n.target_type, target_id: n.target_id }];
    return [];
  };

  // Per-link button label: humanized slug for slug-based types, @username for players,
  // otherwise the generic "View".
  const linkLabel = (l: NotificationLink) => {
    const id = String(l.target_id ?? "");
    if (["event", "news", "organizer"].includes(l.target_type || "") && id) {
      return humanizeSlug(id);
    }
    if (l.target_type === "player" && id) return `@${id}`;
    return t("notifications.view");
  };

  // The type used for the icon + the small category label on a card.
  const typeOf = (n: AppNotification) =>
    (n.target_type || n.links?.[0]?.target_type || "none") as string;
  const typeLabel = (tt: string) =>
    t(`notifications.types.${KNOWN_TYPES.includes(tt) ? tt : "none"}`);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-auto p-0 hover:bg-transparent"
        >
          <IconBell />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="p-0 flex flex-col w-[90vw] sm:max-w-sm">
        <SheetHeader className="px-4 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <Badge variant="secondary">
                {t("notifications.unreadCount", { count: unreadCount })}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          {notifications.length === 0 ? (
            // Richer empty state: icon + headline + hint (replaces the bare italic line).
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="rounded-full bg-muted p-3">
                <IconBell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{t("notifications.empty")}</p>
              <p className="text-xs text-muted-foreground">
                {t("notifications.emptyHint")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {notifications.map((notification: AppNotification, index) => {
                const unread = !notification.is_read;
                const tt = typeOf(notification);
                const Icon = TYPE_ICON[tt] || IconBell;
                const links = linksFor(notification);
                return (
                  // The card itself is the (subtle) mark-read target; the View buttons
                  // stopPropagation and handle navigation. A div (not a button) so it can
                  // legally contain the action buttons.
                  <div
                    key={index}
                    onClick={() => unread && markRead(notification)}
                    className={cn(
                      "rounded-md border p-3 shadow-sm transition-colors",
                      unread
                        ? "cursor-pointer border-l-2 border-l-primary bg-muted/40 hover:bg-muted/60"
                        : "bg-card",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type icon chip */}
                      <div className="mt-0.5 shrink-0 rounded-full bg-muted p-1.5 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {typeLabel(tt)}
                          </span>
                          {notification.created_at && (
                            <LocalTime
                              value={notification.created_at}
                              mode="relative"
                              className="shrink-0 text-[11px] text-muted-foreground"
                            />
                          )}
                        </div>

                        {notification.title && (
                          <p className="mt-0.5 text-sm font-semibold leading-snug break-words">
                            {notification.title}
                          </p>
                        )}
                        {/* Linkify URLs in the body so a pasted link (e.g. a WhatsApp group invite an
                            admin/organizer adds) is tappable + highlighted, not dead text (owner 2026-06-30). */}
                        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted-foreground">
                          <LinkifiedText text={notification.message} />
                        </p>

                        {(links.length > 0 || unread) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {links.map((l, i) => (
                              <Button
                                key={i}
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-full px-3 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLink(notification, l.link);
                                }}
                              >
                                {linkLabel(l)}
                                <IconArrowRight className="ml-1 h-3 w-3" />
                              </Button>
                            ))}
                            {unread && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(notification);
                                }}
                              >
                                {t("notifications.markRead")}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
