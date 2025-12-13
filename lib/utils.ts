import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function formatDate(dateString: string | any): string {
  const date = new Date(dateString);

  // Get the day, month and year
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();

  // Function to get the ordinal suffix
  const getOrdinalSuffix = (num: number): string => {
    const suffixes = ["th", "st", "nd", "rd"];
    const modulo100 = num % 100;
    const modulo10 = num % 10;
    const suffix =
      modulo10 <= 3 && modulo10 > 0 && modulo100 !== 11
        ? suffixes[modulo10]
        : suffixes[0];
    return `${num}${suffix}`;
  };

  // Format the date
  return `${month} ${getOrdinalSuffix(day)}, ${year}`;
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
};

export function calculateDaysDifference(
  dateStr1: string,
  dateStr2?: string
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
