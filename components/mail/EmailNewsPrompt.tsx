"use client";

// components/mail/EmailNewsPrompt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The one-time question on the home page (mockup "Player: the one-time question", approved
// 2026-10-16): "Want AFC news by email?" It shows to a signed-in player who has never answered and
// goes away for good once they answer either way (GET mail/preferences/ answered). Nothing is ticked
// in advance: a yes is a press of "Yes, email me".
// CALLS: GET/POST mail/preferences/ (lib/mailApi.ts). i18n: emailPrefs. CALLER: app/(user)/home/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { mailPreferences } from "@/lib/mailApi";

export function EmailNewsPrompt() {
  const t = useTranslations("emailPrefs");
  const [state, setState] = useState<"hidden" | "asking" | "thanks">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mailPreferences
      .get()
      .then((p) => setState(p.answered ? "hidden" : "asking"))
      .catch(() => setState("hidden"));
  }, []);

  const answer = async (value: boolean) => {
    setBusy(true);
    try {
      await mailPreferences.set(value, "prompt");
      setState("thanks");
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (state === "hidden") return null;
  return (
    <section className="mb-4 rounded-md bg-card p-4 shadow-sm md:p-5" aria-live="polite">
      {state === "asking" ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t("promptTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("promptBody")}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button disabled={busy} onClick={() => void answer(true)}>
              {t("promptYes")}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>
              {t("promptNo")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("promptThanks")}</p>
      )}
    </section>
  );
}
