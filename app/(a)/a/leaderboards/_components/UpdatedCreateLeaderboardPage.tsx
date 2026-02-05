"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SelectionMethodStep } from "../_components/SelectionMethodStep";
import { BasicInfoStep } from "../_components/BasicInfoStep";
import { ConfigurePointSystem } from "../_components/ConfigurePointSystem";
import { FileUploadStep } from "../_components/FileUploadStep";
import { SuccessStep } from "../_components/SuccessStep";
import { SelectTeamsStep } from "../_components/SelectTeamsStep";
import { InputMapDataStep } from "../_components/InputMapDataStep";
import { GenerateLeaderboardStep } from "../_components/GenerateLeaderboardStep";
import { ReviewAndPublishStep } from "../_components/ReviewAndPublishStep";

export type Method = "manual" | "image_upload" | "room_file_upload";

export default function CreateLeaderboardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    event_id: "",
    stage_id: "",
    group_id: "",
    leaderboard_method: "" as Method,
    file_type: "match_result_file",
    placement_points: {} as Record<string, number>,
    kill_point: "1",
    selected_teams: [] as any[],
    map_data: [] as any[],
  });

  const isManualFlow = formData.leaderboard_method === "manual";
  const totalSteps = isManualFlow ? 8 : 5;

  const updateFormData = (newData: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const nextStep = (value = 1) => setCurrentStep((prev) => prev + value);
  const prevStep = () => setCurrentStep((prev) => prev - 1);

  const getStepTitle = (step: number) => {
    if (!isManualFlow) {
      // Automated flow (5 steps)
      if (step === 1) return "Select Creation Method";
      if (step === 2) return "Basic Information";
      if (step === 3) return "Select File Type";
      if (step === 4) return "Configure Point System";
      return "Process Complete";
    } else {
      // Manual flow (8 steps)
      if (step === 1) return "Select Creation Method";
      if (step === 2) return "Basic Information";
      if (step === 3) return "Configure Point System";
      if (step === 4) return "Select Teams";
      if (step === 5) return "Input Map Data";
      if (step === 6) return "Generate Leaderboard";
      if (step === 7) return "Review & Publish";
      return "Process Complete";
    }
  };

  return (
    <div className="space-y-6 min-h-screen">
      <PageHeader
        back={currentStep > 1 && currentStep < totalSteps}
        title="Create Leaderboard"
        description={
          currentStep < totalSteps
            ? `Step ${currentStep} of ${totalSteps}: ${getStepTitle(currentStep)}`
            : ""
        }
      />

      <div className="mt-4">
        {/* Step 1: Selection Method - Common to all flows */}
        {currentStep === 1 && (
          <SelectionMethodStep
            onSelect={(method) => {
              const methodMap: Record<string, Method> = {
                manual: "manual",
                image: "image_upload",
                file: "room_file_upload",
              };
              updateFormData({
                leaderboard_method: methodMap[method] || "manual",
              });
              nextStep();
            }}
          />
        )}

        {/* Step 2: Basic Info - Common to all flows */}
        {currentStep === 2 && (
          <BasicInfoStep
            onNext={nextStep}
            onBack={prevStep}
            updateData={updateFormData}
          />
        )}

        {/* MANUAL FLOW STEPS */}
        {isManualFlow && (
          <>
            {/* Step 3: Configure Point System */}
            {currentStep === 3 && (
              <ConfigurePointSystem
                onNext={(pointsData: any) => {
                  updateFormData({
                    placement_points: pointsData.placement_points,
                    kill_point: pointsData.kill_point,
                  });
                  nextStep();
                }}
                onBack={prevStep}
                parentFormData={formData}
              />
            )}

            {/* Step 4: Select Teams */}
            {currentStep === 4 && (
              <SelectTeamsStep
                onNext={nextStep}
                onBack={prevStep}
                updateData={updateFormData}
                groupId={formData.group_id}
              />
            )}

            {/* Step 5: Input Map Data */}
            {currentStep === 5 && (
              <InputMapDataStep
                onNext={nextStep}
                onBack={prevStep}
                updateData={updateFormData}
                selectedTeams={formData.selected_teams}
              />
            )}

            {/* Step 6: Generate Leaderboard */}
            {currentStep === 6 && (
              <GenerateLeaderboardStep
                onNext={nextStep}
                onBack={prevStep}
                formData={formData}
              />
            )}

            {/* Step 7: Review & Publish */}
            {currentStep === 7 && (
              <ReviewAndPublishStep
                onNext={nextStep}
                onBack={prevStep}
                formData={formData}
              />
            )}

            {/* Step 8: Success */}
            {currentStep === 8 && <SuccessStep />}
          </>
        )}

        {/* AUTOMATED FLOW STEPS (image_upload or room_file_upload) */}
        {!isManualFlow && (
          <>
            {/* Step 3: File Upload */}
            {currentStep === 3 && (
              <FileUploadStep
                onNext={nextStep}
                onBack={prevStep}
                updateData={updateFormData}
              />
            )}

            {/* Step 4: Configure Point System */}
            {currentStep === 4 && (
              <ConfigurePointSystem
                onNext={nextStep}
                onBack={prevStep}
                parentFormData={formData}
              />
            )}

            {/* Step 5: Success */}
            {currentStep === 5 && <SuccessStep />}
          </>
        )}
      </div>
    </div>
  );
}
