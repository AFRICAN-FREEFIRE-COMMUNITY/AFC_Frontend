"use client";

// ── MyPlayerReports (owner 2026-06-20) ───────────────────────────────────────
// The "My reports" tab body on the owner's own profile (/profile?tab=reports).
// Lists the player-to-player reports THIS user filed, with the admin's answer +
// current status, so a reporter can see how their report was handled. The deep
// link in the "Your report was reviewed" notification points here.
//
// Data: GET /auth/my-player-reports/ (afc_auth.views_player_reports.my_player_reports)
// returns only the caller's own reports (no other reporter's data, no flags).
// Copy: messages/en/playerReports.json (mine.*). Times render in the viewer's tz.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NothingFound } from "@/components/NothingFound";
import { IconFlag } from "@tabler/icons-react";

interface MyReport {
  id: number;
  reported_username: string | null;
  category: string;
  details: string;
  evidence: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  admin_response: string;
  created_at: string | null;
}

// Status -> Badge styling. Resolved is green, dismissed muted, reviewing amber,
// open default. Kept inline (small, local to this view).
const STATUS_CLASS: Record<string, string> = {
  open: "border-primary/50 text-primary",
  reviewing: "border-yellow-500/60 text-yellow-600 dark:text-yellow-400",
  resolved: "border-green-600/60 text-green-600 dark:text-green-400",
  dismissed: "border-muted-foreground/40 text-muted-foreground",
};

export function MyPlayerReports() {
  const t = useTranslations("playerReports");
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = Cookies.get("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/my-player-reports/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (!cancelled) setReports(res.data?.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <FullLoader />;

  if (reports.length === 0) {
    return <NothingFound text={t("mine.empty")} />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">{t("mine.title")}</h3>
      {reports.map((r) => (
        <div key={r.id} className="rounded-md border bg-card p-4 space-y-3">
          {/* header: who was reported + category + status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconFlag className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm font-medium">
                {t("mine.reportedLabel")}:{" "}
                {r.reported_username || t("mine.deletedPlayer")}
              </span>
              <Badge variant="outline" className="text-xs">
                {t(`mine.category.${r.category}`)}
              </Badge>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${STATUS_CLASS[r.status] || ""}`}
            >
              {t(`mine.status.${r.status}`)}
            </Badge>
          </div>

          {/* filed date */}
          {r.created_at && (
            <p className="text-xs text-muted-foreground">
              {t("mine.filedOn", { date: "" })}
              <LocalTime value={r.created_at} />
            </p>
          )}

          {/* the reporter's own notes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("mine.yourNotes")}
            </p>
            <p className="text-sm whitespace-pre-wrap">{r.details}</p>
          </div>

          {/* the admin's answer (or a "no answer yet" note) */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("mine.adminAnswer")}
            </p>
            {r.admin_response?.trim() ? (
              <p className="text-sm whitespace-pre-wrap">{r.admin_response}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {t("mine.noAnswerYet")}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
