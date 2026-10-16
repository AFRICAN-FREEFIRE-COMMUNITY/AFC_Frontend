/**
 * components/WorkspaceMessages.tsx - the FULL translation catalog for a workspace route group.
 *
 * WHY (Search Console, 2026-10-16): app/layout.tsx now hands public pages only the namespaces they
 * can reach (lib/i18n/publicNamespaces.generated.json, written by scripts/i18n-namespaces.mjs), so a
 * team page no longer carries the admin tour, the organizer help center and 41 other workspace
 * namespaces in its HTML (about 445 KB of English on every page). The four workspace groups need
 * those namespaces, so each group's top layout wraps its pages in this server component, which
 * mounts a second I18nProvider with everything.
 *
 * A nested provider REPLACES the outer messages rather than merging (use-intl IntlProvider:
 * `messages === undefined ? prevContext.messages : messages`), which is why this passes the whole
 * catalog and not just the missing part. Staff pages therefore carry the public part twice; they
 * are a few dozen users on desktop, and the public pages are where the weight mattered.
 *
 * Used by: app/(a)/layout.tsx, app/(organizer)/layout.tsx, app/(sponsor)/layout.tsx,
 * app/(vendor)/layout.tsx (the WORKSPACE_GROUPS of scripts/i18n-namespaces.mjs).
 */
import { getLocale, getMessages } from "next-intl/server";

import { I18nProvider } from "@/components/I18nProvider";

export async function WorkspaceMessages({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>
  );
}
