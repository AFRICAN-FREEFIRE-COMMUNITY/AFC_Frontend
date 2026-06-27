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
  // IDENTITY LOCK (owner 2026-06-15): true while the player is signed up for a LIVE event
  // (upcoming/ongoing). The profile-edit form (app/(user)/profile/edit/page.tsx) disables +
  // explains the in-game name and UID inputs when this is true; the backend enforces the same in
  // edit_profile. Set by the get-user-profile payload; releases once all their events complete.
  identity_locked?: boolean;
  team: string | null;
  // Profile-completion reminder (owner 2026-06-20): the name of a team this user OWNS that has no logo
  // (or null), so a gentle nudge can ask the owner to add one. From get-user-profile.
  team_without_logo?: string | null;
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
  // First-login onboarding flag (owner 2026-06-20). False for a brand-new account;
  // OnboardingGate redirects such users to /onboarding once. Set True on Finish/Skip.
  has_completed_onboarding?: boolean;
  // One-time dashboard intro callouts: {"sponsor": true, ...} once each is dismissed. Consumed by
  // app/(user)/_components/DashboardIntroCoachmark.tsx, which shows a "here is where your new
  // dashboard lives" callout for any accessible dashboard whose key is missing. Set by the backend
  // get-user-profile payload and flipped via POST /auth/mark-dashboard-intro-seen/.
  seen_dashboard_intros?: Record<string, boolean>;
  // i18n Phase 0 (preferred UI language). One of "en" | "fr" | "pt". Set by the backend
  // get-user-profile / login / edit-profile payloads (the User.language field, default "en",
  // auto-detected from the login country on first login only). Chosen by the user on the profile
  // edit page (app/(user)/profile/edit/page.tsx), which also writes the same value to a NEXT_LOCALE
  // cookie so Phase 1 (next-intl, not built yet) can pick up the locale. Read-only displayed on the
  // profile overview (ProfileContent.tsx). Defaults to "en" below when a payload omits it.
  language?: string;
  // stats_visible: opt-in toggle controlling whether other users can see this player's stats
  // (tournament performance, kills, wins, etc.). Default false = private. Set by the backend
  // get-user-profile and echoed back by edit-profile. The profile edit page
  // (app/(user)/profile/edit/page.tsx) renders a Switch that sends "true"/"false" in the
  // edit-profile FormData; login() -> fetchUser() refreshes this value after save.
  stats_visible?: boolean;

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
  // Cookie lifetime is STORAGE ONLY — it is NOT the session timeout. The real timeout is the
  // backend's 3h IDLE window (SessionToken: expires_at slides forward on every authed request via
  // validate_token -> touch()), so an actively-used session never expires and a 3h-idle one does.
  //
  // BUG FIX (owner 2026-06-15: "logs out mid-use, not up to 3h"): the cookie used to be pinned to
  // 3h (3/24) and only slid on AXIOS successes, so on fetch-heavy / SSR pages (or a slide race) the
  // cookie lapsed WHILE the backend token was still alive — logging an active user out early. We now
  // give the cookie a long life (7d) and let the backend be the single source of truth: while active,
  // the backend keeps sliding so requests succeed; once idle past 3h the backend token expires and the
  // next request 401s, which the response interceptor below turns into a clean logout (via the
  // get-user-profile revalidation path). So the 3h-idle behaviour is preserved, without the early
  // mid-use logout.
  expires: 7, // days (storage only; backend SessionToken 3h-idle is the actual timeout)
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict" as const,
  path: "/",
};

// Activity slide: on activity we re-write the auth_token cookie so its 7d storage window keeps
// refreshing for as long as the user keeps using the app (the actual session timeout is the
// backend's sliding 3h-idle window — see COOKIE_OPTIONS). Throttled to once per 5 min so we are
// not re-writing the cookie on every single request.
let lastCookieBumpAt = 0;
const COOKIE_BUMP_THROTTLE_MS = 5 * 60 * 1000;

// Return-to-page after a session-timeout re-login (owner 2026-06-15). When the session is lost we
// stash the page the user was on so the login flow can send them right back — covering surfaces that
// navigate to /login (admin/organizer guards, bare pushes) as well as the in-place AuthModal. The
// /login page (LoginForm) reads + clears it; the AuthModal clears it on a successful in-place login
// (no navigation needed there). Skipped for auth pages so we never bounce back to /login itself.
export const POST_LOGIN_REDIRECT_KEY = "afc_post_login_redirect";
function stashPostLoginRedirect() {
  try {
    const path = window.location.pathname + window.location.search;
    if (
      /^\/(login|register|forgot-password|reset-password|verify|email-confirmation)/.test(
        path,
      )
    )
      return;
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
  } catch {}
}

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
        // Activity cookie slide: any successful API call counts as activity, so refresh the
        // auth_token cookie's 7d storage window (throttled). The real 3h-idle timeout lives on the
        // backend (SessionToken slides on every authed request); once idle past 3h the backend
        // token expires and the next request 401s -> clean logout via the handler below.
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
            // Stash the current page first so surfaces WITHOUT the in-place modal
            // (admin/organizer) still return here after re-login.
            stashPostLoginRedirect();
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

    // i18n: send the active locale as Accept-Language on EVERY axios request, so the backend
    // (LocaleMiddleware) can localize user-generated content (news/events/notifications) and
    // action-triggered emails to the user's language. Locale = the NEXT_LOCALE cookie written by
    // the profile language selector / Phase 0; absent -> backend defaults to English.
    // Belt-and-suspenders: set it as an axios DEFAULT header (covers any request, even ones made
    // before this effect runs) AND via a request interceptor (picks up a mid-session language
    // change). Use AxiosHeaders.set when present (axios v1) since bracket-assign can be ignored.
    try {
      const loc0 = Cookies.get("NEXT_LOCALE");
      if (loc0) axios.defaults.headers.common["Accept-Language"] = loc0;
    } catch {
      /* ignore */
    }
    const localeInterceptor = axios.interceptors.request.use((config) => {
      try {
        const loc = Cookies.get("NEXT_LOCALE");
        if (loc) {
          const h: any = config.headers;
          if (h && typeof h.set === "function") h.set("Accept-Language", loc);
          else config.headers = { ...(config.headers as any), "Accept-Language": loc };
        }
      } catch {
        // never block a request over cookie access
      }
      return config;
    });

    return () => {
      axios.interceptors.response.eject(interceptor);
      axios.interceptors.request.eject(localeInterceptor);
    };
  }, [token]);

  // Resilient profile fetch. Logs the user out ONLY on a genuine auth failure (401). Any TRANSIENT
  // failure (network, timeout, 5xx - e.g. a backend worker momentarily stalled) is retried with
  // backoff and, if it still fails, leaves the session INTACT (token kept) instead of logging the
  // user out. (owner 2026-06-20: "open a page and it randomly logs me out" - a transient
  // get-user-profile failure was destroying a perfectly valid, freshly-logged-in session.)
  const fetchUser = async (token: string, attempt = 0): Promise<User> => {
    try {
      const res = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-user-profile/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Fail fast if a worker is stalled so a retry can recover, instead of hanging.
          timeout: 15000,
        },
      );

      // axios already rejects non-2xx, so reaching here means a 2xx response. Do NOT gate on
      // res.statusText - it is empty ("") on HTTP/2, which made a valid 200 throw -> logout.
      const dbUser = res.data;

      const mappedUser: User = {
        id: dbUser.user_id.toString(),
        user_id: dbUser.user_id,
        full_name: dbUser.full_name,
        country: dbUser.country,
        in_game_name: dbUser.in_game_name,
        uid: dbUser.uid,
        // IDENTITY LOCK: disables the IGN/UID inputs on the profile-edit form while the player is
        // in a live event (server also enforces it in edit_profile). Defaults false when omitted.
        identity_locked: dbUser.identity_locked ?? false,
        team: dbUser.team,
        team_without_logo: dbUser.team_without_logo ?? null,
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
        has_completed_onboarding: dbUser.has_completed_onboarding ?? false,
        // Dismissed one-time dashboard intros (see the User interface note). Default {} so a
        // missing field reads as "nothing dismissed yet" - the coachmark gates on access TOO,
        // so a user with no dashboards still sees nothing.
        seen_dashboard_intros: dbUser.seen_dashboard_intros ?? {},
        // i18n Phase 0 preferred language (see the User interface note). The backend coalesces this
        // to "en" everywhere, but we default to "en" here too so an absent field never leaves the
        // language undefined for the profile edit selector / read-only display.
        language: dbUser.language ?? "en",
        // stats_visible: whether other users can see this player's stats (see User interface note).
        // Defaults false (private) so a missing field from an older payload never accidentally
        // exposes stats that the user did not explicitly opt in to sharing.
        stats_visible: dbUser.stats_visible ?? false,
        stats: dbUser.stats,
      };

      setUser(mappedUser);
      return mappedUser;
    } catch (err: any) {
      const status = err?.response?.status;

      // Genuine auth failure: the token is invalid/expired -> clear the session.
      if (status === 401) {
        logout();
        throw err;
      }

      // TRANSIENT failure (no response = network/timeout, or a 5xx). DO NOT destroy a valid
      // session. Retry a couple times with backoff; the backend usually recovers (e.g. once a
      // stalled worker frees up). If it still fails, KEEP the token so a reload logs the user
      // straight back in - no forced re-login on a server hiccup.
      const isTransient = status === undefined || status >= 500;
      if (isTransient && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        return await fetchUser(token, attempt + 1);
      }

      toast.error(
        isTransient
          ? "Couldn't reach the server. Your session is kept; please retry."
          : err.response?.data?.message || "Internal server error",
      );
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
    // Stash the current page so re-login returns here (see stashPostLoginRedirect).
    stashPostLoginRedirect();
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
