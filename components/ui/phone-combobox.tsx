"use client";

// PhoneCombobox = a type-to-search picker for the player's CURRENT MOBILE DEVICE.
//
// Owner 2026-06-29 ("Player Available Post" feature 1): replace the free-text "Current Mobile
// Device" Input on the Player Market post form with a combobox over a curated phone list
// (constants/phones.ts), while STILL allowing any free-text "Other" value so a phone that
// isn't on the list can always be submitted. Backend mobile_device stays a CharField (max 80);
// this is FE UX only.
//
// Built on the same shadcn Popover + cmdk Command shell as TeamSearchSelect /
// user-search-select (components/ui/*), so it reads like the rest of the codebase: a Popover
// trigger button, a CommandInput, and a CommandList. Differences: it searches a STATIC local
// list (no network), it is single-value (emits a string), and it surfaces a "Use <typed>"
// row so the typed text becomes the value when no exact match is wanted.
//
// CONNECTS TO:
//   constants/phones.ts                       -> the option list
//   lib/search.matchesSearch                  -> punctuation/accent/fancy-font tolerant filter
//     (same matcher the CountryMultiSelect + every "Search ..." box on the site uses)
//   app/(user)/player-markets/page.tsx        -> Create/Edit Player form, value -> mobile_device

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { PHONE_MODELS } from "@/constants/phones";
import { IconDeviceMobile, IconCheck, IconChevronDown } from "@tabler/icons-react";

type Props = {
  /** Current device string (may be a list value OR a free-text "Other" value). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Free-text "Use <typed>" row label, e.g. 'Use "{q}"'. {q} is replaced with the typed text. */
  otherLabel?: string;
  /** Empty-state copy when nothing matches and nothing has been typed. */
  emptyLabel?: string;
  searchPlaceholder?: string;
  className?: string;
  maxLength?: number;
  id?: string;
};

export function PhoneCombobox({
  value,
  onChange,
  placeholder = "Select your phone...",
  otherLabel = 'Use "{q}"',
  emptyLabel = "No phone found. Type to use a custom one.",
  searchPlaceholder = "Search or type your phone...",
  className,
  maxLength = 80,
  id,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Manual, accent/punctuation-insensitive filter (shouldFilter={false} on Command). Capped so
  // a one-character query doesn't render all ~300 rows; the curated list is the point.
  const filtered = React.useMemo(() => {
    const q = query.trim();
    if (!q) return PHONE_MODELS.slice(0, 30);
    return PHONE_MODELS.filter((m) => matchesSearch(m, q)).slice(0, 50);
  }, [query]);

  // Show the "Use <typed>" row whenever the typed text isn't already an exact (case-insensitive)
  // option, so any phone can be submitted verbatim. This is the free-text "Other" escape hatch.
  const trimmed = query.trim();
  const hasExact = PHONE_MODELS.some(
    (m) => m.toLowerCase() === trimmed.toLowerCase(),
  );
  const showOther = trimmed.length > 0 && !hasExact;

  const pick = (v: string) => {
    onChange(v.slice(0, maxLength));
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <IconDeviceMobile className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{value || placeholder}</span>
          </span>
          <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={(v) => setQuery(v.slice(0, maxLength))}
          />
          <CommandList>
            {filtered.length === 0 && !showOther && (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            )}

            {/* Free-text "Other": commit exactly what the player typed. Always first so it is
                reachable with a single Enter after typing a phone not on the list. */}
            {showOther && (
              <CommandGroup>
                <CommandItem
                  value={`__other__${trimmed}`}
                  onSelect={() => pick(trimmed)}
                >
                  <IconDeviceMobile className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">
                    {otherLabel.replace("{q}", trimmed)}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}

            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((model) => (
                  <CommandItem
                    key={model}
                    value={model}
                    onSelect={() => pick(model)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{model}</span>
                    {value === model && (
                      <IconCheck className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
