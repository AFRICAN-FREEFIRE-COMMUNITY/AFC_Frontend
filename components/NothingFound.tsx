import React from "react";

export const NothingFound = ({ text }: { text: string }) => {
  return (
    <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
      {text}
    </div>
  );
};
