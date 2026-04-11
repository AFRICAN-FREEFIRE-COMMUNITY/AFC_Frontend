"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  IconArrowLeft,
  IconSend,
  IconMessage,
  IconLoader2,
  IconChevronRight,
} from "@tabler/icons-react";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatListItem {
  chat_id: number;
  application_id: number;
  team: string;
  player: string;
}

interface ChatMessage {
  id: number;
  sender: string;
  message: string;
  sent_at: string;
}

interface ChatConversation {
  chat_id: number;
  application_id: number;
  status: string;
  team: string;
  team_logo: string | null;
  player: string;
  messages: ChatMessage[];
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, skips the list and opens this chat directly */
  initialChatId?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return formatDate(dateString);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TrialChatSidebar({ open, onClose, initialChatId }: Props) {
  const { token, user } = useAuth();

  const [view, setView] = useState<"list" | "conversation">("list");
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(
    null,
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch chat list when sidebar opens ───────────────────────────────────
  useEffect(() => {
    if (!open || !token) return;
    setLoadingChats(true);
    axios
      .get<ChatListItem[]>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chats/`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => {
        setChats(res.data);
        if (initialChatId) {
          const match = res.data.find((c) => c.chat_id === initialChatId);
          if (match) openConversation(initialChatId);
        }
      })
      .catch(() => toast.error("Failed to load chats."))
      .finally(() => setLoadingChats(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  // ── Poll messages while in conversation view ──────────────────────────────
  useEffect(() => {
    if (!selectedChat || view !== "conversation" || !token) return;
    const poll = () => {
      axios
        .get<ChatConversation>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chat/messages/?chat_id=${selectedChat.chat_id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((res) => setSelectedChat(res.data))
        .catch(() => {});
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [selectedChat?.chat_id, view, token]);

  // ── Auto-scroll to latest message ─────────────────────────────────────────
  useEffect(() => {
    if (view === "conversation") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChat?.messages.length, view]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openConversation = (chatId: number) => {
    setView("conversation");
    setLoadingMessages(true);
    axios
      .get<ChatConversation>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chat/messages/?chat_id=${chatId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => setSelectedChat(res.data))
      .catch(() => toast.error("Failed to load messages."))
      .finally(() => setLoadingMessages(false));
  };

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !selectedChat) return;
    setSending(true);
    setMessageText("");
    try {
      const res = await axios.post<ChatMessage>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chat/send/`,
        { chat_id: String(selectedChat.chat_id), message: text },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSelectedChat((prev) =>
        prev ? { ...prev, messages: [...prev.messages, res.data] } : prev,
      );
    } catch {
      toast.error("Failed to send message.");
      setMessageText(text);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClose = () => {
    setView("list");
    setSelectedChat(null);
    setMessageText("");
    onClose();
  };

  const goBackToList = () => {
    setView("list");
    setSelectedChat(null);
    setMessageText("");
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] p-0 flex flex-col gap-0"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {view === "conversation" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 -ml-1"
                onClick={goBackToList}
              >
                <IconArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base truncate">
                {view === "list"
                  ? "Trial Chats"
                  : selectedChat
                    ? selectedChat.team
                    : "Chat"}
              </SheetTitle>
              {view === "conversation" && selectedChat && (
                <p className="text-xs text-muted-foreground truncate">
                  with {selectedChat.player}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* ── Chat List ───────────────────────────────────────────────── */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="flex items-center justify-center h-36 gap-2 text-muted-foreground text-sm">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Loading chats...
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground px-6 text-center">
                <IconMessage className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No trial chats yet</p>
                <p className="text-xs">
                  Chats become available once a trial is started
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {chats.map((chat) => (
                  <button
                    key={chat.chat_id}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => openConversation(chat.chat_id)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback>
                        {chat.team.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{chat.team}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        with {chat.player}
                      </p>
                    </div>
                    <IconChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Conversation ────────────────────────────────────────────── */}
        {view === "conversation" && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-36 gap-2 text-muted-foreground text-sm">
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              ) : !selectedChat || selectedChat.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <IconMessage className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs">Send the first message below</p>
                </div>
              ) : (
                selectedChat.messages.map((msg) => {
                  const isMine = msg.sender === user?.in_game_name;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarImage src={DEFAULT_PROFILE_PICTURE} />
                        <AvatarFallback className="text-xs">
                          {msg.sender.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[75%] space-y-0.5 flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-muted rounded-tl-sm"
                          }`}
                        >
                          {msg.message}
                        </div>
                        <p className="text-[10px] text-muted-foreground px-1">
                          {formatTime(msg.sent_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t shrink-0">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <Input
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={sending}
                  className="flex-1"
                  autoComplete="off"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !messageText.trim()}
                >
                  {sending ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconSend className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
