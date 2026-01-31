"use client";

import { type Icon } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function NavMain({
  items,
}: {
  items: {
    label: string;
    slug: string;
    icon?: Icon | LucideIcon;
    comingSoon?: boolean;
    allowedRoles?: string[];
  }[];
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { user, isAdmin } = useAuth();

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  /**
   * Normalizes roles for comparison (e.g., "Head Admin" -> "head_admin")
   */
  const normalizeRole = (role: string) =>
    role.toLowerCase().replace(/\s+/g, "_");

  const canAccess = (linkAllowedRoles?: string[]) => {
    // 1. If user isn't logged in or isn't an admin at all, block.
    if (!user || !isAdmin) return false;

    // 2. Super admins/Head Admins usually get global access
    const userRoles = Array.isArray(user.roles)
      ? user.roles.map(normalizeRole)
      : [normalizeRole(user.role || "")];

    if (userRoles.includes("super_admin") || userRoles.includes("head_admin")) {
      return true;
    }

    // 3. If no specific roles are required for the link, let them through
    if (!linkAllowedRoles || linkAllowedRoles.length === 0) return true;

    // 4. Check if any of the user's roles match the allowed roles
    return userRoles.some((role) => linkAllowedRoles.includes(role));
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items
            .filter((item) => canAccess(item.allowedRoles))
            .map((item) => {
              const isActive =
                pathname === item.slug || pathname.startsWith(`${item.slug}/`);
              const IconComponent = item.icon;

              return (
                <SidebarMenuItem key={item.slug}>
                  {item.comingSoon ? (
                    <SidebarMenuButton
                      tooltip={item.label}
                      className="opacity-50 cursor-not-allowed"
                      disabled
                    >
                      {IconComponent && <IconComponent className="size-4" />}
                      <span>{item.label.replace("Admin ", "")}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        Soon
                      </Badge>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      tooltip={item.label}
                      asChild
                      className={cn(
                        isActive &&
                          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                      )}
                    >
                      <Link href={item.slug} onClick={handleLinkClick}>
                        {IconComponent && <IconComponent className="size-4" />}
                        <span>{item?.label.replace("Admin ", "")}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
