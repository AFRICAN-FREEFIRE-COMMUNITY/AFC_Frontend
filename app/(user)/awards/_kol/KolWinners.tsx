"use client";

/**
 * app/(user)/awards/_kol/KolWinners.tsx - the winners page of a themed edition (inbox #430).
 *
 * ROUTE: /awards/<edition>/winners. Six winner cards (award tag, torn photo with the crown, name, a
 * "Winner film" or "Winner's page" link, "The award" link), then every nominee thanked by name. A
 * winner is the award's PUBLISHED winner (admin "Publish winner"), shown only once the edition's
 * winners are public; before that the page says so in words and draws no card. No counts anywhere.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useKol } from "./KolContext";
import { KolIcon } from "./icons";
import { Reveal, SplitTitle } from "./KolMotion";
import { nomineePhoto, pad2, winnerFilm, winnerOf } from "./model";

const rich = { em: (c: React.ReactNode) => <em>{c}</em> };

export function KolWinners() {
  const t = useTranslations("awardsKol");
  const { model, slug } = useKol();
  const year = model.detail.edition.year;
  const wins = model.awards.map((a) => ({ award: a, winner: winnerOf(a) })).filter((w) => !!w.winner);
  const everyone = [...new Set(model.awards.flatMap((a) => a.nominees.map((n) => n.label)))];

  return (
    <>
      <section className="cat-hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
        <img className="bgimg" alt="" src="/kol/bg-purple.webp" />
        <div className="wrap">
          <Link className="back" href={`/awards/${slug}`}>
            <KolIcon name="back" />
            {t("winners.back")}
          </Link>
          <p className="eyebrow">{year ? t("winners.eyebrow", { year }) : t("winners.eyebrowNoYear")}</p>
          <SplitTitle as="h1" className="t2" label={t("winners.label")} delay={0.15} style={{ marginTop: 8 }}>
            {t.rich("winners.title", rich)}
          </SplitTitle>
          <p className="sub" style={{ color: "var(--body)" }}>{t("winners.sub", { count: wins.length })}</p>
        </div>
      </section>

      <div className="wrap">
        {wins.length === 0 ? (
          <p className="empty">{t("winners.none")}</p>
        ) : (
          <div className="wins">
            {wins.map(({ award, winner }, i) => {
              const n = winner!;
              const photo = nomineePhoto(n);
              return (
                <Reveal as="div" key={award.slug} kind="stamp" delay={0.1 * i} className="win">
                  <span className="wtag">{pad2(award.number)} · {award.question.prompt}</span>
                  <Link className="wphoto" href={`/awards/${slug}/${award.slug}/${n.slug}`} aria-label={n.label}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
                      <img alt="" src={photo} width={250} height={312} />
                    ) : (
                      <span className="typecard"><span>{n.label}</span></span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
                    <img className="wcrown" alt="" src="/kol/crown-yellow.webp" />
                  </Link>
                  <h3>{n.label}</h3>
                  <div className="acts">
                    <Link className="btn y sm" href={`/awards/${slug}/${award.slug}/${n.slug}`}>
                      {winnerFilm(n) ? t("winners.filmBtn") : t("winners.pageBtn")}
                    </Link>
                    <Link className="btn l sm" href={`/awards/${slug}/${award.slug}`}>{t("winners.awardBtn")}</Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
        {everyone.length > 0 && (
          <div className="all-noms">
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
      </div>
    </>
  );
}
