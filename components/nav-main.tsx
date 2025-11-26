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

export function NavMain({
  items,
}: {
  items: {
    label: string;
    slug: string;
    icon?: Icon | LucideIcon;
    comingSoon?: boolean;
  }[];
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.slug;
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
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
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
