import AdminLayout from "@/components/AdminLayout";
import React from "react";
import { Team } from "./_components/Team";

type Params = Promise<{
  id: string;
}>;

const page = async ({ params }: { params: Params }) => {
  const { id } = await params;
  return (
    <AdminLayout>
      <Team id={id} />
    </AdminLayout>
  );
};

export default page;
