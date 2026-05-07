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
import {
  IconBell,
  IconLock,
  IconCoin,
  IconArrowsExchange,
  IconCheck,
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { env } from "@/lib/env";

interface NotificationDropdownProps {
  notifications: any[];
  unreadCount: number;
  onNotificationUpdate: () => void;
}

// Wager-feature notification kinds (M13.4). Real backend notifications
// come down as plain { message } strings, but the wager flow may attach
// a `kind` discriminator + structured `payload`. We render those with
// dedicated icons + formatted labels; everything else falls back to the
// raw `notification.message` text.
type WagerNotificationKind =
  | "WAGER_LOCK_SOON"
  | "WAGER_SETTLED"
  | "P2P_RECEIVED"
  | "WITHDRAW_APPROVED";

interface WagerNotification {
  kind: WagerNotificationKind;
  payload?: {
    market?: { title?: string };
    amount?: string | number;
    sender?: string;
    outcome?: "won" | "lost";
  };
}

function isWagerKind(value: unknown): value is WagerNotificationKind {
  return (
    value === "WAGER_LOCK_SOON" ||
    value === "WAGER_SETTLED" ||
    value === "P2P_RECEIVED" ||
    value === "WITHDRAW_APPROVED"
  );
}

function renderWagerNotification(
  notification: any,
): { icon: ReactNode; label: string } | null {
  if (!isWagerKind(notification?.kind)) return null;
  const n = notification as WagerNotification;
  const payload = n.payload ?? {};
  switch (n.kind) {
    case "WAGER_LOCK_SOON":
      return {
        icon: <IconLock className="size-4 text-orange-400 shrink-0" />,
        label: `Wager locks soon: ${payload.market?.title ?? "your market"}`,
      };
    case "WAGER_SETTLED": {
      const direction = payload.outcome === "lost" ? "lost" : "won";
      return {
        icon: <IconCheck className="size-4 text-emerald-400 shrink-0" />,
        label: `Wager settled: ${payload.amount ?? ""} ${direction}`.trim(),
      };
    }
    case "P2P_RECEIVED":
      return {
        icon: (
          <IconArrowsExchange className="size-4 text-primary shrink-0" />
        ),
        label: `${payload.sender ?? "Someone"} sent you ${payload.amount ?? ""}`.trim(),
      };
    case "WITHDRAW_APPROVED":
      return {
        icon: <IconCoin className="size-4 text-emerald-400 shrink-0" />,
        label: `Withdrawal approved: ${payload.amount ?? ""}`.trim(),
      };
  }
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onNotificationUpdate,
}: NotificationDropdownProps) {
  const { token } = useAuth();
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  const handleNotificationClick = async (notification: any) => {
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
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} unread</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            {notifications.length === 0 ? (
              <p className="italic text-sm text-muted-foreground text-center py-10 px-4">
                No notifications yet
              </p>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification, index) => {
                  const wager = renderWagerNotification(notification);
                  return (
                    <div key={index}>
                      <button
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 w-full text-left transition-colors hover:bg-muted/70 cursor-pointer",
                          !notification.is_read && "bg-muted/50",
                        )}
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={
                          wager
                            ? `notification-${notification.kind}`
                            : undefined
                        }
                      >
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                        {notification.is_read && (
                          <div className="h-2 w-2 shrink-0 mt-1.5" />
                        )}
                        {wager ? (
                          <span className="flex-1 flex items-start gap-2">
                            {wager.icon}
                            <span className="text-sm leading-relaxed line-clamp-2">
                              {wager.label}
                            </span>
                          </span>
                        ) : (
                          <span className="flex-1 text-sm leading-relaxed line-clamp-2">
                            {notification.message}
                          </span>
                        )}
                      </button>
                      {index < notifications.length - 1 && <Separator />}
                    </div>
                  );
                })}
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
            <DialogTitle>Notification</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm leading-relaxed">
              {selectedNotification?.message}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
