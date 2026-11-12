/**
 * app/(user)/awards/_kol/model.ts - the KOL Awards page's view of one awards edition.
 *
 * WHAT IT DOES
 *   Flattens the API's EditionDetail (GET polls/editions/<slug>/, afc_polls.views.edition_detail)
 *   into what the themed pages draw: a list of AWARDS (one PollQuestion each, in order), each with its
 *   nominees (PollOption), the nominee the viewer picked, the published winner, and which poll to post
 *   a vote to. Nothing here is invented: every award, nominee, film and phase comes from the edition.
 *
 * CONNECTS TO
 *   lib/polls.ts (the API types and client), KolContext.tsx (fetches and refreshes the EditionDetail
 *   and hands this model to every page), KolLanding / KolAward / KolNominee (draw it).
 */
import type { EditionDetail, PollOption, PollQuestion, Verdict } from "@/lib/polls";

/** The four moments, as the pages name them. `archived` reads as `winners` (the edition is over). */
export type Stage = "announced" | "voting" | "counting" | "winners";

export type KolNominee = PollOption & { slug: string };

export type KolAward = {
  /** PollQuestion.slug: the award's address segment. */
  slug: string;
  /** 1-based position, for "Award 03 of 06". */
  number: number;
  question: PollQuestion;
  /** The poll this award is a question of, which is where a vote is posted. */
  pollSlug: string;
  /** Whether that poll takes answers right now (open window and not a preview). */
  accepting: boolean;
  verdict: Verdict;
  nominees: KolNominee[];
  /** The option the viewer picked, or null (signed out, or not voted in this award). */
  myPickId: number | null;
  /** The published winner's option id once the winners are public, else null. */
  winnerId: number | null;
};

export type KolModel = {
  detail: EditionDetail;
  stage: Stage;
  awards: KolAward[];
  /** How many awards the viewer has picked in. */
  picked: number;
  /** True when a poll's eligibility lists the in-game UID profile requirement (key profile_uid). */
  needsUid: boolean;
};

const STAGE_OF: Record<string, Stage> = {
  announced: "announced",
  voting: "voting",
  counting: "counting",
  winners: "winners",
  archived: "winners",
};

export function buildModel(detail: EditionDetail): KolModel {
  const awards: KolAward[] = [];
  let needsUid = false;

  for (const poll of detail.polls) {
    if (poll.eligibility?.requirements?.some((r) => r.key === "profile_uid")) needsUid = true;
    for (const question of poll.questions) {
      const mine = poll.your_answers?.[String(question.question_id)]?.[0] ?? null;
      awards.push({
        slug: question.slug || `award-${awards.length + 1}`,
        number: awards.length + 1,
        question,
        pollSlug: poll.slug,
        accepting: poll.accepting_answers,
        verdict: poll.eligibility,
        nominees: question.options.map((o) => ({ ...o, slug: o.slug || String(o.option_id) })),
        myPickId: mine,
        // The PUBLISHED winner is named once the edition's winners are announced, whatever the ballot's results
        // setting: an award ballot keeps its vote numbers admins-only by default, and the server sends the winner
        // claim on its own (AFC-B afc_polls.views _winners_are_out). results_visible still covers older ballots.
        winnerId:
          poll.results_visible || detail.edition.winners_are_public ? question.published_winner_option_id ?? null : null,
      });
    }
  }

  return {
    detail,
    stage: STAGE_OF[detail.edition.phase] ?? "announced",
    awards,
    picked: awards.filter((a) => a.myPickId !== null).length,
    needsUid,
  };
}

/** The nominee a person is, in every award they are nominated in (same slug and same name). */
export function awardsOfNominee(model: KolModel, nominee: KolNominee): KolAward[] {
  return model.awards.filter((a) => a.nominees.some((n) => n.slug === nominee.slug || n.label === nominee.label));
}

/** The winning nominee of an award, once winners are public and the admin has published one. */
export function winnerOf(award: KolAward): KolNominee | undefined {
  return award.winnerId ? award.nominees.find((n) => n.option_id === award.winnerId) : undefined;
}

/** The film a winner surface plays: the winner film, else the nominee film, else "". */
export function winnerFilm(n: PollOption): string {
  return n.winner_film_url || n.film_url || "";
}

/** Two-digit award number, "03". */
export const pad2 = (n: number) => String(n).padStart(2, "0");

/** The nominee's picture: the linked player or team avatar, else the image the admin entered. */
export function nomineePhoto(n: PollOption): string {
  return n.linked?.avatar_url || n.image_url || "";
}
