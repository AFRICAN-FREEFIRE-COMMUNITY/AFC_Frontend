// "use client";

// import React, { useState } from "react";
// import { useRouter } from "next/navigation";
// import { PageHeader } from "@/components/PageHeader";
// import { BasicInfoStep } from "../_components/BasicInfoStep";
// import { ConfigurePointSystem } from "../_components/ConfigurePointSystem";
// import { MatchOverviewStep } from "../_components/MatchOverviewStep";
// import { MatchMethodSelectionStep } from "../_components/MatchMethodSelectionStep";
// import { ManualMatchResultStep } from "../_components/ManualMatchResultStep";
// import { ImageUploadStep } from "../_components/ImageUploadStep";
// import { FileUploadStep } from "../_components/FileUploadStep";
// import { EditLeaderboardStep } from "../_components/EditLeaderboardStep";
// import { ReviewAndPublishStep } from "../_components/ReviewAndPublishStep";
// import { SuccessStep } from "../_components/SuccessStep";

// interface FormData {
//   event_id: string;
//   stage_id: string;
//   group_id: string;
//   event_slug: string;
//   // Populated from BasicInfoStep after selecting a group
//   group_matches: any[];
//   competitors_in_group: string[];
//   group_leaderboard: any | null;
//   // Point system
//   placement_points: Record<string, number>;
//   kill_point: string;
//   assist_point: string;
//   damage_point: string;
//   apply_to_all_maps: boolean;
//   placement_points_all?: Array<{
//     match_id: number;
//     kill_point: string;
//     assist_point: string;
//     damage_point: string;
//   }>;
//   // Created leaderboard tracking
//   leaderboard_id: number | null;
//   completed_match_ids: number[];
// }

// export default function CreateLeaderboardPage() {
//   const router = useRouter();
//   const [currentStep, setCurrentStep] = useState(1);
//   type MatchView = "method" | "manual" | "image_upload" | "room_file_upload";
//   const [enteringMatch, setEnteringMatch] = useState<{
//     match: { match_id: number; match_name: string };
//     view: MatchView;
//   } | null>(null);

//   const [formData, setFormData] = useState<FormData>({
//     event_id: "",
//     stage_id: "",
//     group_id: "",
//     event_slug: "",
//     group_matches: [],
//     competitors_in_group: [],
//     group_leaderboard: null,
//     placement_points: {},
//     kill_point: "1",
//     assist_point: "0.5",
//     damage_point: "0.5",
//     apply_to_all_maps: true,
//     leaderboard_id: null,
//     completed_match_ids: [],
//   });

//   const updateFormData = (newData: Partial<FormData>) => {
//     setFormData((prev) => ({ ...prev, ...newData }));
//   };

//   const nextStep = () => setCurrentStep((prev) => prev + 1);
//   const prevStep = () => setCurrentStep((prev) => prev - 1);

//   const TOTAL_DISPLAY_STEPS = 5;

//   const getStepTitle = () => {
//     if (currentStep === 1) return "Basic Information";
//     if (currentStep === 2) return "Configure Point System";
//     if (currentStep === 3) {
//       if (!enteringMatch) return "Match Overview";
//       if (enteringMatch.view === "method") return "Select Upload Method";
//       if (enteringMatch.view === "manual") return "Manual Input";
//       if (enteringMatch.view === "image_upload") return "Image Upload";
//       if (enteringMatch.view === "room_file_upload") return "3D Room File Upload";
//     }
//     if (currentStep === 4) return "Edit Leaderboard";
//     if (currentStep === 5) return "Review & Publish";
//     return "";
//   };

//   const isSuccess = currentStep === 6;

//   return (
//     <div className="space-y-6 min-h-screen">
//       <PageHeader
//         back={currentStep > 1 && !isSuccess && !enteringMatch && currentStep !== 4 && currentStep !== 5}
//         title="Create Leaderboard"
//         description={
//           !isSuccess
//             ? `Step ${currentStep} of ${TOTAL_DISPLAY_STEPS}: ${getStepTitle()}`
//             : undefined
//         }
//       />

//       <div className="mt-4">
//         {/* Step 1: Basic Information */}
//         {currentStep === 1 && (
//           <BasicInfoStep
//             onNext={nextStep}
//             onBack={() => router.back()}
//             updateData={updateFormData}
//           />
//         )}

//         {/* Step 2: Configure Point System */}
//         {currentStep === 2 && (
//           <ConfigurePointSystem
//             parentFormData={formData}
//             onNext={(data) => {
//               updateFormData({
//                 placement_points: data.placement_points,
//                 kill_point: data.kill_point,
//                 assist_point: data.assist_point,
//                 damage_point: data.damage_point,
//                 apply_to_all_maps: data.apply_to_all_maps,
//                 placement_points_all: data.placement_points_all,
//                 leaderboard_id: data.leaderboard_id ?? null,
//               });
//               nextStep();
//             }}
//             onBack={prevStep}
//           />
//         )}

//         {/* Step 3: Match Overview */}
//         {currentStep === 3 && !enteringMatch && (
//           <MatchOverviewStep
//             formData={formData}
//             updateData={updateFormData}
//             onEnterMatch={(match) => setEnteringMatch({ match, view: "method" })}
//             onComplete={nextStep}
//             onBack={prevStep}
//           />
//         )}

//         {/* Step 3 sub-view: Select upload method for a match */}
//         {currentStep === 3 && enteringMatch?.view === "method" && (
//           <MatchMethodSelectionStep
//             matchName={enteringMatch.match.match_name}
//             onSelect={(method) =>
//               setEnteringMatch({ match: enteringMatch.match, view: method as MatchView })
//             }
//             onBack={() => setEnteringMatch(null)}
//           />
//         )}

//         {/* Step 3 sub-view: Manual result entry */}
//         {currentStep === 3 && enteringMatch?.view === "manual" && (
//           <ManualMatchResultStep
//             match={enteringMatch.match}
//             formData={formData}
//             onComplete={(matchId) => {
//               updateFormData({
//                 completed_match_ids: [
//                   ...formData.completed_match_ids,
//                   matchId,
//                 ].filter((v, i, a) => a.indexOf(v) === i),
//               });
//               setEnteringMatch(null);
//             }}
//             onBack={() => setEnteringMatch({ match: enteringMatch.match, view: "method" })}
//           />
//         )}

//         {/* Step 3 sub-view: Image upload */}
//         {currentStep === 3 && enteringMatch?.view === "image_upload" && (
//           <ImageUploadStep
//             onNext={() => {
//               updateFormData({
//                 completed_match_ids: [
//                   ...formData.completed_match_ids,
//                   enteringMatch.match.match_id,
//                 ].filter((v, i, a) => a.indexOf(v) === i),
//               });
//               setEnteringMatch(null);
//             }}
//             onBack={() => setEnteringMatch({ match: enteringMatch.match, view: "method" })}
//           />
//         )}

//         {/* Step 3 sub-view: 3D room file upload */}
//         {currentStep === 3 && enteringMatch?.view === "room_file_upload" && (
//           <FileUploadStep
//             match={enteringMatch.match}
//             formData={formData}
//             onNext={() => {
//               updateFormData({
//                 completed_match_ids: [
//                   ...formData.completed_match_ids,
//                   enteringMatch.match.match_id,
//                 ].filter((v, i, a) => a.indexOf(v) === i),
//               });
//               setEnteringMatch(null);
//             }}
//             onBack={() => setEnteringMatch({ match: enteringMatch.match, view: "method" })}
//           />
//         )}

//         {/* Step 4: Edit Leaderboard */}
//         {currentStep === 4 && (
//           <EditLeaderboardStep
//             formData={formData}
//             onNext={nextStep}
//             onBack={prevStep}
//           />
//         )}

//         {/* Step 5: Review & Publish */}
//         {currentStep === 5 && (
//           <ReviewAndPublishStep
//             formData={formData}
//             onNext={nextStep}
//             onBack={prevStep}
//           />
//         )}

//         {/* Step 6: Success */}
//         {isSuccess && <SuccessStep />}
//       </div>
//     </div>
//   );
// }

"use client";

import React, { useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { BasicInfoStep } from "../_components/BasicInfoStep";
import { ConfigurePointSystem } from "../_components/ConfigurePointSystem";
import { MatchOverviewStep } from "../_components/MatchOverviewStep";
import { MatchMethodSelectionStep } from "../_components/MatchMethodSelectionStep";
import { ManualMatchResultStep } from "../_components/ManualMatchResultStep";
import { ImageUploadStep } from "../_components/ImageUploadStep";
import { FileUploadStep } from "../_components/FileUploadStep";
import { EditLeaderboardStep } from "../_components/EditLeaderboardStep";
import { ReviewAndPublishStep } from "../_components/ReviewAndPublishStep";
import { SuccessStep } from "../_components/SuccessStep";

interface FormData {
  event_id: string;
  stage_id: string;
  group_id: string;
  event_slug: string;
  group_matches: any[];
  competitors_in_group: string[];
  group_leaderboard: any | null;
  placement_points: Record<string, number>;
  kill_point: string;
  assist_point: string;
  damage_point: string;
  apply_to_all_maps: boolean;
  placement_points_all?: Array<{
    match_id: number;
    kill_point: string;
    assist_point: string;
    damage_point: string;
  }>;
  leaderboard_id: number | null;
  completed_match_ids: number[];
}

export default function CreateLeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read ?event_id=... from the URL (set by the leaderboards list page)
  const preselectedEventId = searchParams.get("event_id") ?? "";

  const [currentStep, setCurrentStep] = useState(1);
  type MatchView = "method" | "manual" | "image_upload" | "room_file_upload";
  const [enteringMatch, setEnteringMatch] = useState<{
    match: { match_id: number; match_name: string };
    view: MatchView;
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    event_id: "",
    stage_id: "",
    group_id: "",
    event_slug: "",
    group_matches: [],
    competitors_in_group: [],
    group_leaderboard: null,
    placement_points: {},
    kill_point: "1",
    assist_point: "0.5",
    damage_point: "0.5",
    apply_to_all_maps: true,
    leaderboard_id: null,
    completed_match_ids: [],
  });

  const updateFormData = (newData: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const nextStep = () => setCurrentStep((prev) => prev + 1);
  const prevStep = () => setCurrentStep((prev) => prev - 1);

  const TOTAL_DISPLAY_STEPS = 5;

  const getStepTitle = () => {
    if (currentStep === 1) return "Basic Information";
    if (currentStep === 2) return "Configure Point System";
    if (currentStep === 3) {
      if (!enteringMatch) return "Match Overview";
      if (enteringMatch.view === "method") return "Select Upload Method";
      if (enteringMatch.view === "manual") return "Manual Input";
      if (enteringMatch.view === "image_upload") return "Image Upload";
      if (enteringMatch.view === "room_file_upload")
        return "3D Room File Upload";
    }
    if (currentStep === 4) return "Edit Leaderboard";
    if (currentStep === 5) return "Review & Publish";
    return "";
  };

  const isSuccess = currentStep === 6;

  return (
    <div className="space-y-6 min-h-screen">
      <PageHeader
        back={
          currentStep > 1 &&
          !isSuccess &&
          !enteringMatch &&
          currentStep !== 4 &&
          currentStep !== 5
        }
        title="Create Leaderboard"
        description={
          !isSuccess
            ? `Step ${currentStep} of ${TOTAL_DISPLAY_STEPS}: ${getStepTitle()}`
            : undefined
        }
      />

      <div className="mt-4">
        {/* Step 1: Basic Information — receives preselectedEventId to auto-fill */}
        {currentStep === 1 && (
          <BasicInfoStep
            onNext={nextStep}
            onBack={() => router.back()}
            updateData={updateFormData}
            preselectedEventId={preselectedEventId}
          />
        )}

        {/* Step 2: Configure Point System */}
        {currentStep === 2 && (
          <ConfigurePointSystem
            parentFormData={formData}
            onNext={(data) => {
              updateFormData({
                placement_points: data.placement_points,
                kill_point: data.kill_point,
                assist_point: data.assist_point,
                damage_point: data.damage_point,
                apply_to_all_maps: data.apply_to_all_maps,
                placement_points_all: data.placement_points_all,
                leaderboard_id: data.leaderboard_id ?? null,
              });
              nextStep();
            }}
            onBack={prevStep}
          />
        )}

        {/* Step 3: Match Overview */}
        {currentStep === 3 && !enteringMatch && (
          <MatchOverviewStep
            formData={formData}
            updateData={updateFormData}
            onEnterMatch={(match) =>
              setEnteringMatch({ match, view: "method" })
            }
            onComplete={nextStep}
            onBack={prevStep}
          />
        )}

        {/* Step 3 sub-view: Select upload method for a match */}
        {currentStep === 3 && enteringMatch?.view === "method" && (
          <MatchMethodSelectionStep
            matchName={enteringMatch.match.match_name}
            onSelect={(method) =>
              setEnteringMatch({
                match: enteringMatch.match,
                view: method as MatchView,
              })
            }
            onBack={() => setEnteringMatch(null)}
          />
        )}

        {/* Step 3 sub-view: Manual result entry */}
        {currentStep === 3 && enteringMatch?.view === "manual" && (
          <ManualMatchResultStep
            match={enteringMatch.match}
            formData={formData}
            onComplete={(matchId) => {
              updateFormData({
                completed_match_ids: [
                  ...formData.completed_match_ids,
                  matchId,
                ].filter((v, i, a) => a.indexOf(v) === i),
              });
              setEnteringMatch(null);
            }}
            onBack={() =>
              setEnteringMatch({ match: enteringMatch.match, view: "method" })
            }
          />
        )}

        {/* Step 3 sub-view: Image upload */}
        {currentStep === 3 && enteringMatch?.view === "image_upload" && (
          <ImageUploadStep
            onNext={() => {
              updateFormData({
                completed_match_ids: [
                  ...formData.completed_match_ids,
                  enteringMatch.match.match_id,
                ].filter((v, i, a) => a.indexOf(v) === i),
              });
              setEnteringMatch(null);
            }}
            onBack={() =>
              setEnteringMatch({ match: enteringMatch.match, view: "method" })
            }
          />
        )}

        {/* Step 3 sub-view: 3D room file upload */}
        {currentStep === 3 && enteringMatch?.view === "room_file_upload" && (
          <FileUploadStep
            match={enteringMatch.match}
            formData={formData}
            onNext={() => {
              updateFormData({
                completed_match_ids: [
                  ...formData.completed_match_ids,
                  enteringMatch.match.match_id,
                ].filter((v, i, a) => a.indexOf(v) === i),
              });
              setEnteringMatch(null);
            }}
            onBack={() =>
              setEnteringMatch({ match: enteringMatch.match, view: "method" })
            }
          />
        )}

        {/* Step 4: Edit Leaderboard */}
        {currentStep === 4 && (
          <EditLeaderboardStep
            formData={formData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {/* Step 5: Review & Publish */}
        {currentStep === 5 && (
          <ReviewAndPublishStep
            formData={formData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {/* Step 6: Success */}
        {isSuccess && <SuccessStep />}
      </div>
    </div>
  );
}
