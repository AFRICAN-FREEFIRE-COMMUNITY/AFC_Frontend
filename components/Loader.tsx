import { Loader2 } from "lucide-react";
import React from "react";

export const Loader = ({ text = "Loading..." }: { text?: string }) => {
  return (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className="size-4 animate-spin" />
      <span>{text}</span>
    </div>
  );
};

export const FullLoader = ({ text = "" }: { text?: string }) => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading {text}...</p>
      </div>
    </div>
  );
};
