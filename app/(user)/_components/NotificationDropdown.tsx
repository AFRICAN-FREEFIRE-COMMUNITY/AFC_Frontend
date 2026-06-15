"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { IconBell, IconArrowRight } from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LocalTime } from "@/components/LocalTime";
import axios from "axios";
import { env } from "@/lib/env";
// Shared-chrome strings live in messages/en/common.json under "common".
import { useTranslations } from "next-intl";

// ── Notification shape ────────────────────────────────────────────────────────
// Mirrors what GET /auth/get-notifications/ returns (fetched in Header.tsx and
// passed down as the `notifications` prop). `message` is already localized to the
// viewer's locale by the backend (translate-on-read). `created_at` is a UTC ISO
// instant we render in the viewer's own timezone via <LocalTime>. `link` is the
// backend-computed deep link (a relative URL like "/tournaments/<slug>",
// "/news/<slug>", "/teams/<id>", "/players/<username>", "/shop",
// "/organizations/<slug>", a custom "/path", or null). target_type/target_id are
// the raw target the link is derived from; we only need `link` to drive the
// "Take me there" affordance, but the type carries them for completeness with the
// backend contract.
interface AppNotification {
  id: number | string;
  message: string;
  is_read: boolean;
  created_at?: string | null;
  target_type?: string | null;
  target_id?: string | number | null;
  link?: string | null;
  [key: string]: any;
}

interface NotificationDropdownProps {
  notifications: AppNotification[];
  unreadCount: number;
  onNotificationUpdate: () => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onNotificationUpdate,
}: NotificationDropdownProps) {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations("common");
  // Controlled Sheet so a "Take me there" tap can close the panel before routing
  // (App Router navigation keeps the Header mounted, so the Sheet would otherwise
  // stay open over the destination page).
  const [open, setOpen] = useState(false);

  // Mark a notification read on the backend (idempotent) and refresh the list so
  // the unread dot + count update. Safe to call on an already-read row; we just
  // skip the POST. Returns once the request settles so callers can navigate after.
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

  // Tapping a row marks it read and, when the backend gave it a deep link, closes
  // the panel and routes the user straight to the related entity. With the full
  // message now rendered inline there is nothing more to "open", so a link-less
  // notification simply clears its unread state.
  const handleRowClick = async (notification: AppNotification) => {
    await markRead(notification);
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

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
            <p className="italic text-sm text-muted-foreground text-center py-10 px-4">
              {t("notifications.empty")}
            </p>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification: AppNotification, index) => (
                <div key={index}>
                  {/* Whole row is the click target: marks read + (if linked) navigates.
                      It is a <button> so it must NOT contain another interactive
                      element - the "Take me there" cue below is a plain span, and the
                      parent handler performs the navigation. */}
                  <button
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 w-full text-left transition-colors hover:bg-muted/70 cursor-pointer",
                      !notification.is_read && "bg-muted/50",
                    )}
                    onClick={() => handleRowClick(notification)}
                  >
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0 mt-1.5",
                        !notification.is_read && "bg-primary",
                      )}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Full message, untruncated. whitespace-pre-line keeps any
                          line breaks the admin typed; break-words stops long
                          unbroken strings (URLs) from overflowing the panel. */}
                      <p className="text-sm leading-relaxed whitespace-pre-line break-words">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        {notification.created_at && (
                          <LocalTime
                            value={notification.created_at}
                            mode="relative"
                            className="text-xs text-muted-foreground"
                          />
                        )}
                        {notification.link && (
                          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                            {t("notifications.takeMeThere")}
                            <IconArrowRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {index < notifications.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
