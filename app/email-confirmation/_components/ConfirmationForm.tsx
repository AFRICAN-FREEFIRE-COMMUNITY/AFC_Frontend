"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/components/ui/use-toast";
import {
	EmailConfirmationFormSchema,
	EmailConfirmationFormSchemaType,
} from "@/lib/zodSchemas";
import { useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { Loader } from "@/components/Loader";

interface Props {
	email: string;
}

export function ConfirmationForm({ email }: Props) {
	const router = useRouter();

	const [pending, startTransition] = useTransition();
	const [pendingResend, startResendTransition] = useTransition();

	const form = useForm<EmailConfirmationFormSchemaType>({
		resolver: zodResolver(EmailConfirmationFormSchema),
		defaultValues: {
			email,
			code: "",
		},
	});

	function onSubmit(data: EmailConfirmationFormSchemaType) {
		startTransition(async () => {
			try {
				const response = await axios.post(
					`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/verify-code/`,
					{ ...data }
				);

				toast.success(response.data.message);
				router.push(`/home`);
			} catch (error: any) {
				console.log(error);
				toast.error(
					error?.response?.data?.error || "Internal server error"
				);
			}
		});
	}

	const handleResendCode = () => {
		startResendTransition(async () => {
			try {
				const response = await axios.post(
					`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/resend-verification-code/`,
					{ email }
				);

				toast.success(response.data.message);
			} catch (error: any) {
				console.log(error);
				toast.error(
					error?.response?.data?.error || "Internal server error"
				);
			}
		});
	};

	// const handleConfirmEmail = async (e: React.FormEvent) => {
	// 	e.preventDefault();
	// 	// In a real application, this would verify the confirmation code with the backend
	// 	try {
	// 		// Simulating an API call
	// 		await new Promise((resolve) => setTimeout(resolve, 1000));

	// 		if (confirmationCode === "123456") {
	// 			// This is a mock validation, replace with actual logic
	// 			localStorage.removeItem("pendingConfirmationEmail");
	// 			toast({
	// 				title: "Email confirmed",
	// 				description: "Your account has been successfully created.",
	// 			});
	// 			router.push("/home");
	// 		} else {
	// 			toast({
	// 				title: "Invalid code",
	// 				description: "Please enter the correct confirmation code.",
	// 				variant: "destructive",
	// 			});
	// 		}
	// 	} catch (error) {
	// 		toast({
	// 			title: "Error",
	// 			description:
	// 				"An error occurred while confirming your email. Please try again.",
	// 			variant: "destructive",
	// 		});
	// 	}
	// };

	return (
		<>
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="space-y-6"
				>
					<FormField
						control={form.control}
						name="code"
						render={({ field }) => (
							<FormItem>
								<FormControl>
									<Input
										placeholder="Enter confirmation code"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button className="w-full" type="submit" disabled={pending}>
						{pending ? (
							<Loader text="Confirming..." />
						) : (
							"Confirm Email"
						)}
					</Button>
				</form>
			</Form>
			<div className="mt-4 text-center">
				<Button
					type="button"
					variant="ghost"
					className="w-full"
					onClick={handleResendCode}
					disabled={pendingResend}
				>
					{pendingResend ? (
						<Loader text="Sending..." />
					) : (
						"Resend confirmation code"
					)}
				</Button>
			</div>
		</>
	);
}
