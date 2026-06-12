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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries, DEFAULT_PROFILE_PICTURE } from "@/constants";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  EditProfileFormSchema,
  EditProfileFormSchemaType,
} from "@/lib/zodSchemas";
import axios from "axios";
import { env } from "@/lib/env";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FullLoader, Loader } from "@/components/Loader";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";

// Prevent paste on specific inputs to block fancy unicode characters
const preventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
};

const Page = () => {
  const { user, token, login } = useAuth();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [avatar, setAvatar] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Esport Image state (its own flow: uploads immediately on file pick, replace-only). ──
  const [esportUploading, setEsportUploading] = useState(false);
  const [esportPreview, setEsportPreview] = useState<string | null>(null);

  // Upload/replace the esport image the moment a file is picked. POST
  // /auth/upload-esport-image/ (multipart `esport_image`); on success the returned URL becomes
  // the preview. No delete path exists by design (owner: replace-only).
  const handleEsportImagePick = async (file: File | null) => {
    if (!file) return;
    setEsportUploading(true);
    try {
      const fd = new FormData();
      fd.append("esport_image", file);
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/upload-esport-image/`,
        fd,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setEsportPreview(res.data.esport_image_url);
      toast.success("Esport image saved.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to upload the esport image.");
    } finally {
      setEsportUploading(false);
    }
  };

  const form = useForm<EditProfileFormSchemaType>({
    resolver: zodResolver(EditProfileFormSchema),
    defaultValues: {
      avatar: "",
      ingameName: "",
      fullName: "",
      // country: "" as EditProfileFormSchemaType["country"],
      email: "",
      uid: "",
    },
  });

  // Reset form values when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        avatar: user.profile_pic || "",
        ingameName: user.in_game_name || "",
        fullName: user.full_name || "",
        // country:
        //   (user.country as EditProfileFormSchemaType["country"]) ||
        //   ("" as EditProfileFormSchemaType["country"]),
        email: user.email || "",
        uid: user.uid || "",
      });
    }
  }, [user, form]);

  function onSubmit(data: EditProfileFormSchemaType) {
    startTransition(async () => {
      try {
        // Create FormData object
        const formData = new FormData();

        // Append all form fields to FormData
        formData.append("full_name", data.fullName);
        // formData.append("country", data.country);
        formData.append("in_game_name", data.ingameName);
        formData.append("email", data.email);
        formData.append("uid", data.uid);

        // Append profile picture file if selected
        if (selectedFile) {
          formData.append("profile_pic", selectedFile);
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(response.data.message);
        const storedToken = localStorage.getItem("authToken");
        if (storedToken) {
          await login(storedToken);
        } else {
          toast.error("Oops! An error occurred. Login again");
          router.push("/login");
        }
        router.push(`/profile`);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
      }
    });
  }

  if (!user) return <FullLoader />;

  return (
    <div>
      <PageHeader back title={`Edit Profile: ${user.full_name}`} />

      <Card>
        <CardHeader>
          <CardTitle>Update Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex justify-center mb-4">
                <Avatar className="w-32 h-32 mb-4 object-cover">
                  <AvatarImage
                    src={avatar || user?.profile_pic || DEFAULT_PROFILE_PICTURE}
                    alt={`${user.full_name}'s picture`}
                    className="object-cover"
                  />
                  <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>

              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        placeholder="shadcn"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);

                            // Create preview URL for display
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => {
                              const previewImage = reader.result as string;
                              setAvatar(previewImage);
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
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        onPaste={preventPaste}
                        {...field}
                      />
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uid"
                render={({ field }) => (
                  // data-tour anchor (guided welcome tour): the Free Fire UID field.
                  // Targeted by guided-tour-stops.ts -> profile stop -> "profile-uid".
                  <FormItem data-tour="profile-uid">
                    <FormLabel>
                      UID <InfoTip id="profile.edit.uid" />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter your FreeFire UID"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ingameName"
                render={({ field }) => (
                  // data-tour anchor (guided welcome tour): the in-game name field.
                  // Targeted by guided-tour-stops.ts -> profile stop -> "profile-ign".
                  <FormItem data-tour="profile-ign">
                    <FormLabel>
                      In-game Name <InfoTip id="profile.edit.in_game_name" />
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="bg-input border-border"
                        placeholder="Enter your in-game name"
                        onPaste={preventPaste}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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
              /> */}
              <div className="flex gap-2 items-center justify-between">
                {/* data-tour anchor (guided welcome tour): the Save button. Targeted
                    by guided-tour-stops.ts -> profile stop -> "profile-save". */}
                <Button
                  className="flex-1"
                  disabled={pending}
                  type="submit"
                  data-tour="profile-save"
                >
                  {pending ? <Loader text="Saving..." /> : "Save changes"}
                </Button>
                <Button className="flex-1" variant="outline" asChild>
                  <Link href="/profile/change-password">Change Password</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── Esport Image ── a SEPARATE asset from the profile picture (owner 2026-06-12).
          Organizers use it as the player's image in event graphics, and events can REQUIRE it
          before registration. Uploads hit POST /auth/upload-esport-image/ immediately (its own
          flow, not part of the form above); replace-only - there is no way to remove it. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center">
            Esport Image
            <InfoTip
              text="Tournament organizers use this image as your player picture in event graphics. Some events require it before you can register."
              className="ml-1.5"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* THE WARNING (owner, verbatim intent): own picture only, esport-style bust shot,
              no branded shirts - violations can ban the player AND their team. */}
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">Read before uploading</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>
                Upload <span className="font-medium text-foreground">only your own picture</span>.
              </li>
              <li>
                It must look like an esport image: a clear shot covering your bust, facing the
                camera.
              </li>
              <li>
                Do <span className="font-medium text-foreground">not</span> wear a branded shirt.
              </li>
              <li className="text-destructive">
                If you upload a picture that is not yours, or anything that is not an esport
                picture, we can and will ban both you and your team.
              </li>
            </ul>
          </div>

          {/* SAMPLES (owner 2026-06-12: "lets have samples to show them") - three reference shots
              shipped in public/esport-samples/ so players see exactly what an esport image looks
              like before uploading their own. */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              Examples of what your esport image should look like:
            </p>
            <div className="flex flex-wrap gap-2">
              {["sample-1.jpg", "sample-2.png", "sample-3.webp"].map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f}
                  src={`/esport-samples/${f}`}
                  alt="Esport image example"
                  className="h-32 w-24 rounded-md border object-cover"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            {/* Current image (or placeholder). Esport shots are portrait, so a tall preview. */}
            <div className="h-40 w-32 overflow-hidden rounded-md border bg-muted/30">
              {esportPreview || user.esport_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={esportPreview || user.esport_image_url || ""}
                  alt="Your esport image"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  No esport image yet
                </div>
              )}
            </div>

            <div className="flex-1 min-w-[220px] space-y-2">
              <Input
                type="file"
                accept="image/*"
                disabled={esportUploading}
                onChange={(e) => handleEsportImagePick(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {user.esport_image_url
                  ? "Picking a file replaces your current esport image immediately. Esport images cannot be removed, only replaced."
                  : "Picking a file uploads it immediately. Esport images cannot be removed, only replaced."}
              </p>
              {esportUploading && <Loader text="Uploading esport image..." />}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Page;
