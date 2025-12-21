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
import { cn, formatWord } from "@/lib/utils";
import { IconBell, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationDropdownProps {
  notifications: any[];
  unreadCount: number;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
}: NotificationDropdownProps) {
  const router = useRouter();

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
      <DropdownMenuContent align="end" className="min-w-xs max-w-sm">
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
                    <span className="flex-1">{notification.message}</span>
                  </div>
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
