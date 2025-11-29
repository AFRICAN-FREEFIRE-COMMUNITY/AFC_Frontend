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
import { newsCategories, relatedEvents } from "@/constants";
import { useState, useTransition } from "react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

function page() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [pending, startTransition] = useTransition();

  const form = useForm<CreateNewsFormSchemaType>({
    resolver: zodResolver(CreateNewsFormSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      event: "",
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

        // Append profile picture file if selected
        if (selectedFile) {
          formData.append("images", selectedFile);
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

  return (
    <div>
      <Form {...form}>
        <PageHeader title="Create News" />
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
                    <FormLabel>Category</FormLabel>
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
              <FormField
                control={form.control}
                name="event"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Event (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {relatedEvents.map((event, index) => (
                          <SelectItem key={index} value={event.value}>
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Input
                        type="file"
                        accept="image/*"
                        placeholder="Select images"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);

                            // Create preview URL for display
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => {
                              const previewImage = reader.result as string;
                              // setAvatar(previewImage);
                              field.onChange(file.name);
                            };
                          }
                        }}
                      />
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
                  {pending ? "Publishing..." : "Publish"}
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
