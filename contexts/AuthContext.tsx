"use client";

import { env } from "@/lib/env";
import axios from "axios";
import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
import { toast } from "sonner";

export interface User {
	id: string;
	full_name: string;
	country: string;
	in_game_name: string;
	uid: string;
	team?: string;
	role?: string;
	email: string;
	avatar?: string;
	banReason?: boolean;
}

interface AuthContextType {
	user: User | null;
	token: string | null;
	loading: boolean;
	login: (token: string) => Promise<void>;
	logout: () => void;
	isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Load token from storage and fetch user
	useEffect(() => {
		const storedToken = localStorage.getItem("authToken");
		if (storedToken) {
			setToken(storedToken);
			fetchUser(storedToken);
		} else {
			setLoading(false);
		}
	}, []);

	const fetchUser = async (token: string) => {
		try {
			const res = await axios(
				`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-user-profile/`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (res.statusText !== "OK")
				throw new Error("Failed to fetch user");

			setUser(res.data);
		} catch (err: any) {
			toast.error(err.response.data.message || "Internal server error");
			logout();
		} finally {
			setLoading(false);
		}
	};

	const login = async (token: string) => {
		localStorage.setItem("authToken", token);
		setToken(token);
		await fetchUser(token);
	};

	const logout = () => {
		localStorage.removeItem("authToken");
		setUser(null);
		setToken(null);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				loading,
				login,
				logout,
				isAuthenticated: !!user,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within AuthProvider");
	return context;
};
