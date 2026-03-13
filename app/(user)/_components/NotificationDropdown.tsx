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
import { IconBell, IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { env } from "@/lib/env";
import { Loader } from "@/components/Loader";

interface NotificationDropdownProps {
  notifications: any[];
  unreadCount: number;
  onNotificationUpdate: () => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onNotificationUpdate,
}: NotificationDropdownProps) {
  const { token } = useAuth();
  const [markingAsRead, setMarkingAsRead] = useState<number | null>(null);

  const handleMarkAsRead = async (
    notificationId: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!token) return;
    setMarkingAsRead(notificationId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/view-notification/`,
        { notification_id: notificationId.toString() },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      onNotificationUpdate();
    } catch (error) {
    } finally {
      setMarkingAsRead(null);
    }
  };

  return (
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
              {notifications.map((notification, index) => (
                <div key={index}>
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      !notification.is_read && "bg-muted/50",
                    )}
                  >
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                    {/* select-text so the user can long-press and copy on mobile */}
                    <span className="flex-1 text-sm select-text leading-relaxed">
                      {notification.message}
                    </span>
                    {!notification.is_read && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        disabled={markingAsRead === notification.id}
                      >
                        {markingAsRead === notification.id ? (
                          <Loader text="" />
                        ) : (
                          <IconCheck className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
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
