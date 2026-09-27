"use client";

/**
 * components/nav-main.tsx
 * The admin sidebar menu (inbox #52 / #54, owner 2026-09-26; approved mockup
 * mockups/admin-menu/admin-menu-mockup.html): collapsible SECTIONS of PAGES, and under the page you
 * are on, its SUB-PAGES. Everything comes from adminNavSections in constants/nav-links.ts; nothing is
 * listed here.
 *
 * Behaviour
 *   - The section holding the current page is open; the others fold away and open on a click.
 *   - A page with sub-pages shows them only while you are on it (clicking the page opens its first
 *     sub-page you may see). Which sub-page is current: see findCurrentSub.
 *   - Each person sees only pages and sub-pages their roles allow (canAccess); a page left with no
 *     sub-page they may open is hidden, and a section with no pages is hidden.
 *   - Labels: adminNav.section.*, adminNav.<navKey>, adminNav.sub.* (messages/{en,fr,pt}/adminNav.json).
 * Caller: components/app-sidebar.tsx. The phone drawer is the same component (the sidebar is
 * offcanvas on small screens).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconChevronDown } from "@tabler/icons-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NewBadge } from "@/components/NewBadge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { optionalAuthHeaders } from "@/lib/http";
import { adminNavSections } from "@/constants/nav-links";
import type { AdminNavLink, AdminNavSection, AdminNavSub } from "@/constants/nav-links";

/** "Head Admin" -> "head_admin" */
const normalizeRole = (role: string) => role.toLowerCase().replace(/\s+/g, "_");

/** Whether the signed-in admin may see an entry with these roles. Shared with the breadcrumb. */
export function useAdminAccess() {
  const { user, isAdmin } = useAuth();
  return (allowedRoles?: string[]) => {
    if (!user || !isAdmin) return false;
    const userRoles = [
      ...(Array.isArray(user.roles) ? user.roles.map(normalizeRole) : []),
      normalizeRole(user.role || ""),
    ].filter(Boolean);
    if (userRoles.includes("super_admin") || userRoles.includes("head_admin")) return true;
    // Sponsors see only entries tagged for them
    if (userRoles.includes("sponsor")) return !!allowedRoles?.includes("sponsor");
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return userRoles.some((role) => allowedRoles.includes(role));
  };
}

/**
 * The pages and sub-pages one person may open, per section; a page left with no sub-page they may
 * open is dropped, and so is a section with no pages. Read by NavMain and useAdminHome.
 */
export function visibleAdminSections(sections: AdminNavSection[], canAccess: (roles?: string[]) => boolean) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => canAccess(item.allowedRoles))
        .map((item) => ({ ...item, subs: item.subs?.filter((sub) => canAccess(sub.allowedRoles ?? item.allowedRoles)) }))
        .filter((item) => !item.subs || item.subs.length > 0),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Where "the admin dashboard" is for this person (inbox #58): the first page their menu offers.
 * The Dashboard itself for a head admin; for everyone else /a/dashboard (head admin only) used to
 * answer "unauthorized", so anybody given a narrower admin role met a dead end on the way in.
 * Read by app/(user)/_components/ProtectedRoute.tsx when /a/dashboard or /a is refused.
 */
export function useAdminHome(): string | null {
  const canAccess = useAdminAccess();
  const first = visibleAdminSections(adminNavSections, canAccess)[0]?.items[0];
  if (!first) return null;
  return first.subs?.[0]?.href ?? first.slug;
}

// How often the menu counts refresh while the panel is open and the tab is visible
const COUNTS_REFRESH_MS = 60_000;

/**
 * The waiting counts on the menu (inbox #57): GET auth/admin/nav-counts/ answers
 * {"counts": {"tickets": n, "reports": n, "approvals": n}} with only the queues this person may open
 * (afc_auth/views_admin_nav.py). Refreshed every minute while the tab is visible and when it comes
 * back into view. A failed read leaves the last numbers (or none): a badge is a hint, never a gate.
 */
export function useAdminNavCounts(): Record<string, number> {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      const headers = optionalAuthHeaders();
      if (!("Authorization" in headers)) return;
      axios
        .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/nav-counts/`, { headers })
        .then((res) => {
          if (alive) setCounts(res.data?.counts ?? {});
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, COUNTS_REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [user]);
  return counts;
}

/** A page's waiting count: the sum over the sub-pages this person may see that work a queue. */
function pageCount(subs: AdminNavSub[], counts: Record<string, number>) {
  return subs.reduce((sum, sub) => sum + (sub.countKey ? counts[sub.countKey] ?? 0 : 0), 0);
}

const subPath = (sub: AdminNavSub) => sub.href.split("?")[0];
const subTab = (sub: AdminNavSub) => {
  const query = sub.href.split("?")[1];
  return query ? new URLSearchParams(query).get("tab") : null;
};

/**
 * The sub-page a location stands on. Same path and same ?tab= first; a tabbed page opened with no
 * tab (plain /a/teams) is its first tab; a detail page (/a/shop/orders/12) belongs to the sub-page
 * whose path it extends (Orders). Also read by the breadcrumb in components/site-header.tsx.
 */
export function findCurrentSub(subs: AdminNavSub[], itemSlug: string, pathname: string, tab: string | null) {
  const samePath = subs.filter((sub) => subPath(sub) === pathname);
  if (samePath.length) {
    const byTab = samePath.find((sub) => subTab(sub) !== null && subTab(sub) === tab);
    if (byTab) return byTab;
    const plain = samePath.find((sub) => subTab(sub) === null);
    if (plain) return plain;
    return tab === null ? samePath[0] : undefined;
  }
  return subs
    .filter((sub) => subPath(sub) !== itemSlug && pathname.startsWith(`${subPath(sub)}/`))
    .sort((a, b) => subPath(b).length - subPath(a).length)[0];
}

export function pageIsCurrent(item: AdminNavLink, pathname: string) {
  return (
    pathname === item.slug ||
    pathname.startsWith(`${item.slug}/`) ||
    (item.subs ?? []).some((sub) => {
      const path = sub.href.split("?")[0];
      return pathname === path || pathname.startsWith(`${path}/`);
    })
  );
}

export function NavMain({ sections }: { sections: AdminNavSection[] }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const { setOpenMobile } = useSidebar();
  const canAccess = useAdminAccess();
  const counts = useAdminNavCounts();
  const t = useTranslations("adminNav");

  // Pages and sub-pages this person may open, per section
  const visible = visibleAdminSections(sections, canAccess);

  const currentSection = visible.find((s) => s.items.some((item) => pageIsCurrent(item, pathname)))?.sectionKey;
  // Sections the person opened or closed by hand; the current one is open unless they closed it
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => toggled[key] ?? key === currentSection;

  const close = () => setOpenMobile(false);

  return (
    <SidebarGroup data-tour="admin-nav">
      <SidebarGroupContent className="flex flex-col gap-1">
        {visible.map((section) => {
          const open = isOpen(section.sectionKey);
          // A folded section still shows what waits inside it, or the number is out of sight
          const sectionWaiting = open ? 0 : section.items.reduce((sum, item) => sum + pageCount(item.subs ?? [], counts), 0);
          return (
            <div key={section.sectionKey}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setToggled((prev) => ({ ...prev, [section.sectionKey]: !open }))}
                className="flex w-full items-center justify-between rounded-md px-2 pt-2 pb-1.5 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase hover:text-foreground"
              >
                {t(`section.${section.sectionKey}`)}
                {sectionWaiting > 0 && (
                  <span className="ml-auto mr-1.5 rounded-full bg-background px-[7px] py-px text-[11px] font-bold tracking-normal tabular-nums">
                    <span aria-hidden="true">{sectionWaiting > 99 ? "99+" : sectionWaiting}</span>
                    <span className="sr-only">{t("waiting", { count: sectionWaiting })}</span>
                  </span>
                )}
                <IconChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />
              </button>
              {open && (
                <SidebarMenu>
                  {section.items.map((item) => {
                    const current = pageIsCurrent(item, pathname);
                    const subs = item.subs ?? [];
                    const currentSub = current ? findCurrentSub(subs, item.slug, pathname, tab) : undefined;
                    const Icon = item.icon;
                    const label = item.navKey ? t(item.navKey) : item.label;
                    // A page without sub-pages is filled green when current. A page with sub-pages
                    // gets a muted fill as the parent, and the current sub-page a muted fill in bold
                    // (the approved mockup); green only if no sub-page matches the location.
                    const filled = current && (subs.length === 0 || !currentSub);
                    const waiting = pageCount(subs, counts);
                    return (
                      <SidebarMenuItem key={item.slug}>
                        <SidebarMenuButton
                          tooltip={label}
                          asChild
                          className={cn(
                            filled && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                            current && !filled && "bg-muted",
                          )}
                        >
                          <Link href={subs[0]?.href ?? item.slug} onClick={subs.length ? undefined : close}>
                            {Icon && <Icon className="size-4" />}
                            <span className="truncate">{label}</span>
                            {item.newSince && (
                              <NewBadge
                                since={item.newSince}
                                className={cn(
                                  "ml-auto",
                                  filled && "border-primary-foreground/60 bg-primary-foreground/15 text-primary-foreground",
                                )}
                              />
                            )}
                            {waiting > 0 && (
                              // Filled pill, no ring (approved mockup .cnt): page bg on the sidebar,
                              // a dark tint on the green current row
                              <span
                                className={cn(
                                  "rounded-full px-[7px] py-px text-[11px] font-bold tabular-nums",
                                  !item.newSince && "ml-auto",
                                  filled ? "bg-black/25 text-primary-foreground" : "bg-background text-muted-foreground",
                                )}
                              >
                                <span aria-hidden="true">{waiting > 99 ? "99+" : waiting}</span>
                                <span className="sr-only">{t("waiting", { count: waiting })}</span>
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                        {current && subs.length > 0 && (
                          <div className="flex flex-col gap-px py-1 pl-8">
                            {subs.map((sub) => {
                              const on = sub === currentSub;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={close}
                                  aria-current={on ? "page" : undefined}
                                  className={cn(
                                    "rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground",
                                    on && "bg-muted font-semibold text-foreground",
                                  )}
                                >
                                  {t(`sub.${sub.subKey}`)}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </div>
          );
        })}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** "Switch to": the ways out of the admin panel, in the sidebar footer. */
export function NavSwitch({ links }: { links: AdminNavLink[] }) {
  const canAccess = useAdminAccess();
  const { setOpenMobile } = useSidebar();
  const t = useTranslations("adminNav");
  const shown = links.filter((link) => canAccess(link.allowedRoles));
  if (shown.length === 0) return null;
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="px-1.5 pb-1 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{t("switchTo")}</p>
      {shown.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.slug}
            href={link.slug}
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
          >
            {Icon && <Icon className="size-4" />}
            {link.navKey ? t(link.navKey) : link.label}
          </Link>
        );
      })}
    </div>
  );
}
