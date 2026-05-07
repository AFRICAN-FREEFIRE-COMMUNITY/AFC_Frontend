"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MarketCard } from "./MarketCard";
import { listMarkets } from "@/lib/mock-wager/handlers/markets";
import { listMyWagers } from "@/lib/mock-wager/handlers/wagers";
import { runSeed } from "@/lib/mock-wager/seed";
import { getCurrentUser } from "@/lib/mock-wager/handlers/auth";
import { getDB } from "@/lib/mock-wager/store";
import { getBalance } from "@/lib/mock-wager/handlers/wallet";
import { subscribe } from "@/lib/mock-wager/pubsub";
import type {
  FxSnapshot,
  Market,
  MarketStatus,
  User,
  Wager,
} from "@/lib/mock-wager/types";

type StatusTab = "OPEN" | "LOCKED" | "SETTLED" | "MY_WAGERS";

const PAGE_SIZE = 9;

export default function WagersClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [myWagers, setMyWagers] = useState<Wager[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  const [tab, setTab] = useState<StatusTab>("OPEN");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const refresh = async () => {
    const all = await listMarkets({});
    setMarkets(all);
    if (user) {
      const w = await listMyWagers({ user_id: user.id });
      setMyWagers(w);
      try {
        const b = await getBalance(user.id);
        setFx(b.fx);
      } catch {
        // user has no wallet yet — leave fx alone
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const cur =
        (await getCurrentUser()) ??
        ({
          id: "player_1",
          username: "stormbreaker",
          display_name: "StormBreaker",
          role: "user",
          created_at: "",
        } as User);
      if (cancelled) return;
      setUser(cur);
      const db = await getDB();
      const evs = await db.getAll("events");
      setEvents(evs.map((e) => ({ id: e.id, name: e.name })));
      try {
        const b = await getBalance(cur.id);
        if (!cancelled) setFx(b.fx);
      } catch {
        if (!cancelled) {
          setFx({
            id: "fx_default",
            captured_at: new Date().toISOString(),
            ngn_per_usd: 1500,
            source: "fallback",
          });
        }
      }
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bootstrapped) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, user]);

  // Live updates: any pool change refreshes the list
  useEffect(() => {
    if (!bootstrapped) return;
    const off1 = subscribe("pool:updated", () => refresh());
    const off2 = subscribe("market:locked", () => refresh());
    const off3 = subscribe("market:settled", () => refresh());
    return () => {
      off1();
      off2();
      off3();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, user]);

  const myWagerMarketIds = useMemo(
    () => new Set(myWagers.map((w) => w.market_id)),
    [myWagers],
  );

  const filtered = useMemo(() => {
    let pool: Market[];
    if (tab === "MY_WAGERS") {
      pool = markets.filter((m) => myWagerMarketIds.has(m.id));
    } else if (tab === "OPEN") {
      pool = markets.filter((m) => m.status === "OPEN");
    } else if (tab === "LOCKED") {
      pool = markets.filter(
        (m) => m.status === "LOCKED" || m.status === "PENDING_SETTLEMENT",
      );
    } else {
      pool = markets.filter(
        (m) => m.status === "SETTLED" || m.status === "VOIDED",
      );
    }
    if (eventFilter !== "ALL") {
      pool = pool.filter((m) => m.event_id === eventFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }
    return pool;
  }, [markets, tab, eventFilter, search, myWagerMarketIds]);

  useEffect(() => {
    setPage(1);
  }, [tab, eventFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const eventNameById = (id: string) =>
    events.find((e) => e.id === id)?.name ?? "";
  const wagerByMarketId = (id: string) =>
    myWagers.find((w) => w.market_id === id) ?? null;

  if (!bootstrapped || !fx) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Wagers"
        description="Pool-based wagers on AFC matches. Open markets close at lock-time, then settle when the result lands."
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as StatusTab)}
        className="gap-3"
      >
        <TabsList className="w-full max-w-2xl">
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="LOCKED">Locked</TabsTrigger>
          <TabsTrigger value="SETTLED">Settled</TabsTrigger>
          <TabsTrigger value="MY_WAGERS">My Wagers</TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search markets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(["OPEN", "LOCKED", "SETTLED", "MY_WAGERS"] as StatusTab[]).map(
          (t) => (
            <TabsContent key={t} value={t}>
              {paginated.length === 0 ? (
                <div className="rounded-md border bg-card py-12 text-center text-sm text-muted-foreground">
                  {t === "MY_WAGERS"
                    ? "You haven't placed any wagers yet."
                    : "No markets match your filters."}
                </div>
              ) : (
                <>
                  <div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                    data-testid="markets-grid"
                  >
                    {paginated.map((m) => (
                      <MarketCard
                        key={m.id}
                        market={m}
                        fx={fx}
                        eventLabel={eventNameById(m.event_id)}
                        wager={wagerByMarketId(m.id)}
                      />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <p className="hidden md:block text-sm text-muted-foreground">
                        Showing {(page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                        {filtered.length}
                      </p>
                      <Pagination className="w-full md:w-auto mx-0">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              className={
                                page === 1
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(
                              (n) =>
                                n === 1 ||
                                n === totalPages ||
                                Math.abs(n - page) <= 1,
                            )
                            .map((n, idx, arr) => (
                              <React.Fragment key={n}>
                                {idx > 0 && arr[idx - 1] !== n - 1 && (
                                  <PaginationItem>
                                    <PaginationEllipsis />
                                  </PaginationItem>
                                )}
                                <PaginationItem>
                                  <PaginationLink
                                    isActive={page === n}
                                    onClick={() => setPage(n)}
                                    className="cursor-pointer"
                                  >
                                    {n}
                                  </PaginationLink>
                                </PaginationItem>
                              </React.Fragment>
                            ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                              }
                              className={
                                page === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ),
        )}
      </Tabs>
    </div>
  );
}
