"use client";

/**
 * app/(user)/awards/_kol/KolLanding.tsx - the landing page of a Detty Royale KOL Awards edition.
 *
 * WHAT IT DRAWS (top to bottom, as in the approved mockup mockups/kol-awards/template.html):
 *   hero with the 3D trophy and the stage flag + countdown, the awards list, how to vote, the pinned
 *   "from list to stage" track, the trophy section (turned by scroll), how a winner is decided, the
 *   night, questions, and a sticky call-to-action bar.
 *
 * WHERE EVERYTHING COMES FROM
 *   Awards, nominees, photos, dates and the viewer's own picks come from the edition API (see
 *   KolContext + model.ts). The static copy (how it works, the 40/30/30 split, the trophy notes, the
 *   questions) is from the KOL Awards deck, Revision 3, and lives in messages/<locale>/awardsKol.json.
 *   No vote counts are shown anywhere and no sample data exists in this file.
 *
 * MOTION: arrival only, framer-motion, instant under prefers-reduced-motion (see KolMotion.tsx).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";

import { useKol } from "./KolContext";
import { KolIcon } from "./icons";
import { Reveal, SplitTitle, useReduceMotion } from "./KolMotion";
import { KolTrophy } from "./KolTrophy";
import { nomineePhoto, pad2, type KolAward, type Stage } from "./model";

/** The day the themed edition went live, for its NEW badge (5 days, expires by itself). */
const KOL_NEW_SINCE = "2026-11-02";

const rich = {
  em: (c: React.ReactNode) => <em>{c}</em>,
  b: (c: React.ReactNode) => <b>{c}</b>,
};

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Whole seconds until `iso`, ticking, or null before mount / without a date (the server cannot know). */
function useCountdown(iso: string | null | undefined): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [iso]);
  return iso && now !== null ? Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000)) : null;
}

function scrollToId(id: string, reduce: boolean | null) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: reduce ? "auto" : "smooth" });
}

export function KolLanding() {
  const t = useTranslations("awardsKol");
  const { model, slug } = useKol();
  const reduce = useReduceMotion();
  // The accessible name of a title: the message with its <em> markers taken off (t.raw is unformatted).
  const plain = (key: Parameters<typeof t.raw>[0]) => String(t.raw(key)).replace(/<\/?em>/g, "");
  const { edition } = model.detail;
  const { stage, awards } = model;
  const year = edition.year;
  const count = awards.length;

  // ── hero countdown: voting opens (before) or closes (during); nothing to count to otherwise ──
  const target = stage === "announced" ? edition.voting_opens_at : stage === "voting" ? edition.voting_closes_at : null;
  const left = useCountdown(target);
  const countdown =
    left === null ? null : (
      <>
        {stage === "announced" ? t("stage.opensIn") : t("stage.closesIn")}{" "}
        <b>{String(Math.floor(left / 86400)).padStart(2, "0")}</b>{t("stage.days")}{" "}
        <b>{String(Math.floor((left % 86400) / 3600)).padStart(2, "0")}</b>{t("stage.hours")}{" "}
        <b>{String(Math.floor((left % 3600) / 60)).padStart(2, "0")}</b>{t("stage.minutes")}{" "}
        <b>{String(left % 60).padStart(2, "0")}</b>{t("stage.seconds")}
      </>
    );
  const stageNote = stage === "counting" ? t("stage.counting") : stage === "winners" ? t("stage.winners") : countdown;

  // ── the sticky bar appears once the awards list has come into view, and can be dismissed ──
  const [ctaShown, setCtaShown] = useState(false);
  const [ctaClosed, setCtaClosed] = useState(false);
  useEffect(() => {
    // Read after mount (the server cannot know), in a timeout so no state is set during the effect.
    const read = window.setTimeout(() => {
      try {
        setCtaClosed(sessionStorage.getItem("kolCtaClosed") === "1");
      } catch {
        /* storage blocked: the bar simply shows */
      }
    }, 0);
    const onScroll = () => {
      const el = document.getElementById("awards");
      setCtaShown(!!el && el.getBoundingClientRect().top < window.innerHeight * 0.8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(read);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  const closeCta = () => {
    setCtaClosed(true);
    try {
      sessionStorage.setItem("kolCtaClosed", "1");
    } catch {
      /* ignore */
    }
  };

  // ── the trophy section turns the model with scroll and lights its notes one by one ──
  const trophyRef = useRef<HTMLElement>(null);
  const { scrollYProgress: trophyP } = useScroll({ target: trophyRef, offset: ["start 60%", "end 40%"] });
  const [turn, setTurn] = useState(0);
  useMotionValueEvent(trophyP, "change", (v) => setTurn(v));
  const callouts = ["c1", "c2", year ? "c3" : "c3NoYear"] as const;
  const litUpTo = Math.min(callouts.length - 1, Math.floor(turn * callouts.length));

  const ctaCopy: Record<Stage, { big: string; small: string; btn: string; to: string }> = {
    voting: { big: "cta.votingBig", small: "cta.votingSmall", btn: "cta.votingBtn", to: "awards" },
    announced: { big: "cta.announcedBig", small: "cta.announcedSmall", btn: "cta.announcedBtn", to: "awards" },
    counting: { big: "cta.countingBig", small: "cta.countingSmall", btn: "cta.countingBtn", to: "awards" },
    winners: { big: "cta.winnersBig", small: "", btn: "cta.winnersBtn", to: "awards" },
  };
  const cta = ctaCopy[stage];

  return (
    <>
      {/* ═════════════ HERO ═════════════ */}
      <section className="hero">
        <div className="hero-bg" />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public, drawn at its own size */}
        <img className="torn-c" alt="" src="/kol/torn-corner-c.webp" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <Reveal kind="pop" now as="img" className="dr-logo" src="/kol/logo-white.webp" alt={t("hero.logoAlt")} />
            <Reveal now delay={0.1} as="p" className="eyebrow">
              {year ? t("hero.eyebrow", { year }) : t("hero.eyebrowNoYear")}
              {" "}
              <NewBadge since={KOL_NEW_SINCE} />
            </Reveal>
            <SplitTitle as="h1" className="t1" label={edition.title} delay={0.3}>
              {edition.title}
            </SplitTitle>
            <Reveal now delay={0.8} as="p" className="lede">
              {edition.tagline || t("hero.lede")}
            </Reveal>
            <Reveal now delay={0.9} className="stagetag">
              <span className="flag">{t(`stage.flag.${stage === "announced" ? "announced" : stage}`)}</span>
              {stageNote && <span className="count" suppressHydrationWarning>{stageNote}</span>}
            </Reveal>
            <Reveal now delay={1} className="ctas">
              <button className="btn y" onClick={() => scrollToId("awards", reduce)}>
                {stage === "voting" ? t("hero.voteNow") : t("hero.seeNominees")}
              </button>
              <button className="btn l" onClick={() => scrollToId("how", reduce)}>{t("hero.how")}</button>
            </Reveal>
          </div>
          <div className="hero-art">
            <KolTrophy className="trophy-box" poster="/kol/low-hero.webp" alt={t("hero.trophyAlt")} label={t("hero.trophyCanvas")} intro />
            <Reveal kind="sticker" now delay={1.35} as="img" className="crown" src="/kol/crown-yellow.webp" />
            <Reveal kind="sticker" now delay={1.4} as="img" className="sparkles" src="/kol/sparkles-yellow.webp" />
            <Reveal kind="sticker" now delay={1.45} as="img" className="shards" src="/kol/shards-yellow.webp" />
            <Reveal now delay={0.9} as="p" className="drag-hint">{t("hero.drag")}</Reveal>
          </div>
        </div>
      </section>

      {/* ═════════════ THE AWARDS ═════════════ */}
      <section className="sec" id="awards">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <SplitTitle className="t2" inView label={year ? t("awards.label", { count, year }) : t("awards.titleNoYear", { count })}>
                {year ? t.rich("awards.title", { ...rich, count, year }) : t("awards.titleNoYear", { count })}
              </SplitTitle>
              <p className="sub">{t("awards.sub")}</p>
            </div>
            <Reveal kind="sticker" as="img" className="doodle" src="/kol/crown-gold.webp" />
          </div>
          {awards.length === 0 ? (
            <p className="empty">{t("awards.empty")}</p>
          ) : (
            <ol className="awards">
              {awards.map((a, i) => (
                <Reveal key={a.slug} as="li" kind={i % 2 ? "slide-r" : "slide-l"}>
                  <AwardRow award={a} stage={stage} editionSlug={slug} />
                </Reveal>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ═════════════ HOW TO VOTE ═════════════ */}
      <section className="sec" id="how" style={{ background: "var(--panel2)" }}>
        <div className="wrap">
          <div className="sec-head" style={{ justifyContent: "center", textAlign: "center" }}>
            <div>
              <SplitTitle className="t2" inView label={plain("how.title")}>
                {t.rich("how.title", rich)}
              </SplitTitle>
              <p className="sub" style={{ marginInline: "auto" }}>{model.needsUid ? t("how.subThree") : t("how.subTwo")}</p>
            </div>
          </div>
          <div className="gsteps">
            {(model.needsUid ? (["signin", "uid", "pick"] as const) : (["signin", "pick"] as const)).map((k, i, all) => (
              <div key={k} style={{ display: "contents" }}>
                <Reveal kind="stamp" className="gstep">
                  <div className="gbanner">
                    <span className="gnum">{i + 1}</span>
                    <span>{t(`how.${k}.title`)}</span>
                  </div>
                  <p className="gbody">{t.rich(`how.${k}.body`, rich)}</p>
                </Reveal>
                {i < all.length - 1 && (
                  <Reveal kind="drop" as="div">
                    <KolIcon name="chev" className="chev" />
                  </Reveal>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Track count={count} />

      {/* ═════════════ THE TROPHY ═════════════ */}
      <section className="sec trophy-sec" id="trophy" ref={trophyRef}>
        <div className="wrap trophy-grid">
          <div className="trophy-stage">
            <KolTrophy
              className="trophy-box"
              poster="/kol/three-quarter.webp"
              alt={t("hero.trophyAlt")}
              label={t("hero.trophyCanvas")}
              drag={false}
              angle={turn * Math.PI * 2 + 0.5}
            />
          </div>
          <div>
            <SplitTitle className="t2" inView label={plain("trophy.title")}>
              {t.rich("trophy.title", rich)}
            </SplitTitle>
            <p className="sub">{t("trophy.sub")}</p>
            <ul className="callouts" style={{ marginTop: 26 }}>
              {callouts.map((k, i) => (
                <li key={k} className={i <= litUpTo ? "on" : ""}>
                  <b>{t(`trophy.${k}.title`)}</b>
                  {t(`trophy.${k}.body`, { year: year ?? "" })}
                </li>
              ))}
            </ul>
            <ul className="diamonds">
              <li>{t("trophy.made", { count })}</li>
              <li>{t("trophy.everyone")}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ═════════════ HOW A WINNER IS DECIDED ═════════════ */}
      <section className="sec" id="decided" style={{ background: "var(--panel2)" }}>
        <div className="wrap">
          <SplitTitle className="t2" inView label={plain("decided.title")}>
            {t.rich("decided.title", rich)}
          </SplitTitle>
          <p className="sub">{t("decided.sub")}</p>
          <Split />
          <div className="parts">
            {(["numbers", "votes", "panel"] as const).map((k) => (
              <Reveal key={k}>
                <h3>{t(`decided.${k}.title`)}</h3>
                <p>{t(`decided.${k}.body`)}</p>
              </Reveal>
            ))}
          </div>
          <Reveal kind="stamp" className="then">
            <h3>{t("decided.then.title")}</h3>
            <p>{t("decided.then.body")}</p>
          </Reveal>
        </div>
      </section>

      {/* ═════════════ THE NIGHT ═════════════ */}
      <section className="sec night" id="night">
        <div className="wrap">
          <SplitTitle className="t2" inView label={plain("night.title")}>
            {t.rich("night.title", rich)}
          </SplitTitle>
          <p className="sub">{t("night.sub")}</p>
          <Reveal className="facts">
            <span className="y">
              {edition.winners_announced_at ? <LocalTime value={edition.winners_announced_at} mode="date" /> : t("night.dateTbc")}
            </span>
            <span>{t("night.awardsCount", { count })}</span>
            <span>{t("night.live")}</span>
          </Reveal>
        </div>
        <div className="art">
          <Reveal as="img" className="scene" src="/kol/crew-scene.webp" alt={t("night.sceneAlt")} />
        </div>
      </section>

      {/* ═════════════ QUESTIONS ═════════════ */}
      <section className="sec" id="faq">
        <div className="wrap">
          <SplitTitle className="t2" inView label={t("faq.title")} style={{ marginBottom: 34 }}>
            {t("faq.title")}
          </SplitTitle>
          <div className="faq">
            {([model.needsUid ? "whoUid" : "who", "howMany", "change", "winning", ...(model.needsUid ? ["whyUid"] : [])] as const).map((k) => (
              <details key={k}>
                <summary>{t(`faq.${k}.q`)}</summary>
                <p>{t(`faq.${k}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════ STICKY CALL TO ACTION ═════════════ */}
      <div className={`cta-bar${ctaShown && !ctaClosed ? " show" : ""}`} aria-hidden={!(ctaShown && !ctaClosed)}>
        <div className="inner">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative art in /public */}
          <img className="leon" alt="" src="/kol/char-leon.webp" />
          <div className="txt">
            <span className="big">{t.rich(cta.big, rich)}</span>
            {cta.small && <span className="small">{t(cta.small, { done: model.picked, total: count })}</span>}
            <button className="btn y sm" tabIndex={ctaShown && !ctaClosed ? 0 : -1} onClick={() => scrollToId(cta.to, reduce)}>
              {t(cta.btn)}
            </button>
          </div>
          <button className="x" onClick={closeCta} aria-label={t("cta.close")} tabIndex={ctaShown && !ctaClosed ? 0 : -1}>
            <KolIcon name="x" />
          </button>
        </div>
      </div>
    </>
  );
}

/** One row of the awards list: number, name, description, the faces of up to four nominees, a link. */
function AwardRow({ award, stage, editionSlug }: { award: KolAward; stage: Stage; editionSlug: string }) {
  const t = useTranslations("awardsKol");
  const faces = award.nominees.filter((n) => nomineePhoto(n)).slice(0, 4);
  const rest = award.nominees.length - faces.length;
  const mine = award.myPickId ? award.nominees.find((n) => n.option_id === award.myPickId) : undefined;
  return (
    <Link className="award hud" href={`/awards/${editionSlug}/${award.slug}`}>
      <span className="no">{pad2(award.number)}</span>
      <span>
        <span className="aname">{award.question.prompt}</span>
        <span className="adesc">
          {award.question.help_text} {t("awards.nominees", { count: award.nominees.length })}.
        </span>
        {mine && stage !== "announced" && <span className="mine">{t("awards.yourPick", { name: mine.label })}</span>}
      </span>
      <span className="right">
        <span className="faces">
          {faces.map((n) => (
            // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
            <img key={n.option_id} alt={n.label} src={nomineePhoto(n)} />
          ))}
          {rest > 0 && <span className="more">{t("awards.facesMore", { count: rest })}</span>}
        </span>
        <span className="go">{stage === "winners" ? t("awards.goWinner") : t("awards.goNominees")} ›</span>
      </span>
    </Link>
  );
}

/** The 40 / 30 / 30 bar, drawn from the left once it is seen. */
function Split() {
  const reduce = useReduceMotion();
  const parts = [
    { cls: "a", label: "40%" },
    { cls: "b", label: "30%" },
    { cls: "c", label: "30%" },
  ];
  return (
    <div className="split" style={{ marginTop: 34 }}>
      {parts.map((p, i) => (
        <motion.span
          key={p.cls}
          className={p.cls}
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.15 }}
        >
          {p.label}
        </motion.span>
      ))}
    </div>
  );
}

/** From list to stage: five steps on a track that scrolls sideways while the section stays pinned
 *  (wide screens), a plain stack on phones and when motion is reduced. */
function Track({ count }: { count: number }) {
  const t = useTranslations("awardsKol");
  const plain = (key: Parameters<typeof t.raw>[0]) => String(t.raw(key)).replace(/<\/?em>/g, "");
  const reduce = useReduceMotion();
  const wide = useMedia("(min-width: 901px)");
  const pinned = wide && !reduce;
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);

  useLayoutEffect(() => {
    if (!pinned) return;
    const measure = () => {
      if (track.current) setDist(Math.max(0, track.current.scrollWidth - window.innerWidth + window.innerWidth * 0.08));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pinned]);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist]);

  const steps = [
    { n: "01", k: "s1", sign: false },
    { n: "02", k: "s2", sign: true },
    { n: "03", k: "s3", sign: false },
    { n: "04", k: "s4", sign: true },
    { n: "05", k: "s5", sign: false },
  ] as const;

  return (
    <section
      className="sec track-sec"
      id="steps"
      ref={section}
      style={pinned ? { height: `calc(100svh + ${dist}px)`, padding: 0 } : undefined}
    >
      <div className={pinned ? "track-pin" : undefined}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <SplitTitle className="t2" inView label={plain("steps.title")}>
                {t.rich("steps.title", rich)}
              </SplitTitle>
              <p className="sub">{t("steps.sub")}</p>
            </div>
            <Reveal kind="sticker" as="img" className="doodle" src="/kol/shards-yellow.webp" />
          </div>
        </div>
        <div className="wrap" style={{ maxWidth: "none", width: "auto", paddingLeft: "4vw" }}>
          <motion.div className="track" ref={track} style={pinned ? { x } : undefined}>
            {steps.map((s) => (
              <div key={s.k} className="tstep hud">
                <span className="tn">{s.n}</span>
                <h3>{t(`steps.${s.k}.title`)}</h3>
                <p>{t(`steps.${s.k}.body`, { count })}</p>
                {s.sign && <span className="sign">{t(`steps.${s.k}.sign` as "steps.s2.sign")}</span>}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
