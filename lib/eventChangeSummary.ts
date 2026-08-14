/**
 * eventChangeSummary - builds the list of edits shown by the "confirm save" dialog on the two
 * event edit pages.
 *
 * WHY THIS EXISTS AS ONE SHARED MODULE
 * Both `app/(a)/a/events/[slug]/edit/page.tsx` (admin) and
 * `app/(organizer)/organizer/events/[slug]/edit/page.tsx` (organizer) render the same
 * `SaveConfirmModal`, and each used to build its own hand-written list of fields to compare.
 * That list drifted from the form schema twice: the event description was saved while the dialog
 * denied there was an edit (fixed 2026-08-06), and about 25 further editable fields were never
 * listed at all, so an admin who changed ONLY the prize split, the entry fee, the Discord gate,
 * the waitlist, the country restriction or a stage was told "No changes detected. Are you sure you
 * want to save?" right after making a real change. That reads as "my edit did not register".
 *
 * HOW IT AVOIDS DRIFTING AGAIN
 * Instead of a hand-written list of fields to check, this walks EVERY key present in the form and
 * reports anything that differs. A field added to `EventFormSchema` tomorrow is therefore reported
 * from the day it is added: at worst it shows under a generic label, never as "no changes".
 *
 * WHAT IT COMPARES
 * The baseline is a snapshot of `form.getValues()` taken right after the edit page runs
 * `form.reset(...)` from the fetched event, NOT the raw API object. Both sides then come from the
 * same form, so field-by-field shape differences (a date the form stores as a string, a number the
 * API sends as a number) cannot masquerade as edits. Zod still coerces on submit ("64" becomes 64),
 * so values are canonicalized to strings before comparison.
 *
 * CONNECTS TO
 *  - `app/(a)/a/events/[slug]/edit/page.tsx` -> getChangedFields -> SaveConfirmModal
 *  - `app/(organizer)/organizer/events/[slug]/edit/page.tsx` -> same
 *  - copy lives in the `evEditPage` namespace under `changes.*` (messages/{en,fr,pt}/evEditPage.json)
 *  - the dialog itself is `app/(a)/a/events/[slug]/edit/_components/SaveConfirmModal.tsx`
 */

export type EventChangeRow = { label: string; from: string; to: string };

/** next-intl's `useTranslations("evEditPage")`, narrowed to what this module needs. */
type Translator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Fields deliberately left out of the dialog.
 *  - banner / rules_document hold a URL string that the form rewrites on load; a NEW upload is
 *    reported separately by the caller, which is the only case a human cares about.
 *  - number_of_stages is derived from `stages`, so reporting both says the same thing twice.
 */
const IGNORED_FIELDS = new Set(["banner", "rules_document", "number_of_stages"]);

/**
 * Human labels, keyed by form field. The value is the suffix under `changes.` in the evEditPage
 * namespace. Anything missing here still gets reported, under `changes.otherField`.
 */
const FIELD_LABEL_KEYS: Record<string, string> = {
  event_name: "eventName",
  event_description: "eventDescription",
  competition_type: "competitionType",
  participant_type: "participantType",
  event_type: "eventType",
  is_public: "eventPrivacy",
  max_teams_or_players: "maxParticipants",
  event_mode: "eventMode",
  start_date: "startDate",
  end_date: "endDate",
  event_start_time: "eventStartTime",
  event_end_time: "eventEndTime",
  registration_open_date: "registrationOpen",
  registration_end_date: "registrationClose",
  registration_start_time: "registrationStartTime",
  registration_end_time: "registrationEndTime",
  registration_link: "registrationLink",
  registration_type: "registrationType",
  registration_fee: "registrationFee",
  registration_fee_currency: "registrationFeeCurrency",
  country_payment_rules: "countryPaymentRules",
  prizepool: "prizePool",
  prizepool_cash_value: "prizePoolCashValue",
  prize_currency: "prizeCurrency",
  prize_distribution: "prizeDistribution",
  event_rules: "eventRules",
  event_status: "eventStatus",
  stages: "stages",
  stream_channels: "streamChannels",
  require_discord: "discordRequired",
  discord_server_id: "discordServer",
  discord_invite_link: "discordInvite",
  publish_to_tournaments: "publishToTournaments",
  publish_to_news: "publishToNews",
  save_to_drafts: "saveToDrafts",
  registration_restriction: "registrationRestriction",
  restriction_mode: "restrictionMode",
  selected_locations: "restrictedLocations",
  is_sponsored: "sponsored",
  sponsor_name: "sponsorName",
  sponsor_usernames: "sponsors",
  requirement_description: "sponsorRequirement",
  sponsor_field_label: "sponsorFieldLabel",
  uuid_label: "sponsorFieldLabel",
  is_waitlist_enabled: "waitlistEnabled",
  waitlist_capacity: "waitlistCapacity",
  waitlist_discord_role_id: "waitlistDiscordRole",
};

/** Booleans read better as On / Off than as "true" / "false". */
const BOOLEAN_FIELDS = new Set([
  "require_discord",
  "is_sponsored",
  "is_waitlist_enabled",
  "publish_to_tournaments",
  "publish_to_news",
  "save_to_drafts",
]);

/** A long value (the rules body, a country list) would push the dialog off a phone screen. */
const MAX_DISPLAY_LENGTH = 120;

/**
 * Reduce a value to something two versions of it can be compared by.
 * Numbers become strings because zod coerces on submit while the untouched baseline keeps the
 * string the form held: without this, every numeric field would look edited. Objects are sorted by
 * key so that key order alone cannot read as a change.
 */
function canonical(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value.trim();
  if (value instanceof File) return `file:${value.name}:${value.size}`;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return String(value);
}

function isSame(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function truncate(text: string): string {
  return text.length > MAX_DISPLAY_LENGTH
    ? `${text.slice(0, MAX_DISPLAY_LENGTH)}...`
    : text;
}

/** Turn one field value into the short human string the dialog shows either side of the arrow. */
function formatValue(field: string, value: unknown, t: Translator): string {
  if (value === null || value === undefined || value === "") return t("changes.notSet");

  if (field === "is_public") {
    const isPublic = value === true || value === "True" || value === "true";
    return isPublic ? t("changes.public") : t("changes.private");
  }

  if (BOOLEAN_FIELDS.has(field) || typeof value === "boolean") {
    const on = value === true || value === "true" || value === "True";
    return on ? t("changes.on") : t("changes.off");
  }

  if (field === "stages" && Array.isArray(value)) {
    return t("changes.stageCount", { count: value.length });
  }

  if (field === "prize_distribution" && value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return t("changes.notSet");
    return truncate(entries.map(([place, amount]) => `${place}: ${amount}`).join(", "));
  }

  if (field === "country_payment_rules") {
    const count = Array.isArray(value)
      ? value.length
      : Object.keys(value as Record<string, unknown>).length;
    return count === 0 ? t("changes.notSet") : t("changes.ruleCount", { count });
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return t("changes.notSet");
    return truncate(value.map((item) => String(item)).join(", "));
  }

  if (typeof value === "object") {
    // No dedicated formatter: say how big it is rather than dumping JSON at an admin.
    const count = Object.keys(value as Record<string, unknown>).length;
    return t("changes.itemCount", { count });
  }

  return truncate(String(value).trim());
}

function labelFor(field: string, t: Translator): string {
  const suffix = FIELD_LABEL_KEYS[field];
  if (suffix) return t(`changes.${suffix}`);
  // A field added to the schema and not yet labelled. Showing its raw name is not pretty, but it
  // is honest: the alternative is the dialog claiming nothing changed while a change is saved.
  return t("changes.otherField", { field: field.replace(/_/g, " ") });
}

export interface BuildEventChangeRowsArgs {
  /** `form.getValues()` captured right after the page reset the form from the fetched event. */
  baseline: Record<string, unknown> | null;
  /** The validated values about to be submitted. */
  current: Record<string, unknown>;
  t: Translator;
  /** Name of a newly picked banner file, if the admin chose one this session. */
  bannerFileName?: string | null;
  /** Name of a newly picked rules document, if the admin chose one this session. */
  rulesFileName?: string | null;
}

/**
 * Compare the submitted values against the baseline snapshot and return one row per real edit,
 * in the order fields appear on the form.
 *
 * Returning an empty array is what makes the dialog say "No changes detected", so a field must
 * only be absent here when it genuinely did not change.
 */
export function buildEventChangeRows({
  baseline,
  current,
  t,
  bannerFileName,
  rulesFileName,
}: BuildEventChangeRowsArgs): EventChangeRow[] {
  const rows: EventChangeRow[] = [];

  // No snapshot means the page has not finished loading the event, so there is nothing to compare
  // against and every field would look new. Report only the freshly picked files.
  if (baseline) {
    const ordered = Object.keys(FIELD_LABEL_KEYS);
    const remaining = [...Object.keys(baseline), ...Object.keys(current)].filter(
      (key) => !ordered.includes(key),
    );
    const fields = [...ordered, ...Array.from(new Set(remaining))];

    for (const field of fields) {
      if (IGNORED_FIELDS.has(field)) continue;
      if (!(field in baseline) && !(field in current)) continue;

      const before = baseline[field];
      const after = current[field];
      if (isSame(before, after)) continue;

      rows.push({
        label: labelFor(field, t),
        from: formatValue(field, before, t),
        to: formatValue(field, after, t),
      });
    }
  }

  // File pickers live outside the form, so they are reported by name rather than by comparison.
  if (bannerFileName) {
    rows.push({
      label: t("changes.eventBanner"),
      from: t("changes.previousBanner"),
      to: t("changes.newFile", { name: bannerFileName }),
    });
  }
  if (rulesFileName) {
    rows.push({
      label: t("changes.rulesDocument"),
      from: t("changes.previousDocument"),
      to: t("changes.newFile", { name: rulesFileName }),
    });
  }

  return rows;
}
