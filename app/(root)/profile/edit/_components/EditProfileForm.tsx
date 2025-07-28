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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { countries } from "@/constants";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, User } from "@/contexts/AuthContext";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import {
	EditProfileFormSchema,
	EditProfileFormSchemaType,
} from "@/lib/zodSchemas";
import Link from "next/link";
import { useState, useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/Loader";

const FormSchema = z.object({
	avatar: z.string().min(2, {
		message: "avatar must be at least 2 characters.",
	}),
});

export function EditProfileForm({
	user,
	token,
}: {
	user: User;
	token: string;
}) {
	const router = useRouter();
	const { login } = useAuth();

	const [pending, startTransition] = useTransition();
	const [avatar, setAvatar] = useState<string>();

	const form = useForm<EditProfileFormSchemaType>({
		resolver: zodResolver(EditProfileFormSchema),
		defaultValues: {
			avatar: user.profile_pic || "",
			ingameName: user.in_game_name || "",
			fullName: user.full_name || "",
			country:
				(user.country as EditProfileFormSchemaType["country"]) ||
				("" as EditProfileFormSchemaType["country"]),
			email: user.email || "",
			uid: user.uid || "",
		},
	});

	function onSubmit(data: EditProfileFormSchemaType) {
		startTransition(async () => {
			try {
				const editedData = {
					profile_pic: data.avatar,
					full_name: data.fullName,
					country: data.country,
					in_game_name: data.ingameName,
					email: data.email,
					uid: data.uid,
				};
				const response = await axios.post(
					`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`,
					{ ...editedData },
					{ headers: { Authorization: `Bearer ${token}` } }
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
				toast.error(
					error?.response?.data?.message || "Internal server error"
				);
				return;
			}
		});
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<div className="flex justify-center mb-4">
					<Avatar className="w-32 h-32 mb-4">
						<AvatarImage
							src={
								avatar ||
								user.profile_pic ||
								DEFAULT_PROFILE_PICTURE
							}
							alt={`${user.full_name}'s picture`}
							className="object-cover"
						/>
						<AvatarFallback>
							{user.full_name.charAt(0)}
						</AvatarFallback>
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
											console.log(file);
											const reader = new FileReader();
											reader.readAsDataURL(file);
											reader.onload = () => {
												const previewImage =
													reader.result as string;
												setAvatar(previewImage);
												field.onChange(previewImage);
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
				<div className="flex justify-between">
					<Button disabled={pending} type="submit">
						{pending ? <Loader text="Saving..." /> : "Save changes"}
					</Button>
					<Button variant="outline" asChild>
						<Link href="/profile/change-password">
							Change Password
						</Link>
					</Button>
				</div>
			</form>
		</Form>
	);
}
