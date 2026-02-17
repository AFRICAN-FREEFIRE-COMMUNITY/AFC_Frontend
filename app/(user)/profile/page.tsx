import React, { Suspense } from "react";
import { ProfileContent } from "./_components/ProfileContent";
import { FullLoader } from "@/components/Loader";

const page = () => {
  return (
    <Suspense fallback={<FullLoader />}>
      <ProfileContent />
    </Suspense>
  );
};

export default page;
