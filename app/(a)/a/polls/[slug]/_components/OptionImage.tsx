"use client";

/**
 * app/(a)/a/polls/[slug]/_components/OptionImage.tsx - upload, replace or remove ONE nominee's picture in the poll
 * builder (goal of 11 Nov 2026, inbox #537: "ensure the backend/admin section is very thoroughly built").
 *
 * WHY: until now the picture was a link field only, so an admin without a hosted copy of a creator's photo had no way
 * to put one on the awards pages. The link field stays beside this control for a picture that already lives online.
 *
 * WHAT IT DOES: sends the file to POST polls/admin/polls/<slug>/options/<option_id>/image/
 * (AFC-B afc_polls.views.admin_option_image), which decodes the bytes (JPEG, PNG, WEBP, GIF, HEIF), caps the size at
 * 10 MB, re-encodes it under an opaque name and answers the new image_url. That URL is handed back through onChange so
 * the builder's form keeps it: the next whole-list "Save questions" then writes the same value instead of clearing it.
 * Refusals arrive with a code (not_an_image, image_too_large, image_required) and are shown through serverMessages.
 *
 * WHEN: only for a nominee already saved (it has an option_id), like the film control (OptionFilm). Allowed after
 * people have voted: a picture is decoration, it does not change what anyone was asked.
 *
 * USED BY the option rows of app/(a)/a/polls/[slug]/page.tsx.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { NewBadge } from "@/components/NewBadge";
import { Button } from "@/components/ui/button";
import { pollsApi } from "@/lib/polls";
import { useServerMessage } from "@/lib/i18n/serverMessage";

export function OptionImage({
  pollSlug,
  optionId,
  imageUrl,
  onChange,
}: {
  pollSlug: string;
  optionId?: number;
  imageUrl?: string;
  /** Called with the new picture URL ("" after a removal) so the builder keeps its copy in step. */
  onChange: (url: string) => void;
}) {
  const t = useTranslations("awardsKol.admin");
  const serverMessage = useServerMessage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!optionId) return <p className="text-xs text-muted-foreground">{t("imageSaveFirst")}</p>;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await pollsApi.adminSetOptionImage(pollSlug, optionId, file);
      onChange(res.image_url || "");
      toast.success(t("imageSaved"));
    } catch (error: unknown) {
      const data = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      toast.error(serverMessage(data, t("imageFailed")));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await pollsApi.adminRemoveOptionImage(pollSlug, optionId);
      onChange("");
      toast.success(t("imageRemoved"));
    } catch (error: unknown) {
      const data = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      toast.error(serverMessage(data, t("imageFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
        <img src={imageUrl} alt="" width={32} height={40} className="h-10 w-8 rounded-sm object-cover" />
      ) : (
        <IconPhoto className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      )}
      <span className="text-muted-foreground">{t("imageLabel")}:</span>
      <NewBadge since="2026-11-12" />
      {!imageUrl && <span className="text-muted-foreground">{t("imageNone")}</span>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <IconUpload className="mr-1 h-3.5 w-3.5" />
        {imageUrl ? t("imageReplace") : t("imageUpload")}
      </Button>
      {imageUrl && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void remove()}>
          <IconTrash className="mr-1 h-3.5 w-3.5" />
          {t("imageRemove")}
        </Button>
      )}
      <span className="text-muted-foreground">{t("imageHelp")}</span>
    </div>
  );
}
