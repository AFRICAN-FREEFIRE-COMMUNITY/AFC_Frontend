"use client";

/**
 * app/(user)/awards/_kol/KolWinners.tsx - the winners page of a themed edition (inbox #430; round 5 of
 * mockups/kol-awards, "the winners look", approved 11 Nov 2026, inbox #445 #537).
 *
 * ROUTE: /awards/<edition>/winners. Once the winners are out, everything a winner touches changes colour world: from the
 * Detty purple of the vote to the trophy's own materials, gold on black (.kol-win in kol.css). The hero (title, trophy,
 * gold crown), a board of every winner, then one band per winner, sides alternating, whose sealed envelope tears open
 * the first time the band comes into view (reduced motion: already open), with the other nominees and the links; every
 * nominee thanked by name; then the hall of fame across seasons (KolHallOfFame). A winner is the award's PUBLISHED
 * winner (admin "Publish winner"), shown only once the edition's winners are public; before that the page says so in
 * words and draws no card. No vote counts anywhere.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useKol } from "./KolContext";
import { KolIcon } from "./icons";
import { KolHallOfFame } from "./KolHallOfFame";
import { SplitTitle, useReduceMotion } from "./KolMotion";
import { nomineePhoto, pad2, winnerFilm, winnerOf, type KolAward, type KolNominee } from "./model";

const rich = { em: (c: React.ReactNode) => <em>{c}</em> };

export function KolWinners() {
  const t = useTranslations("awardsKol");
  const { model, slug } = useKol();
  const year = model.detail.edition.year;
  const wins = model.awards.map((a) => ({ award: a, winner: winnerOf(a) })).filter((w) => !!w.winner);
  const everyone = [...new Set(model.awards.flatMap((a) => a.nominees.map((n) => n.label)))];

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="kol-win">
      <section className="whero">
        <div className="wrap">
          <Link className="back" href={`/awards/${slug}`}>
            <KolIcon name="back" />
            {t("winners.back")}
          </Link>
          <div className="whero-grid">
            <div>
              <p className="eyebrow">{year ? t("winners.eyebrow", { year }) : t("winners.eyebrowNoYear")}</p>
              <SplitTitle as="h1" className="t1" label={t("winners.label")} delay={0.15}>
                {t.rich("winners.title", rich)}
              </SplitTitle>
              {/* "N creators": people, not awards, so a creator who won twice is counted once. */}
              <p className="lede">{t("winners.sub", { count: new Set(wins.map((w) => w.winner!.label)).size })}</p>
              {wins.length > 0 && (
                <div className="acts">
                  <a className="btn g" href={`#w-${wins[0].award.slug}`} onClick={jump(`w-${wins[0].award.slug}`)}>
                    {t("winners.openEnvelopes")}
                  </a>
                  <a className="btn k" href="#hall" onClick={jump("hall")}>{t("winners.hallBtn")}</a>
                </div>
              )}
            </div>
            <div className="whero-art" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
              <img className="tro" alt="" src="/kol/three-quarter.webp" width={900} height={1200} />
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
              <img className="crown" alt="" src="/kol/crown-gold.webp" />
            </div>
          </div>
          {wins.length === 0 ? (
            <p className="empty">{t("winners.none")}</p>
          ) : (
            <ol className="board">
              {wins.map(({ award, winner }) => (
                <li key={award.slug}>
                  <a href={`#w-${award.slug}`} onClick={jump(`w-${award.slug}`)}>
                    <span className="no">{pad2(award.number)}</span>
                    <Face n={winner!} w={56} h={70} />
                    <span>
                      <span className="aw">{award.question.prompt}</span>
                      <span className="nm">{winner!.label}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {wins.map(({ award, winner }, i) => (
        <WinnerBand key={award.slug} award={award} winner={winner!} alt={i % 2 === 1} slug={slug} />
      ))}

      {everyone.length > 0 && (
        <div className="wrap all-noms">
          <p className="eyebrow">{t("winners.everyone")}</p>
          <SplitTitle className="t2" inView label={t("winners.thanksLabel", { count: everyone.length })}>
            {t.rich("winners.thanks", { ...rich, count: everyone.length })}
          </SplitTitle>
          <div className="row">
            {everyone.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
      )}

      <KolHallOfFame />
    </div>
  );
}

function Face({ n, w, h }: { n: KolNominee; w: number; h: number }) {
  const photo = nomineePhoto(n);
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
    <img alt="" src={photo} width={w} height={h} />
  ) : (
    <span className="ini">{(n.label || "?").slice(0, 1)}</span>
  );
}

/** One winner's band. The envelope (two gold halves over the photo) tears open the first time the band is in view. */
function WinnerBand({ award, winner, alt, slug }: { award: KolAward; winner: KolNominee; alt: boolean; slug: string }) {
  const t = useTranslations("awardsKol");
  const reduce = useReduceMotion();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (reduce) {
      setOpen(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOpen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setOpen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -38% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const photo = nomineePhoto(winner);
  const others = award.nominees.filter((n) => n.option_id !== winner.option_id);
  const page = `/awards/${slug}/${award.slug}/${winner.slug}`;
  const share = async () => {
    const url = `${window.location.origin}${page}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("sheet.done.shared"));
    } catch {
      toast(url);
    }
  };

  return (
    <section ref={ref} className={`wband${alt ? " alt" : ""}${open ? " open" : ""}`} id={`w-${award.slug}`}>
      <div className="wrap wband-grid">
        <Link className="wstage" href={page} aria-label={t("winners.stageLabel", { name: winner.label, award: award.question.prompt })}>
          <span className="gb" />
          <span className="ph">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
              <img alt="" src={photo} width={300} height={375} />
            ) : (
              <span className="wtc"><span>{winner.label}</span></span>
            )}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
          <img className="wcrown" alt="" src="/kol/crown-gold.webp" />
          <span className="stamp gold">{t("winners.stamp")}</span>
          <span className="env" aria-hidden="true">
            <i className="ea"><span>{t("winners.envelopeTop")}</span></i>
            <i className="eb"><span>{award.question.prompt}</span></i>
          </span>
        </Link>
        <div className="winfo">
          <span className="no">{pad2(award.number)}</span>
          <p className="eyebrow">{award.question.prompt}</p>
          <h2 className="t1">{winner.label}</h2>
          <p className="beat">{t("winners.beat", { count: award.nominees.length })}</p>
          {others.length > 0 && (
            <>
              <p className="also-h">{t("winners.alsoNominated")}</p>
              <div className="also">
                {others.map((n) => (
                  <span key={n.option_id}>{n.label}</span>
                ))}
              </div>
            </>
          )}
          <div className="acts">
            <Link className="btn g" href={page}>{winnerFilm(winner) ? t("winners.filmBtn") : t("winners.pageBtn")}</Link>
            <Link className="btn k" href={`/awards/${slug}/${award.slug}`}>{t("winners.awardBtn")}</Link>
            <button className="btn k" onClick={() => void share()}>
              <KolIcon name="share" />
              {t("winners.share")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
