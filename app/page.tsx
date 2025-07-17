"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "./landing/page";

// Mock authentication check
const useAuth = () => {
	// In a real app, this would check for a valid session or token
	return { isLoggedIn: false };
};

export default function Page() {
	const router = useRouter();
	const { isLoggedIn } = useAuth();

	useEffect(() => {
		if (isLoggedIn) {
			router.push("/home");
		}
	}, [isLoggedIn, router]);

	// If not logged in, show the landing page
	return <LandingPage />;
}
