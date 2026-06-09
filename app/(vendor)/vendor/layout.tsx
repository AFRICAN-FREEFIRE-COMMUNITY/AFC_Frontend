// ─────────────────────────────────────────────────────────────────────────────
// Vendor portal layout.
//
// Mirrors app/(organizer)/organizer/layout.tsx: a guard wrapping a header + sidebar
// + content shell, with the loaded data handed to child pages via a small context.
// Two things differ from the organizer portal, both because "vendor" is NOT a role
// on the User model:
//
//   1. THE GATE IS DATA-DRIVEN, NOT ROLE-DRIVEN. The organizer portal gates on
//      useAuth().isOrganizer. There is no equivalent vendor flag, so this layout
//      gates by CALLING the backend: GET /shop/fulfilment/my-orders/ (vendorApi.
//      getMyOrders). A 200 means the caller has a Vendor account → render the portal.
//      A 403 ({ "You are not a vendor." }) means they don't → render a friendly
//      "You do not have vendor access" card (vendors are invited by AFC). Any other
//      error is treated as a generic load failure with a retry. This is exactly the
//      gate the build brief specifies.
//
//   2. THE LAYOUT OWNS THE DATA. Because that gate call already fetches the whole
//      fulfilment queue, the layout hands the orders (+ a refetch) down through
//      <VendorProvider> (./_components/VendorContext) so neither the queue page nor
//      the per-order page re-fetches. (There is no per-order GET endpoint anyway —
//      see VendorContext's header note — so the per-order page reads its order out
//      of this shared list by id.)
//
// The shell itself (SidebarProvider / Sidebar / SidebarTrigger / SidebarInset +
// header) is the SAME shadcn stack the organizer portal copies from the admin
// dashboard, kept visually identical so the two portals read as one designer's work.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, ReactNode } from "react";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  IconArrowLeft,
  IconHome,
  IconLayoutDashboard,
  IconLogout,
  IconPackage,
  IconShoppingBag,
} from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { vendorApi, VendorOrder } from "@/lib/vendor";
import { VendorProvider } from "./_components/VendorContext";

// The portal sub-routes the left nav links to. "Orders" is the fulfilment queue;
// "Products" is the vendor's self-serve catalogue (Phase B2). The active-link rule
// below uses longest-prefix-wins, so each section highlights correctly even though
// /vendor/orders and /vendor/products share the /vendor prefix.
const NAV_ITEMS = [
  { label: "Orders", href: "/vendor/orders", icon: IconPackage },
  { label: "Products", href: "/vendor/products", icon: IconShoppingBag },
];

// ── Sidebar ──────────────────────────────────────────────────────────────────
// The vendor sub-nav as a shadcn collapsible Sidebar, mirroring the organizer
// portal's OrganizerSidebar (which itself mirrors the admin AppSidebar). Same
// active-link idiom (the current route gets the primary fill) and the same
// "leave the portal" group at the bottom.

function VendorSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // isAdmin drives the optional "Admin Dashboard" exit link (a platform admin who is
  // also a vendor can jump back to the admin area); everyone else just gets the
  // "User Dashboard" link back to the main site.
  const { isAdmin } = useAuth();

  const exitItems = [
    { label: "User Dashboard", href: "/home", icon: IconHome },
    ...(isAdmin
      ? [
          {
            label: "Admin Dashboard",
            href: "/a/dashboard",
            icon: IconLayoutDashboard,
          },
        ]
      : []),
  ];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-start gap-2">
          <Logo size="small" />
          <span className="font-medium text-sm text-muted-foreground">
            Vendor Portal
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                // Active = current path is, or sits under, this nav href. With a
                // single section this is trivial, but we keep the longest-prefix-wins
                // rule from the organizer sidebar so adding Products later "just works".
                const matches = (href: string) =>
                  pathname === href || pathname.startsWith(`${href}/`);
                const bestMatch = NAV_ITEMS.filter((i) => matches(i.href)).sort(
                  (a, b) => b.href.length - a.href.length,
                )[0];
                const isActive = bestMatch?.href === item.href;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      asChild
                      className={
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : undefined
                      }
                    >
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Leave the portal ── navigation OUT of the vendor area. */}
        <SidebarGroup className="mt-auto">
          <Separator className="mb-2" />
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {exitItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton tooltip={item.label} asChild>
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// ── Shell (header + sidebar + gated content) ──────────────────────────────────
// Owns the data-driven vendor gate AND the shared order list. Mirrors the organizer
// OrganizerShell, but instead of fetching organizations it fetches the fulfilment
// queue and uses the RESULT (200 vs 403) as the gate.

function VendorShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  // gateState drives what the content area shows:
  //   "loading"   → still calling my-orders.
  //   "vendor"    → 200; the caller is a vendor, render the portal pages.
  //   "no-access" → 403; the caller has no Vendor account, show the invite card.
  //   "error"     → any other failure (network/5xx), show a retry card.
  const [gateState, setGateState] = useState<
    "loading" | "vendor" | "no-access" | "error"
  >("loading");
  const [orders, setOrders] = useState<VendorOrder[]>([]);

  // ── The gate fetch ──
  // load() is also the refetch handed to pages via context: after any lifecycle
  // action a page calls refetch() to pull the freshly-transitioned state. We only
  // flip gateState to "vendor" here (a 403 after a successful first load shouldn't
  // happen, but if it did we'd surface it as no-access on the next load).
  const load = useCallback(async () => {
    try {
      const res = await vendorApi.getMyOrders();
      setOrders(res.results ?? []);
      setGateState("vendor");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        // Backend says "You are not a vendor." — this is the no-access branch.
        setGateState("no-access");
      } else {
        setGateState("error");
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SidebarProvider>
      {/* Left nav as a collapsible sidebar (mirrors the organizer portal). */}
      <VendorSidebar />

      <SidebarInset>
        {/* Header — same shell as the organizer portal, fronted by the
            SidebarTrigger hamburger that toggles VendorSidebar. */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
          <div className="container mx-auto h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => router.back()}
              >
                <IconArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <Link href={"/home"} className="flex items-center space-x-2">
                <Logo size="small" />
                <span className="text-base md:text-xl font-bold bg-gradient-to-r from-primary to-[var(--gold)] bg-clip-text text-transparent line-clamp-1 hover:text-primary">
                  African Freefire Community
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {user.in_game_name}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5"
                onClick={logout}
              >
                <IconLogout className="size-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 container py-8">
          {gateState === "loading" ? (
            <FullLoader text="Loading your vendor portal..." />
          ) : gateState === "no-access" ? (
            // ── 403: the caller is not a vendor. Vendors are invited by AFC, so
            // there is nothing for them to do here but head back. ──
            <div className="flex items-center justify-center py-16">
              <Card className="max-w-md w-full">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <IconShoppingBag className="size-6" />
                  </div>
                  <h2 className="text-lg font-semibold">
                    You do not have vendor access
                  </h2>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    The vendor portal is for AFC marketplace vendors. Vendor
                    accounts are set up by the AFC team. If you believe you should
                    have access, please reach out to AFC.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/home")}
                  >
                    Back to home
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : gateState === "error" ? (
            // ── A non-403 failure (network / server). Offer a retry. ──
            <div className="flex items-center justify-center py-16">
              <Card className="max-w-md w-full">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    We could not load your vendor portal. Please try again.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGateState("loading");
                      load();
                    }}
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            // ── 200: a confirmed vendor. Hand the queue + refetch to the pages. ──
            <VendorProvider value={{ orders, refetch: load }}>
              {children}
            </VendorProvider>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function VendorPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <VendorShell>{children}</VendorShell>;
}
