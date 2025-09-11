"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
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
import {
  CreateTeamFormSchema,
  CreateTeamFormSchemaType,
} from "@/lib/zodSchemas";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/constants";
import { useState, useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Check,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Plus,
  Twitter,
  X,
  Youtube,
} from "lucide-react";
import { Loader } from "@/components/Loader";
import Link from "next/link";

export function CreateTeamForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { user, token } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<CreateTeamFormSchemaType>({
    resolver: zodResolver(CreateTeamFormSchema),
    defaultValues: {
      team_name: "",
      team_description: "",
      country: "",
      team_tag: "",
      list_of_players_to_invite: [{ player: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "list_of_players_to_invite",
  });

  const addInvite = () => {
    append({ player: "" });
  };

  const removeInvite = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  function onSubmit(data: z.infer<typeof CreateTeamFormSchema>) {
    startTransition(async () => {
      try {
        // Create FormData object
        const formData = new FormData();

        formData.append("team_name", data.team_name);
        if (data.team_tag) {
          formData.append("team_tag", data.team_tag);
        }
        if (selectedFile) {
          formData.append("team_logo", selectedFile);
        }
        formData.append("team_description", data.team_description);
        formData.append("country", data.country);
        formData.append("join_settings", data.join_settings);
        // Handle list_of_players_to_invite as JSON string
        if (
          data.list_of_players_to_invite &&
          data.list_of_players_to_invite.length > 0
        ) {
          formData.append(
            "list_of_players_to_invite",
            JSON.stringify(data.list_of_players_to_invite)
          );
        }

        const socialMediaLinks: any = {};
        if (data.facebook_url) socialMediaLinks.facebook = data.facebook_url;
        if (data.twitter_url) socialMediaLinks.twitter = data.twitter_url;
        if (data.instagram_url) socialMediaLinks.instagram = data.instagram_url;
        if (data.youtube_url) socialMediaLinks.youtube = data.youtube_url;
        if (data.twitch_url) socialMediaLinks.twitch = data.twitch_url;

        // Only append if there are social media links
        if (Object.keys(socialMediaLinks).length > 0) {
          formData.append(
            "team_social_media_links",
            JSON.stringify(socialMediaLinks)
          );
        }

        console.log(data, formData);

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/create-team/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log(response);

        if (response.statusText === "Created") {
          toast.success(`Team created successfully!`);
          router.push("/teams");
        } else {
          console.log("noooo");
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        console.log(error);
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
          name="team_tag"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team tag (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter your team tag" {...field} />
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
          name="team_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter a brief description about your team"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {countries.map((country, index) => (
                    <SelectItem key={index} value={country}>
                      {country}
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
          name="join_settings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Join settings</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
        <div className="space-y-2">
          <FormLabel>Invite Members (Email or Username)</FormLabel>
          {fields.map((field, index) => (
            <FormField
              key={field.id}
              control={form.control}
              name={`list_of_players_to_invite.${index}.player`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative group">
                      <Input
                        {...formField}
                        placeholder={`Enter email or username`}
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {formField.value && (
                          <Button type="button" variant="ghost">
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInvite(index)}
                            className="text-muted-foreground hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button type="button" onClick={addInvite} disabled={pending}>
            <Plus className="size-4 mr-1" />
            New invite
          </Button>
        </div>
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
            <Link href="/teams">Cancel</Link>
          </Button>
          <Button disabled={pending} type="submit">
            {pending ? <Loader text="Creating..." /> : "Create Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
