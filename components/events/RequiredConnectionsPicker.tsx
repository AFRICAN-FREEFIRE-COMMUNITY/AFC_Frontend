"use client";

// RequiredConnectionsPicker (owner 2026-08-26)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// The "Required connected accounts" control on the event forms. Every player registering for the
// event must have each selected outside account linked to their AFC profile.
//
// USED BY ALL FOUR event-form surfaces, which is why it is a shared component rather than four
// copies: admin create (Step1EventDetails), admin edit (BasicInfoTab), organizer create, and
// organizer edit. Those four already carry require_player_uid / require_whatsapp and have drifted
// from each other before.
//
// DATA: lib/connections.ts listProviders() -> GET /auth/connections/providers/, which returns the
// providers actually CONFIGURED on this deployment. That is deliberate: an organizer must not be
// able to require something no player can connect. v-ent.co appears here the same day it appears
// on the player's profile page, and not before.
//
// DISCORD IS ABSENT ON PURPOSE. require_discord is its own switch on these same forms, and it
// means MORE than this one does: connected AND a member of the event's Discord server, with a
// paired invite link. Offering it in both places is how an organizer sets one and gets the other's
// behaviour. The backend refuses the slug too (_clean_required_connections), so the two agree.
//
// STYLE: filled chips. No rings, no outlines (house rule bans building structure from hairlines).
// Selected is a stronger FILL plus a text-colour change, never a border.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { NewBadge } from "@/components/NewBadge";
import { useAuth } from "@/contexts/AuthContext";
import { type ConnectionProvider, listProviders } from "@/lib/connections";

/** The day this control went live. NewBadge removes itself 5 days later. */
const SHIPPED_ON = "2026-08-26";

type Props = {
  /** Provider slugs currently required. Owned by the parent form's state. */
  value: string[];
  onChange: (next: string[]) => void;
};

export function RequiredConnectionsPicker({ value, onChange }: Props) {
  const t = useTranslations("evStep1.requiredConnections");
  const { token } = useAuth();
  const [providers, setProviders] = useState<ConnectionProvider[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listProviders(token)
      .then((rows) => {
        // Discord is filtered here as well as on the backend: belt and braces, because a stale
        // deployment of one side should not start offering a switch the other side refuses.
        if (!cancelled) setProviders(rows.filter((p) => p.slug !== "discord"));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selected = Array.isArray(value) ? value : [];

  const toggle = (slug: string) => {
    onChange(
      selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : [...selected, slug],
    );
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        {t("label")}
        <NewBadge since={SHIPPED_ON} />
      </p>
      <p className="text-xs text-muted-foreground">{t("help")}</p>

      {failed ? (
        <p className="text-xs text-muted-foreground">{t("loadError")}</p>
      ) : providers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => {
            const on = selected.includes(provider.slug);
            const key = `provider.${provider.slug}`;
            const translated = t(key as never);
            const label = translated === key ? provider.label : translated;
            return (
              <button
                key={provider.slug}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(provider.slug)}
                className={
                  on
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
