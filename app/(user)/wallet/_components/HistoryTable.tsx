"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { listTxns } from "@/lib/mock-wager/handlers/wallet";
import type {
  FxSnapshot,
  SourceTag,
  WalletTxn,
  WalletTxnKind,
} from "@/lib/mock-wager/types";

interface HistoryTableProps {
  userId: string;
  fx: FxSnapshot;
  /** When set, table truncates to N rows and hides filters/export. */
  preview?: number;
}

const KIND_LABEL: Record<WalletTxnKind, string> = {
  DEPOSIT_PAYSTACK: "Deposit · Paystack",
  DEPOSIT_STRIPE: "Deposit · Stripe",
  DEPOSIT_CRYPTO: "Deposit · Crypto",
  DEPOSIT_VOUCHER: "Voucher Redeemed",
  WAGER_PLACE: "Wager Placed",
  WAGER_REFUND: "Wager Refund",
  WAGER_PAYOUT: "Wager Payout",
  WAGER_CANCEL_FEE: "Wager Cancel Fee",
  HOUSE_RAKE: "House Rake",
  P2P_OUT: "P2P Sent",
  P2P_IN: "P2P Received",
  P2P_FEE: "P2P Fee",
  WITHDRAW_HOLD: "Withdraw Hold",
  WITHDRAW_REVERSAL: "Withdraw Reversal",
  ADJUSTMENT: "Adjustment",
};

const KIND_OPTIONS: { value: WalletTxnKind | "ALL"; label: string }[] = [
  { value: "ALL", label: "All kinds" },
  ...Object.entries(KIND_LABEL).map(([value, label]) => ({
    value: value as WalletTxnKind,
    label,
  })),
];

const SOURCE_OPTIONS: { value: SourceTag | "ALL"; label: string }[] = [
  { value: "ALL", label: "All sources" },
  { value: "PURCHASED", label: "Purchased" },
  { value: "WON", label: "Won" },
  { value: "GIFT", label: "Gift" },
];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function isCredit(t: WalletTxn) {
  return t.amount_kobo > 0;
}

function kindColor(t: WalletTxn): string {
  if (t.kind === "WAGER_PAYOUT") return "text-emerald-400";
  if (t.kind === "WAGER_PLACE" || t.kind === "P2P_OUT") return "text-rose-400";
  if (t.kind === "DEPOSIT_PAYSTACK" || t.kind === "DEPOSIT_STRIPE" || t.kind === "DEPOSIT_CRYPTO" || t.kind === "DEPOSIT_VOUCHER") {
    return "text-emerald-400";
  }
  return isCredit(t) ? "text-emerald-400" : "text-rose-400";
}

function sourceBadgeClass(s: SourceTag): string {
  if (s === "PURCHASED") return "border-blue-500/40 text-blue-400";
  if (s === "WON") return "border-amber-500/40 text-amber-400";
  return "border-emerald-500/40 text-emerald-400";
}

interface Row extends WalletTxn {
  balance_after_kobo: number;
}

export function HistoryTable({ userId, fx, preview }: HistoryTableProps) {
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<WalletTxnKind | "ALL">("ALL");
  const [source, setSource] = useState<SourceTag | "ALL">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = await listTxns({ user_id: userId });
        if (!cancelled) setTxns(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filtered = useMemo(() => {
    let out = txns;
    if (kind !== "ALL") out = out.filter((t) => t.kind === kind);
    if (source !== "ALL") out = out.filter((t) => t.source_tag === source);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (t) =>
          t.kind.toLowerCase().includes(q) ||
          t.ref_id.toLowerCase().includes(q) ||
          (KIND_LABEL[t.kind] ?? "").toLowerCase().includes(q),
      );
    }
    return out;
  }, [txns, kind, source, search]);

  // Compute balance_after_kobo by walking the txns oldest-first (reverse-sort).
  const rows: Row[] = useMemo(() => {
    const oldestFirst = [...filtered].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    let running = 0;
    const map = new Map<string, number>();
    for (const t of oldestFirst) {
      running += t.amount_kobo;
      map.set(t.id, running);
    }
    return filtered.map((t) => ({
      ...t,
      balance_after_kobo: map.get(t.id) ?? 0,
    }));
  }, [filtered]);

  const visible = preview ? rows.slice(0, preview) : rows;

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "When",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {relativeTime(row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: "kind",
        header: "Kind",
        cell: ({ row }) => (
          <span className={`font-medium ${kindColor(row.original)}`}>
            {KIND_LABEL[row.original.kind] ?? row.original.kind}
          </span>
        ),
      },
      {
        accessorKey: "source_tag",
        header: "Source",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={sourceBadgeClass(row.original.source_tag)}
          >
            {row.original.source_tag.toLowerCase()}
          </Badge>
        ),
      },
      {
        accessorKey: "amount_kobo",
        header: "Amount",
        cell: ({ row }) => {
          const v = formatMoney(row.original.amount_kobo, fx);
          const sign = row.original.amount_kobo >= 0 ? "+" : "";
          return (
            <div className="flex flex-col tabular-nums">
              <span
                className={`font-medium ${row.original.amount_kobo >= 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {sign}
                {v.coins} coins
              </span>
              <span className="text-[10px] text-muted-foreground">
                {sign}
                {v.naira}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "balance_after_kobo",
        header: "Balance after",
        cell: ({ row }) => {
          const v = formatMoney(row.original.balance_after_kobo, fx);
          return (
            <div className="flex flex-col tabular-nums text-muted-foreground">
              <span>{v.coins}</span>
              <span className="text-[10px]">{v.naira}</span>
            </div>
          );
        },
      },
    ],
    [fx],
  );

  const table = useReactTable({
    data: visible,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const onExportCSV = () => {
    const headers = [
      "created_at",
      "kind",
      "source_tag",
      "amount_kobo",
      "balance_after_kobo",
      "ref_type",
      "ref_id",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.created_at,
          r.kind,
          r.source_tag,
          r.amount_kobo,
          r.balance_after_kobo,
          r.ref_type,
          r.ref_id,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallet-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card data-testid="history-table">
      <CardContent className="flex flex-col gap-3">
        {!preview && (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search reference or kind…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as WalletTxnKind | "ALL")}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={source}
                onValueChange={(v) => setSource(v as SourceTag | "ALL")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              disabled={rows.length === 0}
              data-testid="csv-export"
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        )}

        <div className="rounded-md border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="h-10">
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className="text-foreground p-2 text-xs"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    {r.getVisibleCells().map((c) => (
                      <TableCell key={c.id} className="p-2 text-xs">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
