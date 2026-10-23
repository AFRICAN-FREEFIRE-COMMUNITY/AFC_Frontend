"use client";

/**
 * PersonPanel - everything one person sent, in one place, and the reply box (inbox #169 / #174).
 *
 * Owner 2026-10-08: "view all messages from each user in a single place without having to scroll
 * ... reply all messages together or at least reply one by one."
 *
 * Top: who they are (account, email, country, Discord) and "Assign to me". Middle (scrolls inside
 * the panel): every request newest first, open ones expanded, resolved and closed ones folded to
 * one line; pictures shown as previews and other files as downloads, all through the staff signed
 * links of inbox #168 (lib/api/support.ts attachmentUrl). Bottom (always on screen on desktop):
 * "Reply to" all open requests or one of them, files, "mark as resolved", Send.
 *
 * Talks to (lib/api/support.ts -> AFC-B afc_support):
 *   replyToPerson   POST support/people/<key>/reply/   one message on the chosen requests, ONE email
 *   setTicketStatus POST support/tickets/<n>/status/   a request's status, "assign to me"
 * Rendered by components/support/desk/SupportDesk.tsx, which loads the SupportPersonDetail.
 *
 * ON AN ORGANIZER'S DESK (inbox #175, `organization` set): replies are signed with the
 * organization's name (the backend does it; this shows it), the player's name links to their
 * public profile instead of the admin page, the email address is not shown (the backend sends it
 * blank to organizers), and each request names the event it is about when the player picked one.
 * `readOnly` (AFC head / super admins overseeing an organizer's desk): everything is shown, but no
 * reply box, status menu or "Assign to me", because only the organizer's own team answers (the
 * server refuses the rest with code org_support_read_only).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconBrandDiscord,
  IconFile,
  IconMail,
  IconPaperclip,
  IconSend,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  attachmentUrl,
  replyToPerson,
  setTicketStatus,
  type SupportAttachment,
  type SupportPersonDetail,
  type SupportTicket,
} from "@/lib/api/support";
import { CountryFlag } from "@/lib/countryFlag";
import { adminPlayerPath, playerPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { STATUSES } from "./DeskFilters";
import { STATUS_PILL } from "./PeopleList";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ANSWERABLE = new Set(["open", "waiting"]);

function FileLink({ att }: { att: SupportAttachment }) {
  const t = useTranslations("support");
  const href = attachmentUrl(att);
  if (att.content_type?.startsWith("image/")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={t("desk.openFile", { name: att.name })}
         className="bg-background/60 block w-36 overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={att.name} className="h-20 w-36 object-cover" loading="lazy" />
        <span className="block truncate px-2 py-1 text-[11px] font-medium">{att.name}</span>
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className="bg-background/60 inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium">
      <IconFile className="size-3.5 shrink-0" />
      <span className="truncate">{att.name}</span>
      <span className="text-muted-foreground shrink-0">{Math.max(1, Math.round(att.size_bytes / 1024))} KB</span>
    </a>
  );
}

function Request({
  ticket,
  personName,
  onStatus,
  organizationName,
  readOnly = false,
}: {
  ticket: SupportTicket;
  personName: string;
  onStatus: (number: string, status: string) => void;
  /** Set on an organizer's desk: outgoing messages are signed with it. */
  organizationName?: string;
  readOnly?: boolean;
}) {
  const t = useTranslations("support");
  const finished = !ANSWERABLE.has(ticket.status);
  const [open, setOpen] = useState(!finished);
  return (
    <article className="bg-muted/40 rounded-md p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{ticket.ticket_number}</span>
        <span className="min-w-0 text-sm font-medium">{ticket.subject}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_PILL[ticket.status])}>
          {t(`status.${ticket.status}`)}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
          {t.has(`desk.source.${ticket.source}`) ? t(`desk.source.${ticket.source}`) : ticket.source}
        </span>
        {ticket.event ? (
          <span className="bg-muted text-muted-foreground max-w-[220px] truncate rounded-full px-2 py-0.5 text-[11px]">
            {t("desk.aboutEvent", { event: ticket.event.name })}
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="text-muted-foreground text-xs">
          {t("openedOn")} <LocalTime value={ticket.created_at} />
        </span>
        {finished ? (
          <button type="button" className="text-primary text-xs font-semibold" onClick={() => setOpen((v) => !v)}>
            {open ? t("desk.hide") : t("desk.show")}
          </button>
        ) : null}
        {readOnly ? null : (
          <Select value={ticket.status} onValueChange={(s) => onStatus(ticket.ticket_number, s)}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          {(ticket.messages ?? []).map((m) =>
            m.channel === "auto" ? (
              <p key={m.id} className="text-muted-foreground self-center text-xs">
                {m.body.split("\n")[0].slice(0, 140)} {t("thread.automatic")}
              </p>
            ) : (
              <div
                key={m.id}
                className={cn(
                  "max-w-[min(640px,95%)] rounded-md px-3 py-2",
                  m.direction === "in" ? "bg-muted self-start" : "bg-primary/15 self-end",
                )}
              >
                <div className="text-muted-foreground mb-0.5 flex gap-2 text-[11px] font-semibold">
                  <span>
                    {m.direction === "in"
                      ? personName
                      : `${organizationName || t("thread.fromAfc")}${m.author_username ? ` (${m.author_username})` : ""}`}
                  </span>
                  <LocalTime value={m.created_at} />
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                {m.attachments.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.attachments.map((a) => (
                      <FileLink key={a.id} att={a} />
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      ) : null}
    </article>
  );
}

export function PersonPanel({
  token,
  detail,
  onChanged,
  onBack,
  organization,
  readOnly = false,
}: {
  token: string;
  /** Inbox #175: AFC oversight of an organizer's desk reads everything and changes nothing. */
  readOnly?: boolean;
  /** Inbox #175: the organizer desk this panel belongs to, or undefined for AFC's desk. */
  organization?: { slug: string; name: string };
  detail: SupportPersonDetail;
  /** Called with the fresh detail after a reply or a status change, so the list can refresh. */
  onChanged: (next: SupportPersonDetail | null) => void;
  onBack: () => void;
}) {
  const t = useTranslations("support");
  const { person, tickets } = detail;
  const firstName = (person.name || "").split(" ")[0] || person.name;
  const openTickets = useMemo(() => tickets.filter((x) => ANSWERABLE.has(x.status)), [tickets]);
  const [replyTo, setReplyTo] = useState<string>("all");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [resolve, setResolve] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A different person, or the chosen request was closed: start the reply box over.
  useEffect(() => {
    setReplyTo("all");
    setMessage("");
    setFiles([]);
    setResolve(false);
  }, [person.key]);
  const targets =
    replyTo === "all" || openTickets.length === 1
      ? openTickets.map((x) => x.ticket_number)
      : [replyTo].filter((n) => openTickets.some((x) => x.ticket_number === n));

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const next = [...files];
    for (const f of picked) {
      if (next.length >= MAX_FILES) {
        toast.error(t("errors.rejected.count", { name: f.name }));
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(t("errors.rejected.size", { name: f.name }));
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const send = async () => {
    if (!message.trim() || !targets.length) return;
    setSending(true);
    try {
      const res = await replyToPerson(token, person.key, {
        message: message.trim(),
        ticketNumbers: targets,
        files,
        resolve,
        organization: organization?.slug,
      });
      res.rejected_files?.forEach((f) => toast.error(t(`errors.rejected.${f.reason}`, { name: f.name })));
      toast.success(
        res.answered.length > 1
          ? t("desk.sentMany", { count: res.answered.length })
          : res.discord_dm ? t("reply.sentWithDiscord") : t("reply.sent"),
      );
      setMessage("");
      setFiles([]);
      setResolve(false);
      setReplyTo("all");
      onChanged({ person: res.person, tickets: res.tickets });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.reply"));
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (number: string, status: string) => {
    try {
      await setTicketStatus(token, number, { status });
      toast.success(t("status.changed"));
      onChanged(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.status"));
    }
  };

  const assignToMe = async () => {
    try {
      await Promise.all(openTickets.map((x) => setTicketStatus(token, x.ticket_number, { assign_to_me: true })));
      toast.success(t("desk.assignedToYou"));
      onChanged(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.status"));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <Button variant="ghost" size="sm" className="basis-full justify-start px-0 lg:hidden" onClick={onBack}>
          <IconArrowLeft className="mr-1 size-4" /> {t("desk.back")}
        </Button>
        <div className="bg-muted flex size-11 items-center justify-center rounded-full text-lg font-bold">
          {(person.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-[200px] flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {person.name}
            {person.country_name ? <CountryFlag country={person.country_name} /> : null}
          </h2>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <IconUser className="size-3.5" />
              {person.username ? (
                <Link
                  href={organization ? playerPath(person.username) : adminPlayerPath(person.username)}
                  className="text-primary hover:underline"
                >
                  @{person.username}
                </Link>
              ) : (
                t("desk.noAccount")
              )}
            </span>
            {person.email ? (
              <a className="hover:text-primary inline-flex items-center gap-1" href={`mailto:${person.email}`}>
                <IconMail className="size-3.5" /> {person.email}
              </a>
            ) : null}
            {person.country_name ? <span>{person.country_name}</span> : null}
            {person.has_discord ? (
              <span className="inline-flex items-center gap-1">
                <IconBrandDiscord className="size-3.5" /> {t("hasDiscord")}
              </span>
            ) : null}
          </div>
        </div>
        {openTickets.length && !readOnly ? (
          <Button size="sm" variant="outline" onClick={assignToMe}>
            {t("desk.assignMe")}
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wide uppercase">
          {t("desk.allRequests", { count: tickets.length, name: firstName })}
        </p>
        <div className="flex flex-col gap-2.5">
          {tickets.map((ticket) => (
            <Request
              key={ticket.ticket_number}
              ticket={ticket}
              personName={person.name}
              onStatus={changeStatus}
              organizationName={organization?.name}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {readOnly ? (
        <p className="text-muted-foreground shrink-0 px-4 py-5 text-center text-sm">
          {t("desk.readOnly", { name: organization?.name ?? "" })}
        </p>
      ) : openTickets.length ? (
        <div className="bg-card shrink-0 rounded-b-md px-4 pt-3 pb-4 lg:shadow-[0_-10px_18px_-14px_rgba(0,0,0,0.7)]">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-[11px] font-bold tracking-wide uppercase">
              {t("desk.replyTo")}
            </span>
            {openTickets.length > 1 ? (
              <button
                type="button"
                aria-pressed={replyTo === "all"}
                onClick={() => setReplyTo("all")}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-semibold",
                  replyTo === "all" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {t("desk.allOpen", { count: openTickets.length })}
              </button>
            ) : null}
            {openTickets.map((x) => {
              const on = openTickets.length === 1 || replyTo === x.ticket_number;
              return (
                <button
                  key={x.ticket_number}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReplyTo(x.ticket_number)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-semibold",
                    on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {x.ticket_number}
                </button>
              );
            })}
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("desk.placeholder", { name: firstName })}
            className="min-h-[76px]"
          />
          {files.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                  {f.name}
                  <button
                    type="button"
                    aria-label={t("composer.removeFile", { name: f.name })}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <IconX className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
              <IconPaperclip className="mr-1 size-4" /> {t("composer.attach")}
            </Button>
            <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" className="accent-primary size-4" checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
              {t("desk.resolveAfter")}
            </label>
            <span className="flex-1" />
            <Button onClick={send} disabled={sending || !message.trim() || !targets.length}>
              <IconSend className="mr-1 size-4" /> {sending ? t("composer.sending") : t("composer.send")}
            </Button>
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {targets.length > 1 ? t("desk.hintAll", { name: firstName, count: targets.length }) : t("desk.hintOne")}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground shrink-0 px-4 py-5 text-center text-sm">
          {t("desk.allResolved", { name: firstName })}
        </p>
      )}
    </div>
  );
}
