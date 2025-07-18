"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import React, { ReactNode } from "react";

const layout = ({ children }: { children: ReactNode }) => {
	const router = useRouter();
	const { isAuthenticated } = useAuth();

	if (isAuthenticated) return router.push("/home");

	return <div>{children}</div>;
};

export default layout;
