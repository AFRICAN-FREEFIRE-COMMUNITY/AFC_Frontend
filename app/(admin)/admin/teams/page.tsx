import AdminLayout from "@/components/AdminLayout";
import React from "react";
import { Teams } from "./_components/Teams";

const page = () => {
  return (
    <AdminLayout>
      <Teams />
    </AdminLayout>
  );
};

export default page;
