"use client";

/**
 * app/error.tsx - the error boundary for every route under the root layout (owner rule R79).
 *
 * WHY: a component that throws while rendering used to land on Next's default error page, which
 * names the framework and, in development, prints the stack. This boundary shows one generic
 * sentence in the person's language and two ways out (try again, go home); the details go to the
 * console, where the deploy's log collection can read them, never to the screen (R44, R79).
 *
 * Next calls it with the thrown error and `reset`, which re-renders the segment that failed.
 * The root layout still wraps this, so next-intl's provider is available; app/global-error.tsx
 * covers the one case it is not (the root layout itself throwing).
 */
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");

  useEffect(() => {
    // The one place the detail goes. `digest` is Next's id for a server-side error, which is what
    // the server log carries, so the two can be matched.
    console.error("route error", error?.digest ?? "", error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl md:text-4xl font-bold text-primary">{t("states.error")}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t("states.errorDetail")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("states.retry")}</Button>
        <Button asChild variant="secondary">
          <Link href="/">{t("states.goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
