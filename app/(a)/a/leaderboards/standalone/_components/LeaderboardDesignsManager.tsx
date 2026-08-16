"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LeaderboardDesignsManager - the shared "Leaderboard designs" library card + editor.
// ----------------------------------------------------------------------------
// Where designers CREATE/EDIT branded leaderboard designs. Mounted on BOTH homes the owner asked
// for (2026-06-13):
//   • organizer -> app/(organizer)/organizer/design/page.tsx   (org-scoped library)
//   • admin     -> app/(a)/a/_components/DesignsAdminContent.tsx ("Designs" tab of /a/events,
//                  organizationId=null = the AFC-native library)
// The export PICKER (ExportGraphicDialog, on each leaderboard's view) only SELECTS a design to
// download - it does not edit. So library management lives here; selection lives on the leaderboard.
//
// A design = a name + an Instagram (1080x1350) and/or YouTube (1920x1080) background + text/accent
// colours + row cap + show-title/subtitle toggles + an is_default flag + 0..N POSITIONED LOGOS.
// Logos are placed by dragging them on a live preview canvas (freeform); position is stored as a
// percent of the canvas (centre anchor) so one placement maps to BOTH output sizes. Each logo has
// its own size band (small/medium/large). The renderer (afc_leaderboard.graphic) draws the standings
// + title/subtitle + these logos; the export picker's default is auto-selected.
//
// DATA: leaderboardDesignsApi (lib/leaderboardDesigns.ts) -> the backend CRUD under
// organizers/leaderboard-designs/ (afc_organizers.views_leaderboard_design), incl. the logo
// sub-endpoints. Create/edit go up as multipart FormData; logos diff on save (POST new, PATCH moved
// or resized, DELETE removed). WRITE access is gated server-side and via the canManage prop.
//
// Design: AFC constants - rounded-md card, text-xs table, outline rounded-full badges, sonner toasts.
// No em/en dashes.
//
// i18n (owner override: admin surfaces ARE in scope): every string here resolves through the
// "adminDesignEditor" namespace, the SAME one DesignFieldsEditor uses. One namespace for the whole
// design library on purpose - this card is the DOOR into that editor, and translating the editor
// while its door stayed English is exactly the half-done state this pass closes. English is authored
// in messages/en/adminDesignEditor.json; fr and pt are hand-written and pinned by their
// .adminDesignEditor.source.json sidecars so a later `pnpm i18n:translate` cannot overwrite them.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconLoader2,
  IconPalette,
  IconCopyPlus,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconStar,
  IconTableColumn,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import { Loader } from "@/components/Loader";
// The shared self-expiring NEW tag. Used on the design-TYPE options that appear in this dialog's
// picker for the first time on 2026-08-16 (the shipping date, not the day the code was written);
// it removes itself 5 days later with nothing to clean up.
import { NewBadge } from "@/components/NewBadge";
// Live refresh (owner 2026-07-02): site-wide heartbeat; the design LIBRARY LIST re-fetches
// on each tick (and on tab return). Only the read-only table refreshes - the create/edit
// dialog and the fields editor keep their own working state, so nothing mid-edit is touched.
import { useLiveTick } from "@/hooks/useLiveTick";
import {
  leaderboardDesignsApi,
  type LeaderboardDesign,
  type GraphicSize,
  type LogoSize,
} from "@/lib/leaderboardDesigns";
import { DesignFieldsEditor } from "./DesignFieldsEditor";

// Accepted background/logo image types (same set the organizer Design-request page allows).
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

// Mirror of afc_leaderboard.graphic.LOGO_SIZE_FRAC: a logo's longest edge as a fraction of canvas
// height. Used to size the preview markers so they approximate the render.
const LOGO_SIZE_FRAC: Record<LogoSize, number> = {
  small: 0.07,
  medium: 0.11,
  large: 0.16,
};

// A stable-ish local key for a staged logo (browser-only; fine in app code).
const newKey = () => Math.random().toString(36).slice(2);

// ── Local logo draft ────────────────────────────────────────────────────────────
// One logo in the editor's working state. `id` is set for logos already on the server (so save can
// PATCH/DELETE them); `file` is set for newly-added ones (so save can POST them). `url` is the media
// URL (existing) or an object URL (new file) shown in the preview + thumbnail.
interface LogoDraft {
  key: string;
  id?: number;
  file?: File;
  url: string;
  x_pct: number; // centre, 0..100
  y_pct: number;
  size: LogoSize;
}

// ── Editable form state ─────────────────────────────────────────────────────────
interface FormState {
  name: string;
  textColor: string;
  accentColor: string;
  maxRows: number;
  isDefault: boolean;
  // Transparent overlay flag (owner 2026-07-01): when on, the design has no opaque background so the
  // OBS live overlay (app/overlay/leaderboard/[token] -> DesignBoard) + the PNG export render only
  // the placed columns on a see-through canvas. Persisted as `transparent_background` on the design.
  transparentBackground: boolean;
  // BG behaviour on the live overlay (owner 2026-07-02): persistent (always on) | animate (in on load).
  backgroundBehavior: string;
  // Design type (owner 2026-07-02): leaderboard | versus; versusStatKeys = the H2H stat rows.
  designType: string;
  versusStatKeys: string[];
  igFile: File | null;
  ytFile: File | null;
  igPreview: string;
  ytPreview: string;
  logos: LogoDraft[];
}

const EMPTY_FORM: FormState = {
  name: "",
  textColor: "#FFFFFF",
  accentColor: "#34d27b", // AFC primary green
  maxRows: 16,
  isDefault: false,
  transparentBackground: false,
  backgroundBehavior: "persistent",
  designType: "leaderboard",
  versusStatKeys: [],
  igFile: null,
  ytFile: null,
  igPreview: "",
  ytPreview: "",
  logos: [],
};

export function LeaderboardDesignsManager({
  organizationId,
  canManage,
}: {
  // null/undefined = the AFC-native library (admin surface); a number = that org's library.
  organizationId?: number | null;
  // Gate the add/edit/delete controls. Mirrors the backend write gate so a read-only viewer
  // (member without can_submit_designs) sees the list but no mutation buttons.
  canManage: boolean;
}) {
  // Everything this card shows. Scoped to the "manager" sub-block so the calls read t("add") rather
  // than t("manager.add"); the design-TYPE labels are shared with the editor's own picker, so those
  // few come from the namespace root via `tRoot` below instead of being written twice.
  const t = useTranslations("adminDesignEditor.manager");
  const tRoot = useTranslations("adminDesignEditor");
  // The create/edit dialog and the delete confirmation each get their own scope, so a long JSX
  // block reads tDlg("preview") instead of t("dialog.preview").
  const tDlg = useTranslations("adminDesignEditor.manager.dialog");
  const tDel = useTranslations("adminDesignEditor.manager.deleteDialog");

  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/edit dialog. `editing` is the design being edited, or null when creating.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeaderboardDesign | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, startSave] = useTransition();
  const igInputRef = useRef<HTMLInputElement>(null);
  const ytInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Logos that existed when editing began (id -> position/size), so save can compute which logos
  // were moved/resized (PATCH) or removed (DELETE).
  const originalLogosRef = useRef<
    Map<number, { x_pct: number; y_pct: number; size: LogoSize }>
  >(new Map());

  // Live preview canvas state. We measure the WRAPPER width and compute the canvas pixel size in
  // JS (fit the column width AND a height cap, preserving aspect) so a portrait preview never grows
  // taller than the viewport - relying on CSS aspect-ratio + w-full made the portrait canvas
  // overflow when the dialog was wide.
  const [previewSize, setPreviewSize] = useState<GraphicSize>("instagram");
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(0);
  const draggingKeyRef = useRef<string | null>(null);

  // Delete confirmation target.
  const [deleteTarget, setDeleteTarget] = useState<LeaderboardDesign | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fields+text editor: which design (if any) has the DesignFieldsEditor open.
  const [fieldsEditorDesign, setFieldsEditorDesign] = useState<LeaderboardDesign | null>(null);

  // One-click AFC default-design generator (owner 2026-07-04): which preset (12 | 15 | 24) is being
  // created right now, or null. Drives the per-button spinner + disables the trio while in flight.
  const [creatingDefault, setCreatingDefault] = useState<12 | 15 | 24 | null>(null);

  // ── Load the library. ──
  // Live refresh (owner 2026-07-02): background=true skips the "Loading designs..." state
  // so an automatic refresh never flashes the table away mid-view.
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = await leaderboardDesignsApi.list(organizationId);
      setDesigns(res?.results ?? []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("loadFailed"),
      );
    } finally {
      setLoading(false);
    }
    // `t` is memoised by use-intl, so adding it keeps this callback's identity stable (the live-tick
    // effect below re-runs on it).
  }, [organizationId, t]);

  // Live refresh (owner 2026-07-02): re-run the read-only list fetch on the site-wide tick
  // (tick 0 = the normal first load with the loading state).
  const tick = useLiveTick();
  useEffect(() => {
    load(tick > 0);
  }, [load, tick]);

  // ── Track the available width of the preview column (drives the computed canvas size). ──
  useEffect(() => {
    if (!dialogOpen) return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setAvailW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dialogOpen]);

  // Canvas pixel dims: fit the column width, but cap the height so a portrait preview stays on
  // screen; preserve aspect (no distortion, no clipping). Drives both the canvas box and the logo
  // marker sizing (longest edge = LOGO_SIZE_FRAC[size] * canvas height, mirroring the renderer).
  const ratioWH = previewSize === "instagram" ? 1080 / 1350 : 1920 / 1080;
  const MAX_CANVAS_H = 460;
  let canvasW = availW || 320;
  let canvasH = canvasW / ratioWH;
  if (canvasH > MAX_CANVAS_H) {
    canvasH = MAX_CANVAS_H;
    canvasW = canvasH * ratioWH;
  }
  const canvasDims = { w: Math.round(canvasW), h: Math.round(canvasH) };

  // ── Drag a logo on the preview: update its centre percent from the pointer position. ──
  const onPointerMove = useCallback((e: PointerEvent) => {
    const key = draggingKeyRef.current;
    const el = canvasRef.current;
    if (!key || !el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    setForm((f) => ({
      ...f,
      logos: f.logos.map((l) => (l.key === key ? { ...l, x_pct: x, y_pct: y } : l)),
    }));
  }, []);
  const onPointerUp = useCallback(() => {
    draggingKeyRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);
  const startDrag = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    draggingKeyRef.current = key;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
  // Safety: detach listeners on unmount.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ── Open the dialog. ──
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    originalLogosRef.current = new Map();
    setPreviewSize("instagram");
    setDialogOpen(true);
  };
  const openEdit = (d: LeaderboardDesign) => {
    setEditing(d);
    const logos: LogoDraft[] = (d.logos ?? []).map((l) => ({
      key: `srv-${l.id}`,
      id: l.id,
      url: l.image || "",
      x_pct: l.x_pct,
      y_pct: l.y_pct,
      size: l.size,
    }));
    // Snapshot the server logos so save can diff moved/resized/removed ones.
    originalLogosRef.current = new Map(
      logos
        .filter((l) => l.id != null)
        .map((l) => [l.id as number, { x_pct: l.x_pct, y_pct: l.y_pct, size: l.size }]),
    );
    setForm({
      name: d.name,
      textColor: d.text_color || "#FFFFFF",
      accentColor: d.accent_color || "#34d27b",
      maxRows: d.max_rows ?? 16,
      isDefault: d.is_default,
      transparentBackground: d.transparent_background ?? false,
      backgroundBehavior: d.background_behavior ?? "persistent",
      designType: d.design_type ?? "leaderboard",
      versusStatKeys: d.versus_config?.stat_keys ?? [],
      igFile: null,
      ytFile: null,
      igPreview: d.background_instagram || "",
      ytPreview: d.background_youtube || "",
      logos,
    });
    setPreviewSize("instagram");
    setDialogOpen(true);
  };

  // ── Object-URL hygiene: every staged file makes a blob: URL; revoke it when it is replaced or
  // discarded so the bytes are reclaimed (never revoke a server media URL). ──
  const revokeIfBlob = (u?: string) => {
    if (u && u.startsWith("blob:")) URL.revokeObjectURL(u);
  };
  const revokeFormBlobs = (f: FormState) => {
    revokeIfBlob(f.igPreview);
    revokeIfBlob(f.ytPreview);
    f.logos.forEach((l) => revokeIfBlob(l.url));
  };

  // ── Stage a chosen background for a size. ──
  const handleBgFile = (size: "ig" | "yt", file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t("invalidImage"));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((f) => {
      // Replacing a background orphans the previous blob - revoke it first.
      revokeIfBlob(size === "ig" ? f.igPreview : f.ytPreview);
      return size === "ig"
        ? { ...f, igFile: file, igPreview: url }
        : { ...f, ytFile: file, ytPreview: url };
    });
  };

  // ── Add a logo: stage it centred on the canvas at medium size. ──
  const handleLogoFile = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t("invalidImage"));
      return;
    }
    const draft: LogoDraft = {
      key: newKey(),
      file,
      url: URL.createObjectURL(file),
      x_pct: 50,
      y_pct: 50,
      size: "medium",
    };
    setForm((f) => ({ ...f, logos: [...f.logos, draft] }));
  };

  const removeLogo = (key: string) =>
    setForm((f) => {
      revokeIfBlob(f.logos.find((l) => l.key === key)?.url);
      return { ...f, logos: f.logos.filter((l) => l.key !== key) };
    });
  const setLogoSize = (key: string, size: LogoSize) =>
    setForm((f) => ({
      ...f,
      logos: f.logos.map((l) => (l.key === key ? { ...l, size } : l)),
    }));

  // ── Submit (create or edit) + logo diff. ──
  // Failure-safe: each logo op writes its result back into a working copy (added logos get their
  // server id, updates refresh the originals snapshot) BEFORE the next op. So if a call fails
  // mid-way, the caught state reflects what already landed and a retry only sends the remainder -
  // it never re-POSTs an already-created logo or re-creates the design (which would duplicate).
  const onSubmit = () => {
    if (!form.name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    startSave(async () => {
      const r1 = (n: number) => Math.round(n * 10) / 10;
      const original = originalLogosRef.current; // mutated in place as ops succeed
      const working: LogoDraft[] = form.logos.map((l) => ({ ...l }));
      let createdEditing = editing;
      try {
        const fd = new FormData();
        fd.append("name", form.name.trim());
        fd.append("text_color", form.textColor);
        fd.append("accent_color", form.accentColor);
        fd.append("max_rows", String(form.maxRows));        fd.append("is_default", String(form.isDefault));
        // Transparent overlay flag (owner 2026-07-01): PATCHed alongside the other style fields.
        fd.append("transparent_background", String(form.transparentBackground));
        fd.append("background_behavior", form.backgroundBehavior);
        fd.append("design_type", form.designType);
        // versus_config (slots + stat rows) is edited in the fields editor now (owner 2026-07-02);
        // this dialog no longer writes it, so a Save here can never clobber the designer's layout.
        if (form.igFile) fd.append("background_instagram", form.igFile);
        if (form.ytFile) fd.append("background_youtube", form.ytFile);
        if (organizationId != null)
          fd.append("organization_id", String(organizationId));

        // 1) Base design. After a create, mark `editing` so any retry UPDATES (never re-creates).
        let designId = editing?.id;
        if (editing) {
          await leaderboardDesignsApi.update(editing.id, fd);
        } else {
          const res = await leaderboardDesignsApi.create(fd);
          designId = res.design.id;
          createdEditing = res.design;
          setEditing(res.design);
        }
        if (designId == null) throw new Error("Design id missing after save.");

        // 2) Logo diff. Deletions first (was on the server, removed in the editor).
        const currentIds = new Set(
          working.filter((l) => l.id != null).map((l) => l.id as number),
        );
        for (const id of Array.from(original.keys())) {
          if (!currentIds.has(id)) {
            await leaderboardDesignsApi.deleteLogo(designId, id);
            original.delete(id);
          }
        }
        // adds + position/size updates, writing each result back so a retry skips done work.
        for (let i = 0; i < working.length; i++) {
          const lg = working[i];
          if (lg.id == null) {
            if (lg.file) {
              const { logo } = await leaderboardDesignsApi.addLogo(designId, lg.file, {
                x_pct: r1(lg.x_pct),
                y_pct: r1(lg.y_pct),
                size: lg.size,
              });
              revokeIfBlob(lg.url);
              working[i] = {
                key: `srv-${logo.id}`,
                id: logo.id,
                url: logo.image || "",
                x_pct: logo.x_pct,
                y_pct: logo.y_pct,
                size: logo.size,
              };
              original.set(logo.id, {
                x_pct: logo.x_pct,
                y_pct: logo.y_pct,
                size: logo.size,
              });
            }
          } else {
            const o = original.get(lg.id);
            if (
              !o ||
              r1(o.x_pct) !== r1(lg.x_pct) ||
              r1(o.y_pct) !== r1(lg.y_pct) ||
              o.size !== lg.size
            ) {
              await leaderboardDesignsApi.updateLogo(designId, lg.id, {
                x_pct: r1(lg.x_pct),
                y_pct: r1(lg.y_pct),
                size: lg.size,
              });
              original.set(lg.id, { x_pct: lg.x_pct, y_pct: lg.y_pct, size: lg.size });
            }
          }
        }

        // success: reclaim any staged blobs, reset, reload.
        revokeFormBlobs(form);
        toast.success(editing ? t("updated") : t("created"));
        setDialogOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
        load();
      } catch (err: any) {
        // Reflect partial progress so a retry only does the remainder (no duplicate POSTs).
        setForm((f) => ({ ...f, logos: working }));
        setEditing(createdEditing);
        originalLogosRef.current = original;
        toast.error(
          err?.response?.data?.message || t("saveFailed"),
        );
      }
    });
  };

  // ── Create a ready-to-use AFC default design (12 / 15 / 24 teams). ──
  // POSTs the create-default endpoint (leaderboardDesignsApi.createDefault ->
  // afc_organizers.views_leaderboard_design.create_default_design), which builds a design with the
  // AFC dark/green theme + the standard columns (POS, TEAM logo+name, KILLS, PLACEMENT POINTS,
  // BOOYAHS, TOTAL POINTS) pre-placed for the chosen size: 12/15 = one column, 24 = two 12-row
  // columns. On success we reload the library so the new design appears; it is then editable in the
  // DesignFieldsEditor like any other. The org-scoping (organizationId) matches the manager's library.
  const handleCreateDefault = async (preset: 12 | 15 | 24) => {
    if (!canManage || creatingDefault !== null) return;
    setCreatingDefault(preset);
    try {
      const res = await leaderboardDesignsApi.createDefault(preset, organizationId);
      toast.success(t("defaultCreated", { name: res.design.name }));
      load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("defaultCreateFailed"),
      );
    } finally {
      setCreatingDefault(null);
    }
  };

  // ── Delete a design. ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await leaderboardDesignsApi.remove(deleteTarget.id);
      toast.success(t("deleted", { name: deleteTarget.name }));
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("deleteFailed"),
      );
    } finally {
      setDeleting(false);
    }
  };

  // Background URL shown behind the preview canvas for the selected size.
  const previewBg = previewSize === "instagram" ? form.igPreview : form.ytPreview;

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center text-base">
          <IconPalette className="mr-1.5 size-4" />
          {t("heading")}
          <InfoTip text={t("info")} className="ml-1.5" />
        </CardTitle>
        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* One-click AFC default designs (owner 2026-07-04): each button creates a ready-to-use
                design for a team-capacity preset (12 / 15 = one column; 24 = two 12-row columns) and
                refreshes the list. Handy starting point that stays fully editable afterwards. */}
            <div className="flex items-center gap-1.5">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {t("createDefault")}
              </span>
              {([12, 15, 24] as const).map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  disabled={creatingDefault !== null}
                  onClick={() => handleCreateDefault(preset)}
                  title={
                    preset === 24
                      ? t("createDefaultTitleLarge")
                      : t("createDefaultTitle", { count: preset })
                  }
                  aria-label={t("createDefaultAria", { count: preset })}
                >
                  {creatingDefault === preset ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    preset
                  )}
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={openCreate}>
              <IconPlus className="size-4" /> {t("add")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconPhoto className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                {t("addFirst")}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="p-2 text-xs text-foreground">{t("columnName")}</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">{t("columnSizes")}</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">{t("columnLogos")}</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">{t("columnColours")}</TableHead>
                  <TableHead className="p-2 text-xs text-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="p-2 text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        {d.name}
                        {d.is_default && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary px-2 py-0.5 text-xs text-primary"
                          >
                            <IconStar className="mr-0.5 size-3" /> {t("defaultBadge")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant="outline"
                          className={
                            d.background_instagram
                              ? "rounded-full border-blue-500 px-2 py-0.5 text-xs text-blue-600"
                              : "rounded-full border-muted-foreground px-2 py-0.5 text-xs text-muted-foreground"
                          }
                        >
                          {d.background_instagram ? t("igSet") : t("igNone")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            d.background_youtube
                              ? "rounded-full border-red-500 px-2 py-0.5 text-xs text-red-600"
                              : "rounded-full border-muted-foreground px-2 py-0.5 text-xs text-muted-foreground"
                          }
                        >
                          {d.background_youtube ? t("ytSet") : t("ytNone")}
                        </Badge>
                      </div>
                    </TableCell>
                    {/* How many positioned logos this design carries. */}
                    <TableCell className="p-2 text-xs text-muted-foreground">
                      {d.logos?.length ? `${d.logos.length}` : "0"}
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-4 rounded-full border"
                          style={{ backgroundColor: d.text_color }}
                          title={t("textSwatch", { colour: d.text_color })}
                        />
                        <span
                          className="inline-block size-4 rounded-full border"
                          style={{ backgroundColor: d.accent_color }}
                          title={t("accentSwatch", { colour: d.accent_color })}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Modal-edit retired (owner 2026-07-02, studio consolidation): every
                              setting now lives in the designer (the canvas button), so existing
                              designs have ONE editing surface. The modal remains for Add design. */}
                          {/* Duplicate (owner 2026-07-02): full copy - scalars, logos, placed
                              fields, texts and pages - named "<name> copy". */}
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={t("duplicate", { name: d.name })}
                            onClick={async () => {
                              try {
                                const copy = await leaderboardDesignsApi.duplicate(d.id);
                                toast.success(t("duplicated", { name: copy.name }));
                                load();
                              } catch {
                                toast.error(t("duplicateFailed"));
                              }
                            }}
                          >
                            <IconCopyPlus className="size-4" />
                          </Button>
                          {/* Opens the DesignFieldsEditor for columns, text, groups, and fonts. */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFieldsEditorDesign(d)}
                            aria-label={t("editFieldsFor", { name: d.name })}
                            title={t("editFields")}
                          >
                            <IconTableColumn className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(d)}
                            aria-label={t("delete", { name: d.name })}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* ── Create / edit dialog ── two columns: preview+logos | settings. ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            revokeFormBlobs(form); // reclaim staged background/logo blobs on cancel
            setEditing(null);
            setForm(EMPTY_FORM);
          }
          setDialogOpen(open);
        }}
      >
        {/* Width forced via inline style: an arbitrary `sm:max-w-[..]` class can miss the Tailwind
            JIT build and leave the dialog full-width. min() keeps it responsive on small screens. */}
        <DialogContent
          className="max-h-[92vh] overflow-y-auto"
          style={{ maxWidth: "min(920px, calc(100% - 2rem))" }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? tDlg("titleEdit") : tDlg("titleAdd")}
            </DialogTitle>
            <DialogDescription>{tDlg("description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            {/* ── Left: live preview + logo controls ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{tDlg("preview")}</Label>
                {/* Size toggle: positions are percent-based so they carry across both. */}
                <div className="flex overflow-hidden rounded-md border text-xs">
                  {(["instagram", "youtube"] as GraphicSize[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreviewSize(s)}
                      className={
                        previewSize === s
                          ? "bg-primary px-2.5 py-1 capitalize text-primary-foreground"
                          : "px-2.5 py-1 capitalize text-muted-foreground hover:bg-muted"
                      }
                    >
                      {s === "instagram" ? "Instagram" : "YouTube"}
                    </button>
                  ))}
                </div>
              </div>

              {/* The drag canvas: background for the selected size + draggable logo markers.
                  Centered in a measured wrapper; sized in JS to fit the column + a height cap. */}
              <div ref={wrapRef} className="flex w-full justify-center">
              <div
                ref={canvasRef}
                className="relative select-none overflow-hidden rounded-md border bg-[#0a0e0c]"
                style={{ width: canvasDims.w, height: canvasDims.h }}
              >
                {previewBg ? (
                  // Background preview is an object URL or media URL - plain <img>.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewBg}
                    alt={tDlg("backgroundAlt")}
                    className="pointer-events-none absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
                    {/* {size} is the platform's own brand name, so it stays untranslated. */}
                    {tDlg("noBackground", {
                      size: previewSize === "instagram" ? "Instagram" : "YouTube",
                    })}
                  </div>
                )}

                {/* Draggable logo markers. Size approximates the render (frac of canvas height). */}
                {form.logos.map((lg) => {
                  const px = Math.max(16, LOGO_SIZE_FRAC[lg.size] * canvasDims.h);
                  return (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                    <div
                      key={lg.key}
                      onPointerDown={(e) => startDrag(e, lg.key)}
                      className="absolute cursor-grab touch-none rounded-sm ring-1 ring-white/40 active:cursor-grabbing"
                      style={{
                        left: `${lg.x_pct}%`,
                        top: `${lg.y_pct}%`,
                        width: px,
                        height: px,
                        transform: "translate(-50%, -50%)",
                      }}
                      title={tDlg("dragLogo")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lg.url}
                        alt={tDlg("logoAlt")}
                        className="pointer-events-none size-full object-contain"
                      />
                    </div>
                  );
                })}
              </div>
              </div>

              {/* Logo list: thumbnail + size + remove, plus Add logo. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    {tDlg("logos")}{" "}
                    <span className="text-muted-foreground">
                      {tDlg("logosHint")}
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <IconPlus className="size-4" /> {tDlg("addLogo")}
                  </Button>
                </div>
                {form.logos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tDlg("noLogos")}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {form.logos.map((lg) => (
                      <div
                        key={lg.key}
                        className="flex items-center gap-2 rounded-md border p-1.5"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={lg.url}
                            alt={tDlg("logoAlt")}
                            className="size-full object-contain"
                          />
                        </div>
                        <Select
                          value={lg.size}
                          onValueChange={(v) => setLogoSize(lg.key, v as LogoSize)}
                        >
                          <SelectTrigger className="h-8 flex-1 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">{tDlg("logoSmall")}</SelectItem>
                            <SelectItem value="medium">{tDlg("logoMedium")}</SelectItem>
                            <SelectItem value="large">{tDlg("logoLarge")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeLogo(lg.key)}
                          aria-label={tDlg("removeLogo")}
                        >
                          <IconX className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    handleLogoFile(e.target.files?.[0]);
                    e.target.value = ""; // allow re-adding the same file
                  }}
                />
              </div>
            </div>

            {/* ── Right: settings ── */}
            <div className="space-y-4">
              {/* Name (required). */}
              <div className="space-y-2">
                <Label htmlFor="design-name">{tDlg("name")}</Label>
                <Input
                  id="design-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder={tDlg("namePlaceholder")}
                />
              </div>

              {/* Backgrounds. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <BackgroundField
                  label={tDlg("backgroundInstagram")}
                  hint={tDlg("backgroundInstagramHint")}
                  aspectClass="aspect-[4/5]"
                  preview={form.igPreview}
                  inputRef={igInputRef}
                  onPick={(file) => handleBgFile("ig", file)}
                  onClear={() =>
                    setForm((f) => {
                      revokeIfBlob(f.igPreview);
                      return { ...f, igFile: null, igPreview: "" };
                    })
                  }
                />
                <BackgroundField
                  label={tDlg("backgroundYoutube")}
                  hint={tDlg("backgroundYoutubeHint")}
                  aspectClass="aspect-video"
                  preview={form.ytPreview}
                  inputRef={ytInputRef}
                  onPick={(file) => handleBgFile("yt", file)}
                  onClear={() =>
                    setForm((f) => {
                      revokeIfBlob(f.ytPreview);
                      return { ...f, ytFile: null, ytPreview: "" };
                    })
                  }
                />
              </div>

              {/* Colours. */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tDlg("textColour")}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.textColor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, textColor: e.target.value }))
                      }
                      className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                      aria-label={tDlg("textColour")}
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.textColor}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tDlg("accentColour")}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, accentColor: e.target.value }))
                      }
                      className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                      aria-label={tDlg("accentColour")}
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.accentColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Max rows. */}
              <div className="space-y-2">
                <Label htmlFor="design-rows">{tDlg("maxRows")}</Label>
                <Input
                  id="design-rows"
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxRows}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxRows: Math.max(
                        1,
                        Math.min(50, Number(e.target.value) || 1),
                      ),
                    }))
                  }
                  className="w-28"
                />
              </div>

              {/* Toggles. */}
              <div className="space-y-3">
                {/* Show-title/subtitle toggles REMOVED (owner 2026-07-02): use freeform text
                    elements in the fields editor for headers (WYSIWYG, full styling). */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="design-default" className="font-normal">
                    {tDlg("setDefault")}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {tDlg("setDefaultHint")}
                    </span>
                  </Label>
                  <Switch
                    id="design-default"
                    checked={form.isDefault}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, isDefault: v }))
                    }
                  />
                </div>
                {/* Transparent background (owner 2026-07-01): for the OBS live overlay. When on, the
                    design renders with NO opaque background so only the placed columns/logos/text show
                    over the stream. The background uploads become optional (the overlay ignores them).
                    Read back by DesignBoard (app/overlay/leaderboard/_components) via the feed's
                    design.transparent_background. */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="design-transparent" className="font-normal">
                    {tDlg("transparent")}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {tDlg("transparentHint")}
                    </span>
                  </Label>
                  <Switch
                    id="design-transparent"
                    checked={form.transparentBackground}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, transparentBackground: v }))
                    }
                  />
                </div>
                {/* Design TYPE (owner 2026-07-02): "Versus" designs power the studio's head-to-head
                    overlays - the background/colors above set the look, and the checkboxes pick which
                    stat rows each competitor slot shows (design.versus_config.stat_keys). */}
                <div className="flex items-center justify-between gap-3">
                  <Label className="font-normal">
                    {tDlg("designType")}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {tDlg("designTypeHint")}
                    </span>
                  </Label>
                  <Select
                    value={form.designType}
                    onValueChange={(v) => setForm((f) => ({ ...f, designType: v }))}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* The SAME six types the fields editor offers, and the same labels, read
                          from the namespace root so the two pickers cannot drift apart. This list
                          used to stop at "versus", so a design meant for a live scene had to be
                          created here and then re-typed inside the editor. Backed by
                          afc_organizers.views_leaderboard_design.DESIGN_TYPES; anything outside
                          that set falls back to "leaderboard" server-side.
                          NEW tags: four options appear in THIS picker for the first time on
                          2026-08-16 (booyah included, because it was only ever offered inside the
                          editor before) and nothing else on the row would draw the eye to them.
                          They remove themselves 5 days on. */}
                      <SelectItem value="leaderboard">
                        {tRoot("settings.typeLeaderboard")}
                      </SelectItem>
                      <SelectItem value="versus">
                        {tRoot("settings.typeVersus")}
                      </SelectItem>
                      <SelectItem value="booyah">
                        <span className="flex items-center gap-2">
                          {tRoot("settings.typeBooyah")}
                          <NewBadge since="2026-08-16" />
                        </span>
                      </SelectItem>
                      <SelectItem value="mvp">
                        <span className="flex items-center gap-2">
                          {tRoot("settings.typeMvp")}
                          <NewBadge since="2026-08-16" />
                        </span>
                      </SelectItem>
                      <SelectItem value="top_killers">
                        <span className="flex items-center gap-2">
                          {tRoot("settings.typeTopKillers")}
                          <NewBadge since="2026-08-16" />
                        </span>
                      </SelectItem>
                      <SelectItem value="h2h">
                        <span className="flex items-center gap-2">
                          {tRoot("settings.typeH2h")}
                          <NewBadge since="2026-08-16" />
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Where a non-leaderboard type actually gets laid out. "versus" keeps its own
                    wording because it is the odd one out: its slots and stat rows are a separate
                    control set, whereas the four scene types are laid out with the ordinary
                    columns. Both point at the same place, the fields and text editor. */}
                {form.designType === "versus" ? (
                  <p className="text-xs text-muted-foreground">{tDlg("versusHint")}</p>
                ) : form.designType !== "leaderboard" ? (
                  <p className="text-xs text-muted-foreground">{tDlg("sceneHint")}</p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              {tDlg("cancel")}
            </Button>
            <Button disabled={saving || !form.name.trim()} onClick={onSubmit}>
              {saving ? (
                <Loader text={tDlg("saving")} />
              ) : editing ? (
                tDlg("saveChanges")
              ) : (
                tDlg("create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fields + text editor (DesignFieldsEditor): opens for one design at a time. ──
           Wires the organizationId + canManage from this manager. onSaved reloads the list. */}
      {fieldsEditorDesign && (
        <DesignFieldsEditor
          design={fieldsEditorDesign}
          organizationId={organizationId}
          canManage={canManage}
          open={fieldsEditorDesign !== null}
          onOpenChange={(open) => {
            // Close ONLY when the user dismisses the editor. Refresh the list once here so the
            // manager reflects any change, without refetching mid-edit.
            if (!open) {
              setFieldsEditorDesign(null);
              load();
            }
          }}
          // Auto-save fires after EVERY change (add/move/restyle). It must NOT close the editor or
          // refetch the list (that remounts/closes it). Keep it a no-op; the editor's own status
          // indicator shows "Saved", and the list refreshes when the editor closes (above).
          onSaved={() => {}}
        />
      )}

      {/* ── Delete confirmation ── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogTitle>{tDel("title")}</DialogTitle>
          <DialogDescription>
            {deleteTarget ? tDel("body", { name: deleteTarget.name }) : ""}
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              {tDel("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && <IconLoader2 className="mr-1 size-4 animate-spin" />}
              {tDel("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── BackgroundField ───────────────────────────────────────────────────────────
// One image dropzone/preview pair (one per export size). Dashed dropzone when empty, a preview
// with Remove/Replace once an image (existing URL or freshly chosen file) is staged.
function BackgroundField({
  label,
  hint,
  aspectClass,
  preview,
  inputRef,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  aspectClass: string;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file?: File) => void;
  onClear: () => void;
}) {
  // `label` and `hint` arrive already translated from the caller (they name WHICH size this
  // dropzone is for); only this component's own chrome is resolved here.
  const t = useTranslations("adminDesignEditor.manager.dialog");
  return (
    <div className="space-y-2">
      <Label className="text-xs">
        {label}{" "}
        <span className="font-normal text-muted-foreground">({hint})</span>
      </Label>
      {!preview ? (
        <div
          className={`flex ${aspectClass} cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border bg-muted p-3 text-center transition-colors hover:border-primary`}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <IconPhoto size={16} className="text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dropOr")}{" "}
            <span className="font-medium text-primary hover:underline">
              {t("browse")}
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={`relative ${aspectClass} w-full overflow-hidden rounded-md border bg-muted`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={t("previewAlt", { label })}
              className="size-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onClear}
            >
              <IconX size={14} className="mr-1" /> {t("remove")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={14} className="mr-1" /> {t("replace")}
            </Button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </div>
  );
}
