import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconUsers, IconPhoto, IconUpload } from "@tabler/icons-react";
import { Method } from "../create/page";

interface Props {
  onSelect: (method: Method) => void;
}

export const SelectionMethodStep = ({ onSelect }: Props) => {
  const methods = [
    {
      id: "manual" as Method,
      name: "Manual Creation",
      icon: IconUsers,
      small: "Manually input placement and kills for each player",
      long: "Directly enter match data for teams and players. You'll input placement, kills, assists, and damage for each map, and the system will generate the leaderboard automatically.",
    },
    {
      id: "image" as Method,
      name: "Image Upload",
      icon: IconPhoto,
      small: "Upload match result screenshots",
      long: "Upload screenshots or images of match results from games. The system will parse the image data to generate the leaderboard automatically.",
      disabled: true,
    },
    {
      id: "file" as Method,
      name: "3D Room File Upload",
      icon: IconUpload,
      small: "Upload .txt and debugger files",
      long: "Upload specific .txt format and debugger files from the 3D game environment to automatically extract match data and generate leaderboards.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
      {methods.map((m) => (
        <Card key={m.id} className="bg-dark flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <m.icon className="size-5" /> {m.name}
            </CardTitle>
            <CardDescription className="text-zinc-4 00 text-xs">
              {m.small}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-4">
            <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
              {m.long}
            </p>
            <Button
              disabled={m.disabled}
              className="w-full"
              onClick={() => onSelect(m.id)}
            >
              Select Method
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
