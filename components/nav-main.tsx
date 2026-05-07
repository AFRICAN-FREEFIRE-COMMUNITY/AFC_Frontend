"use client";

import { type Icon } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
import { env } from "@/lib/env";
import { CURRENT_USER_KEY } from "@/lib/mock-wager/handlers/auth";

const MOCK_ADMIN_USER_IDS = new Set([
  "head_admin_jay",
  "wager_admin_jane",
  "wallet_admin_kofi",
]);

const MOCK_ADMIN_ROLES_BY_USER: Record<string, string[]> = {
  head_admin_jay: ["head_admin"],
  wager_admin_jane: ["wager_admin"],
  wallet_admin_kofi: ["wallet_admin"],
};

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

  // Mock-mode: when DevPanel sets a seeded admin user_id in localStorage,
  // expose their mocked roles so admin nav renders without a real Django session.
  const [mockRoles, setMockRoles] = useState<string[] | null>(null);
  useEffect(() => {
    if (!env.NEXT_PUBLIC_WAGER_MOCK) return;
    if (typeof window === "undefined") return;
    const read = () => {
      try {
        const id = window.localStorage?.getItem?.(CURRENT_USER_KEY);
        if (id && MOCK_ADMIN_USER_IDS.has(id)) {
          setMockRoles(MOCK_ADMIN_ROLES_BY_USER[id] ?? []);
        } else {
          setMockRoles(null);
        }
      } catch {
        setMockRoles(null);
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [pathname]);

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  /**
   * Normalizes roles for comparison (e.g., "Head Admin" -> "head_admin")
   */
  const normalizeRole = (role: string) =>
    role.toLowerCase().replace(/\s+/g, "_");

  const canAccess = (linkAllowedRoles?: string[]) => {
    // Mock-mode shortcut: seeded admin in localStorage sees their mocked roles.
    if (mockRoles) {
      if (mockRoles.includes("head_admin")) return true;
      if (!linkAllowedRoles || linkAllowedRoles.length === 0) return true;
      return mockRoles.some((r) => linkAllowedRoles.includes(r));
    }

    // 1. If user isn't logged in or isn't an admin at all, block.
    if (!user || !isAdmin) return false;

    // 2. Build the full set of roles (always include user.role + user.roles)
    const userRoles = [
      ...( Array.isArray(user.roles) ? user.roles.map(normalizeRole) : [] ),
      normalizeRole(user.role || ""),
    ].filter(Boolean);

    if (userRoles.includes("super_admin") || userRoles.includes("head_admin")) {
      return true;
    }

    // 3. Sponsors can ONLY see links explicitly tagged for them
    if (userRoles.includes("sponsor")) {
      return !!linkAllowedRoles?.includes("sponsor");
    }

    // 4. If no specific roles are required for the link, let them through
    if (!linkAllowedRoles || linkAllowedRoles.length === 0) return true;

    // 5. Check if any of the user's roles match the allowed roles
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
