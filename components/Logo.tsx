import Image from "next/image";

export function Logo({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "small" | "default" | "large";
}) {
  const sizes = {
    small: { width: 40, height: 40 },
    default: { width: 60, height: 60 },
    large: { width: 120, height: 120 },
  };

  // Fix: Add fallback for undefined size
  const sizeConfig = sizes[size] || sizes.default;
  const { width, height } = sizeConfig;

  return (
    <Image
      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/AFC_MAIN_LOGO-removebg-preview-z5q5kSWWMvWdeY4Gf5PeFGS35QBGfV.png"
      alt="AFC Logo"
      width={width}
      height={height}
      className={`object-contain ${className}`}
      priority
    />
  );
}
