"use client";
import { env } from "@/lib/env";
import axios from "axios";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { toast } from "sonner";

export interface User {
  id: string;
  user_id: number; // Add this since your DB returns user_id
  full_name: string;
  country: string;
  in_game_name: string;
  uid: string;
  team?: string;
  role: string;
  roles: string[]; // Add this array for admin roles
  email: string;
  profile_pic?: string;
  banReason?: boolean;
  isBanned?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAdminByRoleOrRoles: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
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

  // Set up axios interceptor to handle invalid/expired tokens
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Skip interceptor for auth endpoints (login, register, etc.)
        const requestUrl = error.config?.url || "";
        const isAuthEndpoint =
          requestUrl.includes("/auth/login") ||
          requestUrl.includes("/auth/register") ||
          requestUrl.includes("/auth/forgot-password") ||
          requestUrl.includes("/auth/reset-password");

        if (error.response?.status === 401 && !isAuthEndpoint && token) {
          const errorMessage =
            error.response?.data?.message?.toLowerCase() || "";
          // Check for common token expiration/invalid messages
          if (
            errorMessage.includes("token") ||
            errorMessage.includes("expired") ||
            errorMessage.includes("invalid") ||
            errorMessage.includes("unauthorized") ||
            errorMessage.includes("authentication")
          ) {
            localStorage.removeItem("authToken");
            setUser(null);
            setToken(null);
            toast.error("Session expired. Please log in again.");
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token]);

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

      console.log(res);

      if (res.statusText !== "OK") throw new Error("Failed to fetch user");

      // Map the database user to your User interface
      const dbUser = res.data;
      const mappedUser: User = {
        id: dbUser.user_id.toString(), // Convert user_id to string for id
        user_id: dbUser.user_id,
        full_name: dbUser.full_name,
        country: dbUser.country,
        in_game_name: dbUser.in_game_name,
        uid: dbUser.uid,
        team: dbUser.team,
        role: dbUser.role,
        roles: dbUser.roles || [], // Handle the roles array
        email: dbUser.email,
        profile_pic: dbUser.profile_pic,
        banReason: dbUser.banReason,
        isBanned: dbUser.isBanned,
      };

      setUser(mappedUser);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Internal server error");
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

  const logout = useCallback(() => {
    localStorage.removeItem("authToken");
    setUser(null);
    setToken(null);
  }, []);

  // Helper function to check if user has a specific role
  const hasRole = (role: string): boolean => {
    if (!user) return false;

    // Check both the main role and the roles array
    if (user.role === role) return true;

    // Check roles array (case insensitive)
    return user.roles.some((r) => r.toLowerCase() === role.toLowerCase());
  };

  // Helper function to check if user has any of the specified roles
  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) return false;

    return roles.some((role) => hasRole(role));
  };

  const isAdminByRoleOrRoles = user
    ? user.role === "admin" ||
      (user.role === "player" &&
        user.roles?.some((role) =>
          ["Head Admin", "Shop Admin", "News Admin"].includes(role)
        ))
    : false;

  // Check if user is admin (has any admin role)
  const isAdmin = user
    ? user.role === "admin" ||
      hasAnyRole(["Head Admin", "Shop Admin", "News Admin", "admin"])
    : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin,
        hasRole,
        hasAnyRole,
        isAdminByRoleOrRoles,
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
