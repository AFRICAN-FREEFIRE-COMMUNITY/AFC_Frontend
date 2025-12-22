"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

export function BasicInfoStep({ onNext, onBack, updateData }: any) {
  const { token } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [leaderboardName, setLeaderboardName] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events);
        setLoadingEvents(false);
      });
  }, []);

  const handleEventChange = async (eventId: string) => {
    setSelectedEventId(eventId);
    setLoadingDetails(true);
    const event = events.find((e) => e.event_id.toString() === eventId);
    if (event) setLeaderboardName(event.event_name);

    const res = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ event_id: eventId }),
      }
    );
    const data = await res.json();
    setStages(data.stages || []);
    setLoadingDetails(false);
  };

  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    const stage = stages.find((s) => s.stage_id.toString() === stageId);
    setGroups(stage?.groups || []);
  };

  const handleContinue = () => {
    updateData({
      event_id: selectedEventId,
      stage_id: selectedStageId,
      group_id: selectedGroupId,
    });
    onNext();
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Leaderboard Details</CardTitle>
        <CardDescription>
          Specify the event scope for this leaderboard
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Event</Label>
            <Select onValueChange={handleEventChange}>
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingEvents ? "Loading..." : "Select Event"}
                />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.event_id} value={e.event_id.toString()}>
                    {e.event_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leaderboard Name</Label>
              <Input
                value={leaderboardName}
                onChange={(e) => setLeaderboardName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                onValueChange={handleStageChange}
                disabled={!selectedEventId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingDetails ? "Fetching..." : "Select Stage"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.stage_id} value={s.stage_id.toString()}>
                      {s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Group</Label>
            <Select
              onValueChange={setSelectedGroupId}
              disabled={!selectedStageId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.group_id} value={g.group_id.toString()}>
                    {g.group_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={!selectedGroupId}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
