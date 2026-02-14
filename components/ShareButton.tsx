"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import {
  Twitter,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Share2,
  Youtube,
  MessageCircle, // For WhatsApp
  Facebook,
  Send, // For Telegram
} from "lucide-react";
import { IconBrandTelegram, IconBrandWhatsapp } from "@tabler/icons-react";
import { motion } from "motion/react";
import { toast } from "sonner";

type SocialHandles = {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  whatsapp?: string;
  telegram?: string;
  youtube?: string;
  website?: string;
};

type ShareButtonProps = {
  handles?: SocialHandles;
  url?: string; // The current profile URL to share
  profileName?: string; // The profile name to mention in shares
  platformName?: string; // Your platform name (e.g., "MyApp", "Portfolio")
  text?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function ShareButton({
  className,
  handles = {},
  url,
  profileName = "this profile",
  platformName = "grabcash",
  text = "",
  ...props
}: ShareButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [buttonDimensions, setButtonDimensions] = useState({
    width: 0,
    height: 0,
  });
  const buttonRef = useRef<HTMLDivElement>(null);

  // Define all social platforms with their share URLs and templates
  const socialPlatforms = [
    {
      icon: Twitter,
      label: "Share on Twitter",
      key: "twitter" as keyof SocialHandles,
      hasDirectSharing: true,
      getShareUrl: (
        profileUrl: string,
        profileName: string,
        platformName: string,
      ) => {
        const text = `Check out ${profileName}'s profile on ${platformName}`;
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
      },
    },
    {
      icon: IconBrandWhatsapp,
      label: "Share on WhatsApp",
      key: "whatsapp" as keyof SocialHandles,
      hasDirectSharing: true,
      getShareUrl: (
        profileUrl: string,
        profileName: string,
        platformName: string,
      ) => {
        const text = `Check out ${profileName}'s profile on ${platformName}: ${profileUrl}`;
        // Use web.whatsapp.com for desktop, whatsapp:// for mobile
        const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          );
        if (isMobile) {
          return `whatsapp://send?text=${encodeURIComponent(text)}`;
        } else {
          return `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        }
      },
    },
    {
      icon: IconBrandTelegram,
      label: "Share on Telegram",
      key: "telegram" as keyof SocialHandles,
      hasDirectSharing: true,
      getShareUrl: (
        profileUrl: string,
        profileName: string,
        platformName: string,
      ) => {
        const text = `Check out ${profileName}'s profile on ${platformName}`;
        return `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(text)}`;
      },
    },
  ];

  // Get the current profile URL to share
  const currentProfileUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");

  // Build share buttons - always show all platforms for sharing
  const shareButtons: Array<{
    icon: any;
    label: string;
    url: string;
    disabled: boolean;
    type: ButtonType;
    action: "share" | "copy";
  }> = socialPlatforms.map((platform) => ({
    icon: platform.icon,
    label: platform.label,
    url: platform.getShareUrl(currentProfileUrl, profileName, platformName),
    disabled: false,
    type: "social" as ButtonType,
    action: platform.hasDirectSharing ? "share" : "copy",
  }));

  // Always add copy to clipboard as the last button
  shareButtons.push({
    icon: LinkIcon,
    label: "Copy profile link",
    url: currentProfileUrl,
    disabled: false,
    type: "copy" as ButtonType,
    action: "copy",
  });

  useEffect(() => {
    if (buttonRef.current) {
      const { offsetWidth, offsetHeight } = buttonRef.current;
      setButtonDimensions({ width: offsetWidth, height: offsetHeight });
    }
  }, []);

  // Define the button type
  type ButtonType = "social" | "copy";

  const handleShare = (button: (typeof shareButtons)[0], index: number) => {
    setActiveIndex(index);

    if (button.action === "copy") {
      // Copy to clipboard
      navigator.clipboard
        .writeText(button.url)
        .then(() => {
          toast.success(`Link copied to clipboard.`);
        })
        .catch((err) => {
          toast.error(`Failed to copy link.`);
        });
    } else {
      // Open share dialog for platforms that support it
      if (button.action === "share") {
        // Special handling for WhatsApp mobile vs desktop
        if (button.url.startsWith("whatsapp://")) {
          // Mobile WhatsApp - open directly
          window.location.href = button.url;
        } else {
          // Other platforms - open in popup
          window.open(button.url, "_blank", "width=600,height=400");
        }
      } else {
        // For platforms without direct sharing, copy the link
        navigator.clipboard.writeText(button.url).then(() => {
          toast.success(`Link copied to clipboard.`);
        });
      }
    }

    setTimeout(() => setActiveIndex(null), 300);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <motion.div
        ref={buttonRef}
        animate={{ opacity: isVisible ? 0 : 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <Button className={cn(className)} {...props}>
          <span className="flex items-center gap-2">
            <Share2 />
            {text}
          </span>
        </Button>
      </motion.div>

      <motion.div
        className="absolute top-0 -left-2 flex overflow-hidden z-50"
        style={{ height: buttonDimensions.height }}
        animate={{ width: isVisible ? "auto" : 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        {shareButtons.map((button, i) => (
          <motion.button
            type="button"
            key={`share-${i}`}
            aria-label={button.label}
            onClick={() => handleShare(button, i)}
            disabled={button.disabled}
            className={cn(
              "flex h-12 px-6 py-2 items-center justify-center z-50",
              "bg-muted dark:bg-muted dark:hover:bg-muted/20 dark:hover:text-primary",
              "text-black dark:text-white",
              i === 0 && "rounded-l-md",
              i === shareButtons.length - 1 && "rounded-r-md",
              "border-r border-white/10 dark:border-black/10 last:border-r-0 z-50",
              "outline-none relative overflow-hidden transition-colors duration-200 z-50",
              // Conditional styles based on disabled state
              button.disabled
                ? " cursor-not-allowed"
                : "hover:bg-primary hover:text-white cursor-pointer z-50",
            )}
            style={{
              width: buttonDimensions.height,
              height: buttonDimensions.height,
            }}
            animate={{
              opacity: isVisible ? (button.disabled ? 0.4 : 1) : 0,
              x: isVisible ? 0 : -20,
            }}
            transition={{
              duration: 0.3,
              ease: [0.23, 1, 0.32, 1],
              delay: isVisible ? i * 0.05 : 0,
            }}
          >
            <motion.div
              className="relative z-10"
              animate={{
                scale: activeIndex === i && !button.disabled ? 0.85 : 1,
              }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <button.icon className="w-4 h-4" />
            </motion.div>
            {/* Only show the click effect if not disabled */}
            {!button.disabled && (
              <motion.div
                className="absolute inset-0 bg-white dark:bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: activeIndex === i ? 0.15 : 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              />
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
