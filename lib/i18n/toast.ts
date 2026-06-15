"use client";

/**
 * lib/i18n/toast.ts — localize sonner toasts via next-intl.
 *
 * Purpose: convenience layer so a Client Component can fire a translated toast
 * with one call instead of hand-wiring useTranslations() + sonner every time.
 * This repo already standardizes on `sonner` (mounted in app/layout.tsx as
 * <Toaster position="bottom-center" />), so this helper just localizes the
 * message text before handing it to sonner.
 *
 * How it connects to the rest of the system:
 *  - Depends on useTranslations() from next-intl, which is available because
 *    I18nProvider (NextIntlClientProvider) wraps the app in app/layout.tsx.
 *  - Wraps the `toast` API from sonner (the project's toast library).
 *  - Translation keys live under a namespace file, e.g. messages/en/toast.json
 *    or messages/en/common.json — the caller passes a fully-qualified key like
 *    'common:actions.save' or a key relative to a chosen namespace.
 *
 * Usage (inside a Client Component):
 *   const tt = useLocalizedToast('common');
 *   tt.success('states.error');           // localized success toast
 *   tt.error('states.error', { name });   // with {name} interpolation values
 *
 * NOTE: this is an OPTIONAL convenience. Components may still call
 * `toast.success(t('...'))` directly with useTranslations() if they prefer.
 */

import { toast, type ExternalToast } from "sonner";
import { useTranslations } from "next-intl";

// Interpolation values for {placeholders} inside a message string. Mirrors the
// shape next-intl's `t(key, values)` accepts.
type Values = Record<string, string | number | Date>;

/**
 * Returns a small toast API bound to a translation namespace. Each method
 * translates `key` (with optional `{placeholder}` values) and forwards the
 * resulting string to the matching sonner toast variant.
 *
 * @param namespace messages/en/<namespace>.json — the namespace to resolve keys
 *                  against (defaults to 'common').
 */
export function useLocalizedToast(namespace: string = "common") {
  const t = useTranslations(namespace);

  // Translate then show. `opts` is passed straight through to sonner so callers
  // keep full control of duration, action buttons, description, etc.
  const show =
    (variant: "success" | "error" | "info" | "warning" | "message") =>
    (key: string, values?: Values, opts?: ExternalToast) => {
      const message = t(key, values);
      if (variant === "message") return toast(message, opts);
      return toast[variant](message, opts);
    };

  return {
    success: show("success"),
    error: show("error"),
    info: show("info"),
    warning: show("warning"),
    message: show("message"),
  };
}
