"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EditProfileForm } from "./EditProfileForm";

export const Wrapper = () => {
	const { user, token } = useAuth();

	if (!user || !token) {
		return <div className="text-center py-10">Loading...</div>;
	}

	return <EditProfileForm user={user} token={token} />;
};
