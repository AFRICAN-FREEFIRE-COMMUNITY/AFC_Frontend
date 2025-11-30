import React, { ReactNode } from "react";
import { PageGradient } from "@/components/PageGradient";

const layout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <PageGradient />
      {children}
    </>
  );
};

export default layout;
