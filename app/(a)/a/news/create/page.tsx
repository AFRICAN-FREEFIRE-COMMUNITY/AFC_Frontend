"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CreateNewsFormSchema,
  CreateNewsFormSchemaType,
} from "@/lib/zodSchemas";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "@/components/text-editor/Editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { newsCategories } from "@/constants";
// Shared, self-expiring NEW tag (owner rule: a new option in a picker wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
import { EventMultiSelect } from "@/components/news/EventMultiSelect";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import Image from "next/image";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";

// Local "now" as a YYYY-MM-DDTHH:mm string for the <input type="datetime-local"> min attribute,
// so an admin cannot pick a past time when scheduling. (Backend treats a past/blank time as
// "publish immediately" anyway - this is just a friendlier guard.)
function localNowForInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function page() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Scheduled publish (optional). Empty string => publish immediately (current behaviour). A future
  // datetime here is sent to create-news as `scheduled_publish_at`; the backend then creates the post
  // hidden and the publish_scheduled_news Celery beat task flips it live at that time.
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");

  const [pending, startTransition] = useTransition();

  const form = useForm<CreateNewsFormSchemaType>({
    resolver: zodResolver(CreateNewsFormSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      events: [],
      author: user?.full_name || "",
      images: "",
    },
  });

  function handleSaveDraft() {}

  function handlePublish(data: CreateNewsFormSchemaType) {
    startTransition(async () => {
      try {
        // Create FormData object
        const formData = new FormData();

        // Append all form fields to FormData
        formData.append("news_title", data.title);
        formData.append("content", data.content);
        formData.append("category", data.category);
        formData.append("author", data.author);

        // Related events (News overhaul): submit each selected event id as a repeated
        // `related_events` form field. create_news (afc_auth/views.py) reads them with
        // request.data.getlist("related_events") and sets the News.related_events M2M. An empty
        // selection sends no field, which the backend treats as "no related events" on create.
        (data.events || []).forEach((ev) => {
          formData.append("related_events", String(ev.event_id));
        });

        // Append profile picture file if selected
        if (selectedFile) {
          formData.append("images", selectedFile);
        }

        // Optional schedule. Send the picked LOCAL datetime as a UTC ISO string (mirrors the event
        // roster-window picker) so the backend stores a timezone-aware moment. Omitted when blank,
        // which keeps the original "publish immediately" behaviour.
        if (scheduledPublishAt) {
          formData.append(
            "scheduled_publish_at",
            new Date(scheduledPublishAt).toISOString(),
          );
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/create-news/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(response.data.message);
        router.push(`/a/news`);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
      }
    });
  }

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Form {...form}>
        <PageHeader
          back
          // Title is a ReactNode so the page-level ⓘ can sit right after it.
          title={
            <span className="inline-flex items-center">
              Create News
              <InfoTip id="news.create._page" className="ml-1.5" />
            </span>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>News Details</CardTitle>
          </CardHeader>
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
                            {/* NEW tag on a recently added CATEGORY (Education Updates,
                                2026-08-07), so an admin who already knows this picker sees
                                that a new option appeared in it. Driven by `newSince` on the
                                shared constant, so this picker and the edit form stay in
                                step, and the pill removes itself after 5 days. */}
                            <span className="flex items-center gap-2">
                              {category.label}
                              {category.newSince && (
                                <NewBadge since={category.newSince} />
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Related events (News overhaul): searchable multi-select of REAL events (was a
                  hardcoded single Select bound to the fake `relatedEvents` constant that the create
                  form never submitted). Selection is submitted as repeated `related_events` ids. */}
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
                                    "Only PNG, JPG, JPEG, or WEBP files are supported."
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
                                "Only PNG, JPG, JPEG, or WEBP files are supported."
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

              {/* Schedule publish (optional). Plain state field (not part of the zod form) - mirrors
                  the way the featured image is handled as separate state. Leave blank to publish now;
                  pick a future time to auto-release. The datetime-local renders/edits in the admin's
                  own timezone and is converted to UTC on submit. */}
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
                  Leave blank to publish immediately. Pick a future date and time
                  to release this article automatically.
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  className="flex-1"
                  type="button"
                  asChild
                  variant="outline"
                >
                  <Link href="/a/news">Cancel</Link>
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending
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

export default page;
