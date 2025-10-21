import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
      if (social.platform && social.url) {
        const platformKey = `${social.platform}_url`;
        if (platformKey in socialUrls) {
          socialUrls[platformKey] = social.url;
        }
      }
    });
  }

  return socialUrls;
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
