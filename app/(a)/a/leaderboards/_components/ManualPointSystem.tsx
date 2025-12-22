"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX } from "@tabler/icons-react";

export function ManualPointSystem({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [ranks, setRanks] = useState([
    { id: 1, val: "15" },
    { id: 2, val: "12" },
    { id: 3, val: "10" },
    { id: 4, val: "8" },
    { id: 5, val: "6" },
  ]);

  const addRank = () => setRanks([...ranks, { id: Date.now(), val: "0" }]);
  const removeRank = (id: number) => setRanks(ranks.filter((r) => r.id !== id));

  return (
    <Card className="bg-[#09090b] border-zinc-800 text-white">
      <CardContent className="p-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Configure Point System</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={addRank}
            className="gap-2"
          >
            <IconPlus size={14} /> Add Rank
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {ranks.map((r, i) => (
            <div
              key={r.id}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg relative"
            >
              <div className="flex justify-between text-[10px] text-zinc-500 uppercase mb-1">
                <span>Rank {i + 1}</span>
                {i > 4 && (
                  <button onClick={() => removeRank(r.id)}>
                    <IconX size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <Input
                  defaultValue={r.val}
                  className="bg-transparent border-none p-0 h-auto text-xl font-bold"
                />
                <span className="text-[10px] text-zinc-500 uppercase">pts</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-500 uppercase">
            Performance Metrics
          </h3>
          {["Kills", "Assists", "Damage"].map((m) => (
            <div
              key={m}
              className="flex justify-between items-center p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg"
            >
              <span className="font-bold text-sm">{m}</span>
              <Input
                className="w-20 bg-black border-zinc-800 text-right"
                defaultValue="1"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-6 border-t border-zinc-800">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext} className="bg-white text-black font-bold">
            Next: Generate Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
