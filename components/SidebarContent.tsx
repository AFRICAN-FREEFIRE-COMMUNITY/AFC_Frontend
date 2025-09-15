"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Home,
  Users,
  Calendar,
  BarChart2,
  Newspaper,
  Info,
  Mail,
  LogIn,
  LogOut,
  UserCircle,
  ShieldCheck,
  ShoppingCart,
  Award,
  Trophy,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type React from "react";
import { Separator } from "./ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

interface SidebarContentProps {
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  userRole: string;
  isAdmin: boolean;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  isLoggedIn,
  onLogin,
  onLogout,
  userRole,
  isAdmin,
}) => {
  const pathname = usePathname();

  const menuItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/teams", label: "Teams", icon: Users },
    {
      href: "/tournaments-and-scrims",
      label: "Tournaments & Scrims",
      icon: Calendar,
      comingSoon: true,
    },
    {
      href: "/rankings",
      label: "Rankings & Tiers",
      icon: BarChart2,
      comingSoon: true,
    },
    { href: "/news", label: "News & Updates", icon: Newspaper },
    {
      href: "/shop",
      label: "Shop",
      icon: ShoppingCart,
      comingSoon: true,
    },
    { href: "/awards", label: "Awards", icon: Award },
    { href: "/about", label: "About Us", icon: Info },
    { href: "/contact", label: "Contact", icon: Mail },
  ];

  const adminNavItems = [
    { name: "Admin Dashboard", href: "/admin/dashboard", icon: Home },
    { name: "Admin Leaderboards", href: "/admin/leaderboards", icon: Trophy },
    { name: "Admin Players", href: "/admin/players", icon: Users },
    { name: "Admin Teams", href: "/admin/teams", icon: Users },
    { name: "Admin Events", href: "/admin/events", icon: Calendar },
    { name: "Admin News", href: "/admin/news", icon: Newspaper },
    { name: "Admin Rankings", href: "/admin/rankings", icon: BarChart2 },
    { name: "Admin Tiers", href: "/admin/tiers", icon: ShieldCheck },
    { name: "Admin Shop", href: "/admin/shop", icon: ShoppingCart },
    { name: "Admin History", href: "/admin/history", icon: BarChart2 },
    {
      name: "Admin Partner Verification",
      href: "/admin/partner/roster-verification",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mb-8">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Menu
          </h2>
          <nav className="space-y-1">
            {menuItems.map((item) =>
              item.comingSoon ? (
                <div
                  key={item.href}
                  className="flex items-center px-4 py-2 text-sm font-medium rounded-md opacity-60 cursor-not-allowed"
                >
                  <item.icon className="mr-3 h-6 w-6" />
                  <span>{item.label}</span>
                  <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] font-medium px-1.5 py-0.5"
                  >
                    Coming Soon
                  </Badge>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                    pathname === item.href
                      ? "text-primary-foreground bg-primary"
                      : "text-muted-foreground hover:text-[hsl(var(--gold))] hover:bg-primary/10"
                  } transition-colors duration-200`}
                >
                  <item.icon className="mr-3 h-6 w-6" />
                  {item.label}
                </Link>
              )
            )}

            {(userRole === "moderator" ||
              userRole === "super_admin" ||
              userRole === "admin" ||
              isAdmin) && (
              <>
                <Separator className="my-4" />
                <Collapsible className="group">
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                    <span className="flex items-center gap-3">
                      <Settings className="h-4 w-4" />
                      Admin Panel
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1 pl-6">
                    {adminNavItems.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === item.href ? "bg-muted text-primary" : ""
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Sticky bottom section */}
      <div className="px-4 py-4 border-t mb-10">
        {isLoggedIn ? (
          <>
            <Link
              href="/profile"
              className="flex items-center mb-4 text-sm font-medium text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors duration-200"
            >
              <UserCircle className="mr-3 h-6 w-6" />
              Profile
            </Link>
            <Button onClick={onLogout} className="w-full button-gradient">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <Button onClick={onLogin} className="w-full button-gradient">
              <LogIn className="mr-2 h-4 w-4" /> Login
            </Button>
            <Link href="/create-account">
              <Button
                variant="outline"
                className="w-full hover:bg-primary/10 transition-colors duration-200"
              >
                Create Account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
