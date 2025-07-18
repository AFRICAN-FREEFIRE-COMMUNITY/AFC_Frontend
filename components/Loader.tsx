import { Loader2 } from "lucide-react";
import React from "react";

export const Loader = ({ text = "Loading..." }: { text?: string }) => {
	return (
		<div className="flex items-center justify-center gap-2">
			<Loader2 className="size-4 animate-spin" />
			<span>{text}</span>
		</div>
	);
};
