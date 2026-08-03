"use client";

// ── BroadcastTokenInserts (owner 2026-07-04) ─────────────────────────────────────
// Two small "insert" controls for a broadcast composer: a TIME and a MONEY amount that each recipient
// sees in THEIR OWN timezone / currency. They append tokens to the message; the backend
// (afc_auth.broadcast_tokens via deliver_broadcast) resolves them per recipient at send time:
//   {{time:<ISO>}}         -> the recipient's local time (e.g. "6:00 PM WAT" for a Nigerian).
//   {{money:<amt>:<CUR>}}  -> the amount converted to the recipient's currency.
// Parent passes onInsert(token) which appends the token to its message state.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconClock, IconCoin } from "@tabler/icons-react";
import { AFC_CURRENCIES } from "@/lib/currencies";

export function BroadcastTokenInserts({ onInsert }: { onInsert: (token: string) => void }) {
  const [timeOpen, setTimeOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");

  const insertTime = () => {
    if (!when) return;
    const iso = new Date(when).toISOString(); // absolute instant (your local time -> UTC)
    onInsert(`{{time:${iso}}}`);
    setTimeOpen(false);
    setWhen("");
  };
  const insertMoney = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onInsert(`{{money:${n}:${currency}}}`);
    setMoneyOpen(false);
    setAmount("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
            <IconClock className="mr-1 size-3" /> Insert time
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-3">
          <Label className="text-xs">Time (in your timezone)</Label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          />
          <p className="text-muted-foreground text-[0.7rem]">
            Each recipient sees this in their own timezone.
          </p>
          <Button type="button" size="sm" className="h-7 w-full text-xs" onClick={insertTime}>
            Insert
          </Button>
        </PopoverContent>
      </Popover>

      <Popover open={moneyOpen} onOpenChange={setMoneyOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
            <IconCoin className="mr-1 size-3" /> Insert amount
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-3">
          <Label className="text-xs">Amount</Label>
          <div className="flex items-center gap-1">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="5000"
              className="h-8 text-sm"
            />
            {/* Currency menu comes from lib/currencies.ts, the ONE place any currency list lives
                (owner backlog item 28, 2026-08-03: currencies "missing ... when sending
                notifications or announcements"). This control previously carried its own inline
                8-code array, the shortest on the site: it offered BRL but neither XOF nor XAF, so an
                announcement could not quote a prize in the currency most of francophone West and
                Central Africa uses. The list is long now, so the dropdown is height-capped and
                scrolls; the trigger is widened to fit a 3-letter code plus the chevron. */}
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {AFC_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground text-[0.7rem]">
            Each recipient sees this converted to their own currency.
          </p>
          <Button type="button" size="sm" className="h-7 w-full text-xs" onClick={insertMoney}>
            Insert
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
