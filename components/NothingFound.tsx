import React from "react";

export const NothingFound = ({ text }: { text: string }) => {
  return (
    <div className="text-center py-14 text-muted-foreground italic rounded-lg bg-muted/30">
      {text}
    </div>
  );
};
