import { ReactNode } from "react";
import { ProtectedRoute } from "../(user)/_components/ProtectedRoute";

export default function SponsorRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
