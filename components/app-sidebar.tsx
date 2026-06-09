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
  // can't be gated by allowedRoles). Shown ONLY when the user is an active vendor
  // (user.is_vendor from the get-user-profile payload), so non-vendor admins never see it.
  // Placed directly UNDER the "Organizer Dashboard" entry (owner request 2026-06-09), or at
  // the end if that entry is absent.
  const navItems = (() => {
    if (!user?.is_vendor) return adminNavLinks;
    const vendorEntry = {
      label: "Vendor Dashboard",
      slug: "/vendor",
      icon: IconBuildingStore,
    };
    const items = [...adminNavLinks];
    const orgIdx = items.findIndex((i) => i.slug === "/organizer/overview");
    if (orgIdx >= 0) items.splice(orgIdx + 1, 0, vendorEntry);
    else items.push(vendorEntry);
    return items;
  })();

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
