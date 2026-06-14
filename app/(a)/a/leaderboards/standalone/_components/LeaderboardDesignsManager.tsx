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
// ─────────────────────────────────────────────────────────────────────────────

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  showTitle: boolean;
  showSubtitle: boolean;
  isDefault: boolean;
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
  showTitle: true,
  showSubtitle: true,
  isDefault: false,
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

  // ── Load the library. ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leaderboardDesignsApi.list(organizationId);
      setDesigns(res?.results ?? []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load leaderboard designs.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

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
      showTitle: d.show_title,
      showSubtitle: d.show_subtitle,
      isDefault: d.is_default,
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
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
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
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
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
      toast.error("A design name is required.");
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
        fd.append("max_rows", String(form.maxRows));
        fd.append("show_title", String(form.showTitle));
        fd.append("show_subtitle", String(form.showSubtitle));
        fd.append("is_default", String(form.isDefault));
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
        toast.success(editing ? "Design updated." : "Design created.");
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
          err?.response?.data?.message || "Failed to save the design.",
        );
      }
    });
  };

  // ── Delete a design. ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await leaderboardDesignsApi.remove(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}".`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to delete the design.",
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
          Leaderboard designs
          <InfoTip
            text="Branded backgrounds for exported leaderboards. Upload Instagram and YouTube backgrounds, set colours, and drag logos onto the design. When you export a leaderboard you pick one of these; the default is selected automatically."
            className="ml-1.5"
          />
        </CardTitle>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <IconPlus className="size-4" /> Add design
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            Loading designs...
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconPhoto className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              No designs yet. Add one to brand your exported leaderboards.
            </p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add your first design
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="p-2 text-xs text-foreground">Name</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Sizes</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Logos</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Colours</TableHead>
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
                            <IconStar className="mr-0.5 size-3" /> Default
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
                          IG {d.background_instagram ? "set" : "none"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            d.background_youtube
                              ? "rounded-full border-red-500 px-2 py-0.5 text-xs text-red-600"
                              : "rounded-full border-muted-foreground px-2 py-0.5 text-xs text-muted-foreground"
                          }
                        >
                          YT {d.background_youtube ? "set" : "none"}
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
                          title={`Text ${d.text_color}`}
                        />
                        <span
                          className="inline-block size-4 rounded-full border"
                          style={{ backgroundColor: d.accent_color }}
                          title={`Accent ${d.accent_color}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(d)}
                            aria-label={`Edit ${d.name}`}
                          >
                            <IconPencil className="size-4" />
                          </Button>
                          {/* Opens the DesignFieldsEditor for columns, text, groups, and fonts. */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFieldsEditorDesign(d)}
                            aria-label={`Edit fields and text for ${d.name}`}
                            title="Edit fields and text"
                          >
                            <IconTableColumn className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(d)}
                            aria-label={`Delete ${d.name}`}
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
            <DialogTitle>{editing ? "Edit design" : "Add design"}</DialogTitle>
            <DialogDescription>
              Upload a background per size, set the colours, and drag your logos onto
              the preview. The standings, title, and stage/group line render on top
              when you export a leaderboard.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            {/* ── Left: live preview + logo controls ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
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
                    alt="Background preview"
                    className="pointer-events-none absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
                    No {previewSize === "instagram" ? "Instagram" : "YouTube"}{" "}
                    background uploaded. Logos still position over a plain dark
                    background.
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
                      title="Drag to position"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lg.url}
                        alt="Logo"
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
                    Logos{" "}
                    <span className="text-muted-foreground">
                      (drag on the preview to position)
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <IconPlus className="size-4" /> Add logo
                  </Button>
                </div>
                {form.logos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No logos yet. Add one to brand the design; if you add none, the
                    org logo is used top-left by default.
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
                            alt="Logo"
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
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeLogo(lg.key)}
                          aria-label="Remove logo"
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
                <Label htmlFor="design-name">Name</Label>
                <Input
                  id="design-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Season 3 theme"
                />
              </div>

              {/* Backgrounds. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <BackgroundField
                  label="Instagram background"
                  hint="1080 x 1350"
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
                  label="YouTube background"
                  hint="1920 x 1080"
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
                  <Label>Text colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.textColor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, textColor: e.target.value }))
                      }
                      className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                      aria-label="Text colour"
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.textColor}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, accentColor: e.target.value }))
                      }
                      className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                      aria-label="Accent colour"
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.accentColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Max rows. */}
              <div className="space-y-2">
                <Label htmlFor="design-rows">Max rows</Label>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="design-show-title" className="font-normal">
                    Show title{" "}
                    <span className="text-xs text-muted-foreground">
                      (leaderboard name)
                    </span>
                  </Label>
                  <Switch
                    id="design-show-title"
                    checked={form.showTitle}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, showTitle: v }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="design-show-subtitle" className="font-normal">
                    Show subtitle{" "}
                    <span className="text-xs text-muted-foreground">
                      (stage / group)
                    </span>
                  </Label>
                  <Switch
                    id="design-show-subtitle"
                    checked={form.showSubtitle}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, showSubtitle: v }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="design-default" className="font-normal">
                    Set as default
                    <span className="ml-1 text-xs text-muted-foreground">
                      (auto-selected on export)
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
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving || !form.name.trim()} onClick={onSubmit}>
              {saving ? (
                <Loader text="Saving..." />
              ) : editing ? (
                "Save changes"
              ) : (
                "Create design"
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
          <DialogTitle>Delete this design?</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `"${deleteTarget.name}" will be permanently removed. Leaderboards that used it will fall back to the default or a plain background. This cannot be undone.`
              : ""}
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && <IconLoader2 className="mr-1 size-4 animate-spin" />}
              Delete
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
            Drop or{" "}
            <span className="font-medium text-primary hover:underline">
              browse
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
              alt={`${label} preview`}
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
              <IconX size={14} className="mr-1" /> Remove
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={14} className="mr-1" /> Replace
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
