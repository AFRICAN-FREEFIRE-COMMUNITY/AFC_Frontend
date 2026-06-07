// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Design (leaderboard-design requests).
//
// The org-side surface for asking AFC to build/apply a custom leaderboard design.
// AFC's design team works the request; the organizer never edits the design itself
// - they submit a brief (title + notes + an optional reference image) and watch its
// status move through the queue.
//
// GATING: the page is gated on the SAME permission set the rest of the portal uses
// (events page → can_create_events, profile page → owner). Here the gate is
// membership.permissions.can_submit_designs OR isOwner. A member without that
// permission gets a read-only lock notice (mirrors the non-owner notice on the
// Profile page) - no request form, but they still see the existing requests list.
//
// SUBMIT goes up as multipart FormData via organizersApi.submitDesignRequest(slug, fd)
// - mirroring the Profile page's image-upload path so the optional reference_image
// rides along. On success we toast + refresh the list (so the new row appears).
//
// Design mirrors the sibling organizer pages (events / profile) and the admin
// list idiom: PageHeader, a single Card wrapping a Table, outline status badges
// (rounded-full, text-xs) per AFC constants, sonner toasts on success/error.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/Loader";
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
  IconLock,
  IconPhoto,
  IconPlus,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { formatDate } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// Accepted reference-image types (same set the Profile page allows).
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

// ── Row shape ───────────────────────────────────────────────────────────────
// One design request as returned by listDesignRequests().results[]. Mirrors the
// backend serializer; the organizer surface only reads (never edits) the AFC-side
// fields (status / resolution_notes / handled_by_username).
interface DesignRequest {
  id: number;
  organization_id: number;
  organization_name: string;
  title: string;
  notes: string | null;
  reference_image: string | null;
  status: "open" | "in_progress" | "applied" | "rejected";
  resolution_notes: string | null;
  submitted_by_username: string | null;
  handled_by_username: string | null;
  created_at: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs via the Badge default) per AFC constants,
// colour-coded per the brief: open=muted, in_progress=gold, applied=green,
// rejected=red. Reused on the admin review queue page (same colour mapping).
export function DesignStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "text-muted-foreground",
    in_progress: "border-yellow-500 text-yellow-600", // gold/amber per AFC
    applied: "border-green-600/60 text-green-400",
    rejected: "border-red-500/50 text-red-400",
  };
  // human label for each status (snake_case → Title Case).
  const label: Record<string, string> = {
    open: "Open",
    in_progress: "In progress",
    applied: "Applied",
    rejected: "Rejected",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {label[status] ?? status}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerDesignPage() {
  const { slug, membership, isOwner } = useOrganizer();

  // Same gate the rest of the portal uses, on the design permission.
  const canSubmitDesigns = membership.permissions.can_submit_designs || isOwner;

  // ── List state ──────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Request-a-design dialog state ─────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, startSubmit] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // a title is required; notes + reference image are optional.
  const submitReady = title.trim().length > 0;

  // ── Load this org's existing requests. Re-runs on org switch (the layout
  // re-mounts this subtree keyed on slug, so `slug` is always current). ──
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizersApi.listDesignRequests(slug);
      setRequests(res?.results ?? []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load your design requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ── Validate + stage a chosen reference image. ──
  const handleFile = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // reset the dialog form back to empty (after submit / on cancel).
  const resetForm = () => {
    setTitle("");
    setNotes("");
    setImageFile(null);
    setImagePreview("");
  };

  // ── Submit handler - multipart FormData so the optional image rides along. ──
  const onSubmit = () => {
    if (!submitReady) return;
    startSubmit(async () => {
      try {
        const fd = new FormData();
        fd.append("title", title.trim());
        // notes is optional - only send it when the organizer typed something.
        if (notes.trim()) fd.append("notes", notes.trim());
        if (imageFile) fd.append("reference_image", imageFile);

        await organizersApi.submitDesignRequest(slug, fd);
        toast.success("Design request submitted.");
        resetForm();
        setDialogOpen(false);
        fetchRequests();
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to submit design request.",
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Design"
        description="Request a custom leaderboard design from the AFC team."
        // "Request a design" lives in the header action slot, gated on the permission.
        action={
          canSubmitDesigns ? (
            <Button
              className="w-full md:w-auto"
              onClick={() => setDialogOpen(true)}
            >
              <IconPlus className="size-4" />
              Request a design
            </Button>
          ) : undefined
        }
      />

      {/* ── Non-permitted member: read-only lock notice (mirrors Profile page) ── */}
      {!canSubmitDesigns && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You don&apos;t have permission to submit design requests for this
              organization. You can still view requests below.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Existing requests list ── */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading design requests...
            </div>
          ) : requests.length === 0 ? (
            // ── Empty state ── no requests homed to this org yet.
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconPhoto className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your organization hasn&apos;t requested any designs yet.
              </p>
              {canSubmitDesigns && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  Request your first design
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>AFC response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      {/* Title + the organizer's own notes inline (muted) so the
                          brief reads at a glance. */}
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          {req.title}
                          {req.notes && (
                            <span className="text-xs font-normal text-muted-foreground line-clamp-2">
                              {req.notes}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DesignStatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.created_at ? formatDate(req.created_at) : "-"}
                      </TableCell>
                      {/* AFC's resolution notes - only present once the team has
                          handled the request; otherwise a muted dash. */}
                      <TableCell className="text-muted-foreground">
                        {req.resolution_notes ? (
                          <span className="text-foreground">
                            {req.resolution_notes}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Request-a-design dialog (title + notes? + reference image?) ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          // clear staged input when the dialog closes so it reopens empty.
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a design</DialogTitle>
            <DialogDescription>
              Tell the AFC design team what you need. Add a reference image if it
              helps describe the look you&apos;re after.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title (required). */}
            <div className="space-y-2">
              <Label htmlFor="design-title">Title</Label>
              <Input
                id="design-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Season 3 leaderboard theme"
              />
            </div>

            {/* Notes (optional). */}
            <div className="space-y-2">
              <Label htmlFor="design-notes">
                Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="design-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Colours, mood, anything the team should know..."
                rows={4}
              />
            </div>

            {/* Reference image (optional) - dropzone/preview pair mirroring the
                Profile page's ImageField, trimmed to a single field. */}
            <div className="space-y-2">
              <Label>
                Reference image{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              {!imagePreview ? (
                <div
                  className="cursor-pointer rounded-md border-2 border-dashed border-border bg-muted p-6 text-center transition-colors hover:border-primary"
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <IconPhoto size={20} className="text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Drop an image here, or{" "}
                      <span className="font-medium text-primary hover:underline">
                        browse
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports: PNG, JPG, JPEG, WEBP
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                    {/* Uploaded refs come from an object URL - use a plain <img>. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Reference preview"
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview("");
                      }}
                    >
                      <IconX size={16} className="mr-2" />
                      Remove
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => inputRef.current?.click()}
                    >
                      <IconUpload size={16} className="mr-2" />
                      Replace
                    </Button>
                  </div>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!submitReady || submitting} onClick={onSubmit}>
              {submitting ? <Loader text="Submitting..." /> : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
