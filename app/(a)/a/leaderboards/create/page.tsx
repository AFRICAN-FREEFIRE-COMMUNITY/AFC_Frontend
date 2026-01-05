"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SelectionMethodStep } from "../_components/SelctionMethodStep";
import { BasicInfoStep } from "../_components/BasicInfoStep";
import { ConfigurePointSystem } from "../_components/ConfigurePointSystem";
import { FileUploadStep } from "../_components/FileUploadStep";
import { SuccessStep } from "../_components/SuccessStep";

export type Method = "manual" | "image_upload" | "room_file_upload";

export default function CreateLeaderboardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    event_id: "",
    stage_id: "",
    group_id: "",
    leaderboard_method: "" as Method,
    file_type: "match_result_file",
  });

  const totalSteps = 5; // Reduced total steps

  const updateFormData = (newData: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const nextStep = (value = 1) => setCurrentStep((prev) => prev + value);
  const prevStep = () => setCurrentStep((prev) => prev - 1);

  return (
    <div className="space-y-6 min-h-screen">
      <PageHeader
        back={currentStep > 1 && currentStep < 5} // Disable back button on success screen
        title="Create Leaderboard"
        description={
          currentStep < 5
            ? `Step ${currentStep} of ${totalSteps}: ${getStepTitle(
                currentStep
              )}`
            : ""
        }
      />

      <div className="mt-4">
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

        {currentStep === 2 && (
          <BasicInfoStep
            onNext={() => {
              if (formData.leaderboard_method === "manual") {
                nextStep(2);
              } else {
                nextStep();
              }
            }}
            onBack={prevStep}
            updateData={updateFormData}
          />
        )}

        {currentStep === 3 && (
          <FileUploadStep
            onNext={nextStep}
            onBack={prevStep}
            updateData={updateFormData}
          />
        )}

        {currentStep === 4 && (
          <ConfigurePointSystem
            onNext={nextStep}
            onBack={prevStep}
            parentFormData={formData}
          />
        )}

        {currentStep === 5 && <SuccessStep />}
      </div>
    </div>
  );
}

function getStepTitle(step: number) {
  if (step === 1) return "Select Creation Method";
  if (step === 2) return "Basic Information";
  if (step === 3) return "Select File Type";
  if (step === 4) return "Configure Point System";
  return "Process Complete";
}
