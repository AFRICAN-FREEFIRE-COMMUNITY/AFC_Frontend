"use client";

/**
 * components/I18nProvider.tsx - client wrapper around NextIntlClientProvider.
 *
 * Purpose: makes the request's locale and message catalog available to every
 * Client Component via the useTranslations() / useLocale() hooks. next-intl's
 * provider is itself a Client Component, so we wrap it here (the same idiom this
 * repo uses for ThemeProvider) and mount it once in app/layout.tsx.
 *
 * How it connects to the rest of the system:
 *  - app/layout.tsx (Server Component) reads `locale` from getLocale() and
 *    `messages` from getMessages() (both fed by i18n/request.ts) and passes
 *    them in as props.
 *  - Any Client Component below this provider calls useTranslations('<ns>')
 *    where <ns> is a namespace file under messages/en/<ns>.json. Example:
 *      const t = useTranslations('common');
 *      <Button>{t('actions.save')}</Button>   // -> "Save" / "Enregistrer" / ...
 *  - lib/i18n/toast.ts pairs with this to localize sonner toasts.
 */

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

type Props = {
  // Active locale resolved from the NEXT_LOCALE cookie (see i18n/request.ts).
  locale: string;
  // Deep-merged message catalog (English base + locale overlay).
  messages: AbstractIntlMessages;
  children: React.ReactNode;
};

export function I18nProvider({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
