"use client";

/**
 * app/(user)/awards/_kol/KolHallOfFame.tsx - the hall of fame on the winners page (round 5 of mockups/kol-awards,
 * approved 11 Nov 2026, inbox #445 #537).
 *
 * Every published winner of every released edition, newest season first, with a season filter (filled chips, the
 * picked one in gold) and the most decorated person on top (won two or more). Deliberately denser than the reveal
 * above it. No vote counts.
 *
 * DATA: GET polls/hall-of-fame/ (AFC-B afc_polls/views_hof.py) through lib/polls.ts pollsApi.hallOfFame. Public, no
 * sign-in; a hidden edition (#543) is never in it. Loading, empty and error states are written out.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { pollsApi, type HallOfFame } from "@/lib/polls";

export function KolHallOfFame() {
  const t = useTranslations("awardsKol");
  const [data, setData] = useState<HallOfFame | null>(null);
  const [failed, setFailed] = useState(false);
  const [season, setSeason] = useState<"all" | number>("all");

  useEffect(() => {
    let live = true;
    pollsApi.hallOfFame().then((d) => live && setData(d)).catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const seasons = data?.seasons ?? [];
  const years = [...new Set(seasons.map((s) => s.year).filter((y): y is number => !!y))];
  const top = data?.most_decorated?.[0];

  return (
    <section className="hof" id="hall" aria-labelledby="kolHofTitle">
      <div className="wrap">
        <p className="eyebrow">{t("hof.eyebrow")}</p>
        <h2 className="t2" id="kolHofTitle">{t.rich("hof.title", { em: (c) => <em>{c}</em> })}</h2>

        {failed ? (
          <p className="empty">{t("hof.error")}</p>
        ) : data === null ? (
          <p className="empty" aria-busy="true">{t("hof.loading")}</p>
        ) : seasons.length === 0 ? (
          <p className="empty">{t("hof.none")}</p>
        ) : (
          <>
            {years.length > 1 && (
              <div className="chips" role="group" aria-label={t("hof.seasons")}>
                <button className={`chip${season === "all" ? " on" : ""}`} aria-pressed={season === "all"}
                        onClick={() => setSeason("all")}>{t("hof.all")}</button>
                {years.map((y) => (
                  <button key={y} className={`chip${season === y ? " on" : ""}`} aria-pressed={season === y}
                          onClick={() => setSeason(y)}>{y}</button>
                ))}
              </div>
            )}

            {top && (
              <div className="decor">
                {top.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API-host media
                  <img alt="" src={top.image} width={120} height={150} />
                ) : (
                  <span className="ini">{top.name.slice(0, 1)}</span>
                )}
                <div>
                  <p className="eyebrow">{t("hof.mostDecorated")}</p>
                  <p className="dn">{top.name}</p>
                  <p className="dw">{t("hof.wins", { count: top.wins })}</p>
                  <div className="tags">
                    {[...top.seasons].sort((a, b) => b - a).map((y) => (
                      <span key={y}>{y}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {seasons.map((s) => (
              <div key={s.slug} className="season" hidden={season !== "all" && s.year !== season}>
                <div>
                  {s.year ? <p className="yr">{s.year}</p> : null}
                  <p className="sn">{s.title}</p>
                  <p className="sm">{t("hof.awardsCount", { count: s.winners.length })}</p>
                </div>
                <ul className="plaques">
                  {s.winners.map((w) => (
                    <li key={`${s.slug}-${w.award_slug || w.award}`} className="plaque">
                      {w.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- API-host media
                        <img alt="" src={w.image} width={64} height={80} />
                      ) : (
                        <span className="ini">{w.winner.slice(0, 1)}</span>
                      )}
                      <div>
                        <span className="aw">{w.award}</span>
                        <span className="nm">{w.winner}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
