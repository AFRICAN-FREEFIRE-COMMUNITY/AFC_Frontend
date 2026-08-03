"use client";

/**
 * FeedbackLauncher.tsx - the always-on entry point to the site feedback form (backlog item 29).
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Renders as a link in the Footer's Support column (app/_components/Footer.tsx) and owns the open
 * state of <FeedbackDialog/>.
 *
 * WHY A FOOTER LINK AND NOT A FLOATING BUTTON
 *   1. COVERAGE. The Footer already renders on every user page via app/(user)/layout.tsx AND is
 *      rendered directly by the marketing landing page, rules, privacy, terms, invite, the auth
 *      pages and onboarding. One insertion therefore reaches every public surface. A floating button
 *      mounted in app/(user)/layout.tsx would MISS all of those, and mounting it in the root layout
 *      would put it on the admin dashboard and on the OBS /overlay routes, which then need
 *      pathname-based opt-outs.
 *   2. MOBILE. The brief requires the entry point not to obscure content on a phone. A fixed button
 *      permanently covers a corner of a 390px viewport, and the site's sonner <Toaster/> is already
 *      anchored bottom-center at a z-index of ~1e9, so a bottom-anchored button would sit underneath
 *      every toast the site raises.
 *   3. IDIOM. The user-facing site currently has NO persistent floating UI at all. A footer link is
 *      what this design language already does with Contact, Rules and Terms, so it reads as part of
 *      the site rather than as a bolted-on widget.
 *
 * The tradeoff is honest: a footer link is less prominent than a floating button, so it is reached
 * by scrolling. If the owner wants higher visibility later, this component is the only thing that
 * has to change; FeedbackDialog is already independent of how it gets opened.
 *
 * The dialog is only MOUNTED once opened, so no page pays for the form's fetch until someone asks
 * for it.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FeedbackDialog } from "./FeedbackDialog";

/** The form seeded by `python manage.py seed_feedback_forms`. Other surfaces can pass another key. */
const DEFAULT_FORM_KEY = "site_feedback";

export function FeedbackLauncher({ formKey = DEFAULT_FORM_KEY }: { formKey?: string }) {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("launcher.ariaLabel")}
        // Matches the sibling footer <Link>s exactly (same size, colour and hover transition) so the
        // Support column reads as one list. text-left because a <button> centres its text by default.
        className="text-left transition-colors hover:text-primary"
      >
        {t("launcher.label")}
      </button>

      {open && (
        <FeedbackDialog formKey={formKey} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
