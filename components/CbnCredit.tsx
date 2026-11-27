"use client";

/**
 * components/CbnCredit.tsx - <CbnCredit/>
 * ---------------------------------------
 * The one-line source credit for Central Bank of Nigeria exchange rates (owner 2026-11-27, AFC inbox
 * #649: "CBN where it can", converted amounts show their source and date). The CBN's terms allow
 * copying its rates only with the CBN named as the source, so wherever a CBN rate or an amount
 * converted with one is shown, this line says so, with the rate's date.
 *
 * Props:
 *   codes: currencies whose rate the surrounding UI uses (e.g. the display currency and "NGN").
 *          Omitted = any loaded CBN rate (the site-wide footer).
 *   className: extra classes (muted text by default; no border or box, per the AFC design rules).
 *
 * Renders nothing until a CBN rate with a date is loaded (so a provider-only viewer sees nothing).
 * Data: CurrencyContext.cbnNoteFor <- GET /auth/fx-rates/ `sources`. Used by: components/CurrencyPicker.tsx
 * and app/_components/Footer.tsx. Date through formatCalendarDateAnywhere (a bare calendar date, R31).
 */

import { useLocale, useTranslations } from "next-intl";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCalendarDateAnywhere } from "@/lib/i18n/time";

export function CbnCredit({ codes, className }: { codes?: string[]; className?: string }) {
  const { cbnNoteFor } = useCurrency();
  const t = useTranslations("common");
  const locale = useLocale();
  const note = cbnNoteFor(...(codes ?? []));
  if (!note) return null;
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      {t.rich("fx.creditLine", {
        date: formatCalendarDateAnywhere(note.date, locale),
        link: (chunks) => (
          <a
            href="https://www.cbn.gov.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary"
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
