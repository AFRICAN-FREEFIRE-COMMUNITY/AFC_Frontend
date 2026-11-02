"use client";

/**
 * app/(user)/awards/_kol/KolAward.tsx - one award of a KOL Awards edition: its nominees as cards.
 *
 * ROUTE: /awards/<edition>/<award>. The award is a PollQuestion (slug = question.slug); the cards are
 * its PollOptions. Each card links to the nominee's own page and, while voting is open, carries the
 * Vote button that opens the shared sheet (KolVoteSheet). The viewer's pick is stamped on its card;
 * once winners are public the published winner gets the crown and the WINNER stamp. Before then the
 * page says the winner is revealed on the night. No vote count is drawn anywhere.
 */
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { useKol } from "./KolContext";
import { KolIcon } from "./icons";
import { SplitTitle, useReduceMotion } from "./KolMotion";
import { nomineePhoto, pad2, winnerFilm, winnerOf, type KolAward as Award, type KolNominee } from "./model";

const rich = {
  em: (c: React.ReactNode) => <em>{c}</em>,
  b: (c: React.ReactNode) => <b>{c}</b>,
};

export function KolAward({ awardSlug }: { awardSlug: string }) {
  const t = useTranslations("awardsKol");
  const { model, slug } = useKol();
  const award = model.awards.find((a) => a.slug === awardSlug);
  if (!award) return <NotFound />;

  const { stage, awards } = model;
  const winner = winnerOf(award);
  // Winners phase: the award page is led by its winner, and the others follow undimmed (no counts).
  const leadWinner = stage === "winners" && !!winner;
  const others = leadWinner ? award.nominees.filter((n) => n.option_id !== winner!.option_id) : award.nominees;
  const canVote = stage === "voting" && award.accepting;

  let notice: React.ReactNode = null;
  if (stage === "announced") notice = t.rich("award.noticeAnnounced", rich);
  else if (stage === "counting") notice = t.rich("award.noticeCounting", rich);
  else if (stage === "winners" && !winner) notice = t("award.noticeWinnersPending");

  return (
    <>
      <section className="cat-hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
        <img className="bgimg" alt="" src="/kol/bg-purple.webp" />
        <div className="wrap">
          <Link className="back" href={`/awards/${slug}`}>
            <KolIcon name="back" />
            {t("back")}
          </Link>
          <p className="eyebrow">{t("awardOf", { n: pad2(award.number), total: pad2(awards.length) })}</p>
          <SplitTitle as="h1" className="t2" label={award.question.prompt} delay={0.15} style={{ marginTop: 8 }}>
            {award.question.prompt}
          </SplitTitle>
          {award.question.help_text && <p className="sub" style={{ color: "var(--body)" }}>{award.question.help_text}</p>}
          {stage === "voting" && (
            <div className="ballot">
              <span className="segs">
                {awards.map((a) => (
                  <i key={a.slug} className={a.myPickId ? "on" : ""} />
                ))}
              </span>
              <span>{t("award.ballot", { done: model.picked, total: awards.length })}</span>
            </div>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}
        </div>
      </section>

      {leadWinner && <WinnerBlock award={award} winner={winner!} />}

      <div className="wrap">
        {leadWinner && others.length > 0 && <p className="eyebrow" style={{ marginTop: 40 }}>{t("award.nomineesHeading")}</p>}
        {award.nominees.length === 0 ? (
          <p className="empty">{t("award.noNominees")}</p>
        ) : (
          <div className="noms">
            {others.map((n, i) => (
              <NomineeCard key={n.option_id} award={award} nominee={n} index={i} canVote={canVote} />
            ))}
          </div>
        )}
        <div className="cat-nav">
          {awards.map((a) => (
            <Link key={a.slug} className={`chip${a.slug === award.slug ? " on" : ""}`} href={`/awards/${slug}/${a.slug}`}>
              {a.question.prompt}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function NomineeCard({ award, nominee, index, canVote }: { award: Award; nominee: KolNominee; index: number; canVote: boolean }) {
  const t = useTranslations("awardsKol");
  const { slug, openSheet, model } = useKol();
  const reduce = useReduceMotion();
  const photo = nomineePhoto(nominee);
  const picked = award.myPickId === nominee.option_id && model.stage !== "announced";
  const isWinner = award.winnerId === nominee.option_id;
  // The winner leads the page in its own block and the rest stay undimmed.
  const dim = false;
  const href = `/awards/${slug}/${award.slug}/${nominee.slug}`;
  const hasFilm = !!nominee.film_url;

  return (
    <motion.article
      className={`nom${picked || isWinner ? " picked" : ""}${isWinner ? " winner" : ""}${dim ? " dim" : ""}`}
      initial={reduce ? false : { opacity: 0, y: 60, rotate: ((index * 37) % 17) - 8 }}
      animate={{ opacity: dim ? 0.38 : 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 20, delay: 0.25 + index * 0.08 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
      <img className="crownw" alt="" src="/kol/crown-yellow.webp" />
      <Link className="photo" href={href} aria-label={nominee.label}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
          <img alt="" src={photo} width={250} height={312} />
        ) : (
          <span className="typecard"><span>{nominee.label}</span></span>
        )}
        <span className="tape" />
      </Link>
      <span className="stamp">{isWinner ? t("award.winner") : t("award.yourPick")}</span>
      <h3>{nominee.label}</h3>
      <p className="role">{hasFilm ? t("award.roleFilm", { award: award.question.prompt }) : t("award.role", { award: award.question.prompt })}</p>
      <div className="acts">
        <Link className="btn l sm" href={href}>{hasFilm ? t("award.watch") : t("award.profile")}</Link>
        {canVote && (
          <button className={`btn ${picked ? "d" : "y"} sm`} onClick={() => openSheet(award, nominee)}>
            {picked ? t("award.yourPick") : t("award.vote")}
          </button>
        )}
      </div>
    </motion.article>
  );
}

/** The winner of an award, large: crown, WINNER stamp low on the photo, name, film link, share. */
function WinnerBlock({ award, winner }: { award: Award; winner: KolNominee }) {
  const t = useTranslations("awardsKol");
  const { slug } = useKol();
  const photo = nomineePhoto(winner);
  const href = `/awards/${slug}/${award.slug}/${winner.slug}`;
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      toast(t("nominee.shared"));
    } catch {
      toast(`${window.location.origin}${href}`);
    }
  };
  return (
    <section className="wrap wblock">
      <Link className="wphoto" href={href} aria-label={winner.label}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
          <img alt="" src={photo} width={250} height={312} />
        ) : (
          <span className="typecard"><span>{winner.label}</span></span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
        <img className="wcrown" alt="" src="/kol/crown-yellow.webp" />
        <span className="stamp">{t("award.winner")}</span>
      </Link>
      <div className="wb-info">
        <p className="eyebrow">{t("award.winnerEyebrow", { award: award.question.prompt })}</p>
        <h2 className="t1">{winner.label}</h2>
        <p className="sub" style={{ color: "var(--body)" }}>{t("award.revealed")}</p>
        <div className="acts">
          <Link className="btn y" href={href}>{winnerFilm(winner) ? t("award.winnerFilm") : t("award.winnerPage")}</Link>
          <button className="btn l" onClick={() => void share()}>
            <KolIcon name="share" />
            {t("award.share")}
          </button>
        </div>
      </div>
    </section>
  );
}

export function NotFound() {
  const t = useTranslations("awardsKol");
  const { slug } = useKol();
  return (
    <section className="cat-hero">
      <div className="wrap">
        <h1 className="t2">{t("notFound.title")}</h1>
        <p className="sub">{t("notFound.body")}</p>
        <p style={{ marginTop: 22 }}>
          <Link className="btn y" href={`/awards/${slug}`}>{t("back")}</Link>
        </p>
      </div>
    </section>
  );
}
