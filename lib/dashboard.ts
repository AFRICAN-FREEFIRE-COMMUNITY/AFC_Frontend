// lib/dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
// The admin dashboard's API client: one summary call, and one drill-down call per metric.
//
// WHY THIS FILE EXISTS AT ALL (owner audit 2026-09-02)
//   app/(a)/a/dashboard/page.tsx used to call THIRTEEN endpoints inline with a bare `axios`, no
//   auth header, and `.catch(() => null)` on the ones that mattered. Three of those downloaded a
//   whole table just to call `.length` on it (get-all-teams 362 KB, get-all-news 232 KB,
//   get-admin-history 305 KB, about 900 KB to render three integers and ten rows), and one of them
//   is admin-gated, so it answered 400 and the page showed a confident "0" for a table holding
//   2,982 rows.
//
//   Everything the dashboard shows now comes from auth/admin/dashboard-stats/, in one authed
//   request, and every drill-down from auth/admin/dashboard-stats/<metric>/.
//
// CONNECTS TO
//   Backend  afc_auth/views_dashboard.py (admin_dashboard_stats, admin_dashboard_detail;
//            the metric keys below mirror DETAIL_BUILDERS there exactly).
//   Callers  app/(a)/a/dashboard/page.tsx  and  app/(a)/a/dashboard/[metric]/page.tsx.
//   Auth     lib/http.authHeaders(), the same Bearer helper every other lib client uses.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";

import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
const url = (path: string) => `${BASE}/auth/admin/dashboard-stats/${path}`;

/** Every metric with a drill-down. MIRRORS views_dashboard.DETAIL_BUILDERS; a key that is not in
 *  that registry 404s, which is why the dashboard cards link from this list rather than free
 *  strings. */
export const DASHBOARD_METRICS = [
  "members",
  "teams",
  "tournaments",
  "scrims",
  "news",
  "shop",
  "revenue",
  "kills",
  "match-stats",
  "formats",
  "activity",
] as const;

export type DashboardMetric = (typeof DASHBOARD_METRICS)[number];

export function isDashboardMetric(value: string): value is DashboardMetric {
  return (DASHBOARD_METRICS as readonly string[]).includes(value);
}

export interface DashboardSummary {
  members: { total: number; verified: number; this_month: number };
  teams: { total: number; this_month: number };
  events: {
    tournaments: number;
    tournaments_active: number;
    scrims: number;
    scrims_active: number;
    popular_format: string | null;
  };
  news: { total: number; published: number };
  combat: {
    solo_kills: number;
    team_kills: number;
    total_kills: number;
    player_match_records: number;
    solo_match_records: number;
  };
  shop: {
    products: number;
    variants: number;
    diamond_variants: number;
    orders_total: number;
    orders_paid: number;
    /** Decimal as a STRING. Money must not travel as a float. */
    revenue_paid: string;
    diamond_bundles_sold: number;
    diamond_revenue: string;
    top_bundle: string | null;
  };
  activity: { admin_actions_total: number };
}

/** One table in a drill-down. `rows` are pre-formatted primitives, so the renderer never needs to
 *  know what a Team or an Order is. */
export interface DetailSection {
  key: string;
  title: string;
  note: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface DashboardDetail {
  metric: string;
  title: string;
  subtitle: string;
  headline: { label: string; value: string | number; hint: string }[];
  sections: DetailSection[];
}

export const dashboardApi = {
  /** GET dashboard-stats/ - every figure on the dashboard, in one authed request. */
  summary: async (): Promise<DashboardSummary> => {
    const res = await axios.get(url(""), { headers: authHeaders() });
    return res.data;
  },

  /** GET dashboard-stats/<metric>/ - the breakdown behind one number. 404s on an unknown metric
   *  rather than rendering an empty view. */
  detail: async (metric: string): Promise<DashboardDetail> => {
    const res = await axios.get(url(`${metric}/`), { headers: authHeaders() });
    return res.data;
  },
};
