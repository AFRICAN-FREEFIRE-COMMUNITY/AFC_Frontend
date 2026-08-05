"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BoardChrome - the column headers, grid rules and event/stage header drawn
// around a leaderboard design's placed columns.
// ----------------------------------------------------------------------------
// PURPOSE (owner 2026-08-05, backlog #2)
//   The exported leaderboard graphic was missing three things a reader needs:
//   a label above each column, rules to follow a row across, and the event name
//   as a header with the stage name beneath it. The PNG renderer draws them in
//   afc_leaderboard/graphic.py (_render_column_headers / _render_grid /
//   _render_board_header). These three components are the BROWSER twin of that
//   code, so the design editor's preview and the live OBS overlay show exactly
//   what the downloaded file will contain.
//
// WHO RENDERS THIS
//   • app/(a)/a/leaderboards/standalone/_components/DesignFieldsEditor.tsx
//     - the design editor's preview canvas (mock rows).
//   • app/overlay/leaderboard/_components/DesignBoard.tsx
//     - the live OBS overlay board (real standings).
//   Both gate on the design's show_column_headers / show_grid / show_board_header
//   booleans, which default false so an existing design is unchanged.
//
// WHAT IT CONSUMES
//   The SAME geometry the backend uses, imported from lib/leaderboardDesigns
//   (COLUMN_HEADER_LABELS, columnEdges, columnCell, HEADER_* and GRID_* constants,
//   BOARD_TITLE_DEFAULTS / BOARD_SUBTITLE_DEFAULTS) - a port of graphic.py, so a
//   change on either side has ONE place to be mirrored.
//
// EVERY MEASUREMENT IS A PERCENT of the canvas, except font sizes which are
// percent-of-canvas-HEIGHT converted to px by the caller's canvasH, matching how
// every other element on these two surfaces is positioned.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BOARD_SUBTITLE_DEFAULTS,
  BOARD_TITLE_DEFAULTS,
  COLUMN_HEADER_LABELS,
  GRID_LINE_ALPHA,
  GRID_WIDTH_FRAC,
  HEADER_ROW_GAP,
  HEADER_SIZE_SCALE,
  columnCell,
  columnEdges,
} from "@/lib/leaderboardDesigns";
import type {
  DesignColumnGroup,
  FieldType,
  HeaderStyle,
  TextAlign,
} from "@/lib/leaderboardDesigns";

// The minimum a caller has to describe about a placed column for the chrome to be drawn around it.
// Both callers already hold richer objects (a saved field, or an editor draft) that satisfy this.
export interface ChromeColumn {
  key: string; // stable React key (the field's server id or the editor's draftId)
  field_type: FieldType;
  x_pct: number; // resolved for the size being rendered (YT falls back to the IG x)
  align: TextAlign;
  font_size_pct: number | null;
  color?: string;
  fontFamily?: string;
}

// One column group's row tiling plus the columns that belong to it.
export interface ChromeGroup {
  group: DesignColumnGroup;
  columns: ChromeColumn[];
}

// CSS transform that anchors a label at its x_pct the way the renderer's text anchor does.
const anchor = (align: TextAlign): string =>
  align === "left"
    ? "translate(0, -50%)"
    : align === "right"
      ? "translate(-100%, -50%)"
      : "translate(-50%, -50%)";

/**
 * Hairline rules between the rows AND between the columns of every group.
 * Mirrors graphic._render_grid: the row rules sit HALF a row above/below each row centre (the row's
 * text is vertically centred on its y), and the column rules sit on the table edges from columnEdges.
 */
export function BoardGrid({
  groups,
  canvasH,
  color,
}: {
  groups: ChromeGroup[];
  canvasH: number;
  color: string;
}) {
  if (!canvasH) return null;
  const width = Math.max(1, Math.round(canvasH * GRID_WIDTH_FRAC));
  return (
    <>
      {groups.map(({ group, columns }, gi) => {
        const edges = columnEdges(columns);
        if (!edges.length || group.row_count <= 0) return null;
        const yTop = group.row_start_pct - group.row_height_pct / 2;
        const yBottom =
          group.row_start_pct + (group.row_count - 0.5) * group.row_height_pct;
        const rows = Array.from({ length: group.row_count + 1 }, (_, i) => yTop + i * group.row_height_pct);
        return (
          <div key={`grid-${gi}`} className="pointer-events-none absolute inset-0">
            {rows.map((y, ri) => (
              <div
                key={`h-${ri}`}
                className="absolute"
                style={{
                  left: `${edges[0]}%`,
                  width: `${edges[edges.length - 1] - edges[0]}%`,
                  top: `${y}%`,
                  height: width,
                  backgroundColor: color,
                  opacity: GRID_LINE_ALPHA,
                }}
              />
            ))}
            {edges.map((x, ei) => (
              <div
                key={`v-${ei}`}
                className="absolute"
                style={{
                  left: `${x}%`,
                  width,
                  top: `${yTop}%`,
                  height: `${yBottom - yTop}%`,
                  backgroundColor: color,
                  opacity: GRID_LINE_ALPHA,
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

/**
 * One label above each placed column, at the column's own x / alignment / font.
 * Mirrors graphic._render_column_headers. The label is clamped to the width of the cell the column
 * owns and wraps onto a second line rather than shrinking away (the browser does the wrapping the
 * Python side does by hand in _wrap_header), so "PLACEMENT POINTS" stacks over a narrow column
 * instead of overrunning its neighbour.
 */
export function BoardColumnHeaders({
  groups,
  canvasH,
  canvasW,
  color,
}: {
  groups: ChromeGroup[];
  canvasH: number;
  canvasW: number;
  color: string;
}) {
  if (!canvasH) return null;
  return (
    <>
      {groups.map(({ group, columns }, gi) => {
        const edges = columnEdges(columns);
        return columns.map((col) => {
          const label = COLUMN_HEADER_LABELS[col.field_type] ?? "";
          if (!label) return null;
          const cell = columnCell(edges, col.x_pct);
          // One row-height above row 1, clamped so a group tiled very high still shows its header.
          const topPct = Math.max(
            group.row_height_pct * 0.6,
            group.row_start_pct - group.row_height_pct * HEADER_ROW_GAP,
          );
          const sizePx = ((col.font_size_pct ?? 2.1) / 100) * canvasH * HEADER_SIZE_SCALE;
          return (
            <span
              key={`hdr-${gi}-${col.key}`}
              className="pointer-events-none absolute font-bold uppercase leading-tight"
              style={{
                left: `${col.x_pct}%`,
                top: `${topPct}%`,
                maxWidth: ((cell.right - cell.left) / 100) * canvasW - canvasW * 0.008,
                fontSize: sizePx,
                fontFamily: col.fontFamily,
                color: col.color || color,
                transform: anchor(col.align),
                textAlign: col.align,
              }}
            >
              {label}
            </span>
          );
        });
      })}
    </>
  );
}

/**
 * The board's TITLE (event name) and SUB-TITLE (stage name).
 * Mirrors graphic._render_board_header: position/size/colour/alignment come from the design's
 * title_style / subtitle_style when set, else the centred AFC defaults. Title in the accent colour
 * (the site draws page titles in primary green); sub-header in the text colour.
 */
export function BoardHeaderText({
  title,
  subtitle,
  canvasH,
  titleStyle,
  subtitleStyle,
  textColor,
  accentColor,
  fontFamilyFor,
}: {
  title?: string;
  subtitle?: string;
  canvasH: number;
  titleStyle?: HeaderStyle;
  subtitleStyle?: HeaderStyle;
  textColor: string;
  accentColor: string;
  // Resolves a design font id to a CSS font-family (each caller has its own loader).
  fontFamilyFor?: (fontId: number | null | undefined) => string | undefined;
}) {
  if (!canvasH) return null;
  const line = (
    content: string | undefined,
    style: HeaderStyle | undefined,
    defaults: typeof BOARD_TITLE_DEFAULTS,
    fallbackColor: string,
    key: string,
  ) => {
    if (!content) return null;
    const s = style ?? {};
    const align = (s.align ?? defaults.align) as TextAlign;
    return (
      <span
        key={key}
        className="pointer-events-none absolute font-extrabold leading-none"
        style={{
          left: `${s.x_pct ?? defaults.x_pct}%`,
          top: `${s.y_pct ?? defaults.y_pct}%`,
          fontSize: ((s.font_size_pct ?? defaults.font_size_pct) / 100) * canvasH,
          fontFamily: fontFamilyFor?.(s.font_id),
          color: s.color || fallbackColor,
          transform: anchor(align),
          whiteSpace: "nowrap",
        }}
      >
        {content}
      </span>
    );
  };
  return (
    <>
      {line(title, titleStyle, BOARD_TITLE_DEFAULTS, accentColor, "board-title")}
      {line(subtitle, subtitleStyle, BOARD_SUBTITLE_DEFAULTS, textColor, "board-subtitle")}
    </>
  );
}
