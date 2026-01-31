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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

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
        <NavMain items={adminNavLinks} />
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
