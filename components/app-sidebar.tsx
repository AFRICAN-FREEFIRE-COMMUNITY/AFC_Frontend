"use client";

import * as React from "react";

import { NavMain, NavSwitch } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { adminNavSections, adminSwitchLinks } from "@/constants/nav-links";
import { IconBuildingStore } from "@tabler/icons-react";
// i18n: the "Admin Panel" header text is resolved from the adminNav namespace
// (messages/{en,fr,pt}/adminNav.json). The nav-item labels themselves are
// translated inside NavMain via each item's navKey.
import { useTranslations } from "next-intl";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const t = useTranslations("adminNav");

  // "Switch to" links (sidebar footer, owner 2026-09-26). Vendors also get their /vendor portal
  // here: a vendor is a DB record, not a role, so it cannot be gated by allowedRoles, and it shows
  // only when user.is_vendor (get-user-profile) is true.
  const switchLinks = user?.is_vendor
    ? [
        ...adminSwitchLinks,
        { label: "Vendor Dashboard", navKey: "vendorDashboard", slug: "/vendor", icon: IconBuildingStore },
      ]
    : adminSwitchLinks;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="cursor-pointer flex items-center justify-start gap-2">
          <Logo />{" "}
          <span className="font-medium text-sm text-muted-foreground">
            {t("panelTitle")}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={adminNavSections} />
      </SidebarContent>
      <SidebarFooter>
        <NavSwitch links={switchLinks} />
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
