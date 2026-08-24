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
import { Switch } from "@/components/ui/switch";
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
import { useTranslations } from "next-intl";
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

// Default life of a homepage pin when the admin flips the switch on without picking a date, so the
// common case is one click. Mirrors DEFAULT_PIN_DAYS in backend afc_auth/views.py; the admin can
// still change the date before saving.
const DEFAULT_PIN_DAYS = 7;

function localPinDefaultForInput() {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_PIN_DAYS);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function CreateNewsPage() {
  // Admin surfaces are in scope for i18n (owner override 2026-07-13). Namespace "adminNews"
  // (messages/{en,fr,pt}/adminNews.json) is shared by this form, the edit form and the news list,
  // because the three screens say the same words about the same fields and splitting them would let
  // the wording drift between "create" and "edit".
  const t = useTranslations("adminNews");
  const router = useRouter();
  const { user, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Scheduled publish (optional). Empty string => publish immediately (current behaviour). A future
  // datetime here is sent to create-news as `scheduled_publish_at`; the backend then creates the post
  // hidden and the publish_scheduled_news Celery beat task flips it live at that time.
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");

  // Pin to homepage (backlog item 22). Plain state like the schedule above, not part of the zod
  // form. `pinnedUntil` is the ONLY thing sent to the backend - the switch is UI sugar over "is
  // there a date", which is why the model has one field and cannot end up in a pinned-but-expired
  // state. Turning the switch on fills in a default expiry; turning it off clears the date, which
  // is what unpins. Unpinning never deletes the article.
  const [pinToHomepage, setPinToHomepage] = useState(false);
  const [pinnedUntil, setPinnedUntil] = useState("");

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

        // Homepage pin (optional). Sent as a UTC ISO string, same as the schedule. Omitted when the
        // switch is off, which create_news reads as "not pinned". A date already in the past is
        // also treated as not pinned server-side (see _resolve_pinned_until).
        if (pinToHomepage && pinnedUntil) {
          formData.append("pinned_until", new Date(pinnedUntil).toISOString());
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
        toast.error(error?.response?.data?.message || t("form.serverError"));
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
            <span className="inline-flex flex-wrap items-center">
              {t("form.createTitle")}
              <InfoTip id="news.create._page" className="ml-1.5" />
            </span>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>{t("form.detailsHeading")}</CardTitle>
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
                    <FormLabel>{t("form.title")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("form.titlePlaceholder")} {...field} />
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
                    <FormLabel>{t("form.content")}</FormLabel>
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
                      {t("form.category")}
                      <InfoTip id="news.category" className="ml-1" />
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("form.categoryPlaceholder")} />
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
                      {t("form.relatedEvents")}
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
                    <FormLabel>{t("form.images")}</FormLabel>
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
                                  toast.error(t("form.image.invalidType"));
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
                                {t("form.image.dropPrompt")}{" "}
                                <span className="text-primary font-medium hover:underline">
                                  {t("form.image.browse")}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("form.image.supports")}
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
                                alt={t("form.image.alt")}
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
                                {t("form.image.remove")}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <IconUpload size={16} className="mr-2" />
                                {t("form.image.replace")}
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
                              toast.error(t("form.image.invalidType"));
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
                    <FormLabel>{t("form.author")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("form.authorPlaceholder")}
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
                  {t("form.schedule.label")}
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
                  {t("form.schedule.hint")}
                </p>
              </div>

              {/* Pin to homepage (backlog item 22). A notice IS a news post: this is the only
                  place notices are published from, so there is no second admin screen to keep in
                  step. The expiry is required by design - a pin that never lapses is a pin
                  somebody has to remember to remove, and that one is still there in March. */}
              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <FormLabel htmlFor="news-pin">{t("form.pin.label")}</FormLabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("form.pin.hint")}
                    </p>
                  </div>
                  <Switch
                    id="news-pin"
                    checked={pinToHomepage}
                    onCheckedChange={(on) => {
                      setPinToHomepage(on);
                      // Turning it on pre-fills a sensible expiry so the common case is one click;
                      // turning it off clears the date, which is what actually unpins.
                      setPinnedUntil(on ? pinnedUntil || localPinDefaultForInput() : "");
                    }}
                  />
                </div>
                {pinToHomepage && (
                  <div className="space-y-2 pt-2">
                    <FormLabel htmlFor="news-pin-until">{t("form.pin.untilLabel")}</FormLabel>
                    <Input
                      id="news-pin-until"
                      type="datetime-local"
                      min={localNowForInput()}
                      value={pinnedUntil}
                      onChange={(e) => setPinnedUntil(e.target.value)}
                      className="w-full md:w-auto"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("form.pin.untilHint")}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  className="flex-1"
                  type="button"
                  asChild
                  variant="outline"
                >
                  <Link href="/a/news">{t("form.cancel")}</Link>
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending
                    ? t("form.saving")
                    : scheduledPublishAt
                      ? t("form.schedulePublish")
                      : t("form.publish")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Form>
    </div>
  );
}

export default CreateNewsPage;
