import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTrophy } from "@tabler/icons-react";

export function GenerateStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <Card className="bg-[#09090b] border-zinc-800 text-white p-12 text-center">
      <div className="flex flex-col items-center space-y-6">
        <IconTrophy className="size-16 text-zinc-600" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Ready to Generate</h2>
          <p className="text-zinc-400">
            Click the button below to extract your selected metrics from the
            uploaded file
          </p>
        </div>
        <Button
          onClick={onNext}
          className="bg-white text-black px-10 py-6 text-lg font-bold hover:bg-zinc-200"
        >
          Extract Metrics
        </Button>
        <Button variant="ghost" onClick={onBack} className="text-zinc-500">
          Back
        </Button>
      </div>
    </Card>
  );
}
