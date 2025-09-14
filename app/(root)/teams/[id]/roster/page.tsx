import Layout from "@/components/Layout";
import React from "react";
import { ManageRoster } from "./_components/ManageRoaster";

type Params = Promise<{
  id: string;
}>;

const page = async ({ params }: { params: Params }) => {
  const { id } = await params;
  return (
    <Layout>
      <ManageRoster id={id} />
    </Layout>
  );
};

export default page;
