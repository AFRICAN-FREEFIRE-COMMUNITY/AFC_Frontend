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
  teamRows?: any[];
  playerRows?: any[];
  fetchData?: () => Promise<LeaderboardData>;
  participantType?: "team" | "solo";
  killPoint?: number;
}

// Social media: 15 rows per image (single column)
const ROWS_PER_PAGE = 15;

// YouTube: 12 rows per column, 2 columns = 24 per image
const ROWS_PER_COL_YT = 12;
const ROWS_PER_PAGE_YT = ROWS_PER_COL_YT * 2;

// ── Canvas helpers ──────────────────────────────────────────────────────────

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

const RANK_COLORS = ["#f6c90e", "#b0b8c1", "#cd7c2f"]; // gold, silver, bronze

// ── Shared row-drawing helper ───────────────────────────────────────────────
// Draws a single data row onto ctx, given absolute canvas x-positions.

function drawTeamRow(
  ctx: CanvasRenderingContext2D,
  row: any,
  globalRank: number,
  cy: number,
  cols: {
    rankCx: number;
    nameX: number;
    nameMaxW: number;
    booyahCx: number;
    placeCx: number;
    killsCx: number;
    totalRx: number;
  },
  killPoint: number,
) {
  const { rankCx, nameX, nameMaxW, booyahCx, placeCx, killsCx, totalRx } = cols;

  const name =
    row.team_name ||
    row.competitor__user__username ||
    row.username ||
    "Unknown";
  const kills = (row.total_kills || row.kills) ?? 0;
  const booyah = row.total_booyah ?? 0;
  const total = row.total_points || row.total_pts || 0;
  const placePts =
    killPoint > 0 ? Math.max(0, total - kills * killPoint).toFixed(1) : "—";
  const isTop3 = globalRank <= 3;

  ctx.textBaseline = "middle";

  // Rank
  ctx.fillStyle = isTop3 ? RANK_COLORS[globalRank - 1] : "#e5e7eb";
  ctx.font = `bold ${isTop3 ? 21 : 19}px 'Arial', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(globalRank), rankCx, cy);

  // Team name
  ctx.fillStyle = "#ffffff";
  ctx.font = `${isTop3 ? "bold " : ""}19px 'Arial', sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(truncateText(ctx, name, nameMaxW), nameX, cy);

  // Booyah
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "18px 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(booyah), booyahCx, cy);

  // Placement pts
  ctx.fillText(placePts, placeCx, cy);

  // Kills
  ctx.fillText(String(kills), killsCx, cy);

  // Total — right-aligned, highlighted for top 3
  ctx.fillStyle = isTop3 ? "#fde047" : "#d4f764";
  ctx.font = `bold ${isTop3 ? 20 : 18}px 'Arial', sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(
    typeof total === "number" ? total.toFixed(1) : String(total),
    totalRx,
    cy,
  );
}

function drawPlayerRow(
  ctx: CanvasRenderingContext2D,
  row: any,
  globalRank: number,
  cy: number,
  cols: {
    rankCx: number;
    nameX: number;
    nameMaxW: number;
    teamCx: number;
    killsCx: number;
    dmgCx: number;
    assistsRx: number;
  },
) {
  const { rankCx, nameX, nameMaxW, teamCx, killsCx, dmgCx, assistsRx } = cols;

  const username = row.username || row.competitor__user__username || "Unknown";
  const teamName = row.team_name || "—";
  const kills = row.total_kills ?? 0;
  const damage = row.total_damage ?? 0;
  const assists = row.total_assists ?? 0;
  const isTop3 = globalRank <= 3;

  ctx.textBaseline = "middle";

  // Rank
  ctx.fillStyle = isTop3 ? RANK_COLORS[globalRank - 1] : "#e5e7eb";
  ctx.font = `bold ${isTop3 ? 21 : 19}px 'Arial', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(globalRank), rankCx, cy);

  // Username
  ctx.fillStyle = "#ffffff";
  ctx.font = `${isTop3 ? "bold " : ""}19px 'Arial', sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(truncateText(ctx, username, nameMaxW), nameX, cy);

  // Team
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "16px 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(truncateText(ctx, teamName, 160), teamCx, cy);

  // Kills
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "18px 'Arial', sans-serif";
  ctx.fillText(String(kills), killsCx, cy);

  // Damage
  ctx.fillText(String(damage), dmgCx, cy);

  // Assists — right-aligned
  ctx.fillStyle = isTop3 ? "#fde047" : "#d4f764";
  ctx.font = `bold ${isTop3 ? 20 : 18}px 'Arial', sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(String(assists), assistsRx, cy);
}

// ── Social Media canvas (1080×1080, AFC 15 template) ───────────────────────
// Single column, up to 15 rows per image.
// Column positions tuned to "AFC 15 LEADERBOARD TEMPLATE.png"

async function drawTeamPageSocial(
  rows: any[],
  startRank: number,
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

  const templateImg = await loadImage(
    "/assets/AFC%2015%20LEADERBOARD%20TEMPLATE.png",
  );
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
  }

  // Row layout — 15 rows, header ends ~y=197, footer ~y=952
  const ROW_START_Y = 197;
  const ROW_H = 50.3; // (952 - 197) / 15

  const cols = {
    rankCx: 62,
    nameX: 120,
    nameMaxW: 455,
    booyahCx: 622,
    placeCx: 732,
    killsCx: 838,
    totalRx: 1000,
  };

  for (let i = 0; i < rows.length; i++) {
    const cy = ROW_START_Y + i * ROW_H + ROW_H / 2;
    drawTeamRow(ctx, rows[i], startRank + i, cy, cols, killPoint);
  }

  if (totalPages > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 16px 'Arial', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`Page ${pageNum} / ${totalPages}`, W - 36, 968);
  }

  return canvas;
}

async function drawPlayerPageSocial(
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

  const templateImg = await loadImage(
    "/assets/AFC%2015%20LEADERBOARD%20TEMPLATE.png",
  );
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
  }

  const ROW_START_Y = 197;
  const ROW_H = 50.3;

  // Player columns repurpose the same 6 slots:
  // # | USERNAME | TEAM | KILLS | DAMAGE | ASSISTS
  const cols = {
    rankCx: 62,
    nameX: 120,
    nameMaxW: 400,
    teamCx: 590,
    killsCx: 700,
    dmgCx: 810,
    assistsRx: 1000,
  };

  for (let i = 0; i < rows.length; i++) {
    const cy = ROW_START_Y + i * ROW_H + ROW_H / 2;
    drawPlayerRow(ctx, rows[i], startRank + i, cy, cols);
  }

  if (totalPages > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 16px 'Arial', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`Page ${pageNum} / ${totalPages}`, W - 36, 968);
  }

  return canvas;
}

// ── YouTube canvas (1920×1080, AFC YT template) ────────────────────────────
// Two columns side by side. Left col: rows 1–12. Right col: rows 13–24.
// Column positions tuned to "AFC YT LEADERBOARD TEMPLATE.png"

// Left column absolute x positions.
// Template left column row boxes span canvas x≈22→650.
// Measured from output image: BOOYAH≈414, PLACE≈490, KILLS≈569.
const YT_L = {
  rankCx: 55,    // # center
  nameX: 100,    // TEAM NAME left edge
  nameMaxW: 270, // max width before hitting BOOYAH column
  booyahCx: 420, // BOOYAH center
  placeCx: 478,  // PLACE center
  killsCx: 532,  // KILLS center
  totalRx: 645,  // TOTAL right edge — just inside the box right edge (~650)
};

// Right column mirrors left, shifted by the gap between the two box groups.
// Template right column boxes start at canvas x≈690.
// YT_R_OFFSET = right box start − left column origin ≈ 690 − 22 = 668.
const YT_R_OFFSET = 668;
const YT_R = {
  rankCx: YT_R_OFFSET + 55,
  nameX: YT_R_OFFSET + 100,
  nameMaxW: 270,
  booyahCx: YT_R_OFFSET + 420,
  placeCx: YT_R_OFFSET + 478,
  killsCx: YT_R_OFFSET + 532,
  totalRx: YT_R_OFFSET + 645,
};

async function drawTeamPageYouTube(
  rows: any[], // up to 24 rows (12 left + 12 right)
  startRank: number,
  pageNum: number,
  totalPages: number,
  killPoint: number,
): Promise<HTMLCanvasElement> {
  const W = 1920,
    H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const templateImg = await loadImage(
    "/assets/AFC%20YT%20LEADERBOARD%20TEMPLATE.png",
  );
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
  }

  // Row layout — 12 rows per column.
  // ROW_START_Y tuned so row 1 lands inside the first data row box (below the
  // template's column header). ROW_H keeps all 12 rows clear of the footer.
  const ROW_START_Y = 273;
  const ROW_H = 60;

  for (let i = 0; i < rows.length; i++) {
    const isLeft = i < ROWS_PER_COL_YT;
    const rowIdx = isLeft ? i : i - ROWS_PER_COL_YT;
    const cy = ROW_START_Y + rowIdx * ROW_H + ROW_H / 2;
    const cols = isLeft ? YT_L : YT_R;
    drawTeamRow(ctx, rows[i], startRank + i, cy, cols, killPoint);
  }

  if (totalPages > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 18px 'Arial', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`Page ${pageNum} / ${totalPages}`, W - 50, 1055);
  }

  return canvas;
}

async function drawPlayerPageYouTube(
  rows: any[],
  startRank: number,
  pageNum: number,
  totalPages: number,
): Promise<HTMLCanvasElement> {
  const W = 1920,
    H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const templateImg = await loadImage(
    "/assets/AFC%20YT%20LEADERBOARD%20TEMPLATE.png",
  );
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
  }

  const ROW_START_Y = 273;
  const ROW_H = 60;

  const leftCols = {
    rankCx: YT_L.rankCx,
    nameX: YT_L.nameX,
    nameMaxW: 350,
    teamCx: YT_L.booyahCx,
    killsCx: YT_L.placeCx,
    dmgCx: YT_L.killsCx,
    assistsRx: YT_L.totalRx,
  };
  const rightCols = {
    rankCx: YT_R.rankCx,
    nameX: YT_R.nameX,
    nameMaxW: 350,
    teamCx: YT_R.booyahCx,
    killsCx: YT_R.placeCx,
    dmgCx: YT_R.killsCx,
    assistsRx: YT_R.totalRx,
  };

  for (let i = 0; i < rows.length; i++) {
    const isLeft = i < ROWS_PER_COL_YT;
    const rowIdx = isLeft ? i : i - ROWS_PER_COL_YT;
    const cy = ROW_START_Y + rowIdx * ROW_H + ROW_H / 2;
    const cols = isLeft ? leftCols : rightCols;
    drawPlayerRow(ctx, rows[i], startRank + i, cy, cols);
  }

  if (totalPages > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 18px 'Arial', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`Page ${pageNum} / ${totalPages}`, W - 50, 1055);
  }

  return canvas;
}

// ── Component ───────────────────────────────────────────────────────────────

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

  // ── Team image — social ───────────────────────────────────────────────────
  const handleTeamSocial = async () => {
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
        const canvas = await drawTeamPageSocial(
          pageRows,
          p * ROWS_PER_PAGE + 1,
          p + 1,
          totalPages,
          killPoint,
        );
        const suffix = totalPages > 1 ? `-page${p + 1}` : "";
        downloadCanvas(canvas, `${leaderboardName}-standings${suffix}.png`);
        if (p < totalPages - 1) await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        totalPages > 1
          ? `Downloaded ${totalPages} images`
          : "Team standings downloaded",
      );
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  // ── Team image — YouTube ──────────────────────────────────────────────────
  const handleTeamYouTube = async () => {
    setBusy(true);
    try {
      const { teamRows } = await getData();
      if (teamRows.length === 0) {
        toast.error("No team leaderboard data to download");
        return;
      }
      const totalPages = Math.ceil(teamRows.length / ROWS_PER_PAGE_YT);
      for (let p = 0; p < totalPages; p++) {
        const pageRows = teamRows.slice(
          p * ROWS_PER_PAGE_YT,
          (p + 1) * ROWS_PER_PAGE_YT,
        );
        const canvas = await drawTeamPageYouTube(
          pageRows,
          p * ROWS_PER_PAGE_YT + 1,
          p + 1,
          totalPages,
          killPoint,
        );
        const suffix = totalPages > 1 ? `-page${p + 1}` : "";
        downloadCanvas(canvas, `${leaderboardName}-standings-yt${suffix}.png`);
        if (p < totalPages - 1) await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        totalPages > 1
          ? `Downloaded ${totalPages} YouTube images`
          : "YouTube standings downloaded",
      );
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  // ── Player image — social ─────────────────────────────────────────────────
  const handlePlayerSocial = async () => {
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
        const canvas = await drawPlayerPageSocial(
          pageRows,
          p * ROWS_PER_PAGE + 1,
          p + 1,
          totalPages,
        );
        const suffix = totalPages > 1 ? `-page${p + 1}` : "";
        downloadCanvas(canvas, `${leaderboardName}-players${suffix}.png`);
        if (p < totalPages - 1) await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        totalPages > 1
          ? `Downloaded ${totalPages} images`
          : "Player leaderboard downloaded",
      );
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  // ── Player image — YouTube ────────────────────────────────────────────────
  const handlePlayerYouTube = async () => {
    setBusy(true);
    try {
      const { playerRows } = await getData();
      if (playerRows.length === 0) {
        toast.error("No player leaderboard data to download");
        return;
      }
      const totalPages = Math.ceil(playerRows.length / ROWS_PER_PAGE_YT);
      for (let p = 0; p < totalPages; p++) {
        const pageRows = playerRows.slice(
          p * ROWS_PER_PAGE_YT,
          (p + 1) * ROWS_PER_PAGE_YT,
        );
        const canvas = await drawPlayerPageYouTube(
          pageRows,
          p * ROWS_PER_PAGE_YT + 1,
          p + 1,
          totalPages,
        );
        const suffix = totalPages > 1 ? `-page${p + 1}` : "";
        downloadCanvas(canvas, `${leaderboardName}-players-yt${suffix}.png`);
        if (p < totalPages - 1) await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        totalPages > 1
          ? `Downloaded ${totalPages} YouTube images`
          : "YouTube player leaderboard downloaded",
      );
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  // ── Excel ─────────────────────────────────────────────────────────────────
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <IconUsers size={14} /> {isSolo ? "Solo" : "Team"} Standings
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleTeamSocial}>
          <IconPhoto size={14} className="mr-2" />
          Social Media (1080×1080)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTeamYouTube}>
          <IconPhoto size={14} className="mr-2" />
          YouTube (1920×1080)
        </DropdownMenuItem>

        {!isSolo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <IconUser size={14} /> Player Leaderboard
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handlePlayerSocial}>
              <IconPhoto size={14} className="mr-2" />
              Social Media (1080×1080)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePlayerYouTube}>
              <IconPhoto size={14} className="mr-2" />
              YouTube (1920×1080)
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
