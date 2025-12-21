"use client";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatWord } from "@/lib/utils";
import { IconBell, IconCheck, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { token } = useAuth();

  const [markingAsRead, setMarkingAsRead] = useState<number | null>(null);

  const handleMarkAsRead = async (
    notificationId: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent dropdown item click

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
        }
      );

      // Refresh notifications
      onNotificationUpdate();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    } finally {
      setMarkingAsRead(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-auto p-0 hover:bg-transparent gap-4"
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-xs max-w-sm">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {/* <Button
            disabled={notifications.length === 0}
            variant={"ghost"}
            size={"sm"}
          >
            Clear all
          </Button> */}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="overflow-auto max-h-96">
          {notifications.length === 0 && (
            <DropdownMenuItem className="italic py-4 text-center" disabled>
              No notifications yet
            </DropdownMenuItem>
          )}
          {notifications.map((notification, index) => {
            const isLast = index === notifications.length - 1;

            return (
              <DropdownMenuGroup
                key={index}
                onSelect={(e) => e.preventDefault()}
                className={cn(
                  "overflow-x-hidden",
                  !notification.is_read ? "bg-muted/50" : ""
                )}
              >
                <DropdownMenuItem>
                  <div className="flex items-start gap-2 w-full">
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                    <span className="flex-2">{notification.message}</span>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => handleMarkAsRead(notification.id, e)}
                      disabled={markingAsRead === notification.id}
                    >
                      {markingAsRead === notification.id ? (
                        <Loader text="" />
                      ) : (
                        <IconCheck />
                      )}
                    </Button>
                  )}
                </DropdownMenuItem>

                {!isLast && <DropdownMenuSeparator />}
              </DropdownMenuGroup>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
