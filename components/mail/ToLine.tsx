"use client";

// components/mail/ToLine.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Who gets the email, as Gmail's To line (inbox #286, owner 2026-10-16: "should also still be able
// to select those accounts they want to send to specifically like in broadcast"; #288 the Gmail look).
// The same audience as the broadcast picker (afc_auth/audience.py): Everyone, or the UNION of picked
// teams (roster + owner), picked players and the category filters, which narrow each other. Email
// news adds consent: only people who said yes receive it, so the line under the To row counts who
// will get it and names every picked team or player that will not, with the reason.
//
// CALLS: GET team/search-teams/ and auth/search-users/ (the same searches TeamSearchSelect and
// UserSearchSelect use), GET auth/admin/broadcast-audience/options/ (filter values with counts,
// lib/broadcastAudience.ts), POST mail/audience/ (counts, left out, picked names; lib/mailApi.ts).
// OWNER: components/mail/Composer.tsx (keeps the spec, saves it with the draft).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";

import { useTierLabel } from "@/components/rankings/TierBadge";
import { useAuth } from "@/contexts/AuthContext";
import { broadcastAudienceApi, type AudienceOption, type AudienceOptions } from "@/lib/broadcastAudience";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";
import { formatNumber } from "@/lib/i18n/number";
import { mailAdmin, type AudienceAnswer, type AudienceSpec, type Picked } from "@/lib/mailApi";

type Hit = Picked & { note?: string };
type Category = "tiers" | "countries" | "roles" | "languages";
const CATEGORIES: Category[] = ["tiers", "countries", "roles", "languages"];

export function ToLine({
  spec,
  onChange,
  onCount,
}: {
  spec: AudienceSpec;
  onChange: (next: AudienceSpec) => void;
  /** How many will get it (null while counting), for the Send button. */
  onCount: (n: number | null) => void;
}) {
  const t = useTranslations("emailNews");
  const tierLabel = useTierLabel();
  const { token } = useAuth();
  const [names, setNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [answer, setAnswer] = useState<AudienceAnswer | null>(null);
  const [counting, setCounting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teamIds = spec.team_ids ?? [];
  const userIds = spec.user_ids ?? [];
  const nameOf = (kind: "team" | "player", id: number) => names[`${kind}:${id}`] ?? `#${id}`;

  // Filter values (with how many people each selects), once.
  useEffect(() => {
    if (!token) return;
    broadcastAudienceApi
      .options(token)
      .then(setOptions)
      .catch(() => setOptions(null));
  }, [token]);

  // The count and the left-out list follow the spec (debounced, one request at a time).
  const specKey = JSON.stringify(spec);
  useEffect(() => {
    const parsed = JSON.parse(specKey) as AudienceSpec;
    let alive = true;
    const timer = setTimeout(() => {
      setCounting(true);
      onCount(null);
      mailAdmin
        .audience(parsed)
        .then((a) => {
          if (!alive) return;
          setAnswer(a);
          onCount(a.recipients);
          setNames((n) => ({ ...n, ...Object.fromEntries(a.picked.map((p) => [`${p.kind}:${p.id}`, p.name])) }));
        })
        .catch(() => alive && setAnswer(null))
        .finally(() => alive && setCounting(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // onCount is the composer's state setter, stable for the composer's lifetime.
  }, [specKey, onCount]);

  // One search for teams and players, as one list.
  const search = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const params = { q: q.trim(), limit: 5 };
      const [teams, players] = await Promise.all([
        axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/search-teams/`, { headers: authHeaders(), params }).then((r) => r.data?.results ?? []).catch(() => []),
        axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/search-users/`, { headers: authHeaders(), params }).then((r) => r.data?.results ?? []).catch(() => []),
      ]);
      setHits([
        ...teams.filter((x: { team_id: number }) => !teamIds.includes(x.team_id)).map((x: { team_id: number; team_name: string; country?: string }) => ({
          kind: "team" as const,
          id: x.team_id,
          name: x.team_name,
          note: x.country ? `${t("kind.team")}, ${x.country}` : t("kind.team"),
        })),
        ...players.filter((x: { user_id: number }) => !userIds.includes(x.user_id)).map((x: { user_id: number; username: string }) => ({
          kind: "player" as const,
          id: x.user_id,
          name: x.username,
          note: t("kind.player"),
        })),
      ]);
      setOpen(true);
    }, 300);
  };

  const add = (h: Hit) => {
    setNames((n) => ({ ...n, [`${h.kind}:${h.id}`]: h.name }));
    if (h.kind === "team") onChange({ ...spec, team_ids: [...teamIds, h.id] });
    else onChange({ ...spec, user_ids: [...userIds, h.id] });
    setQuery("");
    setHits([]);
    setOpen(false);
  };
  const removeLast = () => {
    if (userIds.length) onChange({ ...spec, user_ids: userIds.slice(0, -1) });
    else if (teamIds.length) onChange({ ...spec, team_ids: teamIds.slice(0, -1) });
  };
  const toggle = (cat: Category, value: string) => {
    const now = spec[cat] ?? [];
    onChange({ ...spec, [cat]: now.includes(value) ? now.filter((v) => v !== value) : [...now, value] });
  };
  const filterCount = CATEGORIES.reduce((n, c) => n + (spec[c]?.length ?? 0), 0);
  const left = answer?.left_out ?? [];

  const chip = (key: string, label: string, kind: string | null, onRemove: () => void) => (
    <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-1 pl-3 text-sm">
      {label}
      {kind && <span className="text-xs text-muted-foreground">{kind}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("removeName", { name: label })}
        className="grid size-6 place-items-center rounded-full bg-background text-sm leading-none hover:bg-background/70"
      >
        {String.fromCharCode(215)}
      </button>
    </span>
  );

  const filterChips = (cat: Category, values: AudienceOption[]) => (
    <div key={cat} className="grid gap-1.5">
      <p className="text-xs font-medium">{t(`filters.${cat}`)}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-xs text-muted-foreground">{t("filters.none")}</span>}
        {values.map((o) => {
          const on = (spec[cat] ?? []).includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(cat, o.value)}
              className={`rounded-full px-3 py-1 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
            >
              {cat === "tiers" ? tierLabel(o.value) : (o.label ?? o.value)} <span className="opacity-70">{formatNumber(o.count)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-12 flex-wrap items-center gap-2.5 rounded-md bg-background px-3 py-1.5">
        <span className="w-auto shrink-0 text-sm text-muted-foreground sm:w-20">{t("to")}</span>
        <div className="flex min-w-44 flex-1 flex-wrap items-center gap-1.5">
          {spec.everyone
            ? chip("everyone", t("everyoneChip"), null, () => onChange({ ...spec, everyone: false }))
            : [
                ...teamIds.map((id) => chip(`t${id}`, nameOf("team", id), t("kind.teamShort"), () => onChange({ ...spec, team_ids: teamIds.filter((x) => x !== id) }))),
                ...userIds.map((id) => chip(`p${id}`, nameOf("player", id), null, () => onChange({ ...spec, user_ids: userIds.filter((x) => x !== id) }))),
              ]}
          {!spec.everyone && (
            <div className="relative min-w-40 flex-1">
              <input
                value={query}
                onChange={(e) => search(e.target.value)}
                onFocus={() => hits.length && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && hits[0]) {
                    e.preventDefault();
                    add(hits[0]);
                  }
                  if (e.key === "Backspace" && !query) removeLast();
                }}
                placeholder={t("toSearch")}
                aria-label={t("toSearch")}
                role="combobox"
                aria-expanded={open}
                aria-controls="mail-to-list"
                autoComplete="off"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              />
              {open && hits.length > 0 && (
                <div id="mail-to-list" role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-auto rounded-md bg-card p-1 shadow-lg">
                  {hits.map((h) => (
                    <button
                      key={`${h.kind}${h.id}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(h)}
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span>{h.name}</span>
                      <span className="text-xs text-muted-foreground">{h.note}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            aria-pressed={!!spec.everyone}
            onClick={() => onChange({ ...spec, everyone: !spec.everyone })}
            className={`h-9 rounded-full px-3 text-sm font-semibold ${spec.everyone ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          >
            {t("everyone")}
          </button>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="mail-filters"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`h-9 rounded-full px-3 text-sm font-semibold ${filtersOpen ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          >
            {filterCount ? t("filtersN", { n: filterCount }) : t("filters.button")}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div id="mail-filters" className="grid gap-3 rounded-md bg-background p-3">
          {options ? CATEGORIES.map((c) => filterChips(c, options[c])) : <p className="text-xs text-muted-foreground">{t("loading")}</p>}
          <p className="text-xs text-muted-foreground">{t("filters.help")}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 px-1 text-sm text-muted-foreground" role="status">
        {counting ? (
          <span>{t("count.loading")}</span>
        ) : !answer || (!spec.everyone && answer.selected === 0) ? (
          <span>{t("count.pick")}</span>
        ) : spec.everyone ? (
          <span>
            {t.rich("count.everyone", { yes: formatNumber(answer.recipients), total: formatNumber(answer.selected), b: (c) => <b className="text-primary">{c}</b> })}
          </span>
        ) : (
          <span>
            {t.rich("count.some", { yes: formatNumber(answer.recipients), total: answer.selected, totalText: formatNumber(answer.selected), b: (c) => <b className="text-primary">{c}</b> })}
          </span>
        )}
        {!spec.everyone && left.length > 0 && (
          <button
            type="button"
            aria-expanded={leftOpen}
            aria-controls="mail-left-out"
            onClick={() => setLeftOpen((o) => !o)}
            className="text-gold underline underline-offset-4 hover:opacity-80"
          >
            {t("leftOut", { n: left.length })}
          </button>
        )}
      </div>
      {leftOpen && left.length > 0 && !spec.everyone && (
        <div id="mail-left-out" className="grid gap-1.5 rounded-md bg-background p-3">
          {left.map((row) => (
            <div key={`${row.kind}${row.id}`} className="flex flex-wrap justify-between gap-2 rounded-sm bg-muted px-3 py-2 text-sm">
              <span>{row.name}</span>
              <span className="text-gold">
                {row.kind === "player" ? t(`reason.${row.reason}`) : t("teamLeft", { left: row.left, total: row.total })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
