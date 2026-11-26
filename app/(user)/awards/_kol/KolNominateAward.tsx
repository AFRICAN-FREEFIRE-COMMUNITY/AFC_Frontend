"use client";

/**
 * app/(user)/awards/_kol/KolNominateAward.tsx - ONE award on the creators' nomination ballot (inbox #633 / #634,
 * write-ins and self-picks #636 / #637).
 *
 * Up to `award.max` (6) picks, searchable by name or @handle, country shown beside each name. Under the title, what
 * the award means (#638), written per award key in awardsKol.nominate.awardHelp (the admin tab reads the same text). The creator is on
 * their own list (owner, 26 Nov 2026: "they should be able to nominate themselves now"), tagged "You". No counts of
 * any kind: nobody sees how others voted.
 *
 * SOMEONE NOT ON THE LIST (#637: "creators can add and nominate anybody"): "Add them" opens a small form, a TikTok
 * @handle (or profile link) and an optional name. The parent (KolNominate.addWriteIn) asks the server, which answers
 * the candidate this handle is in the round (made now when nobody had it), and picks them; the person then shows on
 * every creator's list, labelled "added by a creator" and never with who added them. One person never twice in one
 * award: a handle already picked here answers "already in your picks".
 *
 * Picked creators sit on top as filled chips (tap to remove); the list below shows the first LIST_LIMIT
 * candidates until the creator searches or asks for all, so 108 names do not make a phone page endless.
 *
 * CONSUMED BY KolNominate.tsx, which owns the picks, the saving and the write-in call.
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
  meId,
  readOnly,
  onChange,
  onAdd,
}: {
  index: number;
  award: { question_id: number; name: string; key: string; max: number };
  candidates: NominationCandidate[];
  picked: number[];
  meId: number;
  readOnly: boolean;
  onChange: (next: number[]) => void;
  // Resolves to a sentence to show under the form (a refusal, "already picked"), or null when the person was picked.
  onAdd: (handle: string, name: string) => Promise<string | null>;
}) {
  const t = useTranslations("awardsKol");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState("");

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

  const openAdd = () => {
    setHandle(query.trim());
    setName("");
    setAddError("");
    setAdding(true);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || busy) return;
    setBusy(true);
    setAddError("");
    const problem = await onAdd(handle, name);
    setBusy(false);
    if (problem) {
      setAddError(problem);
      return;
    }
    setAdding(false);
    setQuery("");
  };

  return (
    <section className="nom-award" aria-labelledby={headingId}>
      <header className="nom-award-head">
        <span className="nom-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <h2 id={headingId} className="nom-award-name">{award.name}</h2>
        <span className={`nom-count${full ? " full" : ""}`}>{t("nominate.count", { n: picked.length, max: award.max })}</span>
      </header>
      {award.key && t.has(`nominate.awardHelp.${award.key}`) && (
        <p className="nom-award-help">{t(`nominate.awardHelp.${award.key}`)}</p>
      )}

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
                  <span className="hd">
                    {c.write_in ? t("nominate.handleAdded", { handle: c.handle }) : `@${c.handle}`}
                  </span>
                  {c.creator_id === meId ? (
                    <span className="ct you">{t("nominate.you")}</span>
                  ) : (
                    c.country && <span className="ct">{c.country}</span>
                  )}
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

          {!full && !adding && (
            <button type="button" className="nom-link nom-add-open" onClick={openAdd}>
              {query.trim() && rest.length === 0 ? t("nominate.add.openWith", { q: query.trim() }) : t("nominate.add.open")}
            </button>
          )}
          {!full && adding && (
            <form className="nom-add" onSubmit={submitAdd}>
              <label className="nom-label sm" htmlFor={`${headingId}-h`}>{t("nominate.add.handleLabel")}</label>
              <input
                id={`${headingId}-h`}
                className="nom-search"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={t("nominate.add.handlePlaceholder")}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
              <label className="nom-label sm" htmlFor={`${headingId}-n`}>{t("nominate.add.nameLabel")}</label>
              <input
                id={`${headingId}-n`}
                className="nom-search"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoComplete="off"
              />
              <p className="err-line" role="alert">{addError}</p>
              <div className="nom-add-actions">
                <button type="submit" className="btn y sm" disabled={busy || !handle.trim()}>
                  {busy ? t("nominate.add.adding") : t("nominate.add.submit")}
                </button>
                <button type="button" className="btn d sm" onClick={() => setAdding(false)} disabled={busy}>
                  {t("nominate.add.cancel")}
                </button>
              </div>
              <p className="nom-help">{t("nominate.add.help")}</p>
            </form>
          )}
        </>
      )}
      {readOnly && picked.length === 0 && <p className="nom-empty">{t("nominate.noneHere")}</p>}
    </section>
  );
}
