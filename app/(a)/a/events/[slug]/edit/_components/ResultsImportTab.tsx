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

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PreviewCompetitor = {
  name: string;
  resolution: string;
  matched?: string | null;
  will_create?: boolean;
  near_misses?: string[];
};

type PreviewSheet = {
  sheet: string;
  kind: "summed" | "per_match" | null;
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

type Props = {
  slug: string;
  /** Bearer token for the admin API, same one every other tab on this page uses. */
  token: string;
  /** Absolute backend origin, e.g. process.env.NEXT_PUBLIC_BACKEND_API_URL. */
  apiBase: string;
};

export default function ResultsImportTab({ slug, token, apiBase }: Props) {
  const t = useTranslations("adminResultsImport");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [busy, setBusy] = useState<"template" | "preview" | "commit" | null>(null);

  const auth = { Authorization: `Bearer ${token}` };

  async function downloadTemplate() {
    setBusy("template");
    try {
      const res = await fetch(
        `${apiBase}/results-import/template/?slug=${encodeURIComponent(slug)}`,
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
      a.download = `${slug}-results.xlsx`;
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
      const json = await res.json();
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
      const json = await res.json();
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
    </div>
  );
}
