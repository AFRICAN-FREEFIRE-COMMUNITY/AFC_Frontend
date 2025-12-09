"use client";

import { Button } from "@/components/ui/button";
import { useFormContext, useFieldArray } from "react-hook-form";

export default function StepStages({ openStageModal, openGroupModal }: any) {
  const form = useFormContext();
  const { fields } = useFieldArray({
    control: form.control,
    name: "stages",
  });

  return (
    <div className="space-y-4">
      <Button type="button" onClick={openStageModal}>
        Add Stage
      </Button>

      <div className="space-y-2">
        {fields.map((stage, index) => (
          <div key={stage.id} className="p-4 border rounded-md">
            <p className="font-semibold">
              {stage.stage_name} ({stage.stage_type})
            </p>

            {stage.stage_type === "group" && (
              <Button type="button" className="mt-2" onClick={openGroupModal}>
                Add Group
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
