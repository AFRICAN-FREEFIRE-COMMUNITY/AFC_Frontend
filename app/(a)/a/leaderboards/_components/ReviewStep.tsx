import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

export function ReviewStep() {
  const [tab, setTab] = useState<"leaderboard" | "stats">("leaderboard");

  return (
    <div className="space-y-6">
      <Card className="bg-[#09090b] border-zinc-800 text-white">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Review Extracted Metrics</h2>
            <p className="text-sm text-zinc-400">
              Review the metrics extracted from your file
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-1 bg-zinc-900 rounded-md">
            <button
              onClick={() => setTab("leaderboard")}
              className={`flex-1 py-2 text-sm font-medium rounded ${
                tab === "leaderboard"
                  ? "bg-zinc-800 text-white shadow"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => setTab("stats")}
              className={`flex-1 py-2 text-sm font-medium rounded ${
                tab === "stats"
                  ? "bg-zinc-800 text-white shadow"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Player Stats
            </button>
          </div>

          <div className="space-y-4">
            {tab === "leaderboard" ? (
              <div className="grid grid-cols-2 gap-8">
                <LeaderboardTable
                  title="Team Leaderboard"
                  columns={["Rank", "Team", "Points"]}
                />
                <LeaderboardTable
                  title="Player Leaderboard"
                  columns={["Rank", "Player", "Points"]}
                />
              </div>
            ) : (
              <LeaderboardTable
                title="Individual Player Statistics"
                columns={["Player", "Team", "Kills"]}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button variant="secondary" className="bg-zinc-900 border-zinc-800">
          Back
        </Button>
        <Button variant="secondary" className="bg-zinc-900 border-zinc-800">
          Save to Drafts
        </Button>
        <Button className="bg-white text-black font-bold px-8 hover:bg-zinc-200">
          Publish Leaderboard
        </Button>
      </div>
    </div>
  );
}

const LeaderboardTable = ({
  title,
  columns,
}: {
  title: string;
  columns: string[];
}) => (
  <div className="space-y-4">
    <h3 className="font-bold text-zinc-200">{title}</h3>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-zinc-500 border-b border-zinc-800 text-left">
          {columns.map((col) => (
            <th key={col} className="pb-2 font-medium">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-900">
        <tr className="text-zinc-300">
          <td className="py-3">#1</td>
          <td>Team Alpha</td>
          <td className="text-right">250.5</td>
        </tr>
      </tbody>
    </table>
  </div>
);
