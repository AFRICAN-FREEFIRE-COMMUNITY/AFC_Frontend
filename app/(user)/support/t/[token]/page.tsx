"use client";

/**
 * app/(user)/support/t/[token]/page.tsx - a person's own support ticket.
 *
 * WHY IT EXISTS (owner 2026-09-14)
 *   The desk has to "see replies from people there also", and the people writing in usually have
 *   no AFC account, or cannot get into the one they have. So the acknowledgement email carries a
 *   link to this page, addressed by an OPAQUE TOKEN (R22, afc_support.models.new_ticket_token):
 *   opening it is the whole authentication. They read the conversation and answer here, files and
 *   all, and their reply lands in the staff dashboard as part of the same thread.
 *
 * DELIBERATELY PUBLIC. No login, no gate, nothing that assumes an account: this page is the one
 * surface that has to work for somebody locked out of everything else. The token is 80 bits and
 * never derived from anything guessable, and attachments are fetched with ?t=<token> through the
 * guarded file view.
 *
 * TALKS TO  GET support/t/<token>/ and POST support/t/<token>/reply/ (lib/api/support.ts).
 */
import { use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconMessageQuestion } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { SupportComposer, SupportThread } from "@/components/support/SupportThread";
import {
  getTicketByToken,
  replyAsRequester,
  type SupportTicket,
} from "@/lib/api/support";

export default function SupportTicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const t = useTranslations("support");

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTicket(await getTicketByToken(token));
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (message: string, files: File[]) => {
    setSending(true);
    try {
      const res = await replyAsRequester(token, message, files);
      setTicket(res.ticket);
      res.rejected_files?.forEach((f) =>
        toast.error(t(`errors.rejected.${f.reason}`, { name: f.name })),
      );
      toast.success(t("public.replySent"));
      return true;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.reply"));
      return false;
    } finally {
      setSending(false);
    }
  };

  if (loading) return <FullLoader />;

  if (notFound || !ticket) {
    return (
      <div>
        <PageHeader title={t("public.title")} />
        <Card>
          <CardContent className="py-12 text-center">
            <IconMessageQuestion className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="text-sm">{t("public.notFound")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("public.title")} description={t("public.subtitle")} />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {t("public.ticket", { number: ticket.ticket_number })}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                ticket.status === "open"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t(`status.${ticket.status}` as "status.open")}
            </span>
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {t("openedOn")} <LocalTime value={ticket.created_at} />
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SupportThread messages={ticket.messages ?? []} ticketToken={token} />
          <SupportComposer
            onSend={send}
            sending={sending}
            placeholder={t("public.placeholder")}
          />
          <p className="text-muted-foreground text-xs">{t("public.explainer")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
