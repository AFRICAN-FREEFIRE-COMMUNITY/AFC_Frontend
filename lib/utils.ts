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
