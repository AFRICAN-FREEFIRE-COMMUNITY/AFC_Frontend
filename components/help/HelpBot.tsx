"use client";

/**
 * HelpBot - the Help button and panel on every page (inbox #109; the owner approved the preview,
 * mockups/help-bot/help-bot-mockup.html, on 2026-10-04).
 *
 * Owner, 1 Oct 2026: "Just like discord, can we set a bot that works and replies or helps with
 * support on the website?" Picks: a Help button on every page; open to everyone, signed in or not;
 * answers about the signed-in person's own account; GPT-4o like the Discord bot. Changed by the
 * owner on 5 Oct 2026, the day it shipped: "we'll use gemini". The panel's answers come from Gemini
 * (then Groq), never OpenAI; that choice lives in the bot (afcbot/bot.py WEB_CHAT_PROVIDER).
 *
 * HOW IT CONNECTS
 *   Mounted once in app/layout.tsx, so it survives client navigation and the chat stays open while
 *   the person moves around the site. Talks only to lib/api/helpBot.ts, which calls afc_helpbot
 *   (GET help-bot/status/, POST help-bot/chat/, POST help-bot/handoff/). The backend decides who may
 *   ask and how often, builds the account facts and asks the Discord bot's process for the answer;
 *   this component only draws the conversation.
 *   - useViewer (lib/gating.ts) decides signed in or out, and nothing is decided while it loads.
 *   - useAuthModal opens the site's own sign-in / create-account modal from an answer.
 *   - BotCheck (Turnstile) appears for a signed-out visitor before their first question and in the
 *     ticket form, which is where the backend asks for it (afc_auth/bot_protection.py).
 *   - "Talk to a person" opens a support ticket; signed in, it is then in My tickets on /support.
 *
 * NOT SHOWN on /overlay/* (OBS broadcast graphics, transparent, see components/PageGradient.tsx) or
 * /qr/* (the printable poster), and never printed.
 *
 * STORAGE, all of it conveniences (wrapped, the panel works without it):
 *   localStorage   afc-help-visitor  a random id for this browser. Signed out, the backend counts the
 *                                    daily allowance by it and only continues a chat for the same id.
 *   sessionStorage afc-help-chat     the open conversation, so a reload keeps it. It records whose it
 *                                    was and is dropped when somebody else is signed in, and on sign out.
 */
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useAuthModal } from "@/components/AuthModal";
import { BotCheck, botCheckEnabled } from "@/components/BotCheck";
import { NewBadge } from "@/components/NewBadge";
import { useAuth } from "@/contexts/AuthContext";
import {
  askHelpBot,
  getHelpBotStatus,
  handOffToPerson,
  helpBotErrorCode,
  type HelpBotStatus,
} from "@/lib/api/helpBot";
import { useViewer } from "@/lib/gating";
import { cn } from "@/lib/utils";

import { HelpMessageText } from "./HelpMessageText";

// The day the panel went live, for the 5-day NEW tag (CLAUDE.md rule; components/NewBadge.tsx).
const LIVE_SINCE = "2026-10-05";
const VISITOR_KEY = "afc-help-visitor";
const CHAT_KEY = "afc-help-chat";
// Mirrors afc_helpbot.views MAX_MESSAGE_CHARS / MAX_HANDOFF_CHARS; the server refuses anything longer.
const MAX_QUESTION = 1000;
const MAX_HANDOFF = 2000;
const MAX_KEPT = 40;
// How long a signed-out first question waits for the Turnstile token before sending anyway (the server
// is what decides; this only avoids a refusal when the token is a second away).
const BOT_CHECK_GRACE_MS = 6000;

// Codes that stop the conversation for today (banner, composer off, the ticket still works).
const BLOCKING = new Set(["help_daily_limit", "help_network_limit", "help_ai_offline"]);
// Codes worth a "Try again" button that sends the same question again.
const RETRYABLE = new Set(["help_busy", "help_ai_timeout", "help_ai_failed", "help_slow_down", "network"]);

type Msg =
  | { id: string; kind: "me"; text: string }
  | { id: string; kind: "bot"; text: string; usedAccount?: boolean; needsPerson?: boolean; needsSignIn?: boolean }
  | { id: string; kind: "ticket"; number: string; url: string; existing: boolean; hadChat: boolean; email?: string }
  | { id: string; kind: "error"; code: string; retry?: string };

// `retry` is the question that ran into an outage: the offline banner offers to send it again,
// because "every provider is down" is often a matter of seconds (a rate limit), not the day.
type Blocked = { code: string; limit?: number; retry?: string } | null;

const newId = () => Math.random().toString(36).slice(2, 10);

function readVisitor(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // Storage blocked (private window): a per-page id still lets this visit work.
    return "page" + Math.random().toString(16).slice(2).padEnd(20, "0");
  }
}

type Saved = { owner: number | null; conversation: string; messages: Msg[] };

function readSaved(): Saved | null {
  try {
    const raw = window.sessionStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved | null) {
  try {
    if (saved) window.sessionStorage.setItem(CHAT_KEY, JSON.stringify(saved));
    else window.sessionStorage.removeItem(CHAT_KEY);
  } catch {
    /* storage blocked: the chat just does not survive a reload */
  }
}

// The approved mockup's icons, drawn inline so they match it exactly.
const Icon = {
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[18px]">
      <path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3h-2a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h12z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[18px]">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[18px]">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[17px]">
      <path d="M10 14 21 3" /><path d="m21 3-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1L21 3" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3">
      <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 size-4 shrink-0">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  ),
};

/** The mount point: nothing at all on the broadcast and print routes. */
export function HelpBot() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/overlay") || pathname.startsWith("/qr/")) return null;
  return <HelpBotPanel />;
}

function HelpBotPanel() {
  const t = useTranslations("helpBot");
  const viewer = useViewer();
  const { token } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [open, setOpen] = useState(false);
  const [visitor, setVisitor] = useState("");
  const [status, setStatus] = useState<HelpBotStatus | null>(null);
  const [conversation, setConversation] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState<Blocked>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [personEmail, setPersonEmail] = useState("");
  const [personText, setPersonText] = useState("");
  const [personError, setPersonError] = useState("");
  const [handingOff, setHandingOff] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [botKey, setBotKey] = useState(0);
  const [botWaitOver, setBotWaitOver] = useState(false);

  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wasSignedIn = useRef<boolean | null>(null);

  const signedIn = viewer.signedIn;
  const ownerId = viewer.id;

  // ── restore this browser's id and the open conversation, once the session is known ──
  useEffect(() => {
    if (viewer.loading) return;
    setVisitor(readVisitor());
    const saved = readSaved();
    if (saved && saved.owner === (ownerId ?? null)) {
      setConversation(saved.conversation || "");
      setMessages(Array.isArray(saved.messages) ? saved.messages.slice(-MAX_KEPT) : []);
    } else if (saved) {
      writeSaved(null); // somebody else's chat on this device: never show it
    }
    // Only on the first answer to the session question; later changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading]);

  // ── signing out ends the chat (a shared phone must not show the last person's account answers) ──
  useEffect(() => {
    if (viewer.loading) return;
    if (wasSignedIn.current === true && !signedIn) {
      setConversation("");
      setMessages([]);
      setBlocked(null);
      setPersonOpen(false);
      writeSaved(null);
    }
    wasSignedIn.current = signedIn;
  }, [signedIn, viewer.loading]);

  // ── keep the conversation across reloads ──
  useEffect(() => {
    if (viewer.loading) return;
    if (!conversation && messages.length === 0) writeSaved(null);
    else writeSaved({ owner: ownerId ?? null, conversation, messages: messages.slice(-MAX_KEPT) });
  }, [conversation, messages, ownerId, viewer.loading]);

  // ── status (online, questions left) whenever the panel opens or the session changes ──
  const loadStatus = useCallback(async () => {
    if (!visitor) return;
    try {
      const s = await getHelpBotStatus(signedIn ? token : null, visitor);
      setStatus(s);
      if (!s.online) setBlocked({ code: "help_ai_offline" });
      else if (s.remaining <= 0) setBlocked({ code: s.spent || "help_daily_limit", limit: s.limit });
      else setBlocked((b) => (b && b.code !== "help_network_limit" ? null : b));
    } catch {
      setStatus(null); // unknown: let them ask, the answer will say what is wrong
    }
  }, [signedIn, token, visitor]);

  useEffect(() => {
    if (open && !viewer.loading) void loadStatus();
  }, [open, viewer.loading, loadStatus]);

  // ── focus, Escape, scroll lock on a phone, and scroll to the newest message ──
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const before = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      if (phone) document.body.style.overflow = before;
    };
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, sending, personOpen, open]);

  // The question box grows with what is typed, up to about four lines, then scrolls.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [draft, open]);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  };

  // ── the bot check: needed for a signed-out visitor's first question and for their ticket ──
  const botCheckShown = !signedIn && !!status?.bot_check && botCheckEnabled();
  const needsBotCheckToAsk = botCheckShown && !conversation;
  useEffect(() => {
    setBotWaitOver(false);
    if (!open || !botCheckShown) return;
    const id = window.setTimeout(() => setBotWaitOver(true), BOT_CHECK_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [open, botCheckShown, botKey]);
  const freshBotCheck = () => {
    setBotToken("");
    setBotKey((k) => k + 1);
  };

  const push = (m: Msg) => setMessages((list) => [...list, m].slice(-MAX_KEPT));

  // ── ask ──
  // `resend` is a retry of a question already on screen: it is sent again without a second bubble.
  const ask = async (raw: string, resend = false) => {
    const text = raw.trim();
    // A resend is the person pressing Try again on the very banner that blocked them, so the block
    // (still set in this render) must not stop it; setBlocked(null) lands on the next render.
    if (!text || sending || (blocked && !resend) || !visitor) return;
    if (resend) {
      // The error under the question goes; the question stays where it was.
      setMessages((list) => list.filter((m) => !(m.kind === "error" && m.retry === text)));
    } else {
      setDraft("");
      push({ id: newId(), kind: "me", text });
    }
    setSending(true);
    const usedBotCheck = needsBotCheckToAsk;
    try {
      const answer = await askHelpBot(signedIn ? token : null, {
        message: text.slice(0, MAX_QUESTION),
        conversation: conversation || undefined,
        visitor,
        turnstile: usedBotCheck ? botToken : undefined,
      });
      setConversation(answer.conversation);
      push({
        id: newId(),
        kind: "bot",
        text: answer.reply,
        usedAccount: answer.used_account,
        needsPerson: answer.needs_person,
        needsSignIn: answer.needs_sign_in,
      });
      setStatus((s) => (s ? { ...s, limit: answer.limit, remaining: answer.remaining } : s));
    } catch (err) {
      const { code, limit } = helpBotErrorCode(err);
      if (code === "help_conversation_not_found") setConversation("");
      if (BLOCKING.has(code)) {
        setBlocked({ code, limit, retry: code === "help_ai_offline" ? text : undefined });
        if (code !== "help_ai_offline") setStatus((s) => (s ? { ...s, remaining: 0 } : s));
      } else {
        push({ id: newId(), kind: "error", code, retry: RETRYABLE.has(code) ? text : undefined });
      }
    } finally {
      setSending(false);
      if (usedBotCheck) freshBotCheck(); // a Turnstile token works once
    }
  };

  // ── talk to a person ──
  const chatHasMessages = messages.some((m) => m.kind === "me");
  const openPerson = () => {
    setPersonError("");
    setPersonOpen(true);
  };

  const handOff = async () => {
    if (handingOff || !visitor) return;
    setPersonError("");
    if (!signedIn && !/^[\w.-]+@[\w.-]+\.\w+$/.test(personEmail.trim())) {
      setPersonError("help_email_invalid");
      return;
    }
    if (!(conversation && chatHasMessages) && !personText.trim()) {
      setPersonError("help_handoff_empty");
      return;
    }
    setHandingOff(true);
    try {
      const ticket = await handOffToPerson(signedIn ? token : null, {
        conversation: conversation || undefined,
        visitor,
        email: signedIn ? undefined : personEmail.trim(),
        message: personText.trim().slice(0, MAX_HANDOFF) || undefined,
        turnstile: botCheckShown ? botToken : undefined,
      });
      push({
        id: newId(),
        kind: "ticket",
        number: ticket.ticket_number,
        url: ticket.ticket_url,
        existing: ticket.existing,
        hadChat: !!conversation && chatHasMessages,
        email: signedIn ? undefined : personEmail.trim(),
      });
      setPersonOpen(false);
      setPersonText("");
    } catch (err) {
      const { code } = helpBotErrorCode(err);
      setPersonError(code === "help_conversation_not_found" ? "ticketFailed" : code);
      if (code === "help_conversation_not_found") setConversation("");
    } finally {
      setHandingOff(false);
      if (botCheckShown) freshBotCheck();
    }
  };

  const newConversation = () => {
    setConversation("");
    setMessages([]);
    setPersonOpen(false);
    setPersonError("");
    setBlocked(null);
    writeSaved(null);
    void loadStatus();
    inputRef.current?.focus();
  };

  // ── words ──
  const errorText = (code: string, limit?: number): string => {
    switch (code) {
      case "help_daily_limit":
        return t("errors.limit", { limit: limit ?? status?.limit ?? 0 });
      case "help_network_limit":
        return t("errors.networkLimit");
      case "help_ai_offline":
        return t("errors.offline");
      case "help_busy":
        return t("errors.busy");
      case "help_slow_down":
        return t("errors.slowDown");
      case "help_ai_timeout":
        return t("errors.timeout");
      case "bot_check_failed":
        return t("errors.botCheck");
      case "help_conversation_not_found":
        return t("errors.conversationGone");
      case "help_email_invalid":
        return t("errors.emailInvalid");
      case "help_handoff_empty":
        return t("errors.handoffEmpty");
      case "help_handoff_limit":
        return t("errors.handoffLimit");
      case "ticketFailed":
        return t("errors.ticketFailed");
      case "network":
        return t("errors.network");
      default:
        return t("errors.failed");
    }
  };

  const footLeft = useMemo(() => {
    if (blocked?.code === "help_ai_offline") return t("foot.offline");
    if (blocked) return t("foot.none");
    if (!status) return t("foot.disclaimer");
    if (status.remaining <= 0) return t("foot.none");
    return t("foot.left", { count: status.remaining });
  }, [blocked, status, t]);

  const sendDisabled =
    !draft.trim() || sending || !!blocked || !visitor || (needsBotCheckToAsk && !botToken && !botWaitOver);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendDisabled) void ask(draft);
    }
  };

  const chips = [
    { key: "tiers", ask: true },
    { key: "leave", ask: true },
    { key: "window", ask: true },
    { key: "person", ask: false },
  ] as const;

  // ── render ──
  return (
    <div className="print:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="afc-help-panel"
        aria-label={open ? t("buttonCloseAria") : t("buttonAria")}
        className={cn(
          "fixed right-4 bottom-4 z-50 inline-flex h-11 items-center gap-2 rounded-full px-[18px] text-sm font-bold sm:right-5 sm:bottom-5",
          "bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(0,0,0,0.35)] hover:bg-primary/90",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          // On a phone the open panel fills the screen and has its own close button.
          open && "max-sm:hidden",
        )}
      >
        {Icon.chat}
        <span>{open ? t("buttonClose") : t("button")}</span>
        {!open && (
          <NewBadge since={LIVE_SINCE} className="bg-primary-foreground/15 px-1.5 py-0 text-[10px] text-primary-foreground" />
        )}
      </button>

      {open && (
        <section
          id="afc-help-panel"
          role="dialog"
          aria-label={t("title")}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-card",
            "inset-0 sm:inset-auto sm:right-5 sm:bottom-[76px] sm:h-[min(600px,calc(100vh-140px))] sm:w-[390px] sm:rounded-[14px]",
            "sm:shadow-[0_18px_50px_rgba(0,0,0,0.55)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
          )}
        >
          {/* ── head ── */}
          <div className="flex items-center gap-2.5 bg-muted py-3 pr-3.5 pl-4">
            <Image src="/logo.png" alt="" width={30} height={30} className="size-[30px]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold">{t("title")}</h2>
              <p className="mt-px text-xs text-muted-foreground">
                {blocked?.code === "help_ai_offline" ? t("subtitleOffline") : t("subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={newConversation}
              aria-label={t("newChat")}
              title={t("newChat")}
              className="grid size-[34px] place-items-center rounded-lg hover:bg-background/40 focus-visible:outline-2 focus-visible:outline-primary"
            >
              {Icon.plus}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              title={t("close")}
              className="grid size-[34px] place-items-center rounded-lg hover:bg-background/40 focus-visible:outline-2 focus-visible:outline-primary"
            >
              {Icon.close}
            </button>
          </div>

          {/* ── conversation ── */}
          <div ref={logRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            {blocked?.code !== "help_ai_offline" && (
              <div className="max-w-[86%] self-start rounded-[4px_14px_14px_14px] bg-muted px-3 py-2.5 text-sm leading-normal">
                {signedIn ? (
                  <>
                    <p>{t("greeting.in", { name: viewer.inGameName })}</p>
                    <p className="mt-2">{t("greeting.in2")}</p>
                  </>
                ) : (
                  <>
                    <p>{t("greeting.out")}</p>
                    <p className="mt-2">{t("greeting.out2")}</p>
                  </>
                )}
              </div>
            )}

            {messages.length === 0 && !blocked && !personOpen && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => (c.ask ? void ask(t(`chips.${c.key}`)) : openPerson())}
                    disabled={c.ask && (sending || (needsBotCheckToAsk && !botToken && !botWaitOver))}
                    className="rounded-[10px] bg-muted px-[11px] py-[7px] text-left text-[13px] hover:bg-muted/70 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {t(`chips.${c.key}`)}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) => {
              if (m.kind === "me") {
                return (
                  <div key={m.id} className="max-w-[86%] self-end whitespace-pre-wrap break-words rounded-[14px_4px_14px_14px] bg-primary px-3 py-2.5 text-sm leading-normal text-primary-foreground">
                    {m.text}
                  </div>
                );
              }
              if (m.kind === "bot") {
                const text = m.text.trim() || (m.needsSignIn ? t("signInFallback") : t("personFallback"));
                return (
                  <div key={m.id} className="max-w-[86%] self-start break-words rounded-[4px_14px_14px_14px] bg-muted px-3 py-2.5 text-sm leading-normal">
                    <HelpMessageText text={text} />
                    {m.usedAccount && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                        {Icon.user}
                        {t("checkedAccount")}
                      </span>
                    )}
                    {(m.needsSignIn && !signedIn) || (m.needsPerson && !personOpen) ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.needsSignIn && !signedIn && (
                          <>
                            <button type="button" onClick={() => openAuthModal({ defaultTab: "login" })} className="h-8 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary">
                              {t("signIn")}
                            </button>
                            <button type="button" onClick={() => openAuthModal({ defaultTab: "register" })} className="h-8 rounded-lg bg-background/40 px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                              {t("createAccount")}
                            </button>
                          </>
                        )}
                        {m.needsPerson && !personOpen && (
                          <button type="button" onClick={openPerson} className="h-8 rounded-lg bg-background/40 px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                            {t("talkToPerson")}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }
              if (m.kind === "ticket") {
                return (
                  <div key={m.id} className="max-w-[86%] self-start rounded-[4px_14px_14px_14px] bg-muted px-3 py-2.5 text-sm leading-normal">
                    <p>{m.existing ? t("ticket.existing") : m.hadChat ? t("ticket.done") : t("ticket.doneNoChat")}</p>
                    <div className="mt-2 rounded-[10px] bg-primary/10 p-3">
                      <div className="text-base font-extrabold tracking-[0.02em] text-primary">{m.number}</div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {m.email ? t("ticket.replyOut", { email: m.email }) : t("ticket.replyIn")}
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {signedIn ? (
                        <Link href="/support" onClick={close} className="inline-flex h-8 items-center rounded-lg bg-background/40 px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                          {t("ticket.openMine")}
                        </Link>
                      ) : (
                        <a href={m.url} className="inline-flex h-8 items-center rounded-lg bg-background/40 px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                          {t("ticket.openPage")}
                        </a>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex flex-col items-start gap-1.5">
                  <div className="flex items-start gap-2 rounded-[10px] bg-destructive/12 px-3 py-2.5 text-[13px] leading-snug text-[oklch(0.82_0.1_25)]">
                    {Icon.alert}
                    <span>{errorText(m.code)}</span>
                  </div>
                  {m.retry && !sending && !blocked && (
                    <button type="button" onClick={() => void ask(m.retry || "", true)} className="h-8 rounded-lg bg-muted px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                      {t("errors.retry")}
                    </button>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex gap-1 self-start rounded-[4px_14px_14px_14px] bg-muted px-3.5 py-3" role="status">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span className="sr-only">{t("writing")}</span>
              </div>
            )}

            {blocked && (
              <>
                <div className="flex items-start gap-2 rounded-[10px] bg-destructive/12 px-3 py-2.5 text-[13px] leading-snug text-[oklch(0.82_0.1_25)]">
                  {Icon.alert}
                  <span>{errorText(blocked.code, blocked.limit)}</span>
                </div>
                {!personOpen && (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={openPerson} className="h-8 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary">
                      {t("talkToPerson")}
                    </button>
                    {blocked.retry && (
                      <button
                        type="button"
                        onClick={() => {
                          const again = blocked.retry || "";
                          setBlocked(null);
                          void ask(again, true);
                        }}
                        className="h-8 rounded-lg bg-muted px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {t("errors.retry")}
                      </button>
                    )}
                    {blocked.code === "help_network_limit" && !signedIn && (
                      <button type="button" onClick={() => openAuthModal({ defaultTab: "login" })} className="h-8 rounded-lg bg-muted px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                        {t("signIn")}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {personOpen && (
              <div className="max-w-[92%] self-start rounded-[4px_14px_14px_14px] bg-muted px-3 py-2.5 text-sm leading-normal">
                <p>{signedIn ? t("person.introIn") : t("person.introOut")}</p>
                {!signedIn && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <label htmlFor="afc-help-email" className="text-xs font-semibold text-muted-foreground">
                      {t("person.emailLabel")}
                    </label>
                    {/* A form control keeps its outline (owner rule: native controls are the exception). */}
                    <input
                      id="afc-help-email"
                      type="email"
                      autoComplete="email"
                      value={personEmail}
                      onChange={(e) => setPersonEmail(e.target.value)}
                      placeholder={t("person.emailPlaceholder")}
                      className="h-[38px] rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                    />
                  </div>
                )}
                {!(conversation && chatHasMessages) && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <label htmlFor="afc-help-need" className="text-xs font-semibold text-muted-foreground">
                      {t("person.messageLabel")}
                    </label>
                    <textarea
                      id="afc-help-need"
                      value={personText}
                      maxLength={MAX_HANDOFF}
                      rows={3}
                      onChange={(e) => setPersonText(e.target.value)}
                      className="resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                    />
                  </div>
                )}
                {botCheckShown && <BotCheck key={`p${botKey}`} onToken={setBotToken} appearance="interaction-only" className="mt-2.5" />}
                {personError && <p className="mt-2 text-[13px] text-destructive">{errorText(personError)}</p>}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handOff()}
                    disabled={handingOff}
                    className="h-8 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {handingOff ? t("person.opening") : t("person.openTicket")}
                  </button>
                  <button type="button" onClick={() => setPersonOpen(false)} className="h-8 rounded-lg bg-background/40 px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                    {t("person.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── compose ── */}
          <div className="bg-card px-3 pt-2.5 pb-3">
            {needsBotCheckToAsk && !personOpen && (
              <BotCheck key={`a${botKey}`} onToken={setBotToken} appearance="interaction-only" className="mb-2 empty:hidden" />
            )}
            <div className="flex items-end gap-2 rounded-xl bg-muted py-1.5 pr-1.5 pl-3">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={MAX_QUESTION}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={!!blocked}
                placeholder={t("placeholder")}
                aria-label={t("inputLabel")}
                className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void ask(draft)}
                disabled={sendDisabled}
                aria-label={t("send")}
                className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-primary text-primary-foreground disabled:bg-background/40 disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                {Icon.send}
              </button>
            </div>
            <div className="mt-[7px] flex justify-between gap-2 px-0.5 text-[11px] text-muted-foreground">
              <span>{footLeft}</span>
              <button type="button" onClick={openPerson} className="shrink-0 font-bold text-primary focus-visible:outline-2 focus-visible:outline-primary">
                {t("talkToPerson")}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default HelpBot;
