"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EditNewsFormSchema, EditNewsFormSchemaType } from "@/lib/zodSchemas";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor } from "@/components/text-editor/Editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { newsCategories } from "@/constants";
import { EventMultiSelect } from "@/components/news/EventMultiSelect";
import { use, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useRouter } from "next/navigation";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import Image from "next/image";
import { SaveConfirmModal } from "../../../events/[slug]/edit/_components/SaveConfirmModal";

type Params = Promise<{
  slug: string;
}>;

// Local "now" as a YYYY-MM-DDTHH:mm string for the <input type="datetime-local"> min attribute.
function localNowForInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Turn a backend UTC ISO datetime into the YYYY-MM-DDTHH:mm LOCAL string the datetime-local input
// needs (so a scheduled article pre-fills the picker in the admin's own timezone).
function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function EditNewsForm({ params }: { params: Params }) {
  const { slug } = use(params);

  const router = useRouter();
  const { user, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newsDetails, setNewsDetails] = useState<any>();

  // Scheduled publish (optional), kept as plain state like the featured image. Pre-filled below only
  // for a not-yet-published (scheduled) article; blank for an already-live one so re-saving it does
  // NOT accidentally re-hide it. Sent to edit-news as `scheduled_publish_at` (UTC ISO) on save.
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string>(
    newsDetails?.images_url ? newsDetails.images_url : "",
  );

  const [pending, startTransition] = useTransition();
  const [pendingEdit, startEditTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFormData, setPendingFormData] =
    useState<EditNewsFormSchemaType | null>(null);
  const [confirmChanges, setConfirmChanges] = useState<
    { label: string; from: string; to: string }[]
  >([]);

  const form = useForm<EditNewsFormSchemaType>({
    resolver: zodResolver(EditNewsFormSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      events: [],
      author: user?.full_name || "",
      images: "",
    },
  });

  useEffect(() => {
    if (!slug) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        // Send the admin's Bearer token so get-news-detail will return a not-yet-published
        // (scheduled) article for editing - the public/anonymous caller gets a 404 for those.
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
          { slug },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );
        setNewsDetails(res.data.news);
        setPreviewUrl(
          res?.data?.news?.images_url ? res?.data?.news?.images_url : "",
        );
        // Pre-fill the schedule picker only for a still-scheduled article (so editing a live post
        // with a blank picker keeps it live - see edit-news backend handling).
        if (res?.data?.news?.is_published === false) {
          setScheduledPublishAt(
            isoToLocalInput(res?.data?.news?.scheduled_publish_at),
          );
        }
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [slug]);

  // Update form values when teamDetails changes
  useEffect(() => {
    if (newsDetails) {
      form.reset({
        id: newsDetails.news_id || "",
        title: newsDetails.news_title || "",
        content: newsDetails.content || "",
        category: newsDetails.category || "",
        // Prefill the multi-select from get-news-detail's related_events list
        // (_serialize_related_news_events -> [{event_id, event_name, slug, tournament_tier, end_date}]);
        // the picker only needs {event_id, event_name}.
        events: (newsDetails.related_events || []).map((e: any) => ({
          event_id: e.event_id,
          event_name: e.event_name,
        })),
        images: newsDetails.images_url || "",
        author: newsDetails?.author || "",
      });
    }
  }, [newsDetails, form]);

  function handleSaveDraft() {}

  function handlePublish(data: EditNewsFormSchemaType) {
    // Build the list of changes to show in the confirmation modal
    const changes: { label: string; from: string; to: string }[] = [];

    if (newsDetails) {
      if (data.title !== (newsDetails.news_title || ""))
        changes.push({
          label: "Title",
          from: newsDetails.news_title || "-",
          to: data.title,
        });
      if (data.category !== (newsDetails.category || ""))
        changes.push({
          label: "Category",
          from: newsDetails.category || "-",
          to: data.category,
        });
      // Related events changed? Compare the selected event names against the article's current set
      // (both flattened to a comma-joined string) so the confirm modal shows a readable before/after.
      const origEvents = (newsDetails.related_events || [])
        .map((e: any) => e.event_name)
        .join(", ");
      const nextEvents = (data.events || [])
        .map((e) => e.event_name)
        .join(", ");
      if (nextEvents !== origEvents)
        changes.push({
          label: "Related Events",
          from: origEvents || "-",
          to: nextEvents || "-",
        });
      if (data.author !== (newsDetails.author || ""))
        changes.push({
          label: "Author",
          from: newsDetails.author || "-",
          to: data.author,
        });
      if (data.content !== (newsDetails.content || ""))
        changes.push({ label: "Content", from: "(previous)", to: "(updated)" });
      if (selectedFile)
        changes.push({
          label: "Image",
          from: "(previous)",
          to: selectedFile.name,
        });
      // Schedule change: compare the picker against the article's current schedule (blank = live now).
      const originalSchedule =
        newsDetails.is_published === false
          ? isoToLocalInput(newsDetails.scheduled_publish_at)
          : "";
      if (scheduledPublishAt !== originalSchedule)
        changes.push({
          label: "Schedule",
          from: originalSchedule
            ? new Date(originalSchedule).toLocaleString()
            : "Publish now",
          to: scheduledPublishAt
            ? new Date(scheduledPublishAt).toLocaleString()
            : "Publish now",
        });
    }

    setConfirmChanges(changes);
    setPendingFormData(data);
    setConfirmOpen(true);
  }

  function handleConfirmPublish() {
    if (!pendingFormData) return;
    const data = pendingFormData;
    startEditTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("news_id", data.id.toString());
        formData.append("news_title", data.title);
        formData.append("content", data.content);
        formData.append("category", data.category);
        formData.append("author", data.author);

        // Related events (News overhaul): ALWAYS send the field on edit so the backend acts on it -
        // each selected event id as a repeated `related_events` field, or a single empty value when
        // the selection was fully cleared. edit_news (afc_auth/views.py) reads
        // request.data.getlist("related_events"), REPLACES the News.related_events M2M, and treats a
        // present-but-empty field as "clear all" (a truly absent field would instead be left untouched).
        if (data.events && data.events.length > 0) {
          data.events.forEach((ev) => {
            formData.append("related_events", String(ev.event_id));
          });
        } else {
          formData.append("related_events", "");
        }

        // Always send the schedule field so the backend acts on it: a future datetime re-schedules
        // (hidden until then), a blank value publishes now and clears any pending schedule.
        formData.append(
          "scheduled_publish_at",
          scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : "",
        );

        if (selectedFile) {
          formData.append("images", selectedFile);
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-news/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(response.data.message);
        setConfirmOpen(false);
        router.back();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
      }
    });
  }

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (pending) return <FullLoader />;

  return (
    <div>
      <SaveConfirmModal
        open={confirmOpen}
        changes={confirmChanges}
        pendingSubmit={pendingEdit}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmPublish}
      />
      <PageHeader
        // Title is a ReactNode so the page-level ⓘ can sit right after it.
        title={
          <span className="inline-flex items-center">
            Edit News: {newsDetails?.news_title}
            <InfoTip id="news.edit._page" className="ml-1.5" />
          </span>
        }
        back
      />
      <Form {...form}>
        <Card>
          <CardContent className="space-y-4">
            <form
              onSubmit={form.handleSubmit(handlePublish)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter news title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <RichTextEditor field={field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Category
                      <InfoTip id="news.category" className="ml-1" />
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {newsCategories.map((category, index) => (
                          <SelectItem key={index} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Related events (News overhaul): searchable multi-select of REAL events (was a
                  hardcoded single Select bound to the fake `relatedEvents` constant). Prefilled from
                  the fetched news.related_events; submitted as repeated `related_events` ids. */}
              <FormField
                control={form.control}
                name="events"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Related Events (Optional)
                      <InfoTip id="news.related_event" className="ml-1" />
                    </FormLabel>
                    <FormControl>
                      <EventMultiSelect
                        value={field.value || []}
                        onChange={field.onChange}
                        token={token}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Images</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {!previewUrl ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                if (
                                  ![
                                    "image/png",
                                    "image/jpeg",
                                    "image/jpg",
                                    "image/webp",
                                  ].includes(file.type)
                                ) {
                                  toast.error(
                                    "Only PNG, JPG, JPEG, or WEBP files are supported.",
                                  );
                                  return;
                                }
                                setSelectedFile(file);
                                setPreviewUrl(URL.createObjectURL(file));
                              }
                            }}
                            className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                              isDragging
                                ? "border-primary bg-primary/5"
                                : "border-gray-300 bg-gray-50"
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                <IconPhoto
                                  size={32}
                                  className="text-primary dark:text-white"
                                />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Drop your image here, or{" "}
                                <span className="text-primary font-medium hover:underline">
                                  browse
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Supports: PNG, JPG, JPEG, WEBP
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex items-center justify-center overflow-hidden">
                              <Image
                                width={1000}
                                height={1000}
                                src={previewUrl}
                                alt="Featured image"
                                className="aspect-video size-full object-cover"
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPreviewUrl("");
                                  field.onChange("");
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = "";
                                  }
                                }}
                              >
                                <IconX size={16} className="mr-2" />
                                Remove
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <IconUpload size={16} className="mr-2" />
                                Replace
                              </Button>
                            </div>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            if (
                              ![
                                "image/png",
                                "image/jpeg",
                                "image/jpg",
                                "image/webp",
                              ].includes(file.type)
                            ) {
                              toast.error(
                                "Only PNG, JPG, JPEG, or WEBP files are supported.",
                              );
                              return;
                            }

                            setSelectedFile(file);
                            setPreviewUrl(URL.createObjectURL(file));
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        {...field}
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Schedule publish (optional) - mirrors the create form. Pre-filled for a scheduled
                  article; blank for a live one. Future time => auto-release later, blank => publish now. */}
              <div className="space-y-2">
                <FormLabel htmlFor="news-schedule">
                  Schedule publish (optional)
                </FormLabel>
                <Input
                  id="news-schedule"
                  type="datetime-local"
                  min={localNowForInput()}
                  value={scheduledPublishAt}
                  onChange={(e) => setScheduledPublishAt(e.target.value)}
                  className="w-full md:w-auto"
                />
                <p className="text-xs text-muted-foreground">
                  {scheduledPublishAt
                    ? "This article will publish automatically at the time above."
                    : "Leave blank to publish immediately. Pick a future date and time to release it automatically."}
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  asChild
                  className="flex-1"
                  variant="outline"
                >
                  <Link href="/a/news">Cancel</Link>
                </Button>
                <Button type="submit" className="flex-1" disabled={pendingEdit}>
                  {pendingEdit
                    ? "Saving..."
                    : scheduledPublishAt
                      ? "Schedule"
                      : "Publish"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Form>
    </div>
  );
}
