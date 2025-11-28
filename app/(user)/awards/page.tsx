"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Award, Clock } from "lucide-react";
import Link from "next/link";

export default function AwardsPage() {
  return (
    <div className="flex w-full flex-col items-center justify-center">
      <Card className="w-full">
        <CardContent className="text-center p-6 md:p-8">
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <Trophy className="h-8 w-8 md:h-12 md:w-12 text-primary mr-2 md:mr-4" />
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              NFCA 2025
            </h1>
            <Award className="h-8 w-8 md:h-12 md:w-12 text-primary ml-2 md:ml-4" />
          </div>

          <div className="bg-muted/50 rounded-full p-4 w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
            <Clock className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 md:mb-4">
            Voting is Now Closed
          </h2>

          <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 max-w-md mx-auto">
            Thank you for your participation in the Nigerian Freefire Community
            Awards 2025. The voting period has ended and we are now tallying the
            results.
          </p>

          <div className="bg-primary/10 border border-primary/20 rounded-md p-4 mb-6">
            <p className="text-sm md:text-base text-primary font-medium">
              Winners will be announced soon!
            </p>
          </div>

          <Button asChild>
            <Link href="/home">Return to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
