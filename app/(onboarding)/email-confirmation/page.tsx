import type React from "react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ConfirmationForm } from "./_components/ConfirmationForm";

export default async function page({ searchParams }: { searchParams: any }) {
	const { email } = await searchParams;

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<div className="flex justify-center mb-4">
						<Logo size="large" />
					</div>
					<CardTitle className="text-2xl text-center">
						Check Your Email
					</CardTitle>
					<CardDescription className="text-center">
						We've sent a confirmation link to {email}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ConfirmationForm email={email} />
				</CardContent>
			</Card>
		</div>
	);
}
