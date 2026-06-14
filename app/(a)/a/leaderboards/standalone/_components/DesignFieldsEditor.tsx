"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DesignFieldsEditor — drag-canvas editor for connected columns, freeform text,
// column groups, and uploaded fonts on one LeaderboardDesign.
// ─────────────────────────────────────────────────────────────────────────────
//
// PURPOSE:
//   Lets an org/admin place and style the "data columns" (standings stats) and
//   freeform text elements on a leaderboard design's background canvas, by
//   dragging them on a 1920x1080 preview. Mirrors the behaviour of the approved
//   interactive prototype at /public/_lb_design_fields_preview.html (v3).
//
// WHERE IT IS MOUNTED:
//   LeaderboardDesignsManager.tsx opens this via an "Edit fields & text" button
//   on each design card row. It receives the full LeaderboardDesign object, the
//   organizationId (for font scoping), a canManage gate, and an onSaved() callback
//   that triggers a list reload in the manager.
//
// API METHODS USED (lib/leaderboardDesigns.ts):
//   leaderboardDesignsApi.{addField, updateField, deleteField, addText, updateText, deleteText, update}
//   leaderboardFontsApi.{list, upload, remove}
//
// PERSISTENCE MODEL: AUTO-SAVE (owner 2026-06-14) ────────────────────────────
//   There is NO explicit "Save" button for layout work. Every change persists to
//   the backend the moment it happens, so closing the dialog or leaving the page
//   never loses placement work. A small status indicator ("Saving...", "Saved",
//   "Save failed - retry") in the footer reflects the in-flight/last-result state.
//
//   How each change persists:
//     - Add column        -> addField()  immediately; the returned id is written
//                            back onto the local element. Until that POST returns,
//                            the element is "pending" (not draggable, edits queued)
//                            so a fast add-then-drag never PATCHes a missing id.
//     - Remove column      -> deleteField() immediately (only if it had a server id).
//     - Add text           -> addText() immediately; id written back (same pending rule).
//     - Delete text        -> deleteText() immediately (if it had an id).
//     - Style change        (align / font / color / column_group) on a field or text
//                            -> updateField()/updateText() immediately.
//     - Font size slider    -> updateField()/updateText() DEBOUNCED ~400ms.
//     - Drag (field x, text x/y) -> optimistic local move during the drag, ONE
//                            updateField()/updateText() on pointerup (release).
//     - Column groups        (sliders/inputs/add/remove/preset) -> leaderboardDesignsApi
//                            .update(designId, FormData[column_groups]) DEBOUNCED ~500ms.
//     - Font upload/delete  -> already hit the API immediately (unchanged).
//
//   FAILURE-SAFE: every call is independent. A failure toasts the server message
//   (err.response.data.message) and flips the status to "Save failed - retry" but
//   never drops other edits or crashes the editor. onSaved() fires after a
//   successful persist so the parent list stays fresh.
//
// RELATED MODELS (backend):
//   OrgLeaderboardDesign, OrgLeaderboardDesignField, OrgLeaderboardDesignText,
//   OrgLeaderboardDesignFont (afc_organizers.models / views_leaderboard_design.py)
//
// DESIGN RULES:
//   AFC constants - rounded-md cards, text-xs, outline rounded-full badges,
//   DM Sans font, dark/green theme, sonner toasts. No em/en dashes anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
  IconUpload,
  IconLayoutColumns,
  IconTextSize,
  IconTypography,
  IconCheck,
  IconAlertTriangle,
  IconRefresh,
} from "@tabler/icons-react";
import {
  leaderboardDesignsApi,
  leaderboardFontsApi,
  type LeaderboardDesign,
  type LeaderboardDesignField,
  type LeaderboardDesignText,
  type LeaderboardDesignFont,
  type LeaderboardDesignFont as Font,
  type DesignColumnGroup,
  type FieldType,
  type TextAlign,
} from "@/lib/leaderboardDesigns";

// ── Constants ─────────────────────────────────────────────────────────────────

// Canvas aspect ratio for the YT background (1920x1080). All position percentages are
// relative to this canvas regardless of the display size.
const CANVAS_RATIO = 1920 / 1080;

// Maximum pixel height for the editor canvas so it never overflows the dialog.
const MAX_CANVAS_H = 520;

// All available connected field types with friendly display labels (mirrors backend FIELD_CHOICES).
const FIELD_LABELS: Record<FieldType, string> = {
  pos: "POS",
  team_name: "TEAM NAME",
  team_logo: "TEAM LOGO",
  booyah: "BOOYAH",
  placement_points: "PP",
  kill_points: "KP",
  total_points: "TP",
  rush_points: "RUSH",
  kills: "KILLS",
  matches: "MATCHES",
  base_total: "BASE TOTAL",
  bonus: "BONUS",
  penalty: "PENALTY",
};

// Canonical display order for the palette chips.
const FIELD_ORDER: FieldType[] = [
  "pos", "team_name", "team_logo", "booyah", "placement_points", "kill_points",
  "total_points", "rush_points", "kills", "matches", "base_total", "bonus", "penalty",
];

// Default x_pct per field type when first added to group 0 (group 1 offset by ~43).
const DEFAULT_X: Record<FieldType, number> = {
  pos: 8.6, team_name: 13.0, team_logo: 6.5, booyah: 33.2,
  placement_points: 40.3, kill_points: 45.4, total_points: 49.2,
  rush_points: 44.0, kills: 44.0, matches: 40.0, base_total: 47.0,
  bonus: 42.0, penalty: 42.0,
};

// Default text alignment when a field is first added (left for name/logo, center for numbers).
const DEFAULT_ALIGN: Partial<Record<FieldType, TextAlign>> = {
  team_name: "left",
  team_logo: "center",
};

// 16 mock teams for the canvas preview. Shape: [name, booyah, pp, kp, tp].
const MOCK_TEAMS: [string, number, number, number, number][] = [
  ["V-ENT ESPORTS", 3, 58, 41, 99], ["NEXT GAMERS", 2, 54, 38, 92],
  ["RATED ESPORTS", 2, 49, 36, 85], ["UNHOLYGODS", 1, 47, 33, 80],
  ["LGN E-SPORT", 1, 44, 31, 75], ["TL COSA NOSTRA", 1, 40, 29, 69],
  ["DIVISION", 1, 38, 25, 63], ["OREX SCRIM", 0, 35, 24, 59],
  ["KNIGHTS E-SPORTS", 1, 33, 22, 55], ["TOXIC REIGN", 0, 31, 20, 51],
  ["NOBLE ESPORTS", 0, 29, 18, 47], ["ELITE GAMERS", 0, 27, 16, 43],
  ["BROTHERS", 0, 24, 15, 39], ["EZVANT", 0, 21, 13, 34],
  ["ARENDT", 0, 18, 11, 29], ["SHEDOO", 0, 15, 8, 23],
];

// Derive a mock cell value for a given field type + row index (0-based within standings).
function mockCellValue(rankIndex: number, field: FieldType): string {
  const t = MOCK_TEAMS[rankIndex];
  if (!t) return "";
  const [name, booyah, pp, kp, tp] = t;
  switch (field) {
    case "pos": return String(rankIndex + 1);
    case "team_name": return name;
    case "team_logo": return "[logo]";
    case "booyah": return String(booyah);
    case "placement_points": return String(pp);
    case "kill_points": return String(kp);
    case "total_points": return String(tp);
    case "rush_points": return "0";
    case "kills": return String(kp);
    case "matches": return "8";
    case "base_total": return String(tp);
    case "bonus": return "0";
    case "penalty": return "0";
    default: return "";
  }
}

// Default column group when a design has none yet (matches Dynasty Cup two-column layout split 1+2).
const DEFAULT_GROUP: DesignColumnGroup = {
  row_start_pct: 33.0,
  row_height_pct: 6.85,
  row_count: 8,
  start_rank: 1,
};

// ── Local draft types ──────────────────────────────────────────────────────────

// Working copy of a field in the editor; carries a local `draftId` for list keys
// (server id is undefined for newly added ones). `pending` is true while its
// creating POST is in flight, so we suppress dragging/edits until the real id lands.
interface FieldDraft {
  draftId: string; // stable local key
  id?: number; // set when this field already exists on the server
  pending?: boolean; // true while addField() is in flight (no server id yet)
  field_type: FieldType;
  column_group: number;
  x_pct: number;
  align: TextAlign;
  font_id: number | null;
  font_size_pct: number | null;
  color: string;
  order: number;
}

// Working copy of a freeform text element.
interface TextDraft {
  draftId: string;
  id?: number;
  pending?: boolean; // true while addText() is in flight
  text: string;
  x_pct: number;
  y_pct: number;
  align: TextAlign;
  font_id: number | null;
  font_size_pct: number | null;
  color: string;
  order: number;
}

const newDraftId = () => Math.random().toString(36).slice(2);

// What is currently selected on the canvas (a field handle or a text element).
type Selection =
  | { type: "field"; draftId: string }
  | { type: "text"; draftId: string }
  | null;

// Auto-save status shown in the footer. "idle" = nothing changed yet this session.
type SaveStatus = "idle" | "saving" | "saved" | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export interface DesignFieldsEditorProps {
  // The design being edited (full object with fields/texts/column_groups pre-populated).
  design: LeaderboardDesign;
  // Org scope for font upload/list. null/undefined = AFC-native.
  organizationId?: number | null;
  // Whether the viewer has write access (mirrors canManage from LeaderboardDesignsManager).
  canManage: boolean;
  // Called after a successful save so the parent list can reload.
  onSaved: () => void;
  // Controls open/close from the parent.
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesignFieldsEditor({
  design,
  organizationId,
  canManage,
  onSaved,
  open,
  onOpenChange,
}: DesignFieldsEditorProps) {
  // ── Draft state (deep-cloned from design on open) ─────────────────────────
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [texts, setTexts] = useState<TextDraft[]>([]);
  const [groups, setGroups] = useState<DesignColumnGroup[]>([]);

  // ── Auto-save plumbing ──────────────────────────────────────────────────────
  // Live mirrors of the draft state so async callbacks (drag pointerup, debounced
  // timers) always read the latest values without stale closures.
  const fieldsRef = useRef<FieldDraft[]>([]);
  const textsRef = useRef<TextDraft[]>([]);
  const groupsRef = useRef<DesignColumnGroup[]>([]);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  useEffect(() => { textsRef.current = texts; }, [texts]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  // Save status: a count of in-flight requests drives "saving"; the last result
  // drives "saved" vs "error". The status indicator in the footer reads this.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const inFlightRef = useRef(0); // number of persist() calls currently awaiting
  const hadErrorRef = useRef(false); // any failure since the last all-clear

  // Debounce timers for the slider-driven persists (font size + column groups).
  const fieldSizeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const textSizeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const groupsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fonts ─────────────────────────────────────────────────────────────────
  const [fonts, setFonts] = useState<LeaderboardDesignFont[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  // Map fontId -> object URL of the loaded @font-face so we inject each only once.
  const loadedFontUrls = useRef<Map<number, string>>(new Map());

  // ── Canvas sizing (same JS-computed pattern as LeaderboardDesignsManager) ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(0);

  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setAvailW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Canvas pixel dims: fit the wrapper width, cap at MAX_CANVAS_H, preserve 1920/1080.
  let canvasW = availW || 700;
  let canvasH = canvasW / CANVAS_RATIO;
  if (canvasH > MAX_CANVAS_H) {
    canvasH = MAX_CANVAS_H;
    canvasW = canvasH * CANVAS_RATIO;
  }
  const canvasDims = { w: Math.round(canvasW), h: Math.round(canvasH) };

  const roundPct = (n: number) => Math.round(n * 10) / 10;

  // ── persist(): the single failure-safe wrapper every auto-save call goes through. ──
  // It runs the given async API call, tracks the in-flight count for the "Saving..."
  // state, flips the status to "saved" or "error" on settle, toasts the server message
  // on failure, and (on success) calls onSaved() so the parent list stays fresh. Each
  // call is independent: one failing never aborts or rolls back another.
  const persist = useCallback(
    async (
      run: () => Promise<unknown>,
      fallbackMessage: string,
    ): Promise<boolean> => {
      inFlightRef.current += 1;
      setSaveStatus("saving");
      try {
        await run();
        return true;
      } catch (err: any) {
        hadErrorRef.current = true;
        toast.error(err?.response?.data?.message || fallbackMessage);
        return false;
      } finally {
        inFlightRef.current -= 1;
        if (inFlightRef.current <= 0) {
          inFlightRef.current = 0;
          if (hadErrorRef.current) {
            setSaveStatus("error");
            hadErrorRef.current = false;
          } else {
            setSaveStatus("saved");
            // Refresh the parent list after a clean settle so its data stays fresh.
            onSaved();
          }
        }
      }
    },
    [onSaved],
  );

  // ── Drag state ─────────────────────────────────────────────────────────────
  // Dragging a field handle moves its x_pct (horizontal only).
  // Dragging a text element moves its x_pct + y_pct (both axes).
  const dragging = useRef<
    | { type: "field"; draftId: string }
    | { type: "text"; draftId: string }
    | null
  >(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragging.current;
      const el = canvasRef.current;
      if (!drag || !el) return;
      const r = el.getBoundingClientRect();
      const xPct = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const yPct = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      if (drag.type === "field") {
        setFields((prev) =>
          prev.map((f) =>
            f.draftId === drag.draftId ? { ...f, x_pct: xPct } : f,
          ),
        );
      } else {
        setTexts((prev) =>
          prev.map((t) =>
            t.draftId === drag.draftId ? { ...t, x_pct: xPct, y_pct: yPct } : t,
          ),
        );
      }
    },
    [],
  );

  // On release: stop dragging and persist the final position with ONE PATCH.
  // We read the latest position from the live ref (not a stale closure). A pending
  // (not-yet-created) element has no server id, so we skip the PATCH for it; its
  // creating POST already carries the dragged-to position by the time it lands.
  const onPointerUp = useCallback(() => {
    const drag = dragging.current;
    dragging.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (!drag) return;

    if (drag.type === "field") {
      const f = fieldsRef.current.find((x) => x.draftId === drag.draftId);
      if (f && f.id != null && !f.pending) {
        const did = design.id;
        const fid = f.id;
        const x = roundPct(f.x_pct);
        persist(
          () => leaderboardDesignsApi.updateField(did, fid, { x_pct: x }),
          `Failed to save the ${FIELD_LABELS[f.field_type]} column position.`,
        );
      }
    } else {
      const t = textsRef.current.find((x) => x.draftId === drag.draftId);
      if (t && t.id != null && !t.pending) {
        const did = design.id;
        const tid = t.id;
        const x = roundPct(t.x_pct);
        const y = roundPct(t.y_pct);
        persist(
          () => leaderboardDesignsApi.updateText(did, tid, { x_pct: x, y_pct: y }),
          "Failed to save the text position.",
        );
      }
    }
  }, [onPointerMove, persist, design.id]);

  // Detach listeners on unmount.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const startDrag = (
    e: React.PointerEvent,
    type: "field" | "text",
    draftId: string,
  ) => {
    e.preventDefault();
    dragging.current = { type, draftId };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Selection>(null);

  const selectedField = selected?.type === "field"
    ? fields.find((f) => f.draftId === selected.draftId) ?? null
    : null;
  const selectedText = selected?.type === "text"
    ? texts.find((t) => t.draftId === selected.draftId) ?? null
    : null;

  // ── Load / reset on open ──────────────────────────────────────────────────
  const loadFonts = useCallback(async () => {
    setFontsLoading(true);
    try {
      const res = await leaderboardFontsApi.list(organizationId);
      setFonts(res?.results ?? []);
    } catch {
      // Non-fatal: editor still works without fonts.
    } finally {
      setFontsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!open) return;
    // Deep-clone design data into drafts.
    const fDrafts: FieldDraft[] = (design.fields ?? []).map((f) => ({
      draftId: `srv-${f.id}`,
      id: f.id,
      field_type: f.field_type,
      column_group: f.column_group,
      x_pct: f.x_pct,
      align: f.align,
      font_id: f.font_id,
      font_size_pct: f.font_size_pct,
      color: f.color,
      order: f.order,
    }));
    const tDrafts: TextDraft[] = (design.texts ?? []).map((t) => ({
      draftId: `srv-${t.id}`,
      id: t.id,
      text: t.text,
      x_pct: t.x_pct,
      y_pct: t.y_pct,
      align: t.align,
      font_id: t.font_id,
      font_size_pct: t.font_size_pct,
      color: t.color,
      order: t.order,
    }));
    const grps =
      design.column_groups?.length
        ? design.column_groups.map((g) => ({ ...g }))
        : [{ ...DEFAULT_GROUP }];

    setFields(fDrafts);
    setTexts(tDrafts);
    setGroups(grps);
    setSelected(null);

    // Fresh auto-save state for this open: nothing has changed yet.
    setSaveStatus("idle");
    inFlightRef.current = 0;
    hadErrorRef.current = false;

    loadFonts();
  }, [open, design, loadFonts]);

  // Clear any pending debounce timers when the dialog closes / component unmounts
  // so a queued PATCH never fires against a stale design after close.
  useEffect(() => {
    if (open) return;
    fieldSizeTimers.current.forEach((t) => clearTimeout(t));
    textSizeTimers.current.forEach((t) => clearTimeout(t));
    fieldSizeTimers.current.clear();
    textSizeTimers.current.clear();
    if (groupsTimer.current) {
      clearTimeout(groupsTimer.current);
      groupsTimer.current = null;
    }
  }, [open]);

  // ── Inject uploaded fonts as @font-face so the canvas preview shows them. ──
  // Uses the FontFace API; each font is loaded once per session.
  useEffect(() => {
    for (const font of fonts) {
      if (!font.file || loadedFontUrls.current.has(font.id)) continue;
      try {
        const ff = new FontFace(font.name, `url(${font.file})`);
        ff.load().then((loaded) => {
          document.fonts.add(loaded);
          loadedFontUrls.current.set(font.id, font.file!);
        });
      } catch {
        // Silently skip fonts that fail to load.
      }
    }
  }, [fonts]);

  // ── Column group helpers (auto-save the row tiling) ─────────────────────────
  // The column_groups live on the design itself, so they persist via a debounced design PATCH
  // (a burst of slider moves coalesces into one request). Reads the live groupsRef.
  const persistGroups = useCallback(() => {
    if (groupsTimer.current) clearTimeout(groupsTimer.current);
    groupsTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.append("column_groups", JSON.stringify(groupsRef.current));
      persist(
        () => leaderboardDesignsApi.update(design.id, fd),
        "Failed to save the column group layout.",
      );
    }, 500);
  }, [persist, design.id]);

  const addGroup = () => {
    const lastGroup = groups[groups.length - 1];
    const newStartRank = lastGroup
      ? lastGroup.start_rank + lastGroup.row_count
      : 1;
    setGroups((prev) => [
      ...prev,
      {
        row_start_pct: DEFAULT_GROUP.row_start_pct,
        row_height_pct: DEFAULT_GROUP.row_height_pct,
        row_count: DEFAULT_GROUP.row_count,
        start_rank: newStartRank,
      },
    ]);
    persistGroups();
  };

  const removeGroup = (idx: number) => {
    // Persist-delete the server fields that lived in this group, then drop the group + its fields
    // locally and save the new group layout.
    for (const f of fieldsRef.current) {
      if (f.column_group === idx && f.id != null) {
        const fid = f.id;
        persist(
          () => leaderboardDesignsApi.deleteField(design.id, fid),
          "Failed to remove a column.",
        );
      }
    }
    setFields((prev) => prev.filter((f) => f.column_group !== idx));
    setGroups((prev) => prev.filter((_, i) => i !== idx));
    persistGroups();
  };

  const updateGroup = (idx: number, patch: Partial<DesignColumnGroup>) => {
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
    persistGroups();
  };

  // Quick preset: two groups at the Dynasty Cup layout (ranks 1-8 and 9-16).
  const applyTwoGroupPreset = () => {
    setGroups([
      { row_start_pct: 33.0, row_height_pct: 6.85, row_count: 8, start_rank: 1 },
      { row_start_pct: 33.0, row_height_pct: 6.85, row_count: 8, start_rank: 9 },
    ]);
    persistGroups();
  };

  // ── Field (connected column) helpers ──────────────────────────────────────

  // Set of field_types currently placed in the editor.
  const placedTypes = new Set(fields.map((f) => f.field_type));

  // AUTO-SAVE: every connected-column change persists immediately (no Save button). The element
  // carries a local draftId always + a server id once created; edits/moves PATCH by id, and a
  // pending element (POST still in flight, no id yet) only updates locally until its id lands.
  const addField = (fieldType: FieldType) => {
    const draftId = newDraftId();
    const draft: FieldDraft = {
      draftId,
      field_type: fieldType,
      column_group: 0, // default to the first/left group; user drags + re-groups after
      x_pct: DEFAULT_X[fieldType] ?? 45,
      align: DEFAULT_ALIGN[fieldType] ?? "center",
      font_id: null,
      font_size_pct: null,
      color: "",
      order: fields.length,
      pending: true,
    };
    setFields((prev) => [...prev, draft]);
    // POST it, then write the returned server id back so later moves/edits target the real row.
    persist(async () => {
      const res = await leaderboardDesignsApi.addField(design.id, {
        field_type: draft.field_type,
        column_group: draft.column_group,
        x_pct: roundPct(draft.x_pct),
        align: draft.align,
        font_id: draft.font_id,
        font_size_pct: draft.font_size_pct,
        color: draft.color,
      });
      setFields((prev) =>
        prev.map((f) =>
          f.draftId === draftId ? { ...f, id: res.field.id, pending: false } : f,
        ),
      );
    }, `Failed to add the ${FIELD_LABELS[fieldType]} column.`);
  };

  const removeField = (draftId: string) => {
    const f = fieldsRef.current.find((x) => x.draftId === draftId);
    setFields((prev) => prev.filter((x) => x.draftId !== draftId));
    if (selected?.type === "field" && selected.draftId === draftId) setSelected(null);
    if (f && f.id != null) {
      const fid = f.id;
      persist(
        () => leaderboardDesignsApi.deleteField(design.id, fid),
        "Failed to remove the column.",
      );
    }
  };

  // Local merge + persist the changed keys (PATCH). The size slider is debounced so a drag of the
  // slider does not fire a request per pixel; everything else persists at once.
  const updateField = (draftId: string, patch: Partial<FieldDraft>) => {
    setFields((prev) =>
      prev.map((f) => (f.draftId === draftId ? { ...f, ...patch } : f)),
    );
    const f = fieldsRef.current.find((x) => x.draftId === draftId);
    if (!f || f.id == null || f.pending) return; // pending: create carries current values
    const fid = f.id;
    const body: Record<string, unknown> = {};
    if ("column_group" in patch) body.column_group = patch.column_group;
    if ("x_pct" in patch) body.x_pct = roundPct(patch.x_pct as number);
    if ("align" in patch) body.align = patch.align;
    if ("font_id" in patch) body.font_id = patch.font_id;
    if ("font_size_pct" in patch) body.font_size_pct = patch.font_size_pct;
    if ("color" in patch) body.color = patch.color;
    if (Object.keys(body).length === 0) return;
    const send = () =>
      persist(
        () => leaderboardDesignsApi.updateField(design.id, fid, body),
        "Failed to save the column.",
      );
    if ("font_size_pct" in patch) {
      const t = fieldSizeTimers.current.get(draftId);
      if (t) clearTimeout(t);
      fieldSizeTimers.current.set(draftId, setTimeout(send, 400));
    } else {
      send();
    }
  };

  // ── Freeform text helpers (same auto-save model) ────────────────────────────
  const addText = () => {
    const draftId = newDraftId();
    const draft: TextDraft = {
      draftId,
      text: "TEXT",
      x_pct: 50,
      y_pct: 14,
      align: "center",
      font_id: null,
      font_size_pct: 5,
      color: "#ffffff",
      order: texts.length,
      pending: true,
    };
    setTexts((prev) => [...prev, draft]);
    setSelected({ type: "text", draftId });
    persist(async () => {
      const res = await leaderboardDesignsApi.addText(design.id, {
        text: draft.text,
        x_pct: roundPct(draft.x_pct),
        y_pct: roundPct(draft.y_pct),
        align: draft.align,
        font_id: draft.font_id,
        font_size_pct: draft.font_size_pct,
        color: draft.color,
      });
      setTexts((prev) =>
        prev.map((t) =>
          t.draftId === draftId ? { ...t, id: res.text.id, pending: false } : t,
        ),
      );
    }, "Failed to add the text element.");
  };

  const removeText = (draftId: string) => {
    const t = textsRef.current.find((x) => x.draftId === draftId);
    setTexts((prev) => prev.filter((x) => x.draftId !== draftId));
    if (selected?.type === "text" && selected.draftId === draftId) setSelected(null);
    if (t && t.id != null) {
      const tid = t.id;
      persist(
        () => leaderboardDesignsApi.deleteText(design.id, tid),
        "Failed to remove the text.",
      );
    }
  };

  const updateText = (draftId: string, patch: Partial<TextDraft>) => {
    setTexts((prev) =>
      prev.map((t) => (t.draftId === draftId ? { ...t, ...patch } : t)),
    );
    const t = textsRef.current.find((x) => x.draftId === draftId);
    if (!t || t.id == null || t.pending) return;
    const tid = t.id;
    const body: Record<string, unknown> = {};
    if ("text" in patch) body.text = patch.text;
    if ("x_pct" in patch) body.x_pct = roundPct(patch.x_pct as number);
    if ("y_pct" in patch) body.y_pct = roundPct(patch.y_pct as number);
    if ("align" in patch) body.align = patch.align;
    if ("font_id" in patch) body.font_id = patch.font_id;
    if ("font_size_pct" in patch) body.font_size_pct = patch.font_size_pct;
    if ("color" in patch) body.color = patch.color;
    if (Object.keys(body).length === 0) return;
    const send = () =>
      persist(
        () => leaderboardDesignsApi.updateText(design.id, tid, body),
        "Failed to save the text.",
      );
    // Debounce free-typing the content + the size slider; persist discrete changes at once.
    if ("text" in patch || "font_size_pct" in patch) {
      const tm = textSizeTimers.current.get(draftId);
      if (tm) clearTimeout(tm);
      textSizeTimers.current.set(draftId, setTimeout(send, 400));
    } else {
      send();
    }
  };

  // ── Font upload / delete ───────────────────────────────────────────────────
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFont, setUploadingFont] = useState(false);

  const handleFontUpload = async (file?: File) => {
    if (!file) return;
    if (!file.name.match(/\.(ttf|otf)$/i)) {
      toast.error("Only TTF or OTF font files are supported.");
      return;
    }
    setUploadingFont(true);
    try {
      const res = await leaderboardFontsApi.upload(file, {
        organizationId: organizationId ?? undefined,
      });
      setFonts((prev) => [...prev, res.font]);
      toast.success(`Font "${res.font.name}" uploaded.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload font.");
    } finally {
      setUploadingFont(false);
    }
  };

  const handleFontDelete = async (font: Font) => {
    try {
      await leaderboardFontsApi.remove(font.id);
      setFonts((prev) => prev.filter((f) => f.id !== font.id));
      // Clear any field/text referencing this font.
      setFields((prev) =>
        prev.map((f) => (f.font_id === font.id ? { ...f, font_id: null } : f)),
      );
      setTexts((prev) =>
        prev.map((t) => (t.font_id === font.id ? { ...t, font_id: null } : t)),
      );
      toast.success(`Font "${font.name}" deleted.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete font.");
    }
  };


  // ── Canvas rendering helpers ───────────────────────────────────────────────

  // CSS transform-X for a given TextAlign value (mirrors the HTML prototype).
  const alignTransform = (align: TextAlign): string => {
    if (align === "left") return "translate(0, -50%)";
    if (align === "right") return "translate(-100%, -50%)";
    return "translate(-50%, -50%)";
  };

  // Font name for a font_id (null = "Default" = DM Sans).
  const fontName = (fontId: number | null): string => {
    if (fontId == null) return "DM Sans, sans-serif";
    const f = fonts.find((f) => f.id === fontId);
    return f ? `"${f.name}", DM Sans, sans-serif` : "DM Sans, sans-serif";
  };

  // Background URL: prefer YouTube (1920x1080) since the canvas uses that aspect ratio.
  const bgUrl = design.background_youtube || design.background_instagram || "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[96vh] overflow-y-auto"
        style={{ maxWidth: "min(1280px, calc(100% - 1rem))" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconLayoutColumns className="size-5 text-primary" />
            Edit fields and text
            <span className="text-sm font-normal text-muted-foreground">
              {" "}({design.name})
            </span>
          </DialogTitle>
          <DialogDescription>
            Add, position, and style connected data columns and freeform text on
            the canvas. Drag field handles (green bars) horizontally to set their
            X position; drag text elements freely. Select an element to edit its
            style in the panel on the right.
          </DialogDescription>
        </DialogHeader>

        {/* ── Main layout: canvas (left/center) + side panel (right) ── */}
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">

          {/* ── Left: connected-columns palette + canvas ── */}
          <div className="space-y-3">

            {/* ── §A Palette: all field types as add/remove chips ── */}
            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  Connected columns
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addText}
                  className="h-7 text-xs"
                  disabled={!canManage}
                >
                  <IconTextSize className="mr-1 size-3" />
                  + Add text
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_ORDER.map((ft) => {
                  const placed = placedTypes.has(ft);
                  return (
                    <span
                      key={ft}
                      className={
                        placed
                          ? "inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs"
                          : "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      <span className="font-medium">{FIELD_LABELS[ft]}</span>
                      {placed ? (
                        <button
                          type="button"
                          onClick={() => {
                            const f = fields.find((f) => f.field_type === ft);
                            if (f) removeField(f.draftId);
                          }}
                          disabled={!canManage}
                          className="flex size-4 items-center justify-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground"
                          aria-label={`Remove ${FIELD_LABELS[ft]}`}
                        >
                          <IconX className="size-2.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addField(ft)}
                          disabled={!canManage}
                          className="font-bold text-primary hover:text-primary/80"
                          aria-label={`Add ${FIELD_LABELS[ft]}`}
                        >
                          +
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              {fields.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Click + on a stat to add it as a column. Drag the green handle
                  on the canvas to set its X position per column group.
                </p>
              )}
            </div>

            {/* ── §B Canvas: background + field handles + text elements ── */}
            <div ref={wrapRef} className="w-full">
              <div
                ref={canvasRef}
                className="relative select-none overflow-hidden rounded-md border bg-[#0a0e0c]"
                style={{ width: canvasDims.w, height: canvasDims.h }}
                onClick={(e) => {
                  // Click on empty canvas space deselects.
                  if (e.target === canvasRef.current) setSelected(null);
                }}
              >
                {/* Background image (YouTube preferred). */}
                {bgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bgUrl}
                    alt="Design background"
                    className="pointer-events-none absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    No background uploaded
                  </div>
                )}

                {/* ── Render each column group's rows + field handles ── */}
                {groups.map((grp, gi) => {
                  // Colour-code groups: group 0 = green, group 1 = gold, rest = blue.
                  const handleColor =
                    gi === 0 ? "#34d27b" : gi === 1 ? "#f5c451" : "#60a5fa";

                  return fields.map((field) => {
                    if (field.column_group !== gi) return null;
                    const isSelected =
                      selected?.type === "field" &&
                      selected.draftId === field.draftId;
                    const fSizePct = field.font_size_pct ?? 2.1;
                    const fSizePx = (fSizePct / 100) * canvasDims.h;

                    return (
                      <div key={`${field.draftId}-g${gi}`}>
                        {/* Draggable vertical handle (horizontal drag only). */}
                        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                        <div
                          onPointerDown={(e) => {
                            setSelected({ type: "field", draftId: field.draftId });
                            if (canManage) startDrag(e, "field", field.draftId);
                          }}
                          className="absolute top-0 h-full cursor-ew-resize"
                          style={{
                            left: `${field.x_pct}%`,
                            width: 2,
                            backgroundColor: isSelected
                              ? handleColor
                              : `${handleColor}80`,
                            transform: "translateX(-50%)",
                            zIndex: 10,
                          }}
                          title={`${FIELD_LABELS[field.field_type]} (group ${gi + 1})`}
                        >
                          {/* Label badge on the handle. */}
                          <span
                            className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 rounded px-1 py-px text-[10px] font-bold leading-none"
                            style={{
                              backgroundColor: handleColor,
                              color: gi === 0 ? "#06210f" : gi === 1 ? "#241c00" : "#0f172a",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {FIELD_LABELS[field.field_type]}
                          </span>
                        </div>

                        {/* Mock data cells (one per group row). */}
                        {Array.from({ length: grp.row_count }).map((_, ri) => {
                          const rankIdx = grp.start_rank - 1 + ri;
                          if (rankIdx >= MOCK_TEAMS.length) return null;
                          const topPct =
                            grp.row_start_pct + ri * grp.row_height_pct;
                          const cellText = mockCellValue(rankIdx, field.field_type);
                          const transformX =
                            field.align === "left"
                              ? "translateX(0)"
                              : field.align === "right"
                              ? "translateX(-100%)"
                              : "translateX(-50%)";
                          return (
                            <span
                              key={`${field.draftId}-r${ri}`}
                              className="pointer-events-none absolute leading-none"
                              style={{
                                left: `${field.x_pct}%`,
                                top: `${topPct}%`,
                                fontSize: fSizePx,
                                fontFamily: fontName(field.font_id),
                                fontWeight: 800,
                                color: field.color || design.text_color || "#ffffff",
                                transform: `${transformX} translateY(-50%)`,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {cellText}
                            </span>
                          );
                        })}
                      </div>
                    );
                  });
                })}

                {/* ── Freeform text elements (draggable in both axes) ── */}
                {texts.map((txt) => {
                  const isSelected =
                    selected?.type === "text" && selected.draftId === txt.draftId;
                  const tSizePx = ((txt.font_size_pct ?? 5) / 100) * canvasDims.h;
                  return (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                    <span
                      key={txt.draftId}
                      onPointerDown={(e) => {
                        setSelected({ type: "text", draftId: txt.draftId });
                        if (canManage) startDrag(e, "text", txt.draftId);
                      }}
                      className="absolute cursor-move leading-none"
                      style={{
                        left: `${txt.x_pct}%`,
                        top: `${txt.y_pct}%`,
                        fontSize: tSizePx,
                        fontFamily: fontName(txt.font_id),
                        fontWeight: 800,
                        color: txt.color || "#ffffff",
                        transform: alignTransform(txt.align),
                        whiteSpace: "nowrap",
                        zIndex: 20,
                        outline: isSelected
                          ? "2px solid #f5c451"
                          : "1px dashed rgba(245,196,81,0.4)",
                        outlineOffset: 3,
                      }}
                      title="Drag to reposition"
                    >
                      {txt.text || "TEXT"}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* ── §C Column groups editor ── */}
            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  Column groups
                  <span className="ml-1.5 text-muted-foreground">
                    (row layout per group)
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={applyTwoGroupPreset}
                    disabled={!canManage}
                    className="h-7 text-xs"
                    title="Apply Dynasty Cup 2-column preset (ranks 1-8 and 9-16)"
                  >
                    2-column preset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addGroup}
                    disabled={!canManage}
                    className="h-7 text-xs"
                  >
                    <IconPlus className="size-3" /> Add group
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {groups.map((grp, gi) => {
                  const groupColor =
                    gi === 0 ? "border-primary/50" : gi === 1 ? "border-yellow-500/50" : "border-blue-400/50";
                  return (
                    <div
                      key={gi}
                      className={`rounded-md border p-2.5 text-xs ${groupColor}`}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          Group {gi + 1}
                          {gi === 0 ? " (green handles)" : gi === 1 ? " (gold handles)" : " (blue handles)"}
                        </span>
                        {groups.length > 1 && canManage && (
                          <button
                            type="button"
                            onClick={() => removeGroup(gi)}
                            className="text-destructive hover:text-destructive/80"
                            aria-label={`Remove group ${gi + 1}`}
                          >
                            <IconX className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        {/* Start rank */}
                        <div>
                          <label className="text-muted-foreground">Start rank</label>
                          <Input
                            type="number"
                            min={1}
                            value={grp.start_rank}
                            disabled={!canManage}
                            onChange={(e) =>
                              updateGroup(gi, {
                                start_rank: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="mt-1 h-7 text-xs"
                          />
                        </div>
                        {/* Row count */}
                        <div>
                          <label className="text-muted-foreground">Row count</label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={grp.row_count}
                            disabled={!canManage}
                            onChange={(e) =>
                              updateGroup(gi, {
                                row_count: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="mt-1 h-7 text-xs"
                          />
                        </div>
                        {/* First row Y */}
                        <div className="col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-muted-foreground">First row Y</label>
                            <span className="tabular-nums text-muted-foreground">
                              {grp.row_start_pct.toFixed(1)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={15}
                            max={60}
                            step={0.1}
                            value={grp.row_start_pct}
                            disabled={!canManage}
                            onChange={(e) =>
                              updateGroup(gi, { row_start_pct: parseFloat(e.target.value) })
                            }
                            className="mt-1 w-full accent-primary"
                          />
                        </div>
                        {/* Row height */}
                        <div className="col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-muted-foreground">Row height</label>
                            <span className="tabular-nums text-muted-foreground">
                              {grp.row_height_pct.toFixed(2)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={3}
                            max={12}
                            step={0.05}
                            value={grp.row_height_pct}
                            disabled={!canManage}
                            onChange={(e) =>
                              updateGroup(gi, { row_height_pct: parseFloat(e.target.value) })
                            }
                            className="mt-1 w-full accent-primary"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right: style panel + font library ── */}
          <div className="space-y-3">

            {/* ── §D Selected element style panel ── */}
            <div className="rounded-md border bg-card p-3">
              <p className="mb-2 text-xs font-medium text-foreground">
                {selectedField
                  ? `Style: ${FIELD_LABELS[selectedField.field_type]}`
                  : selectedText
                  ? "Style: text element"
                  : "Style panel"}
              </p>

              {!selected && (
                <p className="text-xs text-muted-foreground">
                  Click a field handle or text element on the canvas to select
                  and edit its style.
                </p>
              )}

              {/* ── Field style controls ── */}
              {selectedField && (
                <div className="space-y-3">
                  {/* Column group assignment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Column group</Label>
                    <Select
                      value={String(selectedField.column_group)}
                      disabled={!canManage}
                      onValueChange={(v) =>
                        updateField(selectedField.draftId, {
                          column_group: Number(v),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((_, gi) => (
                          <SelectItem key={gi} value={String(gi)}>
                            Group {gi + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Align */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alignment</Label>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as TextAlign[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            updateField(selectedField.draftId, { align: a })
                          }
                          className={
                            selectedField.align === a
                              ? "flex-1 rounded-md border border-primary bg-primary/10 py-1 text-xs font-medium text-primary"
                              : "flex-1 rounded-md border border-border py-1 text-xs text-muted-foreground hover:bg-muted"
                          }
                        >
                          {a.charAt(0).toUpperCase() + a.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font</Label>
                    <Select
                      value={selectedField.font_id != null ? String(selectedField.font_id) : "__default__"}
                      disabled={!canManage || fontsLoading}
                      onValueChange={(v) =>
                        updateField(selectedField.draftId, {
                          font_id: v === "__default__" ? null : Number(v),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Default</SelectItem>
                        {fonts.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font size (% of canvas height) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Font size</Label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {(selectedField.font_size_pct ?? 2.1).toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={6}
                      step={0.1}
                      value={selectedField.font_size_pct ?? 2.1}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateField(selectedField.draftId, { font_size_pct: parseFloat(e.target.value) })
                      }
                      className="w-full accent-primary"
                    />
                  </div>

                  {/* Colour (empty = design default) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Colour
                      <span className="ml-1 text-muted-foreground">
                        (blank = design default)
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedField.color || design.text_color || "#ffffff"}
                        disabled={!canManage}
                        onChange={(e) =>
                          updateField(selectedField.draftId, {
                            color: e.target.value,
                          })
                        }
                        className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-1"
                        aria-label="Field colour"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        disabled={!canManage}
                        onClick={() =>
                          updateField(selectedField.draftId, { color: "" })
                        }
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* X position readout (drag handle is canonical; number input for fine-tuning) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">X position (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={roundPct(selectedField.x_pct)}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateField(selectedField.draftId, {
                          x_pct: Math.max(0, Math.min(100, Number(e.target.value))),
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Delete field button */}
                  {canManage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => removeField(selectedField.draftId)}
                    >
                      <IconTrash className="mr-1 size-3.5" />
                      Remove column
                    </Button>
                  )}
                </div>
              )}

              {/* ── Text element style controls ── */}
              {selectedText && (
                <div className="space-y-3">
                  {/* Content */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Text content</Label>
                    <Input
                      value={selectedText.text}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateText(selectedText.draftId, { text: e.target.value })
                      }
                      placeholder="Type your text..."
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Align */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alignment</Label>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as TextAlign[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            updateText(selectedText.draftId, { align: a })
                          }
                          className={
                            selectedText.align === a
                              ? "flex-1 rounded-md border border-primary bg-primary/10 py-1 text-xs font-medium text-primary"
                              : "flex-1 rounded-md border border-border py-1 text-xs text-muted-foreground hover:bg-muted"
                          }
                        >
                          {a.charAt(0).toUpperCase() + a.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font</Label>
                    <Select
                      value={selectedText.font_id != null ? String(selectedText.font_id) : "__default__"}
                      disabled={!canManage || fontsLoading}
                      onValueChange={(v) =>
                        updateText(selectedText.draftId, {
                          font_id: v === "__default__" ? null : Number(v),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Default</SelectItem>
                        {fonts.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font size */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Font size</Label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {(selectedText.font_size_pct ?? 5).toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={0.1}
                      value={selectedText.font_size_pct ?? 5}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateText(selectedText.draftId, { font_size_pct: parseFloat(e.target.value) })
                      }
                      className="w-full accent-primary"
                    />
                  </div>

                  {/* Colour */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Colour</Label>
                    <input
                      type="color"
                      value={selectedText.color || "#ffffff"}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateText(selectedText.draftId, { color: e.target.value })
                      }
                      className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-1"
                      aria-label="Text colour"
                    />
                  </div>

                  {/* Position readouts */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">X (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={roundPct(selectedText.x_pct)}
                        disabled={!canManage}
                        onChange={(e) =>
                          updateText(selectedText.draftId, {
                            x_pct: Math.max(0, Math.min(100, Number(e.target.value))),
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Y (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={roundPct(selectedText.y_pct)}
                        disabled={!canManage}
                        onChange={(e) =>
                          updateText(selectedText.draftId, {
                            y_pct: Math.max(0, Math.min(100, Number(e.target.value))),
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Delete text button */}
                  {canManage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => removeText(selectedText.draftId)}
                    >
                      <IconTrash className="mr-1 size-3.5" />
                      Delete text
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ── §E Font library ── */}
            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  <IconTypography className="mr-1 inline-block size-3.5" />
                  Fonts
                </p>
                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fontInputRef.current?.click()}
                    disabled={uploadingFont}
                    className="h-7 text-xs"
                  >
                    {uploadingFont ? (
                      <IconLoader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <IconUpload className="mr-1 size-3" />
                    )}
                    Upload
                  </Button>
                )}
                <input
                  ref={fontInputRef}
                  type="file"
                  accept=".ttf,.otf"
                  className="hidden"
                  onChange={(e) => {
                    handleFontUpload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              {fontsLoading ? (
                <p className="text-xs text-muted-foreground">Loading fonts...</p>
              ) : fonts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No custom fonts yet. Upload a TTF or OTF file to use it in
                  field columns and text elements.
                </p>
              ) : (
                <div className="space-y-1">
                  {fonts.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-md border p-1.5 text-xs"
                    >
                      <span style={{ fontFamily: `"${f.name}", DM Sans, sans-serif` }}>
                        {f.name}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleFontDelete(f)}
                          className="ml-2 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete font ${f.name}`}
                        >
                          <IconX className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── there is NO Save button: every change auto-saves. This only reflects the
            auto-save status, so the user can close any time without losing placement work. */}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saveStatus === "saving" && (
              <>
                <IconLoader2 className="mr-1 inline size-3 animate-spin" />
                Saving...
              </>
            )}
            {saveStatus === "saved" && "All changes saved"}
            {saveStatus === "error" && (
              <span className="text-destructive">Save failed. It retries on your next change.</span>
            )}
            {saveStatus === "idle" && "Changes save automatically"}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
