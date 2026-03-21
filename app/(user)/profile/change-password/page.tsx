import React from "react";
import { PasswordForm } from "../_components/PasswordForm";
import { PageHeader } from "@/components/PageHeader";

const page = () => {
  return (
    <div>
      <PageHeader back title={"Change Password"} />
      <PasswordForm />
    </div>
  );
};

export default page;
