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
import { formatWord } from "@/lib/utils";
import { IconBell, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NotificationDropdown({ notifications }: any) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-auto p-0 hover:bg-transparent gap-4"
        >
          <IconBell />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-xs">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          <Button
            disabled={notifications.length === 0}
            variant={"ghost"}
            size={"sm"}
          >
            Clear all
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="overflow-auto max-h-96">
          {notifications.length === 0 && (
            <DropdownMenuItem className="italic py-4 text-center" disabled>
              No notifications yet
            </DropdownMenuItem>
          )}
          {notifications.map((notification, index) => (
            <DropdownMenuItem key={index}>
              {notification.message}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
