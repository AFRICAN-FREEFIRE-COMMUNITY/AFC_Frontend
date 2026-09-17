/**
 * scripts/check-event-forms.mjs - the four event forms against the backend's event contract.
 *
 * WHY (owner rule R24, the frontend half, 2026-09-17). The backend declares every event field once
 * (afc_tournament_and_scrims/event_contract.py) and generates its readers and writers from it. The
 * four forms here (admin create / edit, organizer create / edit) still name the fields by hand in
 * `formData.append("<key>", ...)`: the twelve-copies problem the contract exists to end. Until the
 * forms are generated from the list, this is the check that keeps the copies honest:
 *
 *   BLOCKING  a key a form sends that the contract does not know: a typo, or a field that was
 *             renamed or dropped on the backend. The backend ignores unknown keys silently, so
 *             nothing else would ever notice.
 *   LEDGERED  a writable contract field that NO form sends (event.forms.missing): the field exists
 *             on the backend and no screen can set it. Counted so it can only fall.
 *   BLOCKING  lib/eventContract.generated.json is stale against the backend tree beside us
 *             (regenerate: python ../wt-be-ocr/tools/export_event_contract.py --json > lib/eventContract.generated.json).
 *             Skipped where no backend tree sits beside this one (CI), so the committed list rules.
 *
 * USAGE   node scripts/check-event-forms.mjs [--json]
 * Read by scripts/check-all.mjs (step event-forms).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FORMS = [
  "app/(a)/a/events/create/page.tsx",
  "app/(a)/a/events/[slug]/edit/page.tsx",
  "app/(organizer)/organizer/events/create/page.tsx",
  "app/(organizer)/organizer/events/[slug]/edit/page.tsx",
];
const GENERATED = join(ROOT, "lib", "eventContract.generated.json");

const contract = JSON.parse(readFileSync(GENERATED, "utf8"));

// Keys the forms send that are FORM state, not event fields: the three publish switches fold
// into is_draft on the page, and paid_terms_accepted is read by the organizer create view
// (afc_organizers) outside the event contract. Listed here so they are neither typos nor debt.
const FORM_ONLY = ["publish_to_tournaments", "publish_to_news", "save_to_drafts", "paid_terms_accepted"];
// Writable contract fields set by their OWN control rather than the forms, with the file that
// sets each. They are not missing from any screen; they have a better one.
const SET_ELSEWHERE = {
  auto_seed_on_start: "app/(a)/a/events/[slug]/edit/_components/AutoSeedCard.tsx",
  auto_seed_trigger: "app/(a)/a/events/[slug]/edit/_components/AutoSeedCard.tsx",
  discord_reminder_frequency: "app/(a)/a/events/[slug]/edit/_components/DiscordRemindersCard.tsx",
  discord_reminder_note: "app/(a)/a/events/[slug]/edit/_components/DiscordRemindersCard.tsx",
};
const known = new Set([...contract.fields.map((f) => f.name), ...contract.hand_written, ...FORM_ONLY]);
const writable = new Set(contract.writable.admin.filter((k) => !(k in SET_ELSEWHERE)));

// ── staleness: only where the backend tree is beside us ──
let stale = null;
const backend = ["../wt-be-ocr", "../backend"].find((d) => existsSync(join(d, "tools", "export_event_contract.py")));
if (backend) {
  const py = spawnSync("python", [join(backend, "tools", "export_event_contract.py"), "--json"], { encoding: "utf8", cwd: backend });
  if (py.status === 0 && py.stdout) {
    try {
      const fresh = JSON.parse(py.stdout);
      const a = JSON.stringify(fresh.fields.map((f) => [f.name, f.read, f.write]));
      const b = JSON.stringify(contract.fields.map((f) => [f.name, f.read, f.write]));
      if (a !== b) stale = "lib/eventContract.generated.json differs from the backend contract; regenerate it";
    } catch { /* an environment without Django settings cannot export; the committed list rules */ }
  }
}

// ── what each form sends ──
const sent = new Map();
for (const rel of FORMS) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const keys = new Set([...text.matchAll(/formData\.append\(\s*"([a-z_]+)"/g)].map((m) => m[1]));
  sent.set(rel, keys);
}
const unknown = [];
for (const [rel, keys] of sent) for (const k of keys) if (!known.has(k)) unknown.push({ file: rel, key: k });
const everSent = new Set([...sent.values()].flatMap((s) => [...s]));
const missing = [...writable].filter((k) => !everSent.has(k)).sort();

const result = { unknown, missing, stale, forms: Object.fromEntries([...sent].map(([k, v]) => [k, v.size])) };
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result));
  process.exit(0);
}
for (const u of unknown) console.log(`UNKNOWN ${u.file}  sends "${u.key}", which the contract does not know`);
if (stale) console.log(`STALE ${stale}`);
console.log(`${unknown.length} unknown key(s); ${missing.length} writable field(s) no form sends${missing.length ? ": " + missing.join(", ") : ""}`);
process.exit(unknown.length || stale ? 1 : 0);
