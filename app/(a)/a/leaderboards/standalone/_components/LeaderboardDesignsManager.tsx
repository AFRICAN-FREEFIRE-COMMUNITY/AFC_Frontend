"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LeaderboardDesignsManager - the shared "Leaderboard designs" library card.
// ----------------------------------------------------------------------------
// A self-contained section that lists, creates, edits, and deletes the branded
// leaderboard backgrounds in ONE library, and is mounted on BOTH leaderboard surfaces
// so the admin and organizer experiences are identical:
//   • app/(a)/a/_components/LeaderboardsAdminContent.tsx  -> organizationId=null
//     (the AFC-NATIVE library, used by AFC's own standalone leaderboards)
//   • app/(organizer)/organizer/leaderboards/page.tsx     -> organizationId=<org id>
//     (that organizer's own library, used by their standalone leaderboards)
//
// WHAT A DESIGN IS: a name + an Instagram-size (1080x1350) and/or YouTube-size
// (1920x1080) background image + text/accent colours + row cap + show-title/subtitle
// toggles + an is_default flag. The leaderboard EXPORT picker (ExportGraphicDialog)
// renders the live standings onto the chosen design; the default is auto-selected.
//
// DATA: leaderboardDesignsApi (lib/leaderboardDesigns.ts) -> the backend CRUD under
// organizers/leaderboard-designs/ (afc_organizers.views_leaderboard_design). The list GET is
// keyed on organization_id; create/edit go up as multipart FormData so the background images
// ride along. WRITE access is gated server-side (org_can(can_submit_designs) for org libraries,
// role=="admin" for the AFC-native one); we ALSO gate the buttons here via the canManage prop so a
// read-only viewer never sees them. On every mutation we refetch the list in place (no page reload).
//
// Design: AFC constants - rounded-md bordered card, text-xs table cells, p-2 padding, h-10 header
// rows, text-foreground headers, outline rounded-full badges, sonner toasts. No em/en dashes.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import { Loader } from "@/components/Loader";
import {
  leaderboardDesignsApi,
  type LeaderboardDesign,
} from "@/lib/leaderboardDesigns";

// Accepted background image types (same set the organizer Design-request page allows).
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

// ── Editable form state ─────────────────────────────────────────────────────────
// Shared by the create + edit dialog. `editing` distinguishes the two: null = create.
// igFile/ytFile hold a freshly-chosen File (uploaded on submit); igPreview/ytPreview hold
// either the existing media URL (edit) or a local object URL (newly chosen file).
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

  // Delete confirmation target.
  const [deleteTarget, setDeleteTarget] = useState<LeaderboardDesign | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load the library. Re-runs when organizationId changes (org switch on the
  // organizer surface re-mounts the subtree, so this stays current). ──
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

  // ── Open the dialog for create (editing=null) or edit (prefill from the row). ──
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (d: LeaderboardDesign) => {
    setEditing(d);
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
      // Prefill previews from the existing media so the dialog shows the current art.
      igPreview: d.background_instagram || "",
      ytPreview: d.background_youtube || "",
    });
    setDialogOpen(true);
  };

  // ── Validate + stage a chosen background for the given size. ──
  const handleFile = (size: "ig" | "yt", file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((f) =>
      size === "ig"
        ? { ...f, igFile: file, igPreview: url }
        : { ...f, ytFile: file, ytPreview: url },
    );
  };

  // ── Submit (create or edit) - multipart so the backgrounds ride along. ──
  const onSubmit = () => {
    if (!form.name.trim()) {
      toast.error("A design name is required.");
      return;
    }
    startSave(async () => {
      try {
        const fd = new FormData();
        fd.append("name", form.name.trim());
        fd.append("text_color", form.textColor);
        fd.append("accent_color", form.accentColor);
        fd.append("max_rows", String(form.maxRows));
        fd.append("show_title", String(form.showTitle));
        fd.append("show_subtitle", String(form.showSubtitle));
        fd.append("is_default", String(form.isDefault));
        // Only send a background when the user actually chose a new file (edit keeps the old one).
        if (form.igFile) fd.append("background_instagram", form.igFile);
        if (form.ytFile) fd.append("background_youtube", form.ytFile);
        // org-scoped libraries pass organization_id; the AFC-native library omits it.
        if (organizationId != null)
          fd.append("organization_id", String(organizationId));

        if (editing) {
          await leaderboardDesignsApi.update(editing.id, fd);
          toast.success("Design updated.");
        } else {
          await leaderboardDesignsApi.create(fd);
          toast.success("Design created.");
        }
        setDialogOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
        load();
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to save the design.",
        );
      }
    });
  };

  // ── Delete a design (after confirm). Refetches in place. ──
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

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center text-base">
          <IconPalette className="mr-1.5 size-4" />
          Leaderboard designs
          <InfoTip
            text="Upload branded backgrounds (Instagram and YouTube sizes). When you export a leaderboard you pick one of these designs and the standings are rendered onto it. The default is selected automatically."
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
                  <TableHead className="p-2 text-xs text-foreground">Colours</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Rows</TableHead>
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
                    {/* Which sizes have a background uploaded (the export only offers a size
                        that has art; missing sizes fall back to a plain dark background). */}
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
                    {/* Text + accent colour swatches so the row reads at a glance. */}
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
                    <TableCell className="p-2 text-xs">{d.max_rows}</TableCell>
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

      {/* ── Create / edit dialog ── name + the two backgrounds + colours + toggles. ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setForm(EMPTY_FORM);
          }
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit design" : "Add design"}</DialogTitle>
            <DialogDescription>
              Upload a background for each size you publish to. The standings are
              rendered on top when you export a leaderboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name (required). */}
            <div className="space-y-2">
              <Label htmlFor="design-name">Name</Label>
              <Input
                id="design-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Season 3 theme"
              />
            </div>

            {/* The two backgrounds, side by side. IG is portrait (1080x1350), YT is
                landscape (1920x1080); the preview aspect hints at each. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <BackgroundField
                label="Instagram background"
                hint="1080 x 1350 (portrait)"
                aspectClass="aspect-[4/5]"
                preview={form.igPreview}
                inputRef={igInputRef}
                onPick={(file) => handleFile("ig", file)}
                onClear={() =>
                  setForm((f) => ({ ...f, igFile: null, igPreview: "" }))
                }
              />
              <BackgroundField
                label="YouTube background"
                hint="1920 x 1080 (landscape)"
                aspectClass="aspect-video"
                preview={form.ytPreview}
                inputRef={ytInputRef}
                onPick={(file) => handleFile("yt", file)}
                onClear={() =>
                  setForm((f) => ({ ...f, ytFile: null, ytPreview: "" }))
                }
              />
            </div>

            {/* Colours - native colour inputs with the hex shown beside each. */}
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

            {/* Max rows - how many standings rows the render fits (1..50). */}
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

            {/* Toggles - show the title (leaderboard name) and the subtitle line. */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="design-show-title" className="font-normal">
                  Show title
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
                  Show subtitle
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
// One image dropzone/preview pair (one per export size). Mirrors the organizer
// Design-request page's reference-image field: a dashed dropzone when empty, a
// preview with Remove/Replace once an image (existing URL or freshly chosen file)
// is staged. aspectClass hints the canvas shape (portrait IG vs landscape YT).
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
      <Label>
        {label}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          ({hint})
        </span>
      </Label>
      {!preview ? (
        <div
          className={`flex ${aspectClass} cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted p-4 text-center transition-colors hover:border-primary`}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
            <IconPhoto size={18} className="text-primary" />
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
            {/* Background previews are object URLs or media URLs - plain <img>. */}
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
