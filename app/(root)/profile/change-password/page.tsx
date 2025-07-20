"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function RequestPasswordResetPage() {
	const router = useRouter();
	const { toast } = useToast();
	const [email, setEmail] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Here you would typically send the password reset request to your backend
		console.log("Password reset requested for:", email);

		// Show success message
		toast({
			title: "Reset link sent",
			description:
				"If an account exists with this email, you will receive a password reset link shortly.",
		});

		setIsSubmitted(true);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value);
	};

	return (
		<Layout>
			<div className="container mx-auto px-4 py-8">
				<h1 className="text-4xl font-bold mb-8">Reset Password</h1>

				<Card>
					<CardHeader>
						<CardTitle>Request Password Reset Link</CardTitle>
					</CardHeader>
					<CardContent>
						{isSubmitted ? (
							<div className="text-center py-4">
								<h3 className="text-lg font-medium mb-2">
									Check your email
								</h3>
								<p className="text-muted-foreground mb-4">
									We've sent a password reset link to your
									email address.
								</p>
								<Button onClick={() => router.push("/login")}>
									Return to Login
								</Button>
							</div>
						) : (
							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<Label htmlFor="email">Email Address</Label>
									<Input
										id="email"
										name="email"
										type="email"
										value={email}
										onChange={handleChange}
										placeholder="Enter your registered email"
										required
									/>
									<p className="text-sm text-muted-foreground mt-1">
										We'll send a password reset link to this
										email address.
									</p>
								</div>
								<div className="flex justify-between">
									<Button type="submit">
										Send Reset Link
									</Button>
									<Button
										variant="outline"
										onClick={() => router.push("/login")}
									>
										Cancel
									</Button>
								</div>
							</form>
						)}
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
}
