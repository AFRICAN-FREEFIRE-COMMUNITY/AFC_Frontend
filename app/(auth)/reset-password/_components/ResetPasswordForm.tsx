"use client";

import React, { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import axios from "axios";
import {
	ResetPasswordFormSchema,
	ResetPasswordFormSchemaType,
} from "@/lib/zodSchemas";
import { Loader } from "@/components/Loader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { countries } from "@/constants";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Props {
	email: string;
	token: string;
}

export function ResetPasswordForm({ email, token }: Props) {
	const router = useRouter();

	const [pending, startTransition] = useTransition();

	const form = useForm<ResetPasswordFormSchemaType>({
		resolver: zodResolver(ResetPasswordFormSchema),
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
	});

	const password = form.watch("password");
	const [isVisible, setIsVisible] = useState<boolean>(false);
	const [isConfirmVisible, setConfirmIsVisible] = useState<boolean>(false);
	const toggleVisibility = () => setIsVisible((prevState) => !prevState);
	const toggleConfirmVisibility = () =>
		setConfirmIsVisible((prevState) => !prevState);

	const checkStrength = (pass: string) => {
		const requirements = [
			{ regex: /.{8,}/, text: "At least 8 characters" },
			{ regex: /[0-9]/, text: "At least 1 number" },
			{ regex: /[a-z]/, text: "At least 1 lowercase letter" },
			{ regex: /[A-Z]/, text: "At least 1 uppercase letter" },
			{
				regex: /[!@#$%^&*(),.?":{}|<>]/,
				text: "At least 1 special character",
			},
		];

		return requirements.map((req) => ({
			met: req.regex.test(pass),
			text: req.text,
		}));
	};

	const strength = checkStrength(password);

	const strengthScore = useMemo(() => {
		return strength.filter((req) => req.met).length;
	}, [strength]);

	const getStrengthText = (score: number) => {
		if (score === 0) return "Enter a password";
		if (score <= 2) return "Weak password";
		if (score === 3) return "Medium password";
		return "Strong password";
	};

	function onSubmit(data: ResetPasswordFormSchemaType) {
		startTransition(async () => {
			try {
				const authData = {
					email,
					new_password: data.password,
					token,
				};
				const response = await axios.post(
					`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/reset-password/`,
					{ ...authData }
				);

				toast.success(`${response.data.message}. Redirecting...`);
				router.push(`/login`);
			} catch (error: any) {
				toast.error(
					error?.response?.data?.error || "Internal server error"
				);
				return;
			}
		});
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Password</FormLabel>
							<FormControl>
								<div className="relative">
									<Input
										type={isVisible ? "text" : "password"}
										placeholder="Enter your password"
										{...field}
									/>
									<Button
										className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
										variant={"ghost"}
										size="icon"
										type="button"
										onClick={toggleVisibility}
										aria-label={
											isVisible
												? "Hide password"
												: "Show password"
										}
										aria-pressed={isVisible}
										aria-controls="password"
									>
										{isVisible ? (
											<EyeOffIcon
												className="size-4"
												aria-hidden="true"
											/>
										) : (
											<EyeIcon
												className="size-4"
												aria-hidden="true"
											/>
										)}
									</Button>
								</div>
							</FormControl>
							<FormMessage />
							<div
								className={cn(
									password.length !== 0
										? "block mt-2 space-y-3"
										: "hidden"
								)}
							>
								<Progress
									value={(strengthScore / 5) * 100}
									className={cn("h-1")}
								/>
								{/* Password strength description */}
								<p className="text-foreground mb-2 text-sm font-medium">
									{getStrengthText(strengthScore)}. Must
									contain:
								</p>

								{/* Password requirements list */}
								<ul
									className="space-y-1.5"
									aria-label="Password requirements"
								>
									{strength.map((req, index) => (
										<li
											key={index}
											className="flex items-center gap-2"
										>
											{req.met ? (
												<CheckIcon
													size={16}
													className="text-emerald-500"
													aria-hidden="true"
												/>
											) : (
												<XIcon
													size={16}
													className="text-muted-foreground/80"
													aria-hidden="true"
												/>
											)}
											<span
												className={`text-xs ${
													req.met
														? "text-emerald-600"
														: "text-muted-foreground"
												}`}
											>
												{req.text}
												<span className="sr-only">
													{req.met
														? " - Requirement met"
														: " - Requirement not met"}
												</span>
											</span>
										</li>
									))}
								</ul>
							</div>
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="confirmPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Confirm password</FormLabel>
							<FormControl>
								<div className="relative">
									<Input
										type={
											isConfirmVisible
												? "text"
												: "password"
										}
										placeholder="Enter your password"
										{...field}
									/>
									<Button
										className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
										variant={"ghost"}
										size="icon"
										type="button"
										onClick={toggleConfirmVisibility}
										aria-label={
											isVisible
												? "Hide password"
												: "Show password"
										}
										aria-pressed={isConfirmVisible}
										aria-controls="password"
									>
										{isVisible ? (
											<EyeOffIcon
												className="size-4"
												aria-hidden="true"
											/>
										) : (
											<EyeIcon
												className="size-4"
												aria-hidden="true"
											/>
										)}
									</Button>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button
					className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
					type="submit"
					disabled={pending}
				>
					{pending ? (
						<Loader text="Resetting..." />
					) : (
						"Reset password"
					)}
				</Button>
			</form>
		</Form>
	);
}
