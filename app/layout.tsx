import type React from "react";
import { Inter, Rajdhani } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
});

const rajdhani = Rajdhani({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-rajdhani",
	display: "swap",
});

export const metadata = {
	title: "AFC Esports Metrics",
	description: "Track your performance in the African Freefire Community",
	generator: "v0.dev",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={`${inter.variable} ${rajdhani.variable}`}>
			<body className="font-sans">
				<AuthProvider>
					<Providers>{children}</Providers>
					<Toaster />
				</AuthProvider>
			</body>
		</html>
	);
}
