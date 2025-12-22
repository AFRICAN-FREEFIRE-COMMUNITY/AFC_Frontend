"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconUpload } from "@tabler/icons-react";
import { useState } from "react";

export function ImageUploadStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [method, setMethod] = useState("all");

  return (
    <Card className="bg-[#09090b] border-zinc-800">
      <CardContent className="p-6 space-y-6">
        <h2 className="text-xl font-semibold">Upload Match Result Images</h2>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMethod("all")}
            className={`p-4 text-left border rounded-lg transition ${
              method === "all"
                ? "bg-white text-black"
                : "border-zinc-800 text-white hover:bg-zinc-900"
            }`}
          >
            <p className="font-bold">Upload All Results</p>
            <p className="text-xs opacity-70">Upload all map results at once</p>
          </button>
          <button
            onClick={() => setMethod("map")}
            className={`p-4 text-left border rounded-lg transition ${
              method === "map"
                ? "bg-white text-black"
                : "border-zinc-800 text-white hover:bg-zinc-900"
            }`}
          >
            <p className="font-bold">Upload Per Map</p>
            <p className="text-xs opacity-70">
              Upload results for each map individually
            </p>
          </button>
        </div>

        <div className="border-2 border-dashed border-zinc-800 rounded-xl p-12 flex flex-col items-center justify-center space-y-4">
          <IconUpload className="size-10 text-zinc-500" />
          <p className="text-sm">
            Drag and drop files here, or click to browse
          </p>
          <Button variant="outline">Choose Files</Button>
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button disabled onClick={onNext}>
            Next: Configure Point System
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
