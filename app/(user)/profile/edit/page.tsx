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
import { BackButton } from "@/components/BackButton";

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

  const form = useForm<EditProfileFormSchemaType>({
    resolver: zodResolver(EditProfileFormSchema),
    defaultValues: {
      avatar: "",
      ingameName: "",
      fullName: "",
      country: "" as EditProfileFormSchemaType["country"],
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
        country: (user.country as EditProfileFormSchemaType["country"]) || ("" as EditProfileFormSchemaType["country"]),
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
        formData.append("country", data.country);
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
          }
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
      <h1 className="text-3xl md:text-4xl font-bold mb-4">Edit Profile</h1>
      <BackButton />
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
                  <FormItem>
                    <FormLabel>UID</FormLabel>
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
                  <FormItem>
                    <FormLabel>In-game Name</FormLabel>
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
              <FormField
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
              />
              <div className="flex gap-2 items-center justify-between">
                <Button className="flex-1" disabled={pending} type="submit">
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
    </div>
  );
};

export default Page;
