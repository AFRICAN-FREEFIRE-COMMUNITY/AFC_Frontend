// ─────────────────────────────────────────────────────────────────────────────
// Admin › OCR Model  (self-hosted OCR model ops dashboard)
//
// Shows how the self-hosted OCR model is performing week over week (the "flywheel":
// the local model answers a growing share of reads, Gemini handles fewer, admins edit
// less), and gives an admin the three operator controls: download the training dataset,
// see whether a retrain is due, and promote / roll back the active model version.
//
// DATA SOURCE (two read round-trips):
//   ocrModelApi.getModelStats()     ->  GET /events/ocr/model-stats/     (the whole dashboard)
//   ocrModelApi.getRetrainStatus()  ->  GET /events/ocr/retrain-status/  (the Controls indicator)
//   Both live in lib/api/ocrModel.ts; both are admin-gated (head_admin) server-side, carrying the
//   Bearer auth_token cookie like every other admin call. The write controls hit:
//     ocrModelApi.downloadDataset()  ->  GET  /events/ocr/dataset-export/  (a ZIP blob download)
//     ocrModelApi.promoteModel(v)    ->  POST /events/ocr/promote/
//     ocrModelApi.rollbackModel()    ->  POST /events/ocr/rollback/
//
// GATING: this page sits under app/(a)/a/layout.tsx, which wraps the whole admin tree in
// <ProtectedRoute adminOnly>, so a non-admin is bounced before this component ever renders -
// exactly like every sibling admin page (we do NOT re-implement a guard here). The sidebar entry
// in constants/nav-links.ts is additionally gated to head_admin so only they see the link.
//
// EMPTY STATES (never an infinite spinner):
//   - active_model.version null  -> "No model deployed yet, Gemini is handling all reads".
//   - empty corpus / weekly       -> calm placeholders inside each card, the page still renders.
//
// DESIGN: AFC constants throughout (DM Sans, green-primary heading via PageHeader, rounded-md
// bordered Cards, text-xs dense tables with text-foreground headers, outline rounded-full badges,
// shadcn pill Tabs, recharts themed off the CSS vars exactly like the organizer Metrics page).
// No em/en dashes anywhere in user-facing copy.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/ui/info-tip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconCpu,
  IconChartLine,
  IconDatabase,
  IconDownload,
  IconHandClick,
  IconRefresh,
  IconRobot,
  IconArrowBackUp,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconCloudComputing,
} from "@tabler/icons-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  ocrModelApi,
  type ModelStats,
  type RetrainStatus,
} from "@/lib/api/ocrModel";

// ── Chart palette ───────────────────────────────────────────────────────────────
// Theme line/area fills off the AFC CSS vars (primary green + gold), exactly like the
// organizer Metrics page, so the charts read as the same designer's work.
const C_PRIMARY = "var(--primary)";
const C_GOLD = "var(--gold)";
const C_BLUE = "#60a5fa"; // blue-400, the accent used elsewhere for a third series

// Shared recharts Tooltip style (card bg, border, small text) used by every chart.
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

// ── Formatters ──────────────────────────────────────────────────────────────────

// "1,234" thousands-separated integer (null/undefined safe).
const fmtInt = (n: number | null | undefined): string => (n ?? 0).toLocaleString();

// "82.4%" one-decimal percentage from a 0..100 number (null safe).
const fmtPct = (n: number | null | undefined): string =>
  n == null ? "-" : `${Number(n).toFixed(1)}%`;

// ISO timestamp -> "Jun 7, 2026" (null -> "-"). Used for promoted-at / retrain dates.
const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// A week anchor ("2026-W23" or "2026-06-01") -> a compact axis label. We keep the last
// token so a date collapses to the day and an ISO-week collapses to "W23".
const fmtWeek = (key: string): string => {
  if (!key) return "";
  if (key.includes("W")) return key.split("-").slice(1).join("-"); // "2026-W23" -> "W23"
  const d = new Date(key);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("default", { month: "short", day: "numeric" });
  }
  return key;
};

// ── StatCard ──────────────────────────────────────────────────────────────────
// The AFC headline-stat idiom (icon chip + big number + muted label), identical to the
// organizer Metrics StatCard so the two dashboards read as one designer's work. `sub` hangs
// a muted line under the value; `valueClass` lets a metric pop in gold/green where it earns it.
function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/80">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Calm empty placeholder for a chart card with no data yet. ──
function EmptyChart({ label }: { label?: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
      {label || "No data to chart yet."}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OcrModelPage() {
  // The two read payloads. `stats` backs the whole page; `retrain` backs the Controls indicator.
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [retrain, setRetrain] = useState<RetrainStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Controls state: in-flight flags so buttons disable while a request is out, plus the
  // version-to-promote input and the rollback confirm dialog open flag.
  const [downloading, setDownloading] = useState(false);
  const [promoteVersion, setPromoteVersion] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // ── Load both read payloads. retrain-status is non-blocking: if it fails the dashboard still
  // renders (the indicator just shows "unknown"), so one flaky endpoint never blanks the page. ──
  // Backed by GET /events/ocr/model-stats/ and GET /events/ocr/retrain-status/.
  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        ocrModelApi.getModelStats(),
        ocrModelApi.getRetrainStatus().catch(() => null), // tolerate a missing/failing status
      ]);
      setStats(s ?? null);
      setRetrain(r ?? null);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load OCR model stats.",
      );
    } finally {
      // Always clear the loader, including on error, so the page never spins forever.
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive the view-model from the payload (memoised; recomputes on new data). ──
  const active = stats?.active_model;
  const corpus = stats?.corpus;
  const weekly = useMemo(() => stats?.weekly ?? [], [stats?.weekly]);
  const retrainHistory = useMemo(
    () => stats?.retrain_history ?? [],
    [stats?.retrain_history],
  );
  const datasetGrowth = useMemo(
    () => stats?.dataset_growth ?? [],
    [stats?.dataset_growth],
  );

  // Whether a model has ever been deployed. When false the headline reads "Gemini handling
  // all reads" and the promote/rollback area explains there is nothing to roll back to yet.
  const hasModel = !!active?.version;

  // The latest (most recent) weekly row drives the headline StatCards (this-week numbers).
  const latestWeek = weekly.length > 0 ? weekly[weekly.length - 1] : null;

  // ── Controls handlers ──────────────────────────────────────────────────────────

  // Download the training dataset ZIP. The client streams the blob and clicks a hidden anchor
  // (see ocrModelApi.downloadDataset); here we just toggle the in-flight flag and toast the result.
  // Hits GET /events/ocr/dataset-export/.
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const filename = await ocrModelApi.downloadDataset(); // default splits train+eval, synthetic on
      toast.success(`Training dataset downloaded (${filename}).`);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to download the dataset.",
      );
    } finally {
      setDownloading(false);
    }
  };

  // Promote the typed version to be the active read engine. Hits POST /events/ocr/promote/.
  // On success we refetch so every card reflects the new active model.
  const handlePromote = async () => {
    const version = promoteVersion.trim();
    if (!version) {
      toast.error("Enter a model version to promote.");
      return;
    }
    setPromoting(true);
    try {
      await ocrModelApi.promoteModel(version);
      toast.success(`Promoted ${version} to the active model.`);
      setPromoteVersion("");
      await load(); // refresh active_model + the rest of the dashboard
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to promote the model.");
    } finally {
      setPromoting(false);
    }
  };

  // Roll the active model back to the previously promoted version. Hits POST /events/ocr/rollback/.
  // Confirmed via the dialog first; on success we close the dialog and refetch.
  const handleRollback = async () => {
    setRollingBack(true);
    try {
      const res = await ocrModelApi.rollbackModel();
      const newVersion = res?.active_model?.version ?? res?.version ?? null;
      toast.success(
        newVersion
          ? `Rolled back. Active model is now ${newVersion}.`
          : "Rolled back to the previous model.",
      );
      setRollbackOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to roll back the model.");
    } finally {
      setRollingBack(false);
    }
  };

  // ── First load: calm full-page loader (the page renders as soon as model-stats lands). ──
  if (loading && stats === null) {
    return <FullLoader text="Loading OCR model stats..." />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title is a ReactNode so the page-level info tip can sit right after the heading.
          InfoTip uses an inline `text` (not a HELP id) so we don't have to register a key
          in lib/help-content.ts for this one-off explainer. No em/en dashes in the copy. */}
      <PageHeader
        title={
          <span className="inline-flex items-center">
            OCR Model
            <InfoTip
              className="ml-1.5"
              text="The self-hosted OCR model reads kills and placements off match screenshots so admins do not have to type them. Each week it answers more reads on its own (local share) and needs fewer admin edits (zero-touch), while leaning on Gemini less often. Confirmed reads become gold training labels that feed the next retrain."
            />
          </span>
        }
        description="How the self-hosted OCR model performs each week, plus dataset and model controls."
      />

      {/* ── Headline scorecards: the numbers an operator checks first. ───────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {/* Active model version + when it was promoted (or the Gemini-only fallback). */}
        <StatCard
          icon={<IconCpu className="size-5" />}
          label="Active model"
          value={hasModel ? (active!.version as string) : "Gemini only"}
          sub={
            hasModel
              ? `Promoted ${fmtDate(active!.promoted_at)}`
              : "No model deployed yet"
          }
          valueClass={hasModel ? "text-primary" : undefined}
        />
        {/* Headline local share this week (the flywheel number, big and green). */}
        <StatCard
          icon={<IconChartLine className="size-5" />}
          label="Local share this week"
          value={fmtPct(latestWeek?.local_share)}
          sub="reads answered locally"
          valueClass="text-primary"
        />
        {/* Zero-touch rate this week (reads committed with no admin edits). */}
        <StatCard
          icon={<IconHandClick className="size-5" />}
          label="Zero-touch rate"
          value={fmtPct(latestWeek?.zero_touch)}
          sub="committed with no edits"
          valueClass="text-gold"
        />
        {/* Gemini calls this week (the cost proxy: fewer is cheaper). */}
        <StatCard
          icon={<IconRobot className="size-5" />}
          label="Gemini calls this week"
          value={fmtInt(latestWeek?.gemini_calls)}
          sub="cost proxy, lower is better"
        />
        {/* Dataset size: gold labels (the trustworthy training pool). */}
        <StatCard
          icon={<IconDatabase className="size-5" />}
          label="Dataset size"
          value={fmtInt(corpus?.gold)}
          sub={`${fmtInt(corpus?.total)} total labels`}
        />
      </div>

      {/* ── No-model banner: make the Gemini-only state explicit (calm, not an error). ── */}
      {!hasModel && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconCloudComputing className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                No model deployed yet, Gemini is handling all reads.
              </p>
              <p className="text-xs text-muted-foreground">
                Once gold labels accrue and a model is trained, promote it below to start
                shifting reads onto the local model.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Detail under pill Tabs (keeps the surface scannable as it grows). ──────── */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="history">Retrain history</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
        </TabsList>

        {/* ════════ TAB 1 - Performance: local share + zero-touch over the weeks ════════ */}
        {/* Sourced from model-stats.weekly. The two lines are the flywheel climbing: the
            local model answering a growing share of reads and needing fewer admin edits. */}
        <TabsContent value="performance" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconChartLine className="size-4" />
                Local share and zero-touch over time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weekly.length < 2 ? (
                <EmptyChart label="Not enough weekly data to plot a trend yet. This chart fills in once there are two or more weeks of reads." />
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weekly}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="week"
                        tickFormatter={fmtWeek}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        width={42}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--foreground)" }}
                        labelFormatter={(l) => fmtWeek(String(l))}
                        formatter={(v: any, name: any) => [fmtPct(Number(v)), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="local_share"
                        name="Local share"
                        stroke={C_PRIMARY}
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="zero_touch"
                        name="Zero-touch"
                        stroke={C_GOLD}
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gemini calls per week (the cost proxy) as an area chart: the line we want to
              push DOWN as the local model takes over. Also from model-stats.weekly. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconRobot className="size-4" />
                Gemini calls per week
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weekly.length < 2 ? (
                <EmptyChart label="Gemini-call history fills in once there are two or more weeks of reads." />
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={weekly}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="gGemini" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C_BLUE} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C_BLUE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="week"
                        tickFormatter={fmtWeek}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        width={42}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--foreground)" }}
                        labelFormatter={(l) => fmtWeek(String(l))}
                        formatter={(v: any) => [fmtInt(Number(v)), "Gemini calls"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="gemini_calls"
                        name="Gemini calls"
                        stroke={C_BLUE}
                        strokeWidth={2.5}
                        fill="url(#gGemini)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-week engine split table (dense text-xs). The raw numbers behind the charts. */}
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-base">Weekly engine split</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {weekly.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No weekly reads recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-10 p-2 text-foreground">Week</TableHead>
                        <TableHead className="h-10 p-2 text-right text-foreground">Scans</TableHead>
                        <TableHead className="h-10 p-2 text-right text-foreground">Local</TableHead>
                        <TableHead className="h-10 p-2 text-right text-foreground">Hybrid</TableHead>
                        <TableHead className="h-10 p-2 text-right text-foreground">Gemini</TableHead>
                        <TableHead className="h-10 p-2 text-right text-foreground">Local share</TableHead>
                        <TableHead className="h-10 p-2 text-right text-foreground">Zero-touch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...weekly].reverse().map((w) => (
                        <TableRow key={w.week} className="text-xs">
                          <TableCell className="p-2 font-semibold">
                            {fmtWeek(w.week)}
                          </TableCell>
                          <TableCell className="p-2 text-right">{fmtInt(w.scans)}</TableCell>
                          <TableCell className="p-2 text-right">{fmtInt(w.local)}</TableCell>
                          <TableCell className="p-2 text-right">{fmtInt(w.hybrid)}</TableCell>
                          <TableCell className="p-2 text-right">{fmtInt(w.gemini)}</TableCell>
                          <TableCell className="p-2 text-right font-bold text-primary">
                            {fmtPct(w.local_share)}
                          </TableCell>
                          <TableCell className="p-2 text-right font-bold text-gold">
                            {fmtPct(w.zero_touch)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ TAB 2 - Dataset: corpus composition + cumulative gold growth ════════ */}
        <TabsContent value="dataset" className="mt-4 flex flex-col gap-4">
          {/* Corpus composition StatCards: where the training labels come from. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              icon={<IconDatabase className="size-5" />}
              label="Gold labels"
              value={fmtInt(corpus?.gold)}
              sub="admin-confirmed reads"
              valueClass="text-gold"
            />
            <StatCard
              icon={<IconDatabase className="size-5" />}
              label="Silver labels"
              value={fmtInt(corpus?.silver)}
              sub="high-confidence auto reads"
            />
            <StatCard
              icon={<IconDatabase className="size-5" />}
              label="Synthetic"
              value={fmtInt(corpus?.synthetic)}
              sub="generated rows"
            />
            <StatCard
              icon={<IconCircleCheck className="size-5" />}
              label="Clean and eligible"
              value={fmtInt(corpus?.clean)}
              sub="passed validation"
              valueClass="text-primary"
            />
            <StatCard
              icon={<IconDatabase className="size-5" />}
              label="Total corpus"
              value={fmtInt(corpus?.total)}
              sub="all labels combined"
            />
          </div>

          {/* Cumulative gold growth over the weeks (the dataset compounding). From
              model-stats.dataset_growth. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconChartLine className="size-4" />
                Cumulative gold labels
              </CardTitle>
            </CardHeader>
            <CardContent>
              {datasetGrowth.length < 2 ? (
                <EmptyChart label="Dataset-growth history fills in once there are two or more weeks of confirmed reads." />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={datasetGrowth}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C_GOLD} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={C_GOLD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="week"
                        tickFormatter={fmtWeek}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--foreground)" }}
                        labelFormatter={(l) => fmtWeek(String(l))}
                        formatter={(v: any) => [fmtInt(Number(v)), "Gold labels"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulative_gold"
                        name="Cumulative gold"
                        stroke={C_GOLD}
                        strokeWidth={2.5}
                        fill="url(#gGold)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ TAB 3 - Retrain history: every retrain run, shipped or rejected ════════ */}
        {/* From model-stats.retrain_history. Each row is one retrain attempt; the badge says
            whether the candidate beat the active model (Shipped, green) or not (Rejected, red). */}
        <TabsContent value="history" className="mt-4">
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <IconRefresh className="size-4" />
                Retrain history
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {retrainHistory.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No retrains have run yet. History appears here after the first training run.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-10 p-2 text-foreground">Date</TableHead>
                        <TableHead className="h-10 p-2 text-foreground">Version</TableHead>
                        <TableHead className="h-10 p-2 text-foreground">Result</TableHead>
                        <TableHead className="h-10 p-2 text-foreground">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retrainHistory.map((r, i) => (
                        <TableRow key={`${r.version}-${r.at}-${i}`} className="text-xs">
                          <TableCell className="p-2 text-muted-foreground">
                            {fmtDate(r.at)}
                          </TableCell>
                          <TableCell className="p-2 font-semibold">{r.version}</TableCell>
                          <TableCell className="p-2">
                            {/* Outline rounded-full badge per AFC constants: green Shipped / red Rejected. */}
                            {r.shipped ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                              >
                                <IconCircleCheck className="mr-1 size-3" />
                                Shipped
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full border-red-500 px-2 py-0.5 text-xs text-red-600"
                              >
                                <IconCircleX className="mr-1 size-3" />
                                Rejected
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="p-2 text-muted-foreground">{r.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ TAB 4 - Controls: download dataset, retrain status, promote / rollback ════════ */}
        <TabsContent value="controls" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Download the training dataset (GET /events/ocr/dataset-export/ -> a ZIP blob). */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconDownload className="size-4" />
                Training dataset
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Download the current training dataset (train and eval splits, with synthetic
                rows) as a ZIP. The offline PC trainer uses this to train the next model.
              </p>
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full sm:w-auto"
              >
                <IconDownload className="mr-2 size-4" />
                {downloading ? "Preparing ZIP..." : "Download training dataset"}
              </Button>
            </CardContent>
          </Card>

          {/* Retrain status indicator (GET /events/ocr/retrain-status/). Tells the operator
              whether enough new gold has accrued to justify cutting a new dataset and retraining. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconRefresh className="size-4" />
                Retrain status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {retrain == null ? (
                <p className="text-xs text-muted-foreground">
                  Retrain status is unavailable right now.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {retrain.due ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-gold px-2 py-0.5 text-xs text-gold"
                      >
                        <IconAlertTriangle className="mr-1 size-3" />
                        Retrain due
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                      >
                        <IconCircleCheck className="mr-1 size-3" />
                        Up to date
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">New gold since last</p>
                      <p className="text-lg font-bold">
                        {fmtInt(retrain.new_gold_since_last)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last dataset version</p>
                      <p className="text-lg font-bold">
                        {retrain.last_dataset_version ?? "-"}
                      </p>
                    </div>
                  </div>
                  {retrain.reason && (
                    <p className="text-xs text-muted-foreground">{retrain.reason}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Promote / rollback the active model (POST /events/ocr/promote/ and /rollback/). */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconCpu className="size-4" />
                Model deployment
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Current active line, restated here so the operator sees what they are changing. */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Active model:</span>
                {hasModel ? (
                  <span className="font-semibold text-primary">{active!.version}</span>
                ) : (
                  <span className="font-semibold text-muted-foreground">
                    None (Gemini only)
                  </span>
                )}
              </div>

              {/* Promote: type a version, confirm. Hits POST /events/ocr/promote/. */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="promote-version" className="text-xs">
                  Promote a model version
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="promote-version"
                    value={promoteVersion}
                    onChange={(e) => setPromoteVersion(e.target.value)}
                    placeholder="e.g. local_student_v4"
                    className="h-9 text-sm sm:max-w-xs"
                  />
                  <Button
                    onClick={handlePromote}
                    disabled={promoting || !promoteVersion.trim()}
                  >
                    <IconCircleCheck className="mr-2 size-4" />
                    {promoting ? "Promoting..." : "Promote"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Promoting makes that version the active read engine for new screenshots.
                </p>
              </div>

              {/* Rollback: confirm dialog, then POST /events/ocr/rollback/. Disabled with no model. */}
              <div className="flex flex-col gap-2 border-t pt-4">
                <Label className="text-xs">Roll back to the previous model</Label>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!hasModel || rollingBack}
                  onClick={() => setRollbackOpen(true)}
                >
                  <IconArrowBackUp className="mr-2 size-4" />
                  Roll back
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {hasModel
                    ? "Reverts the active model to the previously promoted version."
                    : "Nothing to roll back to yet, no model has been deployed."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Rollback confirm dialog (shadcn Dialog, matches the rankings admin confirm idiom). ── */}
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconArrowBackUp className="size-5" />
              Roll back the active model
            </DialogTitle>
            <DialogDescription>
              This reverts the active read engine to the previously promoted version. New
              screenshots will be read by that older model until you promote again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackOpen(false)}
              disabled={rollingBack}
            >
              Cancel
            </Button>
            <Button onClick={handleRollback} disabled={rollingBack}>
              {rollingBack ? "Rolling back..." : "Confirm rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
