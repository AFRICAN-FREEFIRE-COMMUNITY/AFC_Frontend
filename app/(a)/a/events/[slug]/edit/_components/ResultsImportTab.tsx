"use client";

/**
 * ResultsImportTab - bring an external tournament's published results into this event.
 *
 * WHY THIS EXISTS
 *   AFC carries tournaments it did not run. Their organisers publish a standings GRAPHIC, not a
 *   match log, so the usable data is a summed row per team per group: "6 matches, 3 Booyahs, 47
 *   placement, 82 elims, 129 total". Typing that into the normal per-match result screens is not
 *   possible, because those matches were never played here.
 *
 * THE THREE STEPS, and the middle one is the point
 *   1. Download a template already carrying this event's stages, groups and registered teams.
 *      That removes two whole classes of failure by construction: a header the parser does not
 *      recognise, and a team name that matches nothing because of a spelling difference.
 *   2. Upload it back for a PREVIEW. Nothing is written. The report says how many rows were read,
 *      which competitors matched an existing AFC team, which will be created as unclaimed
 *      competitors, and every warning, including totals that do not add up.
 *   3. Import, once the report looks right.
 *
 * A results workbook is typed by hand from somebody else's graphic, so it WILL contain surprises.
 * Preview turns each one into a line a person reads before anything is written: a bad file produces
 * a report, not a half-imported event.
 *
 * BACKEND: results-import/template|preview|commit (afc_results_import.views). Re-importing REPLACES
 * this event's imported rows rather than appending, and never touches a result entered by hand.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TeamSearchSelect } from "@/components/ui/team-search-select";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readJson } from "@/lib/readJson";

type PreviewCompetitor = {
  name: string;
  resolution: string;
  matched?: string | null;
  will_create?: boolean;
  near_misses?: string[];
};

type PreviewSheet = {
  sheet: string;
  kind: "summed" | "per_match" | "per_match_players" | null;
  row_count: number;
  competitors: PreviewCompetitor[];
};

type PreviewPayload = {
  sheets: PreviewSheet[];
  problems: string[];
  total_rows: number;
  matched: number;
  to_create: number;
};

/** The four decisions an admin makes ABOUT an imported event (results-import/settings/). */
type ImportSettings = {
  visible_on_profiles: boolean;
  count_in_profile_stats: boolean;
  counts_toward_rankings: boolean;
  tournament_tier: string;
  results_imported_at: string | null;
  /** True when this event's placement points come from the organiser's published totals rather
   *  than being worked out from each map's finish, which is the case for a standings-table
   *  import. Sent by the settings endpoint when rankings are switched on for such an event. */
  placement_points_from_source?: boolean;
};

type Props = {
  slug: string;
  /** Bearer token for the admin API, same one every other tab on this page uses. */
  token: string;
  /** Absolute backend origin, e.g. process.env.NEXT_PUBLIC_BACKEND_API_URL. */
  apiBase: string;
};

/**
 * PAIR ONE NAME (owner 2026-08-24).
 *
 * WHY THIS EXISTS: the preview has always printed "X will be created as a new competitor, but AFC
 * already has Y. Pair them if they are the same club." The backend endpoint to DO that
 * (results-import/pair/) shipped at the same time and was fully working. Nothing in the frontend
 * ever called it, so the sentence pointed at a control that did not exist.
 *
 * WHAT PAIRING IS: it records what a name in THIS file means, so the next import reads it as the
 * team you picked. It is not a merge and not a ghost claim: no roster moves and no history is
 * rewritten, which is why it needs no approval and is undone by simply pairing it differently.
 * (Claiming a ghost's ranked history is the other tool, on /a/rankings/ghost-teams.)
 *
 * The picked team may be one that has never entered this event; the endpoint registers it, which is
 * exactly what the import would have done had the spelling matched.
 *
 * After pairing, the preview is re-run so the row flips from "will be created" to matched, because
 * an admin should see the correction take effect before committing anything.
 */
function PairRow({
  slug, apiBase, token, sourceName, onPaired,
}: {
  slug: string;
  apiBase: string;
  token: string;
  sourceName: string;
  onPaired: () => void;
}) {
  const t = useTranslations("adminResultsImport");
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function pair(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/results-import/pair/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ slug, source_name: sourceName, team_id: id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.message || t("errors.pair"));
        return;
      }
      toast.success(json?.message || t("pair.done"));
      setOpen(false);
      setTeamId(null);
      onPaired();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted/70"
      >
        {t("pair.cta")}
      </button>
    );
  }

  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <span className="min-w-52 flex-1">
        <TeamSearchSelect
          value={teamId}
          onChange={(id) => { setTeamId(id); if (id != null) pair(id); }}
          placeholder={t("pair.placeholder")}
          disabled={saving}
        />
      </span>
      <button
        type="button"
        onClick={() => { setOpen(false); setTeamId(null); }}
        className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70"
      >
        {t("pair.cancel")}
      </button>
    </span>
  );
}

export default function ResultsImportTab({ slug, token, apiBase }: Props) {
  const t = useTranslations("adminResultsImport");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [busy, setBusy] = useState<"template" | "preview" | "commit" | null>(null);
  // WHICH SHAPE the source document has. Asked BEFORE the template is downloaded, because it
  // decides both the columns in that template and what the results can be used for: only a
  // per-match import carries the per-map finishes the ranking rules score from.
  const [shape, setShape] = useState<"summed" | "per_match" | "per_match_players">("summed");

  // ── The four switches. Loaded on mount so the screen shows the CURRENT answers rather than
  // defaults, which matters because a re-import must not look like it reset them.
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const auth = { Authorization: `Bearer ${token}` };

  const loadSettings = useCallback(async () => {
    const res = await fetch(
      `${apiBase}/results-import/settings/?slug=${encodeURIComponent(slug)}`,
      { headers: auth },
    );
    if (!res.ok) {
      toast.error(t("settings.loadFailed"));
      return;
    }
    setSettings(await res.json());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, slug, token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /** Send ONE changed field. The endpoint is tri-state: a field it is not sent keeps its value, so
   *  two admins editing different switches cannot clobber each other. */
  async function saveSetting(patch: Partial<ImportSettings>) {
    setSavingSettings(true);
    try {
      const res = await fetch(`${apiBase}/results-import/settings/`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...patch }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        // The backend explains a refusal in a sentence written for a person (for example that the
        // rankings and tier halves need an AFC event admin), so show that, not a generic failure.
        toast.error(json?.message || t("settings.saveFailed"));
        return;
      }
      setSettings(json);
      toast.success(t("settings.saved"));
    } finally {
      setSavingSettings(false);
    }
  }

  async function downloadTemplate() {
    setBusy("template");
    try {
      const res = await fetch(
        `${apiBase}/results-import/template/?slug=${encodeURIComponent(slug)}&kind=${shape}`,
        { headers: auth },
      );
      if (!res.ok) {
        toast.error(t("errors.template"));
        return;
      }
      // The response is a real .xlsx body, so save it rather than parsing it.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${shape}-results.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function runPreview() {
    if (!file) return;
    setBusy("preview");
    try {
      const body = new FormData();
      body.append("slug", slug);
      body.append("file", file);
      const res = await fetch(`${apiBase}/results-import/preview/`, {
        method: "POST",
        headers: auth,
        body,
      });
      const json = await readJson(res);
      if (!res.ok) {
        // The backend explains a refusal in a sentence written for a person, so show that rather
        // than a generic failure.
        toast.error(json?.message || t("errors.preview"));
        setPreview(null);
        return;
      }
      setPreview(json.preview);
    } finally {
      setBusy(null);
    }
  }

  async function runCommit() {
    if (!file) return;
    setBusy("commit");
    try {
      const body = new FormData();
      body.append("slug", slug);
      body.append("file", file);
      const res = await fetch(`${apiBase}/results-import/commit/`, {
        method: "POST",
        headers: auth,
        body,
      });
      const json = await readJson(res);
      if (!res.ok) {
        toast.error(json?.message || t("errors.commit"));
        return;
      }
      const s = json.summary || {};
      toast.success(
        t("imported", {
          rows: s.stats_rows ?? 0,
          created: s.created_ghosts ?? 0,
        }),
      );
      setPreview(null);
      setFile(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("explainer")}</p>

          {/* STEP 0 - which shape, asked before anything is downloaded. */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-semibold">{t("shape.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("shape.body")}</p>

            <div className="mt-3 space-y-3">
              {(
                [
                  ["summed", "shape.summed", "shape.summedHelp"],
                  ["per_match", "shape.perMatch", "shape.perMatchHelp"],
                  ["per_match_players", "shape.perPlayer", "shape.perPlayerHelp"],
                ] as const
              ).map(([value, label, help]) => (
                <label key={value} className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="import-shape"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={shape === value}
                    onChange={() => setShape(value)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{t(label)}</span>
                    <span className="block text-xs text-muted-foreground">{t(help)}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Said plainly rather than offered as a third option that would not work. A control
                that cannot do what it says is worse than an absent one. */}
            <p className="mt-3 text-xs text-muted-foreground">{t("shape.playersNote")}</p>
          </div>

          {/* STEP 1 */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-semibold">{t("step1.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("step1.body")}</p>
            <Button
              className="mt-2"
              size="sm"
              onClick={downloadTemplate}
              disabled={busy !== null}
            >
              {busy === "template" ? t("step1.working") : t("step1.action")}
            </Button>
          </div>

          {/* STEP 2 */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-semibold">{t("step2.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("step2.body")}</p>
            <input
              type="file"
              accept=".xlsx"
              className="mt-2 block w-full text-xs"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
            <Button
              className="mt-2"
              size="sm"
              onClick={runPreview}
              disabled={!file || busy !== null}
            >
              {busy === "preview" ? t("step2.working") : t("step2.action")}
            </Button>
          </div>

          {/* THE REPORT. Only after a preview, because there is nothing honest to show before one. */}
          {preview && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm font-semibold">{t("report.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("report.counts", {
                  rows: preview.total_rows,
                  matched: preview.matched,
                  created: preview.to_create,
                })}
              </p>

              {preview.sheets.map((sheet) => (
                <div key={sheet.sheet} className="mt-3">
                  <p className="text-xs font-semibold">
                    {sheet.sheet}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {sheet.kind === "summed"
                        ? t("report.summed", { rows: sheet.row_count })
                        : sheet.kind === "per_match_players"
                          ? t("report.perPlayer", { rows: sheet.row_count })
                          : t("report.perMatch", { rows: sheet.row_count })}
                    </span>
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {sheet.competitors.map((c) => (
                      <li key={c.name} className="text-xs text-muted-foreground">
                        {c.name}
                        {c.will_create ? ` ${t("report.willCreate")}` : ` ${t("report.matched")}`}
                        {c.near_misses?.length
                          ? ` ${t("report.nearMiss", { names: c.near_misses.join(", ") })}`
                          : null}
                        {/* The cure for the near-miss warning, on the row that carries it. Offered
                            for anything the import WOULD create, not only near misses, because a
                            renamed club often has no name similar enough to be flagged. */}
                        {c.will_create && (
                          <PairRow
                            slug={slug}
                            apiBase={apiBase}
                            token={token}
                            sourceName={c.name}
                            onPaired={runPreview}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {preview.problems.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold">{t("report.warnings")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {preview.problems.map((p, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* STEP 3, deliberately unavailable until a preview has been seen. */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-semibold">{t("step3.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("step3.body")}</p>
            <Button
              className="mt-2"
              size="sm"
              onClick={runCommit}
              disabled={!preview || busy !== null}
            >
              {busy === "commit" ? t("step3.working") : t("step3.action")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── WHAT THESE RESULTS COUNT TOWARDS ────────────────────────────────────────────────
          A separate card because these are not part of importing a file: an admin revisits them
          long after the import, and they are the answers the owner asked to be able to give.
          Filled surfaces and spacing carry the grouping, no hairline boxes. */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("settings.body")}</p>

            {/* The two PROFILE answers. The second one changes numbers on a real team's public
                page, which is why its help text says so plainly. */}
            <div className="space-y-3 rounded-md bg-muted/50 p-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={settings.visible_on_profiles}
                  disabled={savingSettings}
                  onChange={(e) => saveSetting({ visible_on_profiles: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">{t("settings.visible")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("settings.visibleHelp")}
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={settings.count_in_profile_stats}
                  disabled={savingSettings}
                  onChange={(e) => saveSetting({ count_in_profile_stats: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">{t("settings.stats")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("settings.statsHelp")}
                  </span>
                </span>
              </label>
            </div>

            {/* The two RANKINGS answers, kept in their own surface because they are the ones that
                reach other teams. The backend refuses these for anyone who is not an AFC event
                admin and explains why, so a non-admin gets a real sentence rather than a control
                that silently does nothing. */}
            <div className="space-y-3 rounded-md bg-muted/50 p-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={settings.counts_toward_rankings}
                  disabled={savingSettings}
                  onChange={(e) => saveSetting({ counts_toward_rankings: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">{t("settings.rankings")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("settings.rankingsHelp")}
                  </span>
                  {/* Says WHERE the placement points came from, for a standings-table import.
                      Shown only once counting is on, because until then it changes nothing. */}
                  {settings.counts_toward_rankings &&
                    settings.placement_points_from_source && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("settings.sourcePlacement")}
                      </span>
                    )}
                </span>
              </label>

              <div className="flex items-start gap-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t("settings.tier")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("settings.tierHelp")}
                  </span>
                  <select
                    className="mt-2 h-9 rounded-md bg-background px-2 text-sm"
                    value={settings.tournament_tier}
                    disabled={savingSettings}
                    onChange={(e) => saveSetting({ tournament_tier: e.target.value })}
                  >
                    <option value="tier_1">{t("settings.tier_1")}</option>
                    <option value="tier_2">{t("settings.tier_2")}</option>
                    <option value="tier_3">{t("settings.tier_3")}</option>
                  </select>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
