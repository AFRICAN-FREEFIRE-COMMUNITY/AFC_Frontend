"use client";

import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { adminNavLinks } from "@/constants/nav-links";
import { IconBuildingStore } from "@tabler/icons-react";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

  // Vendors get a "Vendor Dashboard" entry pointing at the /vendor portal. The portal is
  // otherwise only reachable by typing the URL (a vendor is a DB record, not a role, so it
  // can't be gated by allowedRoles). Appended ONLY when the user is an active vendor
  // (user.is_vendor from the get-user-profile payload), so non-vendor admins never see it.
  const navItems = user?.is_vendor
    ? [
        ...adminNavLinks,
        {
          label: "Vendor Dashboard",
          slug: "/vendor",
          icon: IconBuildingStore,
        },
      ]
    : adminNavLinks;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="cursor-pointer flex items-center justify-start gap-2">
          <Logo />{" "}
          <span className="font-medium text-sm text-muted-foreground">
            Admin Panel
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.full_name || "Admin",
            email: user?.email || "",
            avatar: user?.profile_pic || "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
