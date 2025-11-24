import type React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";
import { Logo } from "@/components/Logo";

const ForgotPasswordPage = () => {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="bg-card p-8 rounded-md shadow-md w-full max-w-md">
				<div className="flex justify-center mb-6">
					<Logo size="large" />
				</div>
				<h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
					Reset Your Password
				</h1>
				<p className="text-muted-foreground mb-6 text-center">
					Enter your email address and we'll send you instructions to
					reset your password.
				</p>
				<ForgotPasswordForm />
				<div className="mt-6 text-center">
					<Button className="w-full" variant={"ghost"} asChild>
						<Link href="/login">Back to Login</Link>
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ForgotPasswordPage;
