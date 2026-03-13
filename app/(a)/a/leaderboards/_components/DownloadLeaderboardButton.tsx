"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconDownload,
  IconPhoto,
  IconTable,
  IconLoader2,
  IconUsers,
  IconUser,
} from "@tabler/icons-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export interface LeaderboardData {
  teamRows: any[];
  playerRows: any[];
}

interface Props {
  leaderboardName: string;
  /** Pass data directly when already loaded (individual page) */
  teamRows?: any[];
  playerRows?: any[];
  /** Fetch on first download click (list page) */
  fetchData?: () => Promise<LeaderboardData>;
  participantType?: "team" | "solo";
  /** Kill point value — used to compute placement pts for PLACE column */
  killPoint?: number;
}

const ROWS_PER_PAGE = 15;

// ── Canvas helpers ─────────────────────────────────────────────────────────────


function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Template-based team canvas (1080×1080) ─────────────────────────────────────
// Pixel positions tuned to /public/assets/leaderboard-template.png

async function drawTeamPageWithTemplate(
  rows: any[], // up to ROWS_PER_PAGE rows for this page
  startRank: number, // global rank of the first row (1-based)
  pageNum: number,
  totalPages: number,
  killPoint: number,
): Promise<HTMLCanvasElement> {
  const W = 1080,
    H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Draw template background
  const templateImg = await loadImage("/assets/leaderboard-template.png");
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, W, H);
  } else {
    // Fallback: plain dark background
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
  }

  // ── Row layout (tuned to template) ──
  // Header area ends around y=195; footer starts around y=930
  // 15 rows across ~735px → ~49px each
  const ROW_START_Y = 197; // top edge of first row box
  const ROW_H = 48.8; // row height

  // Column x positions (1080px wide template, aligned to header text)
  // # | TEAM NAME ···· | BOOYAH | PLACE | KILLS | TOTAL
  const COL_RANK_CX = 62; // rank: centered
  const COL_NAME_X = 120; // team name: left-aligned
  const COL_NAME_MAXW = 455; // max team name width before truncation
  const COL_BOOYAH_CX = 622; // booyah: centered
  const COL_PLACE_CX = 732; // placement pts: centered
  const COL_KILLS_CX = 838; // kills: centered
  const COL_TOTAL_RX = 950; // total: RIGHT-aligned (prevents right-border overflow)

  const rankColors = ["#f6c90e", "#b0b8c1", "#cd7c2f"]; // gold, silver, bronze

  ctx.textBaseline = "middle";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const globalRank = startRank + i;
    const cy = ROW_START_Y + i * ROW_H + ROW_H / 2;

    const name =
      row.team_name ||
      row.competitor__user__username ||
      row.username ||
      "Unknown";
    const kills = (row.total_kills || row.kills) ?? 0;
    const booyah = row.total_booyah ?? 0;
    const total = row.total_points || row.total_pts || 0;
    // Placement pts = total – (kills × kill_point)
    const placePts =
      killPoint > 0 ? Math.max(0, total - kills * killPoint).toFixed(1) : "—";

    const isTop3 = globalRank <= 3;

    // Rank
    ctx.fillStyle = isTop3 ? rankColors[globalRank - 1] : "#e5e7eb";
    ctx.font = `bold ${isTop3 ? 21 : 19}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(globalRank), COL_RANK_CX, cy);

    // Team name
    ctx.fillStyle = "#ffffff";
    ctx.font = `${isTop3 ? "bold " : ""}19px 'Arial', sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(truncateText(ctx, name, COL_NAME_MAXW), COL_NAME_X, cy);

    // Booyah
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "18px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(booyah), COL_BOOYAH_CX, cy);

    // Placement pts
    ctx.fillText(placePts, COL_PLACE_CX, cy);

    // Kills
    ctx.fillText(String(kills), COL_KILLS_CX, cy);

    // Total — right-aligned so it never clips the right border
    ctx.fillStyle = isTop3 ? "#fde047" : "#d4f764";
    ctx.font = `bold ${isTop3 ? 20 : 18}px 'Arial', sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(total.toFixed(1), COL_TOTAL_RX, cy);
  }

  // Page indicator (only when there are multiple pages)
  if (totalPages > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 16px 'Arial', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Page ${pageNum} / ${totalPages}`, W - 36, 928);
  }

  return canvas;
}

// ── Template-based player canvas (1080×1080) ──────────────────────────────────
// Reuses the same template image; player columns mapped to template column slots:
//   # | USERNAME (NAME) | TEAM (BOOYAH slot) | KILLS (PLACE slot) | DMG (KILLS slot) | ASSISTS (TOTAL slot)

async function drawPlayerPageWithTemplate(
  rows: any[],
  startRank: number,
  pageNum: number,
  totalPages: number,
): Promise<HTMLCanvasElement> {
  const W = 1080,
    H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Draw template background
  const templateImg = await loadImage("/assets/leaderboard-template.png");
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
  }

  // Same row layout as team template
  const ROW_START_Y = 197;
  const ROW_H = 48.8;

  // Reuse same column x positions — re-purpose for player data:
  // COL_RANK_CX   → rank
  // COL_NAME_X    → username (left-aligned)
  // COL_BOOYAH_CX → team name (centered)
  // COL_PLACE_CX  → kills (centered)
  // COL_KILLS_CX  → damage (centered)
  // COL_TOTAL_RX  → assists (right-aligned)
  const COL_RANK_CX = 62;
  const COL_NAME_X = 120;
  const COL_NAME_MAXW = 400; // shorter so team name fits
  const COL_TEAM_CX = 590;
  const COL_KILLS_CX = 700;
  const COL_DMG_CX = 810;
  const COL_ASSISTS_RX = 950;

  const rankColors = ["#f6c90e", "#b0b8c1", "#cd7c2f"];

  ctx.textBaseline = "middle";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const globalRank = startRank + i;
    const cy = ROW_START_Y + i * ROW_H + ROW_H / 2;

    const username = row.username || row.competitor__user__username || "Unknown";
    const teamName = row.team_name || "—";
    const kills = row.total_kills ?? 0;
    const damage = row.total_damage ?? 0;
    const assists = row.total_assists ?? 0;

    const isTop3 = globalRank <= 3;

    // Rank
    ctx.fillStyle = isTop3 ? rankColors[globalRank - 1] : "#e5e7eb";
    ctx.font = `bold ${isTop3 ? 21 : 19}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(globalRank), COL_RANK_CX, cy);

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = `${isTop3 ? "bold " : ""}19px 'Arial', sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(truncateText(ctx, username, COL_NAME_MAXW), COL_NAME_X, cy);

    // Team
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "16px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(truncateText(ctx, teamName, 160), COL_TEAM_CX, cy);

    // Kills
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "18px 'Arial', sans-serif";
    ctx.fillText(String(kills), COL_KILLS_CX, cy);

    // Damage
    ctx.fillText(String(damage), COL_DMG_CX, cy);

    // Assists — right-aligned
    ctx.fillStyle = isTop3 ? "#fde047" : "#d4f764";
    ctx.font = `bold ${isTop3 ? 20 : 18}px 'Arial', sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(String(assists), COL_ASSISTS_RX, cy);
  }

  // Page indicator
  if (totalPages > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 16px 'Arial', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Page ${pageNum} / ${totalPages}`, W - 36, 928);
  }

  return canvas;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DownloadLeaderboardButton({
  leaderboardName,
  teamRows: teamRowsProp,
  playerRows: playerRowsProp,
  fetchData,
  participantType = "team",
  killPoint = 1,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [cache, setCache] = useState<LeaderboardData | null>(null);

  const getData = async (): Promise<LeaderboardData> => {
    if (teamRowsProp !== undefined || playerRowsProp !== undefined) {
      return { teamRows: teamRowsProp ?? [], playerRows: playerRowsProp ?? [] };
    }
    if (cache) return cache;
    if (!fetchData) return { teamRows: [], playerRows: [] };
    const fetched = await fetchData();
    setCache(fetched);
    return fetched;
  };

  const handleTeamImage = async () => {
    setBusy(true);
    try {
      const { teamRows } = await getData();
      if (teamRows.length === 0) {
        toast.error("No team leaderboard data to download");
        return;
      }

      const totalPages = Math.ceil(teamRows.length / ROWS_PER_PAGE);

      for (let p = 0; p < totalPages; p++) {
        const pageRows = teamRows.slice(
          p * ROWS_PER_PAGE,
          (p + 1) * ROWS_PER_PAGE,
        );
        const startRank = p * ROWS_PER_PAGE + 1;
        const canvas = await drawTeamPageWithTemplate(
          pageRows,
          startRank,
          p + 1,
          totalPages,
          killPoint,
        );
        const suffix = totalPages > 1 ? `-page${p + 1}` : "";
        downloadCanvas(canvas, `${leaderboardName}-standings${suffix}.png`);
        // Small delay between downloads so the browser doesn't block them
        if (p < totalPages - 1) await new Promise((r) => setTimeout(r, 300));
      }

      toast.success(
        totalPages > 1
          ? `Downloaded ${totalPages} images (${teamRows.length} teams)`
          : "Team standings image downloaded",
      );
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  const handlePlayerImage = async () => {
    setBusy(true);
    try {
      const { playerRows } = await getData();
      if (playerRows.length === 0) {
        toast.error("No player leaderboard data to download");
        return;
      }

      const totalPages = Math.ceil(playerRows.length / ROWS_PER_PAGE);

      for (let p = 0; p < totalPages; p++) {
        const pageRows = playerRows.slice(
          p * ROWS_PER_PAGE,
          (p + 1) * ROWS_PER_PAGE,
        );
        const startRank = p * ROWS_PER_PAGE + 1;
        const canvas = await drawPlayerPageWithTemplate(
          pageRows,
          startRank,
          p + 1,
          totalPages,
        );
        const suffix = totalPages > 1 ? `-page${p + 1}` : "";
        downloadCanvas(canvas, `${leaderboardName}-players${suffix}.png`);
        if (p < totalPages - 1) await new Promise((r) => setTimeout(r, 300));
      }

      toast.success(
        totalPages > 1
          ? `Downloaded ${totalPages} images (${playerRows.length} players)`
          : "Player leaderboard image downloaded",
      );
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  const handleExcel = async () => {
    setBusy(true);
    try {
      const { teamRows, playerRows } = await getData();
      if (teamRows.length === 0 && playerRows.length === 0) {
        toast.error("No leaderboard data to download");
        return;
      }

      const wb = XLSX.utils.book_new();

      if (teamRows.length > 0) {
        const teamHeaders = [
          "Rank",
          "Team",
          "Matches Played",
          "Booyahs",
          "Kills",
          "Total Points",
        ];
        const teamData = teamRows.map((row, idx) => [
          idx + 1,
          row.team_name ||
            row.competitor__user__username ||
            row.username ||
            "Unknown",
          row.matches_played ?? "",
          row.total_booyah ?? "",
          (row.total_kills || row.kills) ?? 0,
          parseFloat((row.total_points || row.total_pts || 0).toFixed(1)),
        ]);
        const wsTeam = XLSX.utils.aoa_to_sheet([teamHeaders, ...teamData]);
        wsTeam["!cols"] = [
          { wch: 6 },
          { wch: 30 },
          { wch: 15 },
          { wch: 10 },
          { wch: 8 },
          { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, wsTeam, "Team Leaderboard");
      }

      if (playerRows.length > 0) {
        const playerHeaders = [
          "Rank",
          "Player",
          "Team",
          "Kills",
          "Damage",
          "Assists",
        ];
        const playerData = playerRows.map((p, idx) => [
          idx + 1,
          p.username || "Unknown",
          p.team_name || "—",
          p.total_kills ?? 0,
          p.total_damage ?? 0,
          p.total_assists ?? 0,
        ]);
        const wsPlayer = XLSX.utils.aoa_to_sheet([
          playerHeaders,
          ...playerData,
        ]);
        wsPlayer["!cols"] = [
          { wch: 6 },
          { wch: 25 },
          { wch: 25 },
          { wch: 8 },
          { wch: 10 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, wsPlayer, "Player Leaderboard");
      }

      XLSX.writeFile(wb, `${leaderboardName}-leaderboard.xlsx`);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Failed to generate Excel");
    } finally {
      setBusy(false);
    }
  };

  const isSolo = participantType === "solo";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? (
            <IconLoader2 size={16} className="animate-spin" />
          ) : (
            <IconDownload size={16} />
          )}
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2">
          <IconUsers size={14} /> {isSolo ? "Solo" : "Team"} Standings
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleTeamImage}>
          <IconPhoto size={14} className="mr-2" />
          Image (1080×1080) — Template
        </DropdownMenuItem>

        {!isSolo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <IconUser size={14} /> Player Leaderboard
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handlePlayerImage()}>
              <IconPhoto size={14} className="mr-2" />
              Image (1080×1080) — Template
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExcel}>
          <IconTable size={14} className="mr-2" />
          Excel (.xlsx) — All Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
