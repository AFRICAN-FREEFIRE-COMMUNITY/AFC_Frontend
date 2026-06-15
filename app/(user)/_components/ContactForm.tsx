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
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/contact-us/`,
          { ...data }
        );

        if (response.statusText === "OK") {
          toast.success(response.data.message);
          setOpenModal(true);
        } else {
          toast.error(t("contactForm.toast.error"));
        }
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
                    <div className="space-y-1">
                      <p>{t("contactForm.success.body")}</p>
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
