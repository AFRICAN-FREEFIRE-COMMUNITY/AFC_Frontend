"use client";

import { description } from "@/components/chart-area-interactive";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconPhoto, IconUpload, IconUsers } from "@tabler/icons-react";

const page = () => {
  const methods = [
    {
      name: "Manual Creation",
      icon: IconUsers,
      smallDescription: "Manually input placement and kills for each player",
      step: 1,
      longDescription: `Directly enter match data for teams and players. You'll input placement, kills, assists, and damage for each map, and the system will generate the leaderboard automatically.`,
      link: "/a/leaderboards/create/manual",
    },
    {
      name: "Image Upload",
      icon: IconPhoto, // You might want a different icon for CSV import
      smallDescription: "Upload match result screenshot",
      step: 2,
      longDescription: `Upload screenshots or images of match results from games. The system will parse the image data to generate the leaderboard automatically.`,
      link: "/a/leaderboards/create/image",
    },
    {
      name: "3D Room File Upload",
      icon: IconUpload, // You might want a different icon for API
      smallDescription: "Upload .txt and debugger files",
      step: 3,
      longDescription: `Upload specific .txt format and debugger files from the 3D game environment to automatically extract match data and generate leaderboards.`,
      link: "/a/leaderboards/create/api",
    },
  ];
  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Create Leaderboard"
        description={"Step 1: Select Creation Method"}
      />
      <div className="grid grid-cols-2 2xl:grid-cols-3 gap-2">
        {methods.map((method, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-start gap-2">
                <method.icon className="size-4" />
                {method.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {method.smallDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{method.longDescription}</p>
              <Button className="w-full mt-4">Select method</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default page;
