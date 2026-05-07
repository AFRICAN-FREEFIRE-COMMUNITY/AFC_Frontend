import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FxSnapshot } from "./mock-wager/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Call this after a failed fetch response instead of toast.error().
 * If the message indicates an expired/invalid session it opens the AuthModal
 * (via the auth:session-expired event) and returns true so you can skip the
 * toast. Otherwise it returns false so you can show a regular toast.
 *
 * Usage:
 *   if (!res.ok) {
 *     const data = await res.json();
 *     if (isSessionExpiredError(data.message || data.detail)) return;
 *     toast.error(data.message || "Something went wrong");
 *   }
 */
export function isSessionExpiredError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const isExpired =
    (lower.includes("session") && lower.includes("token")) ||
    (lower.includes("invalid") && lower.includes("token")) ||
    (lower.includes("expired") && lower.includes("token"));
  if (isExpired && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:session-expired"));
  }
  return isExpired;
}

export const formatMoneyInput = (inputValue: string | number | any) => {
  if (inputValue == null) return "";

  let value = String(inputValue);

  // Allow spaces in text — don't format unless it's a pure number
  const numericOnly = value.replace(/,/g, ""); // remove commas to check

  if (!/^\d+(\.\d+)?$/.test(numericOnly)) {
    // Not a number → return raw text
    return value;
  }

  // Split whole and decimal
  let [whole, decimal] = numericOnly.split(".");

  // Add commas to whole number
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimal !== undefined ? `${whole}.${decimal}` : whole;
};

export function formatDate(
  dateString: string | Date,
  withTime: boolean = false,
): string {
  const date = new Date(dateString);

  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();

  const getOrdinalSuffix = (num: number): string => {
    const modulo100 = num % 100;
    const modulo10 = num % 10;

    if (modulo100 >= 11 && modulo100 <= 13) return `${num}th`;
    if (modulo10 === 1) return `${num}st`;
    if (modulo10 === 2) return `${num}nd`;
    if (modulo10 === 3) return `${num}rd`;
    return `${num}th`;
  };

  const datePart = `${month} ${getOrdinalSuffix(day)}, ${year}`;

  if (!withTime) return datePart;

  const timePart = date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} • ${timePart}`;
}

export const formatWord = (role: string) => {
  if (!role) return "";
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Helper function to extract social media URLs from array
export const extractSocialMediaUrls = (socialMediaArray: any) => {
  const socialUrls: any = {
    facebook_url: "",
    twitter_url: "",
    instagram_url: "",
    youtube_url: "",
    twitch_url: "",
  };

  if (socialMediaArray && Array.isArray(socialMediaArray)) {
    socialMediaArray.forEach((social) => {
      if (social.platform && social.link) {
        const platformKey = `${social.platform.toLowerCase()}_url`;
        if (platformKey in socialUrls) {
          socialUrls[platformKey] = social.link;
        }
      }
    });
  }

  return socialUrls;
};

export const formattedWord: Record<string, string> = {
  "br - normal": "Battle Royale - Normal",
  "br - roundrobin": "Battle Royale - Knockout",
  "br - point rush": "Battle Royale - Point Rush",
  "br - champion rush": "Battle Royale - Champion Rush",
  "cs - normal": "Clash Squad - Normal",
  "cs - league": "Clash Squad - League",
  "cs - knockout": "Clash Squad - Knockout",
  "cs - double elimination": "Clash Squad - Double Elimination",
  "cs - round robin": "Clash Squad - Round Robin",
  battle_royale: "Battle Royale",
  clash_squad: "Clash Squad",
  tier_2: "Tier 2",
  tier_1: "Tier 1",
  tier_3: "Tier 3",
  tier_4: "Tier 4",
  allow_only: "Allow Only",
  block_selected: "Block Selected",
};

export function calculateDaysDifference(
  dateStr1: string,
  dateStr2?: string | any,
): number {
  const date1 = new Date(dateStr1);
  const date2: any = date1 ? new Date(dateStr2) : new Date(); // <-- Error occurs here

  // Set time to noon to avoid daylight saving/timezone issues in calculation
  date1.setHours(12, 0, 0, 0);
  date2.setHours(12, 0, 0, 0);

  // Calculate the difference in milliseconds
  const diffTime = date1.getTime() - date2.getTime();

  // Convert milliseconds difference to days and round up (ceil)
  // Math.ceil ensures that even if there is less than a full day remaining,
  // it is still counted as 1 day left if the time is in the future.
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(
  amount_kobo: number,
  fx: FxSnapshot,
): { coins: string; naira: string; usd: string } {
  if (
    !Number.isFinite(amount_kobo) ||
    !Number.isFinite(fx.ngn_per_usd) ||
    fx.ngn_per_usd <= 0
  ) {
    return { coins: "—", naira: "—", usd: "—" };
  }
  const sign = amount_kobo < 0 ? "-" : "";
  const abs = Math.abs(amount_kobo);
  const coins = abs / 50_000;
  const naira = abs / 100;
  const usd = naira / fx.ngn_per_usd;

  return {
    coins: `${sign}${moneyFormatter.format(coins)}`,
    naira: `${sign}₦${moneyFormatter.format(naira)}`,
    usd: `${sign}$${moneyFormatter.format(usd)}`,
  };
}

export const KOBO_PER_COIN = 50_000;
export const COIN_NGN = 500;
export const MIN_DEPOSIT_KOBO = 50_000; // ₦500 = 1 coin
export const MIN_WAGER_KOBO = 10_000; // ₦100 = 0.2 coins
export const MIN_WITHDRAW_KOBO = 250_000; // ₦2,500
export const HOUSE_USER_ID = "house";
export const RAKE_BPS = 500; // 5%
export const CANCEL_FEE_BPS = 100; // 1%
export const P2P_FEE_BPS = 100; // 1%
export const P2P_DAILY_CAP_KOBO = 2_500_000_000; // ₦25M
export const GIFT_DAILY_CAP_KOBO = 10_000_000; // ₦100,000
