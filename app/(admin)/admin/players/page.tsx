import AdminLayout from "@/components/AdminLayout";
import React from "react";
import { Players } from "./_components/Players";

const page = () => {
	return (
		<AdminLayout>
			<Players />
		</AdminLayout>
	);
};

export default page;
