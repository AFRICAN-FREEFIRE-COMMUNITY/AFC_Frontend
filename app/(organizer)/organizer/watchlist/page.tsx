"use client";

// Organizer Watchlist page (/organizer/watchlist) — owner 2026-06-21.
// The SAME shared advisory watchlist as the admin page (/a/watchlist) — one global list every
// admin AND organizer sees — rendered through the shared <WatchlistManager>. This is an
// ORGANIZER-facing surface, so it is INTERNATIONALIZED (next-intl, namespace "watchlist",
// messages/en/watchlist.json -> fr/pt via `pnpm i18n:translate`), per the project i18n rule.
// Data: lib/watchlist.ts -> afc_auth/views_watchlist.py (gate allows any active organizer).
// Nav entry added in app/(organizer)/organizer/layout.tsx.
import { useTranslations } from "next-intl";
import { WatchlistManager, type WatchlistLabels } from "@/components/watchlist/WatchlistManager";

export default function OrganizerWatchlistPage() {
  const t = useTranslations("watchlist");
  // Map every label through next-intl so the whole page localizes (en/fr/pt).
  const labels: WatchlistLabels = {
    title: t("title"),
    subtitle: t("subtitle"),
    tabPlayers: t("tabPlayers"),
    tabTeams: t("tabTeams"),
    searchPlaceholder: t("searchPlaceholder"),
    addButton: t("addButton"),
    addPlayerTitle: t("addPlayerTitle"),
    addTeamTitle: t("addTeamTitle"),
    addPlayerDesc: t("addPlayerDesc"),
    addTeamDesc: t("addTeamDesc"),
    nameLabelPlayer: t("nameLabelPlayer"),
    nameLabelTeam: t("nameLabelTeam"),
    reasonLabel: t("reasonLabel"),
    reasonPlaceholder: t("reasonPlaceholder"),
    cancel: t("cancel"),
    confirmAdd: t("confirmAdd"),
    colSubject: t("colSubject"),
    colReason: t("colReason"),
    colAddedBy: t("colAddedBy"),
    colWhen: t("colWhen"),
    colActions: t("colActions"),
    remove: t("remove"),
    sourceUpload: t("sourceUpload"),
    sourceManual: t("sourceManual"),
    emptyPlayers: t("emptyPlayers"),
    emptyTeams: t("emptyTeams"),
    loadError: t("loadError"),
    addError: t("addError"),
    removeError: t("removeError"),
    added: t("added"),
    removed: t("removed"),
  };
  return (
    <div className="container py-6">
      <WatchlistManager labels={labels} />
    </div>
  );
}
