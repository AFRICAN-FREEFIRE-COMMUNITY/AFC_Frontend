"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DesignBoard - PRESENTATIONAL live-leaderboard board for the OBS overlay.
// ----------------------------------------------------------------------------
// PURPOSE
//   Renders one leaderboard DESIGN (background, placed connected-columns, logos,
//   freeform text, title/subtitle) with REAL live standings, animated, for an OBS
//   Browser Source. It is the runtime twin of the design-editor PREVIEW canvas in
//   app/(a)/a/leaderboards/standalone/_components/DesignFieldsEditor.tsx (the draw
//   at ~L1697-1842): SAME geometry (bg <img> unless transparent, fields absolutely
//   positioned by x_pct + column-group row tiling + font_size_pct% of canvas height
//   + color, logos by x/y_pct, texts by x/y_pct) - but fed the feed's `standings`
//   instead of MOCK_TEAMS, plus an animation layer.
//
// WHERE THE DATA COMES FROM
//   app/overlay/leaderboard/[token]/page.tsx fetches lib/overlay.fetchOverlayFeed()
//   (the public events/overlay/feed/ endpoint) and passes design + standings here.
//   Each design field's `field_type` keys straight into a standings row
//   (row[field.field_type]); team_logo (and any *_logo/image field) renders the
//   image at that URL. Fonts load from the PUBLIC organizers/leaderboard-fonts/by-id/
//   <id>/file/ endpoint via the FontFace API (same source the editor previews use).
//
// ANIMATION (driven by the `anim` + `reveal` props off the URL)
//   - reveal "staggered" | "all": rows fade/slide in on first mount, staggered by rank.
//   - anim "fade": numbers COUNT-UP to their new value + fade.
//   - anim "slide": rows slide in horizontally on reveal.
//   - anim "flash": a cell brightness-pulses when its value changes between polls.
//   - anim "none": no motion.
//   - RE-SORT GLIDE (FLIP): each team's cells are keyed by team identity + field_type,
//     so when a team's rank changes between polls React keeps the SAME element and a
//     CSS transition on top/left makes it GLIDE to its new slot (stable layout, only
//     the occupancy + values change).
//
// TRANSPARENCY
//   design.transparent_background => no bg <img>, see-through canvas (the OBS page is
//   already transparent via html.overlay). Otherwise the size-appropriate background
//   image fills the board (object-cover), exactly like the editor/export.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "@/lib/env";
import { countryToIso2 } from "@/lib/countryFlag";
import type {
  LeaderboardDesign,
  LeaderboardDesignField,
  LeaderboardDesignText,
  DesignColumnGroup,
  TextAlign,
  FieldType,
} from "@/lib/leaderboardDesigns";
import type { OverlaySize, OverlayStandingRow } from "@/lib/overlay";

// Animation / reveal modes carried on the overlay URL. Kept as string unions so the page can pass
// the raw query value straight through (defaults applied here).
export type OverlayAnim = "fade" | "slide" | "flash" | "none";
export type OverlayReveal = "staggered" | "all";

const BACKEND = env.NEXT_PUBLIC_BACKEND_API_URL;

// Canvas aspect per size - mirrors CANVAS_RATIO_BY_SIZE in DesignFieldsEditor so the overlay board
// is proportioned identically to the editor preview + the PNG export.
const RATIO_BY_SIZE: Record<OverlaySize, number> = {
  youtube: 1920 / 1080,
  instagram: 1080 / 1350,
};

// Logo longest-edge as a fraction of canvas height - mirrors afc_leaderboard.graphic.LOGO_SIZE_FRAC
// (and the manager preview), so overlay logos match the export size.
const LOGO_SIZE_FRAC: Record<string, number> = {
  small: 0.07,
  medium: 0.11,
  large: 0.16,
};

// Fallback column group when a design has fields but no column_groups saved (mirrors the editor's
// DEFAULT_GROUP so fields still render rather than vanishing).
const DEFAULT_GROUP: DesignColumnGroup = {
  row_start_pct: 33.0,
  row_height_pct: 6.85,
  row_count: 8,
  start_rank: 1,
};

// A field_type renders as an IMAGE (team logo / player picture) rather than text.
const isImageField = (ft: string) =>
  ft === "team_logo" || ft === "team_flag" || ft.endsWith("_logo") || ft.includes("image");

// CSS translate for a cell's horizontal alignment about its x_pct anchor (mirrors the editor cell:
// left = anchor at start, right = anchor at end, center = anchor at middle) + vertical centering.
const cellTransform = (align: TextAlign): string => {
  const x = align === "left" ? "0" : align === "right" ? "-100%" : "-50%";
  return `translateX(${x}) translateY(-50%)`;
};

// CSS translate for a freeform text element (mirrors DesignFieldsEditor.alignTransform).
const textTransform = (align: TextAlign): string => {
  if (align === "left") return "translate(0, -50%)";
  if (align === "right") return "translate(-100%, -50%)";
  return "translate(-50%, -50%)";
};

// ── FontFace loader (module-scoped dedupe) ───────────────────────────────────
// Each uploaded font is loaded ONCE per page session from the PUBLIC by-id/file endpoint under a
// synthetic family name `lbfont-<id>` (the feed's fields/texts only carry font_id, not the name).
// The same family string is then handed to style.fontFamily on any cell/text using that font.
const loadedFontIds = new Set<number>();
const fontFamilyFor = (fontId: number | null | undefined): string =>
  fontId == null ? "DM Sans, sans-serif" : `"lbfont-${fontId}", DM Sans, sans-serif`;

function useDesignFonts(design: LeaderboardDesign) {
  useEffect(() => {
    if (typeof window === "undefined" || !("fonts" in document)) return;
    const ids = new Set<number>();
    for (const f of design.fields) if (f.font_id != null) ids.add(f.font_id);
    for (const t of design.texts) if (t.font_id != null) ids.add(t.font_id);
    for (const id of ids) {
      if (loadedFontIds.has(id)) continue;
      loadedFontIds.add(id); // mark eagerly so a re-render mid-load doesn't double-fetch
      try {
        const ff = new FontFace(
          `lbfont-${id}`,
          `url(${BACKEND}/organizers/leaderboard-fonts/by-id/${id}/file/)`,
        );
        ff.load()
          .then((loaded) => document.fonts.add(loaded))
          .catch((err) => {
            // Missing/deleted font or a CORS hiccup: fall back to DM Sans, but un-mark so a later
            // successful design load can retry.
            loadedFontIds.delete(id);
            console.warn(`[overlay-fonts] failed to load font ${id}`, err);
          });
      } catch (err) {
        loadedFontIds.delete(id);
        console.warn(`[overlay-fonts] could not construct FontFace for ${id}`, err);
      }
    }
  }, [design]);
}

// ── Count-up number (anim=fade) ──────────────────────────────────────────────
// Animates the displayed integer from its previous value to the next over ~0.5s using rAF. Falls
// back to rendering the raw value immediately when the value is non-numeric or animation is off.
function CountUpNumber({ value, animate }: { value: number; animate: boolean }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 500;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      // easeOutCubic for a snappy settle.
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      prevRef.current = to; // ensure the next diff starts from the final value
    };
  }, [value, animate]);

  return <>{display}</>;
}

// ── One standings cell value (image / count-up / flashing text) ──────────────
function CellValue({
  fieldType,
  value,
  anim,
  sizePx,
}: {
  fieldType: string;
  value: number | string | null | undefined;
  anim: OverlayAnim;
  sizePx: number;
}) {
  // Track value changes to drive the flash pulse (anim=flash).
  const [flashKey, setFlashKey] = useState(0);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      if (anim === "flash") setFlashKey((k) => k + 1);
    }
  }, [value, anim]);
  const flashClass = anim === "flash" && flashKey > 0 ? "overlay-cell-flash" : "";

  if (isImageField(fieldType)) {
    if (!value || typeof value !== "string") return null;
    // Image cell (team logo / player picture): square box scaled to the field's font size, object
    // contained so non-square art is not distorted. Positioned by the parent cell wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        key={flashKey}
        src={value}
        alt=""
        className={flashClass}
        style={{
          height: sizePx * 1.35,
          width: sizePx * 1.35,
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }

  const isNumeric =
    typeof value === "number" ||
    (typeof value === "string" && /^-?\d+$/.test(value.trim()));

  if (isNumeric && anim === "fade") {
    return (
      <span className={flashClass}>
        <CountUpNumber value={Number(value)} animate />
      </span>
    );
  }

  return (
    <span key={flashKey} className={flashClass}>
      {value ?? ""}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface DesignBoardProps {
  design: LeaderboardDesign;
  standings: OverlayStandingRow[];
  size: OverlaySize;
  // Optional field_type allow-list (the URL `cols` param, comma-split by the page). Empty/undefined
  // => render every placed field. A hidden field simply isn't drawn (fixed-position; slot stays blank).
  cols?: string[];
  anim?: OverlayAnim;
  reveal?: OverlayReveal;
  // Board header text from the feed's `board` (NOT the design): only shown when the design's
  // show_title / show_subtitle flags are on. Most designs bake headers into the background art or a
  // freeform text element, so these are optional broadcast extras.
  title?: string;
  subtitle?: string;
  // True when the feed returned an in-round LIVE snapshot (events/overlay/feed/ live branch, Redis key
  // overlay:live:<event>:<stage>:<group>). The page passes feed.live straight through; when true a
  // subtle "LIVE" badge is drawn in the top-right corner. Off => no badge (official per-round feed).
  live?: boolean;
  // Per-OVERLAY background behaviour override (owner 2026-07-02): the studio's stable links carry
  // ?bg=persistent|animate, which beats the design's stored background_behavior default.
  bgBehaviorOverride?: "persistent" | "animate" | null;
}

export function DesignBoard({
  design,
  standings,
  size,
  cols,
  anim = "fade",
  reveal = "staggered",
  title,
  subtitle,
  live = false,
  bgBehaviorOverride = null,
}: DesignBoardProps) {
  useDesignFonts(design);

  // ── Fit the board to the viewport, preserving the design aspect (letterboxed, centered). ──
  // Percentages (x_pct/y_pct/font_size_pct) are relative to THIS canvas, so keeping the exact aspect
  // makes the overlay match the editor + export regardless of the OBS source's pixel dimensions.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ratio = RATIO_BY_SIZE[size];
    const measure = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      // Largest rect of `ratio` that fits inside (availW x availH).
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      setBox({ w: Math.round(w), h: Math.round(h) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const canvasH = box.h;
  const yt = size === "youtube";

  // ── Reveal gate (owner 2026-07-01): flip to revealed one frame AFTER the background image has
  // painted, so the rows / logos / freeform text animate IN over a SOLID background instead of over a
  // dark/blank frame ("screen goes dark when animating in / reloading"). bgReady is set by the bg
  // <img> onLoad/onError below, or immediately when there is no bg (transparent design). ──
  const [bgReady, setBgReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!bgReady) return;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [bgReady]);
  const animated = anim !== "none";

  // ── Active PAGE (owner 2026-06-14 multi-page designs). ──
  // The overlay renders ONE page (page 1). A page carries its OWN backgrounds + column_groups, and
  // fields/texts are scoped to it by page_id (the field.column_group index is relative to the PAGE's
  // column_groups). A legacy single-page design (pages: []) reads geometry straight off the design
  // row and its fields carry page_id null. Without this, fields from every page collapse onto the
  // design-level groups → duplicate field_types per slot → duplicate React keys → the rows vanish.
  const page = useMemo(
    () =>
      design.pages && design.pages.length
        ? (design.pages.find((p) => p.page_number === 1) ?? design.pages[0])
        : null,
    [design.pages],
  );

  // ── Column-group geometry (size-aware, mirrors build_field_layout / the editor). ──
  // YouTube uses column_groups_youtube when present, else column_groups; Instagram always uses
  // column_groups. Read off the active page when multi-page, else the design row. Empty => the
  // DEFAULT_GROUP fallback so placed fields still render.
  const groups: DesignColumnGroup[] = useMemo(() => {
    const igG = page ? page.column_groups : design.column_groups;
    const ytG = page ? page.column_groups_youtube : design.column_groups_youtube;
    const chosen = yt ? (ytG && ytG.length ? ytG : igG) : igG;
    return chosen && chosen.length ? chosen : [DEFAULT_GROUP];
  }, [page, design.column_groups, design.column_groups_youtube, yt]);

  // rank (1-based) -> { groupIndex, topPct }. This is the slot each standings position occupies.
  const slotByRank = useMemo(() => {
    const map = new Map<number, { gi: number; topPct: number }>();
    groups.forEach((grp, gi) => {
      for (let ri = 0; ri < grp.row_count; ri++) {
        const rank = grp.start_rank + ri;
        map.set(rank, { gi, topPct: grp.row_start_pct + ri * grp.row_height_pct });
      }
    });
    return map;
  }, [groups]);

  // The active field_type allow-list (URL `cols`). Empty => all fields shown.
  const colSet = useMemo(
    () => (cols && cols.length ? new Set(cols) : null),
    [cols],
  );

  // Fields belonging to the ACTIVE page (page_id match; all fields for a legacy single-page design),
  // grouped by their column_group index and filtered by the cols allow-list. A team's drawn cells are
  // exactly the fields of the group its current rank falls into.
  const fieldsByGroup = useMemo(() => {
    const map = new Map<number, LeaderboardDesignField[]>();
    const pageFields = page
      ? design.fields.filter((f) => f.page_id === page.id)
      : design.fields;
    for (const f of pageFields) {
      if (colSet && !colSet.has(f.field_type)) continue;
      const arr = map.get(f.column_group) ?? [];
      arr.push(f);
      map.set(f.column_group, arr);
    }
    return map;
  }, [design.fields, page, colSet]);

  // Freeform texts scoped to the active page (all for a legacy single-page design).
  const pageTexts = useMemo(
    () => (page ? design.texts.filter((t) => t.page_id === page.id) : design.texts),
    [design.texts, page],
  );

  // x_pct for the active size (YT falls back to the IG x_pct when its own is unset).
  const fieldX = (f: LeaderboardDesignField) =>
    yt ? (f.x_pct_youtube ?? f.x_pct) : f.x_pct;
  const textX = (t: LeaderboardDesignText) =>
    yt ? (t.x_pct_youtube ?? t.x_pct) : t.x_pct;
  const textY = (t: LeaderboardDesignText) =>
    yt ? (t.y_pct_youtube ?? t.y_pct) : t.y_pct;

  // Stable team identity across polls (drives the FLIP-glide keys). team_name is unique within a
  // tournament; solo/edge rows fall back to a name-ish field, then the position as a last resort.
  const rowKey = (row: OverlayStandingRow): string =>
    String(row.team_name ?? row.player ?? row.name ?? row.username ?? `pos-${row.pos}`);

  // Background image for the active size (transparent designs skip it), read off the active page when
  // multi-page else the design row. Falls back to the other size's bg if the active one is missing.
  const bgSrc = page ?? design;
  const bgUrl = design.transparent_background
    ? ""
    : yt
      ? bgSrc.background_youtube || bgSrc.background_instagram || ""
      : bgSrc.background_instagram || bgSrc.background_youtube || "";

  // No background to wait for (transparent design, or a design with no art) => rows can reveal now.
  useEffect(() => {
    if (!bgUrl) setBgReady(true);
  }, [bgUrl]);

  const textColor = design.text_color || "#ffffff";

  return (
    <div
      ref={wrapRef}
      className="flex h-screen w-screen items-center justify-center overflow-hidden"
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: box.w || undefined,
          height: box.h || undefined,
          // Transparent designs paint nothing behind the columns; opaque designs get their bg <img>.
          background: "transparent",
        }}
      >
        {/* ── Background art (skipped when transparent_background). ── */}
        {bgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            alt=""
            // Load eagerly + hold the row reveal until it has painted, so the background is ALWAYS on
            // and the data animates in over it (never a dark frame). onError still releases the gate so
            // a missing bg can't freeze the overlay.
            loading="eager"
            // @ts-ignore - fetchpriority is a valid DOM attr not yet in the React types on this version.
            fetchpriority="high"
            onLoad={() => setBgReady(true)}
            onError={() => setBgReady(true)}
            className="pointer-events-none absolute inset-0 size-full object-cover"
            // BG behaviour (owner 2026-07-02, design.background_behavior): "persistent" (default)
            // paints the bg statically - always on, never animates. "animate" fades the bg in WITH
            // the content on every load/refresh of the overlay page (opacity keyed on the same
            // revealed gate the rows use, so bg + rows animate in together).
            style={
              (bgBehaviorOverride ?? design.background_behavior) === "animate"
                ? {
                    opacity: revealed ? 1 : 0,
                    transition: "opacity 700ms ease-out",
                  }
                : undefined
            }
          />
        ) : null}

        {/* ── Subtle "LIVE" badge (Tier-2 in-round snapshot only). ──
            Shown only when the feed reports live:true. Small, top-right, semi-transparent pill so it
            never obscures the design and stays transparency-safe (the OBS page is see-through). Sized
            off canvasH so it scales with the board; z-10 keeps it above the standings cells. It snaps
            away automatically when the round's official MatchResult lands (feed.live flips false). */}
        {live && canvasH > 0 ? (
          <div
            className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-sm"
            style={{
              top: "2.5%",
              right: "2.5%",
              padding: `${canvasH * 0.008}px ${canvasH * 0.016}px`,
            }}
          >
            {/* Pulsing red dot = the universal "live" tell. */}
            <span
              className="inline-block animate-pulse rounded-full bg-red-500"
              style={{ width: canvasH * 0.014, height: canvasH * 0.014 }}
            />
            <span
              className="font-bold tracking-wide text-white"
              style={{ fontSize: canvasH * 0.022, lineHeight: 1 }}
            >
              LIVE
            </span>
          </div>
        ) : null}
        {/* Title/subtitle headers REMOVED (owner 2026-07-02): freeform TEXT elements in the
            design cover headers WYSIWYG, so the separate show_title/show_subtitle system is gone. */}

        {/* ── Positioned logos (drawn above the bg, below the data). ── */}
        {design.logos.map((logo) => {
          if (!logo.image) return null;
          const edge = (LOGO_SIZE_FRAC[logo.size] ?? 0.11) * canvasH;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`logo-${logo.id}`}
              src={logo.image}
              alt=""
              className="pointer-events-none absolute"
              style={{
                left: `${logo.x_pct}%`,
                top: `${logo.y_pct}%`,
                height: edge,
                width: edge,
                objectFit: "contain",
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}

        {/* ── Freeform text elements (active page only). ── */}
        {pageTexts.map((txt) => {
          const tSizePx = ((txt.font_size_pct ?? 5) / 100) * canvasH;
          return (
            <span
              key={`text-${txt.id}`}
              className="absolute font-extrabold leading-none"
              style={{
                left: `${textX(txt)}%`,
                top: `${textY(txt)}%`,
                fontSize: tSizePx,
                fontFamily: fontFamilyFor(txt.font_id),
                color: txt.color || textColor,
                transform: textTransform(txt.align),
                whiteSpace: "nowrap",
              }}
            >
              {txt.text}
            </span>
          );
        })}

        {/* ── Standings cells (keyed by team identity + field_type for FLIP-glide re-sort). ──
            One <span> per (team, field). Positioned at the team's CURRENT slot (top from its rank,
            left from the field's x_pct). When the team's rank changes between polls React keeps the
            same element and the top/left CSS transition glides it to the new slot; values inside
            animate via CellValue (count-up / flash). Cells for teams whose rank has no slot (beyond
            the design's rows) are not drawn. */}
        {canvasH > 0 &&
          standings.flatMap((row, rowIdx) => {
            const slot = slotByRank.get(row.pos);
            if (!slot) return [];
            const key = rowKey(row);
            const groupFields = fieldsByGroup.get(slot.gi) ?? [];
            // Stagger only on FIRST reveal; re-sorts glide via the position transition below.
            const revealDelay =
              reveal === "staggered" ? Math.min(rowIdx, 24) * 45 : 0;

            return groupFields.map((field) => {
              const fSizePx = ((field.font_size_pct ?? 2.1) / 100) * canvasH;
              const align = field.align;
              const base = cellTransform(align);
              // Slide-in entry offset (anim=slide): start shifted left, settle to the anchor.
              const entryDx = anim === "slide" && !revealed ? -canvasH * 0.06 : 0;
              const transform = entryDx
                ? `translateX(${entryDx}px) ${base}`
                : base;
              const color = field.color || textColor;

              return (
                <span
                  key={`${key}::${field.id}`}
                  className="absolute leading-none font-extrabold"
                  style={{
                    left: `${fieldX(field)}%`,
                    top: `${slot.topPct}%`,
                    fontSize: fSizePx,
                    fontFamily: fontFamilyFor(field.font_id),
                    color,
                    transform,
                    transformOrigin: "center",
                    whiteSpace: "nowrap",
                    opacity: animated ? (revealed ? 1 : 0) : 1,
                    // top/left glide (FLIP) + reveal fade/slide. `none` disables all motion.
                    transition: animated
                      ? "top 0.6s cubic-bezier(0.22,1,0.36,1), left 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease, transform 0.45s ease"
                      : undefined,
                    transitionDelay: revealed ? "0ms" : `${revealDelay}ms`,
                  }}
                >
                  <CellValue
                    fieldType={field.field_type as FieldType}
                    value={
                      // Country flag column (owner 2026-07-04): the row carries team_country (an
                      // ISO-2 or full name); resolve it to a flagcdn image URL for the image cell.
                      field.field_type === "team_flag"
                        ? (countryToIso2(row.team_country as string)
                            ? `https://flagcdn.com/w160/${countryToIso2(row.team_country as string)}.png`
                            : "")
                        : row[field.field_type]
                    }
                    anim={anim}
                    sizePx={fSizePx}
                  />
                </span>
              );
            });
          })}
      </div>
    </div>
  );
}
