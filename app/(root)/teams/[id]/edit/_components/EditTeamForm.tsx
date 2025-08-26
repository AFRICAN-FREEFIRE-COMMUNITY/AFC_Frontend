"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import Link from "next/link";
import { Loader } from "@/components/Loader";
import { EditTeamFormSchema, EditTeamFormSchemaType } from "@/lib/zodSchemas";
import { useEffect, useState, useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractSocialMediaUrls } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export function EditTeamForm({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [submitPending, startSubmitTransition] = useTransition();
  const [teamDetails, setTeamDetails] = useState<any>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { user, token } = useAuth();
  const router = useRouter();

  const form = useForm<EditTeamFormSchemaType>({
    resolver: zodResolver(EditTeamFormSchema),
    defaultValues: {
      team_id: "",
      team_name: "",
      team_logo: "",
      join_settings: "",
      facebook_url: "",
      twitter_url: "",
      instagram_url: "",
      youtube_url: "",
      twitch_url: "",
    },
  });

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: id }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [id]);

  // Update form values when teamDetails changes
  useEffect(() => {
    if (teamDetails) {
      const socialUrls = extractSocialMediaUrls(teamDetails.social_media_links);

      form.reset({
        team_id: teamDetails.team_id || teamDetails.team_name,
        team_name: teamDetails.team_name || "",
        join_settings: teamDetails.join_settings || "",
        team_logo: teamDetails.team_logo || "",
        ...socialUrls,
        // Add all other fields that need to be populated
      });
    }
  }, [teamDetails, form]);

  function onSubmit(data: EditTeamFormSchemaType) {
    startSubmitTransition(async () => {
      try {
        // Create FormData object
        const formData = new FormData();

        formData.append("team_name", data.team_name);
        if (selectedFile) {
          formData.append("team_logo", selectedFile);
        }
        formData.append("join_settings", data.join_settings);
        const socialMediaLinks: any = {};
        if (data.facebook_url) socialMediaLinks.facebook = data.facebook_url;
        if (data.twitter_url) socialMediaLinks.twitter = data.twitter_url;
        if (data.instagram_url) socialMediaLinks.instagram = data.instagram_url;
        if (data.youtube_url) socialMediaLinks.youtube = data.youtube_url;
        if (data.twitch_url) socialMediaLinks.twitch = data.twitch_url;

        // Only append if there are social media links
        if (Object.keys(socialMediaLinks).length > 0) {
          formData.append(
            "social_media_links",
            JSON.stringify(socialMediaLinks)
          );
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/edit-team/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.statusText === "OK") {
          toast.success(`Team created successfully!`);
          router.push(`/teams/${id}`);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="team_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your team name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="team_logo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team logo</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
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
          name="join_settings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Join settings</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your settings" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={"open"}>Open</SelectItem>
                  <SelectItem value={"by_request"}>By request</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2.5">
          <FormLabel>Social Media Links (Optional)</FormLabel>
          <div className="space-y-1.5">
            <FormField
              control={form.control}
              name="facebook_url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Facebook URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="twitter_url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Twitter URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instagram_url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Instagram URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="youtube_url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Youtube URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="twitch_url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Twitch URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant={"outline"}>
            <Link href={`/teams/${id}`}>Back</Link>
          </Button>
          <Button disabled={submitPending} type="submit">
            {submitPending ? <Loader text="Updating..." /> : "Update Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
