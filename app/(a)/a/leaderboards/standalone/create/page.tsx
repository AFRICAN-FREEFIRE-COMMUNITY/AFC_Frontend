"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Leaderboard — Create wizard (4 steps)
// ----------------------------------------------------------------------------
// The admin/organizer flow for building an event-LESS leaderboard: name + scoring,
// add real-or-ghost participants, enter per-map results, review + publish. It is the
// frontend counterpart to the afc_leaderboard backend app (prefix /leaderboards/standalone/).
//
// Step ownership (each child does its own API calls; this page only holds the shared
// state threaded between them — see lib/standaloneLeaderboards.ts for the client):
//   1. BasicsStep        -> create draft         (POST /create/)            -> sets leaderboardId
//   2. ParticipantsStep  -> add/remove           (.../participants/)        -> fills `participants`
//   3. ResultsStep       -> add maps + results   (.../matches/, .../results/) -> fills `matches`
//   4. ReviewStep        -> detail + publish      (GET /<id>/, PATCH /edit/)  -> routes to view page
//
// ROUTE: /a/leaderboards/standalone/create. Reached from the "Create standalone" button on the admin
// Leaderboards surface (LeaderboardsAdminContent) and the organizer Leaderboards page. NOTE: the
// /a/leaderboards exact-path redirect (next.config) does NOT touch this nested route.
//
// Design: AFC constants — DM Sans, green page title via PageHeader, pill/segment step indicator,
// rounded-md cards. No em/en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { BasicsStep } from "./_components/BasicsStep";
import { ParticipantsStep } from "./_components/ParticipantsStep";
import { ResultsStep } from "./_components/ResultsStep";
import { ReviewStep } from "./_components/ReviewStep";
import type {
  StandaloneLeaderboardHeader,
  StandaloneMatch,
  StandaloneParticipant,
  OcrApplyResponse,
} from "@/lib/standaloneLeaderboards";

const STEP_LABELS = ["Basics", "Participants", "Results", "Review"];

export default function CreateStandaloneLeaderboardPage() {
  const router = useRouter();

  // 1-based step index. Step 1 is always reachable; steps 2-4 unlock once the draft exists.
  const [step, setStep] = useState(1);

  // Shared state threaded between steps (the created header + its participants + maps).
  const [leaderboard, setLeaderboard] =
    useState<StandaloneLeaderboardHeader | null>(null);
  const [participants, setParticipants] = useState<StandaloneParticipant[]>([]);
  const [matches, setMatches] = useState<StandaloneMatch[]>([]);

  // Step 1 done -> store the created leaderboard and advance.
  const handleCreated = (lb: StandaloneLeaderboardHeader) => {
    setLeaderboard(lb);
    setStep(2);
  };

  // OCR shortcut (Stream P2): the Participants step's screenshot dialog applied a screenshot, so the
  // backend already created a map + the participants + the results in one call. Merge the returned
  // participants into the shared list (dedupe by id), carry the created match into `matches`, and
  // jump straight to the Results step so the admin lands on the pre-filled map. Consumes
  // OcrApplyResponse from standaloneLeaderboardsApi.ocrApply (via OcrUploadDialog -> ParticipantsStep).
  const handleOcrApplied = (result: OcrApplyResponse) => {
    setParticipants((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const p of result.participants ?? []) {
        if (!seen.has(p.id)) {
          merged.push(p);
          seen.add(p.id);
        }
      }
      return merged;
    });
    setMatches((prev) =>
      prev.some((m) => m.id === result.match.id) ? prev : [...prev, result.match],
    );
    setStep(3);
  };

  // Step 4 publish done -> jump to the view page.
  const handlePublished = () => {
    if (leaderboard) router.push(`/a/leaderboards/standalone/${leaderboard.id}`);
  };

  return (
    <div className="min-h-screen space-y-6">
      <PageHeader
        back
        title="Create standalone leaderboard"
        description={`Step ${step} of 4: ${STEP_LABELS[step - 1]}`}
      />

      {/* Step indicator — shadcn pill/segment style (bg-muted track, active pill = bg-background). */}
      <div className="inline-flex w-full max-w-xl items-center gap-1 rounded-md bg-muted p-1">
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1;
          const active = step === idx;
          const done = step > idx;
          return (
            <div
              key={label}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : done
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/20 text-primary"
                      : "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {idx}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2">
        {step === 1 && <BasicsStep onCreated={handleCreated} />}

        {step === 2 && leaderboard && (
          <ParticipantsStep
            leaderboardId={leaderboard.id}
            format={leaderboard.format}
            participants={participants}
            onParticipantsChange={setParticipants}
            onOcrApplied={handleOcrApplied}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && leaderboard && (
          <ResultsStep
            leaderboardId={leaderboard.id}
            participants={participants}
            matches={matches}
            onMatchesChange={setMatches}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && leaderboard && (
          <ReviewStep
            leaderboardId={leaderboard.id}
            onBack={() => setStep(3)}
            onPublished={handlePublished}
          />
        )}
      </div>
    </div>
  );
}
