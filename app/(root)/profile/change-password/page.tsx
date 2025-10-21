import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPassword } from "./_components/ResetPasswordForm";

const page = () => {
	return (
		<Layout>
			<div className="container mx-auto px-4 py-8">
				<h1 className="text-4xl font-bold mb-8">Reset Password</h1>

				<Card>
					<CardHeader>
						<CardTitle>Request Password Reset Link</CardTitle>
					</CardHeader>
					<CardContent>
						<ResetPassword />
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
};

export default page;
