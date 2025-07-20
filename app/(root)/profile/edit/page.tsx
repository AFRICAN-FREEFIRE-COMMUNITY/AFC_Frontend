import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProfileForm } from "./_components/EditProfileForm";
import { Wrapper } from "./_components/Wrapper";

export default function EditProfilePage() {
	return (
		<Layout>
			<div className="container mx-auto px-4 py-8">
				<h1 className="text-4xl font-bold mb-8">Edit Profile</h1>
				<Card>
					<CardHeader>
						<CardTitle>Update Your Information</CardTitle>
					</CardHeader>
					<CardContent>
						<Wrapper />
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
}
