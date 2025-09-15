"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import React, { ReactNode } from "react";

const layout = ({ children }: { children: ReactNode }) => {
  return <div>{children}</div>;
};

export default layout;
