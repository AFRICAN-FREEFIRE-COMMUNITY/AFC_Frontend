"use client";

/**
 * app/(user)/awards/_kol/KolNominee.tsx - one nominee of a KOL Awards edition.
 *
 * ROUTE: /awards/<edition>/<award>/<nominee>. Layout (owner, 2 Nov 2026, #424): the name header on
 * top, then the nominee's film, LANDSCAPE 16:9, beside an info column (1.65fr to 1fr); the two stack
 * on phones. The film is the file an admin uploaded for this nominee (PollOption.film, served as
 * `film_url`); a nominee without one gets a written "Film coming" panel, never a stock clip.
 *
 * The info column shows the picture, every award this person is nominated in, a link to their AFC
 * profile when the nominee is linked to one, the description an admin wrote, and the Vote and Share
 * buttons. "Also in <award>" lists the other nominees of the same award.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useKol } from "./KolContext";
import { KolIcon } from "./icons";
import { Reveal, SplitTitle } from "./KolMotion";
import { NotFound } from "./KolAward";
import { awardsOfNominee, nomineePhoto } from "./model";

export function KolNominee({ awardSlug, nomineeSlug }: { awardSlug: string; nomineeSlug: string }) {
  const t = useTranslations("awardsKol");
  const { model, slug, openSheet } = useKol();
  const award = model.awards.find((a) => a.slug === awardSlug);
  const nominee = award?.nominees.find((n) => n.slug === nomineeSlug);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  if (!award || !nominee) return <NotFound />;

  const photo = nomineePhoto(nominee);
  const picked = award.myPickId === nominee.option_id;
  const canVote = model.stage === "voting" && award.accepting;
  const others = award.nominees.filter((n) => n.option_id !== nominee.option_id);
  const nominatedIn = awardsOfNominee(model, nominee);
  const profile = nominee.linked?.profile_url;

  const play = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false;
    v.controls = true;
    void v.play();
    setPlaying(true);
  };
  const share = async () => {
    const url = `${window.location.origin}/awards/${slug}/${award.slug}/${nominee.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("nominee.shared"));
    } catch {
      toast(url);
    }
  };

  return (
    <section className="nom-page">
      <div className="wrap">
        <Link className="back" href={`/awards/${slug}/${award.slug}`}>
          <KolIcon name="back" />
          {award.question.prompt}
        </Link>
        <div className="np-info np-head">
          <p className="eyebrow">{t("nominee.eyebrow", { award: award.question.prompt })}</p>
          <SplitTitle as="h1" className="t1" label={nominee.label} delay={0.15}>
            {nominee.label}
          </SplitTitle>
        </div>

        <div className="np-grid">
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>{t("nominee.filmEyebrow")}</p>
            <div className={`film${playing ? " playing" : ""}`}>
              {nominee.film_url ? (
                <>
                  <video
                    ref={video}
                    playsInline
                    preload="metadata"
                    src={nominee.film_url}
                    onEnded={() => {
                      setPlaying(false);
                      if (video.current) video.current.controls = false;
                    }}
                  />
                  <button className="play" onClick={play} aria-label={t("nominee.play", { name: nominee.label })}>
                    <i><KolIcon name="play" /></i>
                  </button>
                </>
              ) : (
                <div className="nofilm">
                  <p>
                    <b>{t("nominee.noFilmTitle")}</b>
                    {t("nominee.noFilmBody", { name: nominee.label })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="np-info np-side">
            <div className="np-row">
              {photo && (
                <Reveal kind="sticker" className="np-sticker">
                  {/* eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list */}
                  <img alt={nominee.label} src={photo} width={200} height={250} />
                </Reveal>
              )}
              <div className="np-facts">
                <h3>{t("nominee.nominatedIn")}</h3>
                <div className="tags">
                  {nominatedIn.map((a) => (
                    <Link key={a.slug} className="chip" href={`/awards/${slug}/${a.slug}`}>
                      {a.question.prompt}
                    </Link>
                  ))}
                </div>
                {nominee.description && (
                  <>
                    <h3>{t("nominee.about")}</h3>
                    <p style={{ marginTop: 6 }}>{nominee.description}</p>
                  </>
                )}
                {profile && (
                  <>
                    <h3>{t("nominee.theirProfile")}</h3>
                    <p style={{ marginTop: 6 }}>
                      <Link href={profile} style={{ color: "var(--yel)", fontWeight: 700 }}>{t("nominee.viewProfile")}</Link>
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="np-acts">
              {canVote && (
                <button className={`btn ${picked ? "d" : "y"}`} onClick={() => openSheet(award, nominee)}>
                  {picked ? t("nominee.yourPickIn", { award: award.question.prompt }) : t("nominee.voteFor", { name: nominee.label })}
                </button>
              )}
              <button className="btn l" onClick={() => void share()}>
                <KolIcon name="share" />
                {t("nominee.share")}
              </button>
            </div>
            {model.stage === "counting" && <p className="notice">{t("nominee.closedNotice")}</p>}
          </div>
        </div>

        {others.length > 0 && (
          <div className="others">
            <p className="eyebrow">{t("nominee.alsoIn", { award: award.question.prompt })}</p>
            <div className="row">
              {others.map((n) => {
                const p = nomineePhoto(n);
                return (
                  <Link key={n.option_id} href={`/awards/${slug}/${award.slug}/${n.slug}`}>
                    {p ? (
                      // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
                      <img alt="" src={p} />
                    ) : (
                      <span className="tc">{n.label}</span>
                    )}
                    <b>{n.label}</b>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
