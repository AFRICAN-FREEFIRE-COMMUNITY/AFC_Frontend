"use client";

/**
 * app/(user)/awards/_kol/KolNominateAward.tsx - ONE award on the creators' nomination ballot (inbox #633 / #634).
 *
 * Up to `award.max` (6) picks, searchable by name or @handle, country shown beside each name. The creator never
 * appears here: the server leaves them out of `candidates` and refuses a self-pick anyway (AFC-B
 * afc_polls/kol_nominations.py). No counts of any kind: nobody sees how others voted.
 *
 * Picked creators sit on top as filled chips (tap to remove); the list below shows the first LIST_LIMIT
 * candidates until the creator searches or asks for all, so 108 names do not make a phone page endless.
 *
 * CONSUMED BY KolNominate.tsx, which owns the picks and the saving.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { NominationCandidate } from "@/lib/kolNominations";

const LIST_LIMIT = 8;
// The multiplication sign on a chip's remove mark, built from its code point (the repo's dash guard reads raw
// bytes and mistakes this character for a dash).
const TIMES = String.fromCharCode(215);

function matches(candidate: NominationCandidate, query: string) {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!q) return true;
  return candidate.name.toLowerCase().includes(q) || candidate.handle.toLowerCase().includes(q);
}

export function KolNominateAward({
  index,
  award,
  candidates,
  picked,
  readOnly,
  onChange,
}: {
  index: number;
  award: { question_id: number; name: string; max: number };
  candidates: NominationCandidate[];
  picked: number[];
  readOnly: boolean;
  onChange: (next: number[]) => void;
}) {
  const t = useTranslations("awardsKol");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.creator_id, c])), [candidates]);
  const pickedSet = new Set(picked);
  const full = picked.length >= award.max;
  const rest = candidates.filter((c) => !pickedSet.has(c.creator_id) && matches(c, query));
  const shown = query || showAll ? rest : rest.slice(0, LIST_LIMIT);
  const headingId = `kol-nom-award-${award.question_id}`;

  const toggle = (id: number) => {
    if (readOnly) return;
    if (pickedSet.has(id)) onChange(picked.filter((p) => p !== id));
    else if (!full) onChange([...picked, id]);
  };

  return (
    <section className="nom-award" aria-labelledby={headingId}>
      <header className="nom-award-head">
        <span className="nom-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <h2 id={headingId} className="nom-award-name">{award.name}</h2>
        <span className={`nom-count${full ? " full" : ""}`}>{t("nominate.count", { n: picked.length, max: award.max })}</span>
      </header>

      {picked.length > 0 && (
        <ul className="nom-picked" aria-label={t("nominate.yourPicks")}>
          {picked.map((id) => {
            const c = byId.get(id);
            if (!c) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  className="nom-chip"
                  onClick={() => toggle(id)}
                  disabled={readOnly}
                  aria-label={readOnly ? c.name : t("nominate.remove", { name: c.name })}
                >
                  <span className="nm">{c.name}</span>
                  {!readOnly && <span className="x" aria-hidden="true">{TIMES}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <>
          <label className="sr" htmlFor={`${headingId}-q`}>{t("nominate.search")}</label>
          <input
            id={`${headingId}-q`}
            className="nom-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={t("nominate.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {full && <p className="nom-full">{t("nominate.full", { max: award.max })}</p>}
          <ul className="nom-list">
            {shown.map((c) => (
              <li key={c.creator_id}>
                <button type="button" className="nom-row" onClick={() => toggle(c.creator_id)} disabled={full}>
                  <span className="nm">{c.name}</span>
                  <span className="hd">@{c.handle}</span>
                  {c.country && <span className="ct">{c.country}</span>}
                </button>
              </li>
            ))}
          </ul>
          {query && rest.length === 0 && <p className="nom-empty">{t("nominate.noMatch", { q: query.trim() })}</p>}
          {!query && !showAll && rest.length > LIST_LIMIT && (
            <button type="button" className="btn d sm nom-more" onClick={() => setShowAll(true)}>
              {t("nominate.showAll", { n: rest.length })}
            </button>
          )}
        </>
      )}
      {readOnly && picked.length === 0 && <p className="nom-empty">{t("nominate.noneHere")}</p>}
    </section>
  );
}
