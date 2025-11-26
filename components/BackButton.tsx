"use client";
import React from "react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

export const BackButton = () => {
  const router = useRouter();
  return (
    <Button variant="outline" onClick={() => router.back()} className="mb-4">
      Back
    </Button>
  );
};
