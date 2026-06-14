"use client";
import { env } from "@/lib/env";
import axios from "axios";
import Cookies from "js-cookie";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";

export interface MatchStats {
  kills: number;
  wins: number;
  matches_played: number;

  // team-only fields (safe to keep optional)
  assists?: number;
  damage?: number;
  total_points?: number;
}

export interface UserStats {
  solo: MatchStats;
  team: MatchStats;

  total_booyahs: number;
  total_earnings: number;
  total_kills: number;
  total_mvps: number;
  total_scrims_played: number;
  total_tournaments_played: number;
  total_wins: number;
}

export interface User {
  id?: string; // optional if not always returned
  user_id: number;
  full_name: string;
  country: string;
  in_game_name: string;
  uid: string;
  team: string | null;
  role: string;
  roles: string[];
  email: string;
  profile_pic?: string;
  // The SEPARATE esport image (UserProfile.esports_pic): organizers use it as the player's image
  // in event graphics, and events can require it before registration. Uploaded/replaced via
  // POST /auth/upload-esport-image/ (replace-only); see the profile-edit "Esport Image" section.
  esport_image_url?: string | null;
  discord_username?: string;
  is_banned: boolean;
  // True if this user is an active marketplace vendor. Drives the "Vendor Dashboard"
  // sidebar entry (the /vendor portal is otherwise only reachable by URL). Set by the
  // backend get-user-profile payload.
  is_vendor?: boolean;
  // True once the user has finished/skipped the first-time animated WELCOME tour. Consumed by
  // app/(user)/_components/WelcomeTour.tsx: the tour auto-shows only while this is false. Set by
  // the backend get-user-profile payload and flipped via POST /auth/mark-welcome-seen/.
  has_seen_welcome?: boolean;
  // One-time dashboard intro callouts: {"sponsor": true, ...} once each is dismissed. Consumed by
  // app/(user)/_components/DashboardIntroCoachmark.tsx, which shows a "here is where your new
  // dashboard lives" callout for any accessible dashboard whose key is missing. Set by the backend
  // get-user-profile payload and flipped via POST /auth/mark-dashboard-intro-seen/.
  seen_dashboard_intros?: Record<string, boolean>;

  stats: UserStats;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  isAdminByRoleOrRoles: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  signalSessionExpired: () => void;
  // Re-fetch the profile (roles included) with the current token and update context
  // state. For surfaces that gate on a role which may have JUST been granted
  // server-side (see OrganizerGuard in app/(organizer)/organizer/layout.tsx).
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cookie configuration
const COOKIE_NAME = "auth_token";
const COOKIE_OPTIONS = {
  // 3 hours (owner 2026-06-14: auto-logout after 3h). js-cookie `expires` is in DAYS, so
  // 3 hours = 3/24. MUST match the backend SessionToken.SESSION_LIFETIME (timedelta(hours=3)),
  // otherwise the cookie outlives the token and requests start 401-ing while still "logged in".
  expires: 3 / 24,
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict" as const,
  path: "/",
};

// Idle-timeout slide (owner 2026-06-14): on activity we re-set the auth_token cookie with a fresh
// 3h expiry so an active user is never logged out, mirroring the backend SessionToken.touch(). We
// throttle to once per 5 min so we are not re-writing the cookie on every single request.
let lastCookieBumpAt = 0;
const COOKIE_BUMP_THROTTLE_MS = 5 * 60 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards against firing more than one canonical token re-validation at a time
  // when several data requests 401 together (see the response interceptor below).
  const revalidatingRef = useRef(false);

  // Load token from cookies and fetch user
  useEffect(() => {
    const storedToken = Cookies.get(COOKIE_NAME);
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
      (response) => {
        // Idle-timeout cookie slide: any successful API call counts as activity, so refresh the
        // auth_token cookie's 3h expiry (throttled). Keeps an active user logged in; once they go
        // idle for 3h the cookie lapses + the backend token expires, and they are logged out.
        try {
          const t = Cookies.get(COOKIE_NAME);
          const now = Date.now();
          if (t && now - lastCookieBumpAt > COOKIE_BUMP_THROTTLE_MS) {
            lastCookieBumpAt = now;
            Cookies.set(COOKIE_NAME, t, COOKIE_OPTIONS);
          }
        } catch {
          // cookie access can throw in rare sandboxed contexts; never break a response over it
        }
        return response;
      },
      (error) => {
        // Skip interceptor for auth endpoints (login, register, etc.)
        const requestUrl = error.config?.url || "";
        const isAuthEndpoint =
          requestUrl.includes("/auth/login") ||
          requestUrl.includes("/auth/register") ||
          requestUrl.includes("/auth/forgot-password") ||
          requestUrl.includes("/auth/reset-password");

        // Only a 401 from the canonical token-VALIDATION endpoint (get-user-profile) is
        // treated as a real session expiry that logs the user out. A 401 from any other
        // data endpoint is left for the caller to handle (toast etc.) and does NOT clear the
        // session - this stops a single stray/transient 401 (e.g. a request that raced the
        // token, or an endpoint returning 401 for an unrelated reason) from logging the user
        // out mid-work. A genuinely-expired token is still caught on the next profile fetch.
        const isTokenValidation = requestUrl.includes("/auth/get-user-profile");

        if (error.response?.status === 401 && !isAuthEndpoint && token) {
          if (isTokenValidation) {
            // The canonical validation endpoint said 401 -> the session really is
            // dead. Clear it, tell the user, and raise the event the AuthModal
            // listens for so a login modal pops in place (no navigation, so the
            // user keeps their spot and resumes right where they were).
            Cookies.remove(COOKIE_NAME, { path: "/" });
            setUser(null);
            setToken(null);
            toast.error("Your session expired. Please log in to continue.");
            window.dispatchEvent(new CustomEvent("auth:session-expired"));
          } else if (!revalidatingRef.current) {
            // A normal data endpoint 401'd. Previously this was swallowed silently,
            // so an expired token mid-session just left the page half-loaded with no
            // notice. We also don't want to log out on a single stray/racing 401.
            // Resolve both: confirm against the canonical endpoint exactly once. If
            // the token is truly dead that call 401s and re-enters the branch above
            // (showing the modal); if it succeeds, the 401 was a fluke and we ignore it.
            revalidatingRef.current = true;
            axios
              .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-user-profile/`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              .catch(() => {})
              .finally(() => {
                revalidatingRef.current = false;
              });
          }
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token]);

  const fetchUser = async (token: string): Promise<User> => {
    try {
      const res = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-user-profile/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.statusText !== "OK") throw new Error("Failed to fetch user");

      // Map the database user to your User interface
      const dbUser = res.data;

      const mappedUser: User = {
        id: dbUser.user_id.toString(),
        user_id: dbUser.user_id,
        full_name: dbUser.full_name,
        country: dbUser.country,
        in_game_name: dbUser.in_game_name,
        uid: dbUser.uid,
        team: dbUser.team,
        role: dbUser.role,
        roles: dbUser.roles || [],
        email: dbUser.email,
        profile_pic: dbUser.profile_pic,
        esport_image_url: dbUser.esport_image_url ?? null,
        discord_username: dbUser.discord_username,
        is_banned: dbUser.is_banned,
        is_vendor: dbUser.is_vendor ?? false,
        // First-time welcome tour flag (see User interface). The backend get-user-profile
        // payload ALWAYS includes this boolean (afc_auth.views.get_user_profile -> the
        // User.has_seen_welcome field, which defaults to False for a brand-new account), so on
        // a fresh login/signup it carries the real `false` and the guided tour fires. login()
        // below calls fetchUser() right after auth, so has_seen_welcome is known the moment a
        // new user lands on their first authenticated page.
        // We must NOT default an ABSENT field to `true`: that would wrongly SUPPRESS the tour
        // for a newcomer if a payload ever omitted the field. Default to `false` (show the
        // tour) so a missing field never silences a new user; the explicit POST
        // /auth/mark-welcome-seen/ is what permanently turns it off once they finish or skip.
        has_seen_welcome: dbUser.has_seen_welcome ?? false,
        // Dismissed one-time dashboard intros (see the User interface note). Default {} so a
        // missing field reads as "nothing dismissed yet" - the coachmark gates on access TOO,
        // so a user with no dashboards still sees nothing.
        seen_dashboard_intros: dbUser.seen_dashboard_intros ?? {},
        stats: dbUser.stats,
      };

      setUser(mappedUser);
      return mappedUser;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Internal server error");
      logout();
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (token: string): Promise<User> => {
    // Store token in cookie instead of localStorage
    localStorage.setItem("authToken", token);
    Cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
    setToken(token);
    return fetchUser(token);
  };

  const logout = useCallback(() => {
    // Remove cookie instead of localStorage
    Cookies.remove(COOKIE_NAME, { path: "/" });
    setUser(null);
    setToken(null);
  }, []);

  // Re-fetch get-user-profile with the CURRENT token so role changes made since page
  // load become visible without a full reload or re-login. Why this exists: roles are
  // only loaded once (the fetchUser on mount), so when an org owner adds someone as a
  // sub-organizer, that person's already-open session still reads isOrganizer=false
  // and OrganizerGuard bounces them to /unauthorized until they hard-refresh ("access
  // takes time"). Guards await this once before concluding the user lacks a role.
  // Returns the fresh User, or null when there is no token or the fetch failed
  // (fetchUser itself toasts + logs out on a genuinely dead session, same as on load).
  const refreshUser = useCallback(async (): Promise<User | null> => {
    const current = token ?? Cookies.get(COOKIE_NAME);
    if (!current) return null;
    try {
      return await fetchUser(current);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const signalSessionExpired = useCallback(() => {
    Cookies.remove(COOKIE_NAME, { path: "/" });
    setUser(null);
    setToken(null);
    window.dispatchEvent(new CustomEvent("auth:session-expired"));
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
          [
            "head_admin",
            "organizer_admin",
            "metrics_admin",
            "shop_admin",
            "news_admin",
            "teams_admin",
            "event_admin",
            "partner_admin",
          ].includes(role),
        ))
    : false;

  // Check if user is admin (has any admin role)
  const isAdmin = user
    ? user.role === "admin" ||
      user.role === "sponsor" ||
      (user.role === "player" &&
        hasAnyRole([
          "head_admin",
          "organizer_admin",
          "metrics_admin",
          "shop_admin",
          "news_admin",
          "teams_admin",
          "event_admin",
          "partner_admin",
          "sponsor",
        ]))
    : false;

  // An organizer is a non-admin role that owns/runs an organization. It is NOT a
  // platform admin (deliberately kept out of the isAdmin arrays above) - pages use
  // this flag to gate organizer-only surfaces.
  const isOrganizer = hasAnyRole(["organizer"]);

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
        isOrganizer,
        hasRole,
        hasAnyRole,
        isAdminByRoleOrRoles,
        signalSessionExpired,
        refreshUser,
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
