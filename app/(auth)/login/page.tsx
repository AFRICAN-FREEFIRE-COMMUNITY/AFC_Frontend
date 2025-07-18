import React from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./_components/LoginForm";

export default function LoginPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
				<div className="flex justify-center mb-6">
					<Logo size="large" />
				</div>
				<h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
					Login to AFC DATABASE
				</h1>
				<LoginForm />
				<div className="mt-4 text-center">
					<Link
						href="/forgot-password"
						className="text-muted-foreground hover:text-primary"
					>
						Forgot password?
					</Link>
				</div>
				<div className="mt-6 text-center">
					<p className="text-muted-foreground">
						Don't have an account?
					</p>
					<Link
						href="/create-account"
						className="text-primary hover:underline"
					>
						Create an account
					</Link>
				</div>
			</div>
		</div>
	);
}
