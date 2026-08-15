import type { BranchRule, PollQuestion } from "@/lib/polls";

/**
 * lib/pollBranching.ts - the CLIENT half of poll branching.
 *
 * WHY THERE ARE TWO HALVES AT ALL
 *   The rules are evaluated twice on purpose. Here, live, so the form reacts the instant somebody
 *   taps an option, with no network round trip between the tap and the next question appearing on
 *   a phone on mobile data. And again on the server at submit, which is the one that counts: the
 *   backend recomputes the path and DISCARDS answers to questions that are not on it. Somebody who
 *   answers Q3, changes their mind on Q1 and submits would otherwise contribute a Q3 answer they
 *   were never supposed to be asked, and the Q3 totals would be quietly wrong.
 *
 *   So this file is a UX convenience and never a security boundary. A client that lies about its
 *   own path only removes its own answers.
 *
 * IT MUST AGREE WITH backend/afc_polls/branching.py, and the rules below are stated in the same
 * order for exactly that reason:
 *   - Default VISIBLE. A question no rule targets is always shown, which is what makes a poll with
 *     zero rules simply linear.
 *   - An UNANSWERED watched question satisfies nothing, including `is_not`. "You did not answer Q1"
 *     is not the same claim as "your answer to Q1 was not X", and treating a blank as satisfying
 *     is_not would show a follow-up to everybody who has not got there yet.
 *   - `hide` beats `show`. "Do not ask this person" is a stronger statement than "you may".
 *
 * CONSUMED BY app/(user)/polls/[slug]/page.tsx and the awards ballot.
 */

export type Selections = Record<number, number[]>;
export type Ratings = Record<number, number>;

function satisfied(rule: BranchRule, selections: Selections, ratings: Ratings): boolean {
  const watched = rule.when_question_id;

  if (rule.operator === "gte" || rule.operator === "lte") {
    const given = ratings[watched];
    const threshold = rule.value?.rating;
    if (given == null || threshold == null) return false;
    return rule.operator === "gte" ? given >= threshold : given <= threshold;
  }

  const picked = selections[watched] || [];
  const wanted = rule.value?.option_ids || [];
  if (picked.length === 0 || wanted.length === 0) return false;
  const overlap = picked.some((id) => wanted.includes(id));

  // "is" on a multiple-choice question means the wanted option is AMONG the picks. Requiring an
  // exact set match would make a rule on a "pick up to three" question almost impossible to
  // satisfy, which is not what an admin writing "when they picked Support" means.
  if (rule.operator === "is" || rule.operator === "is_any_of") return overlap;
  if (rule.operator === "is_not") return !overlap;
  return false;
}

/** The question ids that are ON this person's path, in poll order. */
export function visibleQuestionIds(
  questions: PollQuestion[],
  rules: BranchRule[],
  selections: Selections,
  ratings: Ratings = {},
): number[] {
  // The common case, short-circuited: a poll with no rules is linear, and proving that per
  // question is pure cost on a 28-category ballot re-rendered on every tap.
  if (!rules || rules.length === 0) return questions.map((q) => q.question_id);

  const targetedQuestions = new Set(
    rules.map((r) => r.target_question_id).filter((id): id is number => !!id),
  );
  const targetedSections = new Set(
    rules.map((r) => r.target_section_id).filter((id): id is number => !!id),
  );

  const shownQ = new Set<number>();
  const shownS = new Set<number>();
  const hiddenQ = new Set<number>();
  const hiddenS = new Set<number>();
  for (const rule of rules) {
    if (!satisfied(rule, selections, ratings)) continue;
    if (rule.target_question_id) {
      (rule.action === "show" ? shownQ : hiddenQ).add(rule.target_question_id);
    }
    if (rule.target_section_id) {
      (rule.action === "show" ? shownS : hiddenS).add(rule.target_section_id);
    }
  }

  const path: number[] = [];
  for (const question of questions) {
    const sectionId = question.section_id ?? null;
    const isTargeted =
      targetedQuestions.has(question.question_id) ||
      (sectionId !== null && targetedSections.has(sectionId));
    if (!isTargeted) {
      path.push(question.question_id);
      continue;
    }

    if (hiddenQ.has(question.question_id)) continue;
    if (sectionId !== null && hiddenS.has(sectionId)) continue;

    const satisfiedShow =
      shownQ.has(question.question_id) || (sectionId !== null && shownS.has(sectionId));
    // Targeted only by `hide` rules means visible until one of them fires, which is why the two
    // cases are tested separately rather than as one flag.
    const onlyHideRules = !rules.some(
      (rule) =>
        rule.action === "show" &&
        (rule.target_question_id === question.question_id ||
          (sectionId !== null && rule.target_section_id === sectionId)),
    );
    if (satisfiedShow || onlyHideRules) path.push(question.question_id);
  }
  return path;
}

/** A plain-English sentence for one rule, for the builder's rule list. An admin has to be able to
 *  read the whole logic of a poll as a list of sentences: that readability is the entire reason
 *  branching is a flat rule list rather than a node graph. */
export function describeRule(rule: BranchRule, questions: PollQuestion[]): string {
  const watched = questions.find((q) => q.question_id === rule.when_question_id);
  const target =
    questions.find((q) => q.question_id === rule.target_question_id)?.prompt || "a section";
  const optionLabels = (rule.value?.option_ids || [])
    .map((id) => watched?.options.find((o) => o.option_id === id)?.label)
    .filter(Boolean)
    .join(", ");

  const condition =
    rule.operator === "gte"
      ? `is at least ${rule.value?.rating}`
      : rule.operator === "lte"
        ? `is at most ${rule.value?.rating}`
        : rule.operator === "is_not"
          ? `is not ${optionLabels}`
          : `is ${optionLabels}`;

  return `When "${watched?.prompt || "a question"}" ${condition}, ${rule.action} "${target}".`;
}
