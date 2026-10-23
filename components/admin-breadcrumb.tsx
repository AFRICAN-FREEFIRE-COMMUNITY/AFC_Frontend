"use client";

/**
 * components/admin-breadcrumb.tsx
 * "Section > Page > Sub-page" at the top of every admin page (inbox #54; approved mockup
 * mockups/admin-menu/admin-menu-mockup.html). Read from the same adminNavSections the sidebar draws
 * (constants/nav-links.ts), with the same current-sub-page rule (components/nav-main.tsx
 * findCurrentSub), so the two always agree. Renders nothing on a page the menu does not know.
 * Caller: components/site-header.tsx.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { findCurrentSub, pageIsCurrent } from "@/components/nav-main";
import { adminNavSections } from "@/constants/nav-links";

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const t = useTranslations("adminNav");

  for (const section of adminNavSections) {
    const item = section.items.find((it) => pageIsCurrent(it, pathname));
    if (!item) continue;
    const sub = item.subs ? findCurrentSub(item.subs, item.slug, pathname, tab) : undefined;
    const page = item.navKey ? t(item.navKey) : item.label;
    return (
      <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
        <span className="hidden sm:inline">{t(`section.${section.sectionKey}`)}</span>
        <span className="hidden sm:inline" aria-hidden="true">›</span>
        {sub ? (
          <>
            <Link href={item.subs?.[0]?.href ?? item.slug} className="truncate hover:text-foreground">
              {page}
            </Link>
            <span aria-hidden="true">›</span>
            <span className="truncate font-semibold text-foreground" aria-current="page">
              {t(`sub.${sub.subKey}`)}
            </span>
          </>
        ) : (
          <span className="truncate font-semibold text-foreground" aria-current="page">
            {page}
          </span>
        )}
      </nav>
    );
  }
  return null;
}
