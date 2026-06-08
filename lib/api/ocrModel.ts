import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

/**
 * Typed client for the self-hosted OCR MODEL ops API (all routes under /events/ocr/).
 *
 * Mirrors lib/api/ocr.ts / lib/rankingsAdmin.ts (axios + the BASE url + Bearer-from-cookie
 * auth): every call carries the Bearer token read from the same `auth_token` cookie that
 * AuthContext sets (js-cookie), so callers don't have to thread it through props/hooks. Every
 * endpoint here is admin-gated server-side (head_admin), exactly like the rest of the admin API.
 *
 * This is the api surface for the admin "OCR Model" dashboard at app/(a)/a/ocr-model/page.tsx,
 * which is the ONLY consumer:
 *   - getModelStats()    backs the StatCards, the weekly local-share / zero-touch charts, the
 *                        dataset-growth chart, and the retrain-history table.
 *   - getRetrainStatus() backs the "Retrain status" indicator in the Controls card (is a retrain
 *                        due, how many new gold labels since the last dataset version).
 *   - downloadDataset()  backs the "Download training dataset" button: it streams the training
 *                        ZIP back as a blob and clicks a hidden anchor to save it to disk.
 *   - promoteModel()     backs the Promote (version) action; rollbackModel() backs Rollback.
 *
 * NOTE: there is also POST /events/ocr/upload-model/ on the backend, but that is called by the
 * offline PC trainer that ships a freshly trained model up - NOT by this page - so it is
 * deliberately omitted from this client.
 *
 * Backend lives in afc_ocr (the same app as lib/api/ocr.ts). The retrain flywheel works off the
 * OCRTrainingPair corpus (gold = admin-confirmed reads, silver = high-confidence auto reads,
 * synthetic = generated). Errors surface as axios errors with `err.response.data.message` -
 * handle them with a toast at the call site, like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// All OCR-model endpoints sit under the /events/ocr/ prefix (afc_ocr.urls is included there).
const url = (path: string) => `${BASE}/events/ocr/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}

// ── Types ───────────────────────────────────────────────────────────────────────
//
// These mirror the JSON the backend hands back from GET /events/ocr/model-stats/ and
// GET /events/ocr/retrain-status/. Every field is optional / nullable so the dashboard renders
// its empty states (no model deployed yet, empty corpus) without crashing on a partial payload.

/** The currently promoted model, or null bounds when nothing has been deployed yet. */
export interface ActiveModel {
  version: string | null; // e.g. "local_student_v3"; null => Gemini is handling every read
  promoted_at: string | null; // ISO timestamp the active version went live
}

/**
 * The training-corpus counts (the OCRTrainingPair pool the trainer learns from).
 *   gold      = admin-confirmed reads (the trustworthy labels)
 *   silver    = high-confidence auto reads (weak labels)
 *   synthetic = generated training rows
 *   total     = gold + silver + synthetic
 *   clean     = rows that passed validation and are eligible for the next dataset
 */
export interface Corpus {
  gold: number;
  silver: number;
  synthetic: number;
  total: number;
  clean: number;
}

/** One week of OCR engine usage (the flywheel-tracking series). */
export interface WeeklyStat {
  week: string; // "YYYY-Www" or "YYYY-MM-DD" week anchor (rendered compactly on the axis)
  scans: number; // total screenshots read that week
  local: number; // reads answered by the self-hosted local model
  gemini: number; // reads that fell through to Gemini
  hybrid: number; // reads answered by the hybrid (local + Gemini-assist) path
  local_share: number; // % of scans the local model answered (0..100) - the headline metric
  zero_touch: number; // % of scans committed with NO admin edits (0..100)
  gemini_calls: number; // raw Gemini API calls that week (the cost proxy)
}

/** One retrain attempt in the history table. */
export interface RetrainEvent {
  at: string; // ISO timestamp of the retrain run
  shipped: boolean; // true => the new model beat the active one and was promoted; false => rejected
  reason: string; // why it shipped / was rejected (e.g. "eval WER 4.1% < 5.2%")
  version: string; // the candidate model version this run produced
}

/** One point in the cumulative dataset-growth series (gold labels accreting over time). */
export interface DatasetGrowthPoint {
  week: string; // week anchor (same format as WeeklyStat.week)
  cumulative_gold: number; // running total of gold labels by the end of that week
}

/** Full payload from GET /events/ocr/model-stats/. */
export interface ModelStats {
  active_model: ActiveModel;
  corpus: Corpus;
  weekly: WeeklyStat[];
  retrain_history: RetrainEvent[];
  shadow: Record<string, any>; // shadow-eval block (reserved; not rendered yet)
  dataset_growth: DatasetGrowthPoint[];
}

/** Payload from GET /events/ocr/retrain-status/ (is a retrain due, and why). */
export interface RetrainStatus {
  due: boolean; // true => enough new gold has accrued to justify a retrain
  new_gold_since_last: number; // gold labels added since the last dataset version was cut
  last_dataset_version: string | null; // the dataset version the active model trained on
  reason: string; // human reason ("142 new gold labels since v3" / "not enough new data")
}

/** Options for the dataset export (which splits to include + synthetic toggle). */
export interface DatasetExportOpts {
  // Which splits to bundle into the ZIP. Defaults to ["train", "eval"] when omitted.
  splits?: ("train" | "eval")[];
  // Whether to include the synthetic rows alongside the real ones. Defaults to true.
  include_synthetic?: boolean;
}

export const ocrModelApi = {
  // ── Read: dashboard stats ───────────────────────────────────────────────────
  /**
   * GET /events/ocr/model-stats/
   * Returns the full dashboard payload: active model, corpus counts, the weekly engine-usage
   * series (local share / zero-touch / Gemini calls), retrain history, and the dataset-growth
   * series. Consumed by app/(a)/a/ocr-model/page.tsx to drive every StatCard, chart, and the
   * retrain-history table.
   */
  getModelStats: () => aGet<ModelStats>("model-stats/"),

  /**
   * GET /events/ocr/retrain-status/
   * Returns whether a retrain is due and how much new gold has accrued since the last dataset
   * version. Consumed by the "Retrain status" indicator in the dashboard's Controls card.
   */
  getRetrainStatus: () => aGet<RetrainStatus>("retrain-status/"),

  // ── Action: download the training dataset (browser file download) ────────────
  /**
   * GET /events/ocr/dataset-export/?splits=train,eval&include_synthetic=true
   * Streams the training dataset back as a ZIP (application/zip). Because this is a binary
   * download (not JSON), we request `responseType: "blob"`, wrap the bytes in an object URL, and
   * click a hidden <a download> to save the file to disk - the same browser-download idiom used
   * for CSV/PDF exports elsewhere in the app. Returns the chosen filename (so the caller can
   * surface it in a toast). Consumed by the dashboard's "Download training dataset" button.
   */
  downloadDataset: async (opts?: DatasetExportOpts): Promise<string> => {
    // Build the query: splits as a comma-joined list, plus the synthetic toggle. Defaults match
    // the backend contract (train+eval, synthetic included) so a bare call still does the right thing.
    const splits = (opts?.splits ?? ["train", "eval"]).join(",");
    const includeSynthetic = opts?.include_synthetic ?? true;

    // responseType "blob" is what makes axios hand back raw bytes instead of parsed JSON.
    const res = await axios.get(url("dataset-export/"), {
      params: { splits, include_synthetic: includeSynthetic },
      headers: authHeaders(),
      responseType: "blob",
    });

    // Prefer the server-suggested filename (Content-Disposition); fall back to a dated default.
    const disposition: string =
      (res.headers?.["content-disposition"] as string) ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename =
      match?.[1] ?? `ocr-training-dataset-${new Date().toISOString().slice(0, 10)}.zip`;

    // Wrap the blob in a temporary object URL and click a hidden anchor to trigger the download,
    // then revoke the URL so we don't leak it. This is the standard blob-download pattern.
    const blobUrl = window.URL.createObjectURL(
      new Blob([res.data], { type: "application/zip" }),
    );
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);

    return filename;
  },

  // ── Action: promote / rollback the active model ─────────────────────────────
  /**
   * POST /events/ocr/promote/  ({ version })
   * Promotes the named model version to be the active read engine. Returns the new active
   * version. Consumed by the dashboard's Promote control (version input + confirm).
   */
  promoteModel: (version: string) =>
    aPost<{ active_model: ActiveModel; version?: string; message?: string }>(
      "promote/",
      { version },
    ),

  /**
   * POST /events/ocr/rollback/
   * Rolls the active model back to the previously promoted version. Returns the new active
   * version. Consumed by the dashboard's Rollback control (confirm dialog).
   */
  rollbackModel: () =>
    aPost<{ active_model: ActiveModel; version?: string; message?: string }>(
      "rollback/",
    ),
};
