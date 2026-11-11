"use client";

/**
 * app/(user)/awards/_kol/KolPreviewGate.tsx - an AFC poll admin previewing a HIDDEN edition (owner, 11 Nov 2026,
 * inbox #543: "the awards page you will build should be hidden thouh till we are ready to release it").
 *
 * The server render reads editions signed out, so a hidden edition is a 404 there. When the admin awards table set
 * the afc_kol_preview cookie for this slug (lib/awardsEdition previewSlug), the KOL routes render this instead: it reads
 * GET polls/editions/<slug>/ with the viewer's own session (AFC-B answers a hidden edition only to a poll admin) and
 * draws the same KolEdition the public will see, under a "hidden" bar. Anybody else gets the plain not-found words.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import type { EditionDetail } from "@/lib/polls";

import { KolEdition, type KolView } from "./KolEdition";

export function KolPreviewGate({ slug, view }: { slug: string; view: KolView }) {
  const t = useTranslations("awardsKol");
  const { token, loading } = useAuth();
  const [detail, setDetail] = useState<EditionDetail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setState("none");
      return;
    }
    let live = true;
    fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/polls/editions/${encodeURIComponent(slug)}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!live) return;
        const d = r.ok ? ((await r.json()) as EditionDetail) : null;
        if (d && d.edition.theme === "detty-royale") {
          // The API answered a hidden edition, so this viewer is a poll admin: remember the preview for this slug
          // so the award, nominee and winners pages (server-rendered, signed out) hand over to this gate too.
          if (d.edition.hidden) {
            document.cookie = `afc_kol_preview=${encodeURIComponent(slug)}; path=/awards; max-age=7200; SameSite=Lax`;
          }
          setDetail(d);
          setState("ok");
        } else setState("none");
      })
      .catch(() => live && setState("none"));
    return () => {
      live = false;
    };
  }, [slug, token, loading]);

  if (state === "ok" && detail) return <KolEdition slug={slug} initial={detail} view={view} />;
  return (
    <main className="container py-24 text-center">
      <p className="text-muted-foreground text-sm">{state === "loading" ? t("preview.loading") : t("preview.notFound")}</p>
    </main>
  );
}
