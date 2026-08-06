"use client";

// ── TwoFactorPrompt ───────────────────────────────────────────────────────────────────────────
// A quiet, dismissible nudge asking ADMINS and ORGANIZERS to turn on two-step sign-in
// (owner 2026-08-06).
//
// WHY ONLY THEM, AND WHY A NUDGE
//   Two-step sign-in is opt in on purpose: switching it on for ~6,790 mostly-mobile players
//   overnight would lock people out of accounts that worked yesterday. But admin and organizer
//   accounts approve payouts, edit events and read player data, so those are the ones worth
//   attacking, and they are the ones worth asking. Asking is where this stops. It does not block
//   anything, it does not re-ask once dismissed, and there is no "remind me later" nagging.
//
// SHOW-ONCE MECHANICS
//   Dismissal is remembered in localStorage, NOT on the server. That is deliberate: this is a
//   suggestion, not security state, and the alternative would be a new column on the User table.
//   Adding any column to User silently enters the login write path in this codebase and 500s
//   production login until a server migration runs (it has happened - see the 2026-06-28
//   stats_visible incident), which is a completely disproportionate risk for a banner. The cost is
//   that a user who dismisses it on their phone may see it once more on a laptop.
//
// HOW IT CONNECTS
//   - Mounted in app/(user)/layout.tsx beside CompletionReminder, the closest sibling (same
//     "quiet dismissible nudge on every user page" job), so it rides along on the whole user shell.
//   - Reads GET /auth/two-factor/status/ through lib/twoFactor.ts and renders nothing at all once
//     2FA is on. Role detection mirrors AuthContext (isAdmin / isOrganizer).
//   - Links to /profile/security (app/(user)/profile/security/page.tsx).
//   - i18n: the `twoFactor` namespace, prompt.* keys.
// DESIGN: AFC constants - bg-card rounded-md border, text-sm, primary accents, no em dashes,
// stacks full-width on a phone.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconShieldLock, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getTwoFactorStatus } from "@/lib/twoFactor";

const DISMISS_KEY = "afc_2fa_prompt_dismissed";

export function TwoFactorPrompt() {
  const t = useTranslations("twoFactor");
  const { token, user, isAdmin, isOrganizer } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Every branch below resolves `show` EXPLICITLY rather than only ever setting it true. The
    // session can change under this component without a page load (the in-place AuthModal logs a
    // different account in), and a prompt that only knows how to appear would keep telling the new
    // user to switch on something they already have.
    if (!token || !user || (!isAdmin && !isOrganizer)) {
      setShow(false);
      return;
    }
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") {
        setShow(false);
        return;
      }
    } catch {
      // localStorage can throw in sandboxed contexts; a missing dismissal just means we ask.
    }

    let cancelled = false;
    getTwoFactorStatus(token)
      .then((status) => {
        // Already protected: say nothing. Congratulating someone is still an interruption.
        if (!cancelled) setShow(!status.enabled);
      })
      .catch(() => {
        // A failed status read must never produce a scary banner. Stay silent.
        if (!cancelled) setShow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user, isAdmin, isOrganizer]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* dismissing must work even if we cannot remember it */
    }
  }

  return (
    <div className="container mt-4">
      <div className="relative flex flex-col gap-3 rounded-md border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <IconShieldLock className="size-5 text-primary" />
        </div>

        {/* pe-8 keeps the text clear of the absolute close button at 390px. */}
        <div className="min-w-0 flex-1 pe-8 sm:pe-0">
          <h3 className="text-sm font-semibold">{t("prompt.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("prompt.body")}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            size="sm"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            asChild
            onClick={dismiss}
          >
            <Link href="/profile/security">{t("prompt.action")}</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={dismiss}
          >
            {t("prompt.dismiss")}
          </Button>
        </div>

        {/* On a phone the "Not now" button would push the card taller for no reason, so the
            dismiss affordance is the corner X instead. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("prompt.close")}
          className="absolute end-2 top-2 rounded-md p-2 text-muted-foreground hover:bg-muted sm:hidden"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  );
}
