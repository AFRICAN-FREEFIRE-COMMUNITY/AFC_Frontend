"use client";

/**
 * app/global-error.tsx - the boundary for an error thrown by the ROOT layout itself (owner rule R79).
 *
 * Next renders this INSTEAD of app/layout.tsx, so nothing the layout provides exists here: no
 * next-intl provider, no fonts, no theme. That is why the three languages are inline (the only
 * strings in the app not read through t(), for the one reason a t() cannot exist yet) and why the
 * markup carries its own <html> and <body>. The locale is read off the NEXT_LOCALE cookie, the
 * same cookie i18n/request.ts reads, so the sentence matches what the person chose.
 *
 * Detail goes to the console (the deploy's log collection reads it), never to the screen.
 */
import { useEffect } from "react";

const COPY = {
  en: { title: "Something went wrong", detail: "The page hit an error. Nothing you did was lost; try again, or go back to the home page.", retry: "Try again", home: "Go home" },
  fr: { title: "Une erreur est survenue", detail: "La page a rencontré une erreur. Rien de ce que vous avez fait n'est perdu ; réessayez, ou revenez à l'accueil.", retry: "Réessayer", home: "Accueil" },
  pt: { title: "Algo deu errado", detail: "A página encontrou um erro. Nada do que fez se perdeu; tente novamente ou volte à página inicial.", retry: "Tentar novamente", home: "Página inicial" },
} as const;

function localeFromCookie(): keyof typeof COPY {
  try {
    const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(fr|pt)/);
    return (m?.[1] as keyof typeof COPY) ?? "en";
  } catch {
    return "en";
  }
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("root layout error", error?.digest ?? "", error);
  }, [error]);
  const c = COPY[typeof document === "undefined" ? "en" : localeFromCookie()];

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#141416", color: "#e7e7ea", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#22c55e", margin: 0 }}>{c.title}</h1>
          <p style={{ marginTop: 16, opacity: 0.8 }}>{c.detail}</p>
          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={reset} style={{ background: "#22c55e", color: "#0b0f0c", fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: 0, cursor: "pointer" }}>{c.retry}</button>
            <a href="/" style={{ background: "#26262b", color: "#e7e7ea", fontWeight: 600, padding: "10px 20px", borderRadius: 8, textDecoration: "none" }}>{c.home}</a>
          </div>
        </div>
      </body>
    </html>
  );
}
