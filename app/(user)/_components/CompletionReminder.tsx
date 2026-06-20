"use client";

// ── CompletionReminder ─────────────────────────────────────────────────────────
// A gentle, NON-BLOCKING nudge (owner 2026-06-20) shown on every user page (mounted in
// app/(user)/layout.tsx). It reminds:
//   - a PLAYER with no esports image to upload one, and
//   - a team OWNER whose team has no logo to add one (only the owner, since only they can fix it).
// It never blocks anything and never toasts repeatedly. Dismissing it hides it for the rest of the
// SESSION (sessionStorage) so it does not irritate; it returns next session until the asset is uploaded,
// which is the "constant but quiet" reminder the owner asked for. Dismissal is keyed to WHICH items are
// outstanding, so if a new item appears (e.g. you later become a team owner) the bar shows again.
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "afc:completionReminderDismissed:v1";

export function CompletionReminder() {
  const { user, loading } = useAuth();
  const t = useTranslations("reminders");
  // Start hidden so there is no flash before we know the user + the per-session dismiss state.
  const [dismissed, setDismissed] = useState(true);

  // Outstanding items for THIS user.
  const items: { key: string; label: string; href: string }[] = [];
  if (user) {
    if (!user.esport_image_url) {
      items.push({ key: "esports", label: t("esports"), href: "/profile/edit" });
    }
    if (user.team_without_logo) {
      items.push({
        key: "logo",
        label: t("logo"),
        href: `/teams/${encodeURIComponent(user.team_without_logo)}`,
      });
    }
  }
  // Signature of the current outstanding items; dismissal is keyed to it so a NEW missing item re-shows
  // the bar even if a previous set was dismissed this session.
  const signature = items.map((i) => i.key).join(",");

  useEffect(() => {
    if (!signature) {
      setDismissed(true);
      return;
    }
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === signature);
    } catch {
      setDismissed(false);
    }
  }, [signature]);

  if (loading || !user || items.length === 0 || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      /* sessionStorage can be unavailable in rare sandboxes; just hide for now. */
    }
    setDismissed(true);
  };

  return (
    <div className="container mt-4">
      <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
        <p className="flex-1 leading-relaxed">
          <span className="text-muted-foreground">{t("intro")} </span>
          {items.map((it, idx) => (
            <span key={it.key}>
              <Link
                href={it.href}
                className="font-medium text-primary hover:underline"
              >
                {it.label}
              </Link>
              {idx < items.length - 1 ? (
                <span className="text-muted-foreground"> {t("and")} </span>
              ) : null}
            </span>
          ))}
          <span className="text-muted-foreground">.</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
