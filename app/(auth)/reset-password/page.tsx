import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";

const page = async ({ searchParams }: { searchParams: any }) => {
	const { email, token } = await searchParams;

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="bg-card p-8 rounded-md shadow-md w-full max-w-md">
				<div className="flex justify-center mb-6">
					<Logo size="large" />
				</div>
				<h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
					Verify token
				</h1>
				<p className="text-muted-foreground mb-6 text-center">
					Enter the token sent to {email}
				</p>
				<ResetPasswordForm token={token} email={email} />
			</div>
		</div>
	);
};

export default page;
