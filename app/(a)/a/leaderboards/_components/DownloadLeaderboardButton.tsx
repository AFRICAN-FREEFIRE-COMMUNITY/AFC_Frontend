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
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

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

function drawHeader(
  ctx: CanvasRenderingContext2D,
  leaderboardName: string,
  subtitle: string,
  width: number,
  s: number,
  pad: number,
): number {
  let y = 70 * s;

  // Accent line
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(0, 0, width, 6 * s);

  // Label
  ctx.fillStyle = "#ea580c";
  ctx.font = `600 ${22 * s}px sans-serif`;
  ctx.fillText("LEADERBOARD", pad, y);
  y += 36 * s;

  // Subtitle (Team / Player)
  ctx.fillStyle = "#9ca3af";
  ctx.font = `${18 * s}px sans-serif`;
  ctx.fillText(subtitle, pad, y);
  y += 36 * s;

  // Event name
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${40 * s}px sans-serif`;
  const nameLines = wrapText(ctx, leaderboardName.toUpperCase(), width - pad * 2);
  for (const line of nameLines) {
    ctx.fillText(line, pad, y);
    y += 48 * s;
  }
  y += 8 * s;

  // Divider
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 26 * s;

  return y;
}

function drawTeamCanvas(
  rows: any[],
  leaderboardName: string,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const s = width / 1080;
  const pad = 56 * s;

  // Background
  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, height * 0.4);
  grad.addColorStop(0, "rgba(234,88,12,0.15)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.4);

  let y = drawHeader(ctx, leaderboardName, "TEAM STANDINGS", width, s, pad);

  // Columns
  const colRank = pad;
  const colName = pad + 72 * s;
  const colKills = width - 260 * s;
  const colPts = width - 90 * s;

  // Table header
  ctx.fillStyle = "#6b7280";
  ctx.font = `${18 * s}px sans-serif`;
  ctx.fillText("RK", colRank, y);
  ctx.fillText("TEAM", colName, y);
  ctx.fillText("KILLS", colKills, y);
  ctx.fillText("PTS", colPts, y);
  y += 12 * s;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 24 * s;

  const rowH = 50 * s;
  const maxRows = Math.floor((height - y - 50 * s) / rowH);
  const rankColors = ["#f59e0b", "#9ca3af", "#cd7c2f"];

  for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
    const row = rows[i];
    const ry = y + i * rowH;

    if (i < 3) {
      ctx.fillStyle =
        i === 0 ? "rgba(234,88,12,0.10)" : "rgba(255,255,255,0.03)";
      ctx.fillRect(pad - 12 * s, ry - 30 * s, width - pad * 2 + 24 * s, 44 * s);
    }

    ctx.fillStyle = i < 3 ? rankColors[i] : "#4b5563";
    ctx.font = `bold ${23 * s}px sans-serif`;
    ctx.fillText(`#${i + 1}`, colRank, ry);

    ctx.fillStyle = i === 0 ? "#ffffff" : "#e5e7eb";
    ctx.font = `${i === 0 ? "bold " : ""}${23 * s}px sans-serif`;
    const name = row.team_name || row.competitor__user__username || row.username || "Unknown";
    ctx.fillText(truncateText(ctx, name, colKills - colName - 20 * s), colName, ry);

    ctx.fillStyle = "#9ca3af";
    ctx.font = `${21 * s}px sans-serif`;
    ctx.fillText(String((row.total_kills || row.kills) ?? 0), colKills, ry);

    ctx.fillStyle = i === 0 ? "#ea580c" : "#f97316";
    ctx.font = `bold ${23 * s}px sans-serif`;
    ctx.fillText((row.total_points || row.total_pts || 0).toFixed(1), colPts, ry);
  }

  ctx.fillStyle = "#374151";
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText("AFC • africanfreechampionship.com", pad, height - 24 * s);

  return canvas;
}

function drawPlayerCanvas(
  rows: any[],
  leaderboardName: string,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const s = width / 1080;
  const pad = 56 * s;

  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, height * 0.4);
  grad.addColorStop(0, "rgba(99,102,241,0.15)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.4);

  // Accent line — indigo for player
  ctx.fillStyle = "#6366f1";
  ctx.fillRect(0, 0, width, 6 * s);

  let y = 70 * s;

  ctx.fillStyle = "#6366f1";
  ctx.font = `600 ${22 * s}px sans-serif`;
  ctx.fillText("LEADERBOARD", pad, y);
  y += 36 * s;
  ctx.fillStyle = "#9ca3af";
  ctx.font = `${18 * s}px sans-serif`;
  ctx.fillText("PLAYER STATS", pad, y);
  y += 36 * s;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${40 * s}px sans-serif`;
  const nameLines = wrapText(ctx, leaderboardName.toUpperCase(), width - pad * 2);
  for (const line of nameLines) {
    ctx.fillText(line, pad, y);
    y += 48 * s;
  }
  y += 8 * s;
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 26 * s;

  // Columns: Rank | Player | Team | Kills | Dmg | Assists
  const colW = (width - pad * 2) / 6;
  const cols = {
    rank: pad,
    player: pad + colW * 0.6,
    team: pad + colW * 2.2,
    kills: pad + colW * 3.7,
    dmg: pad + colW * 4.6,
    assists: pad + colW * 5.4,
  };

  ctx.fillStyle = "#6b7280";
  ctx.font = `${17 * s}px sans-serif`;
  ctx.fillText("RK", cols.rank, y);
  ctx.fillText("PLAYER", cols.player, y);
  ctx.fillText("TEAM", cols.team, y);
  ctx.fillText("KILLS", cols.kills, y);
  ctx.fillText("DMG", cols.dmg, y);
  ctx.fillText("AST", cols.assists, y);
  y += 12 * s;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 22 * s;

  const rowH = 46 * s;
  const maxRows = Math.floor((height - y - 50 * s) / rowH);
  const rankColors = ["#f59e0b", "#9ca3af", "#cd7c2f"];

  for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
    const p = rows[i];
    const ry = y + i * rowH;

    if (i < 3) {
      ctx.fillStyle =
        i === 0 ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.03)";
      ctx.fillRect(pad - 12 * s, ry - 28 * s, width - pad * 2 + 24 * s, 40 * s);
    }

    ctx.fillStyle = i < 3 ? rankColors[i] : "#4b5563";
    ctx.font = `bold ${20 * s}px sans-serif`;
    ctx.fillText(`#${i + 1}`, cols.rank, ry);

    ctx.fillStyle = i === 0 ? "#ffffff" : "#e5e7eb";
    ctx.font = `${i === 0 ? "bold " : ""}${20 * s}px sans-serif`;
    ctx.fillText(
      truncateText(ctx, p.username || "Unknown", cols.team - cols.player - 10 * s),
      cols.player,
      ry,
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = `${18 * s}px sans-serif`;
    ctx.fillText(
      truncateText(ctx, p.team_name || "—", cols.kills - cols.team - 10 * s),
      cols.team,
      ry,
    );

    ctx.fillStyle = "#d1d5db";
    ctx.font = `${20 * s}px sans-serif`;
    ctx.fillText(String(p.total_kills ?? 0), cols.kills, ry);

    ctx.fillStyle = "#9ca3af";
    ctx.font = `${18 * s}px sans-serif`;
    ctx.fillText(String(p.total_damage ?? 0), cols.dmg, ry);
    ctx.fillText(String(p.total_assists ?? 0), cols.assists, ry);
  }

  ctx.fillStyle = "#374151";
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText("AFC • africanfreechampionship.com", pad, height - 24 * s);

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

  const handleTeamImage = async (preset: "instagram" | "youtube") => {
    setBusy(true);
    try {
      const { teamRows } = await getData();
      if (teamRows.length === 0) {
        toast.error("No team leaderboard data to download");
        return;
      }
      const [w, h] = preset === "instagram" ? [1080, 1080] : [1280, 720];
      const suffix = preset === "instagram" ? "1080x1080" : "1280x720";
      downloadCanvas(
        drawTeamCanvas(teamRows, leaderboardName, w, h),
        `${leaderboardName}-team-${suffix}.png`,
      );
      toast.success("Team leaderboard image downloaded");
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  const handlePlayerImage = async (preset: "instagram" | "youtube") => {
    setBusy(true);
    try {
      const { playerRows } = await getData();
      if (playerRows.length === 0) {
        toast.error("No player leaderboard data to download");
        return;
      }
      const [w, h] = preset === "instagram" ? [1080, 1080] : [1280, 720];
      const suffix = preset === "instagram" ? "1080x1080" : "1280x720";
      downloadCanvas(
        drawPlayerCanvas(playerRows, leaderboardName, w, h),
        `${leaderboardName}-player-${suffix}.png`,
      );
      toast.success("Player leaderboard image downloaded");
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

      // ── Sheet 1: Team Leaderboard ──
      if (teamRows.length > 0) {
        const teamHeaders = ["Rank", "Team", "Matches Played", "Booyahs", "Kills", "Total Points"];
        const teamData = teamRows.map((row, idx) => [
          idx + 1,
          row.team_name || row.competitor__user__username || row.username || "Unknown",
          row.matches_played ?? "",
          row.total_booyah ?? "",
          (row.total_kills || row.kills) ?? 0,
          parseFloat((row.total_points || row.total_pts || 0).toFixed(1)),
        ]);
        const wsTeam = XLSX.utils.aoa_to_sheet([teamHeaders, ...teamData]);
        wsTeam["!cols"] = [
          { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, wsTeam, "Team Leaderboard");
      }

      // ── Sheet 2: Player Leaderboard ──
      if (playerRows.length > 0) {
        const playerHeaders = ["Rank", "Player", "Team", "Kills", "Damage", "Assists"];
        const playerData = playerRows.map((p, idx) => [
          idx + 1,
          p.username || "Unknown",
          p.team_name || "—",
          p.total_kills ?? 0,
          p.total_damage ?? 0,
          p.total_assists ?? 0,
        ]);
        const wsPlayer = XLSX.utils.aoa_to_sheet([playerHeaders, ...playerData]);
        wsPlayer["!cols"] = [
          { wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <IconUsers size={14} /> {isSolo ? "Solo" : "Team"} Leaderboard
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleTeamImage("instagram")}>
          <IconPhoto size={14} className="mr-2" />
          Instagram (1080×1080)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTeamImage("youtube")}>
          <IconPhoto size={14} className="mr-2" />
          YouTube (1280×720)
        </DropdownMenuItem>

        {!isSolo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <IconUser size={14} /> Player Leaderboard
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handlePlayerImage("instagram")}>
              <IconPhoto size={14} className="mr-2" />
              Instagram (1080×1080)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePlayerImage("youtube")}>
              <IconPhoto size={14} className="mr-2" />
              YouTube (1280×720)
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
