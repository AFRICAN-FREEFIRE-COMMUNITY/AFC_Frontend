"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React, { useState, useTransition } from "react";

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
import { ContactFormSchema, ContactFormSchemaType } from "@/lib/zodSchemas";
// The support desk (owner 2026-09-14). The form posts to support/contact/ now, which STORES the
// message, its files and its replies before emailing anybody: the old endpoint stored nothing and
// a shadowed variable had been replacing every message with the words "Valid email." for months.
import { sendContactMessage } from "@/lib/api/support";
import { formatBytes } from "@/components/support/SupportThread";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { Loader } from "@/components/Loader";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ContactForm = () => {
  // Strings for the shared "Get in Touch" contact card + its success dialog
  // (namespace == messages/en/home.json).
  const t = useTranslations("home");
  const [openModal, setOpenModal] = useState<boolean>(false);
  // What the desk answered: the number the person quotes back at us, and the address of their own
  // ticket page. Shown in the success dialog so they leave with both.
  const [ticket, setTicket] = useState<{ number: string; url: string } | null>(null);
  // Documents, pictures and videos (owner 2026-09-14). Six files, 20 MB each, the same limits
  // afc_support/views.py enforces.
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();

  const form = useForm<ContactFormSchemaType>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });
  function onSubmit(data: ContactFormSchemaType) {
    startTransition(async () => {
      try {
        const res = await sendContactMessage({ ...data, files });
        // A refused file is NAMED rather than dropped in silence: the desk tells us which one and
        // why, and the person can send it another way instead of assuming it arrived.
        res.rejected_files?.forEach((f) =>
          toast.error(t(`contactForm.rejected.${f.reason}` as "contactForm.rejected.type", {
            name: f.name,
          })),
        );
        setTicket({ number: res.ticket_number, url: res.ticket_url });
        setFiles([]);
        form.reset();
        toast.success(res.message);
        setOpenModal(true);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || t("contactForm.toast.serverError"),
        );
        return;
      }
    });
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("contactForm.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contactForm.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("contactForm.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contactForm.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("contactForm.emailPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contactForm.message")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("contactForm.messagePlaceholder")}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Attachments. A support message is often a screenshot of the thing that went
                  wrong, and asking for it in a second email is how a ticket dies. */}
              <div className="space-y-2">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files;
                    if (picked) setFiles((prev) => [...prev, ...Array.from(picked)].slice(0, 6));
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInput.current?.click()}
                  >
                    <IconPaperclip className="mr-1 size-4" /> {t("contactForm.attach")}
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    {t("contactForm.attachLimits")}
                  </span>
                </div>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                      >
                        <IconPaperclip className="size-3.5" />
                        <span className="max-w-[200px] truncate">{f.name}</span>
                        <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          aria-label={t("contactForm.removeFile", { name: f.name })}
                          onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="hover:text-destructive"
                        >
                          <IconX className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button disabled={pending} type="submit" className="w-full">
                {pending ? (
                  <Loader text={t("contactForm.sending")} />
                ) : (
                  t("contactForm.send")
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="flex flex-col gap-0 p-0 sm:max-h-[min(640px,80vh)] sm:max-w-lg [&>button:last-child]:top-3.5">
          <DialogHeader className="contents space-y-0 text-left">
            <DialogTitle className="border-b px-6 py-4 text-base">
              {t("contactForm.success.title")}
            </DialogTitle>
            <div className="overflow-y-auto">
              <DialogDescription asChild>
                <div className="px-6 py-4">
                  <div className="[&_strong]:text-foreground space-y-4 [&_strong]:font-semibold">
                    <div className="space-y-2">
                      <p>{t("contactForm.success.body")}</p>
                      {ticket ? (
                        <>
                          <p>
                            <strong>{t("contactForm.success.ticket", { number: ticket.number })}</strong>
                          </p>
                          <p>
                            {t("contactForm.success.thread")}{" "}
                            <a
                              href={ticket.url}
                              className="text-primary hover:underline break-all"
                            >
                              {ticket.url}
                            </a>
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </DialogDescription>
              <DialogFooter className="px-6 pb-6 sm:justify-start">
                <DialogClose asChild>
                  <Button type="button">{t("contactForm.success.close")}</Button>
                </DialogClose>
              </DialogFooter>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
