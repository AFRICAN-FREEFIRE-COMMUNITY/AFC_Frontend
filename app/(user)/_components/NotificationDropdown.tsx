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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { IconBell, IconArrowRight } from "@tabler/icons-react";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { env } from "@/lib/env";
// Shared-chrome strings live in messages/en/common.json under "common".
import { useTranslations } from "next-intl";

// ── Notification shape ────────────────────────────────────────────────────────
// Mirrors what GET /auth/get-notifications/ returns (fetched in Header.tsx and
// passed down as the `notifications` prop). `link` is the backend-computed deep
// link (a relative URL like "/tournaments/<slug>", "/news/<slug>", "/teams/<id>",
// "/players/<username>", "/shop", "/organizations/<slug>", a custom "/path", or
// null). target_type/target_id are the raw target the link is derived from; we
// only need `link` to render the "Take me there" button, but the type carries
// them for completeness with the backend contract.
interface AppNotification {
  id: number | string;
  message: string;
  is_read: boolean;
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
  const t = useTranslations("common");
  const [selectedNotification, setSelectedNotification] =
    useState<AppNotification | null>(null);

  const handleNotificationClick = async (notification: AppNotification) => {
    setSelectedNotification(notification);

    if (!notification.is_read && token) {
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
    }
  };

  return (
    <>
      <Sheet>
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
                    <button
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 w-full text-left transition-colors hover:bg-muted/70 cursor-pointer",
                        !notification.is_read && "bg-muted/50",
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                      {notification.is_read && (
                        <div className="h-2 w-2 shrink-0 mt-1.5" />
                      )}
                      <span className="flex-1 text-sm leading-relaxed line-clamp-2">
                        {notification.message}
                      </span>
                    </button>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!selectedNotification}
        onOpenChange={(open) => !open && setSelectedNotification(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("notifications.singular")}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm leading-relaxed">
              {selectedNotification?.message}
            </p>
          </div>
          {/* Deep link ("Take me there"): only when the backend supplied a
              non-null relative `link` for this notification. Tapping it closes
              the dialog (the Sheet auto-closes on navigation) and routes the
              user straight to the related entity. The read-marking already
              happened in handleNotificationClick when the row was opened. */}
          {selectedNotification?.link && (
            <Button
              asChild
              className="w-full"
              onClick={() => setSelectedNotification(null)}
            >
              <Link href={selectedNotification.link}>
                {t("notifications.takeMeThere")}
                <IconArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
