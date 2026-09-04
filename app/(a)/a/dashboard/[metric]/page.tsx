"use client";

// ── Admin · Dashboard drill-down ─────────────────────────────────────────────
// The breakdown behind ONE dashboard number.
//
// Owner 2026-09-02: "when you click on each text or mini tab it takes you that stats and it opens
// up to much more detail."
//
// ONE COMPONENT FOR ELEVEN METRICS, and that is the design rather than an economy. The backend
// returns the same envelope for every metric (afc_auth/views_dashboard.py, DETAIL_BUILDERS):
//
//     {metric, title, subtitle, headline: [{label, value, hint}],
//      sections: [{key, title, note, columns: [...], rows: [[...], ...]}]}
//
// so this file renders members, revenue and admin activity with no branch between them. Adding a
// twelfth metric is a builder in that registry and nothing here. A metric that needs bespoke
// frontend code has been modelled wrong, and the shared shape is what keeps that honest.
//
// Rows arrive as primitives, already ordered and formatted, so this component never needs to know
// what a Team or an Order is in order to put one in a table.
//
// CONNECTS TO
//   lib/dashboard.ts (dashboardApi.detail, DASHBOARD_METRICS)  ->  GET
//   auth/admin/dashboard-stats/<metric>/ . The metric keys here mirror the backend registry, so an
//   unknown one is a 404 with the valid keys named, never an empty page pretending to be a metric.
//   Linked from every card on ../page.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { ArrowLeft } from "lucide-react";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardApi, type DashboardDetail, type DetailSection } from "@/lib/dashboard";

/**
 * A month series drawn as proportional bars.
 *
 * Deliberately NOT a chart library: the shape is twelve values, the AFC admin idiom is Card and
 * Table, and pulling Recharts onto this route to draw twelve bars would cost more than it explains.
 * A bar is a filled div whose width is a percentage of the largest value, so it reads at a glance
 * and the exact number still sits beside it for anyone who needs it.
 */
/** ISO-8601 as the backend emits it (datetime.isoformat), e.g. 2026-08-26T19:33:53.616900+00:00.
 *  Anchored, so a plain "2026-08" month bucket or a team called "2026-thing" is left alone. */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Rows arrive as primitives, and a timestamp among them is still a timestamp: the site's rule is
 *  that every displayed time renders in the VIEWER's timezone, never the server's UTC. The Latest
 *  actions table in the activity breakdown was showing a raw
 *  "2026-08-26T19:33:53.616900+00:00" at a reader until this existed. */
function renderCell(cell: string | number) {
  if (typeof cell === "string" && ISO_TIMESTAMP.test(cell)) {
    return <LocalTime value={cell} />;
  }
  return cell;
}

function MiniSeries({ section }: { section: DetailSection }) {
  const values = section.rows.map((r) => Number(r[1]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex flex-col gap-1.5">
      {section.rows.map((row, i) => (
        <div key={String(row[0])} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">{row[0]}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm bg-primary"
              // A zero month renders as an empty track rather than a hairline, so an empty month
              // reads as empty rather than as a very small number.
              style={{ width: `${(values[i] / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums">
            {row[1]}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: DetailSection }) {
  // A month series is the one shape a table renders badly: twelve rows of "2026-04 | 0" hides the
  // trend that is the entire reason to look. Everything else is genuinely tabular.
  const isSeries = section.key === "by_month" && section.columns.length === 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{section.title}</CardTitle>
        {section.note ? (
          <p className="text-xs text-muted-foreground">{section.note}</p>
        ) : null}
      </CardHeader>
      <CardContent className={isSeries ? "" : "p-0"}>
        {section.rows.length === 0 ? (
          // A written empty state, never a dashed box and never a blank card.
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing recorded for this yet.
          </p>
        ) : isSeries ? (
          <MiniSeries section={section} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {section.columns.map((col, i) => (
                    <TableHead key={col} className={i === 0 ? "" : "text-right"}>
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row, r) => (
                  <TableRow key={r}>
                    {row.map((cell, c) => (
                      <TableCell
                        key={c}
                        className={
                          c === 0
                            ? "font-medium"
                            : "text-right tabular-nums text-muted-foreground"
                        }
                      >
                        {renderCell(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardMetricPage() {
  const params = useParams();
  const metric = String(params?.metric ?? "");
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!metric) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await dashboardApi.detail(metric));
    } catch (err: any) {
      setDetail(null);
      // The backend names the valid metrics on a 404, so pass that through rather than replacing
      // it with a generic failure the reader cannot act on.
      const available = err?.response?.data?.available;
      setError(
        (err?.response?.data?.message || "This breakdown could not be loaded.") +
          (Array.isArray(available) ? ` Available: ${available.join(", ")}.` : ""),
      );
    } finally {
      setLoading(false);
    }
  }, [metric]);

  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Button asChild variant="outline" size="sm" className="w-fit">
      <Link href="/a/dashboard">
        <ArrowLeft className="mr-1 size-4" />
        Back to dashboard
      </Link>
    </Button>
  );

  if (loading) return <FullLoader />;

  if (error || !detail) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <IconAlertTriangle className="size-8 text-destructive" />
            <p className="text-base font-semibold">Breakdown unavailable</p>
            <p className="max-w-lg text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} variant="outline">
              <IconRefresh className="mr-2 size-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PageHeader title={detail.title} description={detail.subtitle} />

      {/* Headline figures: the number the dashboard card showed, plus the context that card had
          no room for. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {detail.headline.map((stat) => (
          <Card key={stat.label} className="gap-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* items-start so a short card (four role rows) does not stretch to match a tall one
          (twenty countries) and leave half a screen of empty card under it. */}
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
        {detail.sections.map((section) => (
          <SectionCard key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}
