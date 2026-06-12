"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StandaloneCreateWizard - the reusable 4-step create wizard body.
// ----------------------------------------------------------------------------
// This is the wizard previously inlined in create/page.tsx, lifted into a shared
// client component so BOTH surfaces can mount the exact same flow:
//   • admin     -> app/(a)/a/leaderboards/standalone/create/page.tsx        (default basePath)
//   • organizer -> app/(organizer)/organizer/leaderboards/standalone/create/page.tsx
// Cross-route-group import is fine in Next.js, so the organizer page imports this
// admin-owned component rather than duplicating the wizard logic.
//
// The ONLY thing that differs between the two surfaces is where we route AFTER
// publish: admins land on /a/leaderboards/standalone/<id>, organizers on
// /organizer/leaderboards/standalone/<id>. That is fully captured by `basePath`
// (default = the admin path), so the admin experience is byte-for-byte unchanged.
//
// Step ownership (each child does its own API calls; this component only holds the
// shared state threaded between them - see lib/standaloneLeaderboards.ts for the client):
//   1. BasicsStep        -> create draft         (POST /create/)            -> sets leaderboardId
//   2. ParticipantsStep  -> add/remove           (.../participants/)        -> fills `participants`
//   3. ResultsStep       -> add maps + results   (.../matches/, .../results/) -> fills `matches`
//   4. ReviewStep        -> detail + publish      (GET /<id>/, PATCH /edit/)  -> routes to view page
//
// Design: AFC constants - DM Sans, green page title via PageHeader, pill/segment step
// indicator, rounded-md cards. No em or en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { BasicsStep } from "./BasicsStep";
import { ParticipantsStep } from "./ParticipantsStep";
import { ResultsStep } from "./ResultsStep";
import { ReviewStep } from "./ReviewStep";
import type {
  StandaloneLeaderboardHeader,
  StandaloneMatch,
  StandaloneParticipant,
  OcrApplyResponse,
} from "@/lib/standaloneLeaderboards";

const STEP_LABELS = ["Basics", "Participants", "Results", "Review"];

// Default = the admin route base. The organizer page passes its own base so the
// post-publish redirect lands inside the organizer portal (which the organizer can reach).
const DEFAULT_BASE_PATH = "/a/leaderboards/standalone";

export function StandaloneCreateWizard({
  basePath = DEFAULT_BASE_PATH,
  organizationId,
}: {
  // Route prefix the wizard redirects to after publish (admin default vs organizer value).
  basePath?: string;
  // Owning org for the new leaderboard, threaded to BasicsStep's create payload.
  // The organizer page passes its selected org's id (the backend REQUIRES it for
  // organizers in _resolve_organization_for_create); the admin page omits it
  // (undefined = AFC-native leaderboard).
  organizationId?: number | null;
}) {
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

  // OCR shortcut (Phase 2.6): the Participants step's batch dialog applied ONE map, so the backend
  // already created that map + its participants + results in one call. Merge the returned participants
  // into the shared list (dedupe by id) and carry the created match into `matches`. We deliberately do
  // NOT change the step here: OcrBatchDialog stays open so the admin can apply more maps, and advancing
  // would unmount the dialog (it lives inside ParticipantsStep) mid-batch. The admin closes the dialog
  // when done, then continues to Results normally. Consumes OcrApplyResponse from ocrJobApply
  // (via OcrBatchDialog -> ParticipantsStep -> here).
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
  };

  // Step 4 publish done -> jump to the view page. basePath keeps this surface-correct:
  // admin -> /a/leaderboards/standalone/<id>, organizer -> /organizer/leaderboards/standalone/<id>.
  const handlePublished = () => {
    if (leaderboard) router.push(`${basePath}/${leaderboard.id}`);
  };

  return (
    <div className="min-h-screen space-y-6">
      <PageHeader
        back
        title="Create standalone leaderboard"
        description={`Step ${step} of 4: ${STEP_LABELS[step - 1]}`}
      />

      {/* Step indicator - shadcn pill/segment style (bg-muted track, active pill = bg-background). */}
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
        {step === 1 && (
          <BasicsStep onCreated={handleCreated} organizationId={organizationId} />
        )}

        {step === 2 && leaderboard && (
          <ParticipantsStep
            leaderboardId={leaderboard.id}
            format={leaderboard.format}
            participants={participants}
            onParticipantsChange={setParticipants}
            onOcrApplied={handleOcrApplied}
            // Scoring config from the created header: lets the OCR review preview each row's points
            // (placement points + kills * kill point) before the map is applied.
            ocrScoring={{
              placementPoints: leaderboard.placement_points ?? {},
              killPoint: leaderboard.kill_point ?? 0,
            }}
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
