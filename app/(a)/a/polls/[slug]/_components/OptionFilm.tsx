"use client";

/**
 * app/(a)/a/polls/[slug]/_components/OptionFilm.tsx - the film control of one nominee in the poll builder.
 *
 * WHAT IT DOES
 *   Uploads, replaces or removes the nominee film of ONE option (PollOption.film). The film is what the
 *   themed KOL Awards nominee page plays (landscape 16:9, about ten seconds). The file goes to
 *   POST polls/admin/polls/<slug>/options/<option_id>/film/ (afc_polls.views.admin_option_film), which
 *   sniffs the real type (MP4 or WebM only), caps the size at 25 MB and stores it under an opaque name.
 *
 * WHEN IT CAN BE USED
 *   Only for an option that already exists in the database (it has an option_id), because the upload is
 *   addressed to that row. A nominee just typed into the builder shows the hint "save the questions
 *   first". Unlike editing the questions, a film can be changed after people have voted.
 *
 * USED BY the option rows of app/(a)/a/polls/[slug]/page.tsx.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconMovie, IconTrash, IconUpload } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { pollsApi } from "@/lib/polls";

export function OptionFilm({
  pollSlug,
  optionId,
  filmUrl,
  onChange,
  kind = "film",
}: {
  pollSlug: string;
  optionId?: number;
  filmUrl?: string;
  /** Called with the new film URL ("" after a removal) so the builder keeps its copy in step. */
  onChange: (url: string) => void;
  /** "winner-film" is the film shown on the winner pages (separate from the nominee film). */
  kind?: "film" | "winner-film";
}) {
  const t = useTranslations("awardsKol.admin");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!optionId) return <p className="text-xs text-muted-foreground">{t("filmSaveFirst")}</p>;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await pollsApi.adminSetOptionFilm(pollSlug, optionId, file, kind);
      onChange(res.film_url ?? res.winner_film_url ?? "");
      toast.success(t("filmSaved"));
    } catch (error: unknown) {
      const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
      toast.error(data?.message || t("filmFailed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await pollsApi.adminRemoveOptionFilm(pollSlug, optionId, kind);
      onChange("");
      toast.success(t("filmRemoved"));
    } catch {
      toast.error(t("filmFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <IconMovie className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">{kind === "winner-film" ? t("winnerFilmLabel") : t("filmLabel")}:</span>
      {filmUrl ? (
        <a href={filmUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
          {t("filmCurrent")}
        </a>
      ) : (
        <span className="text-muted-foreground">{t("filmNone")}</span>
      )}
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <IconUpload className="mr-1 h-3.5 w-3.5" />
        {filmUrl ? t("filmReplace") : t("filmUpload")}
      </Button>
      {filmUrl && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void remove()}>
          <IconTrash className="mr-1 h-3.5 w-3.5" />
          {t("filmRemove")}
        </Button>
      )}
      <span className="text-muted-foreground">{kind === "winner-film" ? t("winnerFilmHelp") : t("filmHelp")}</span>
    </div>
  );
}
