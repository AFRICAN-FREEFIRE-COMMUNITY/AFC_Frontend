// app/(user)/profile/addresses/page.tsx
//
// "Saved Addresses" manage page. Authenticated surface where a buyer reviews, edits,
// deletes, and sets a default among the delivery profiles they have saved at
// checkout. Wrapped in ProtectedRoute (same idiom as app/(user)/orders/page.tsx) so
// an unauthenticated visitor is bounced to login. The interactive list + dialog form
// live in the SavedAddresses client component; data flows through lib/deliveryProfiles.
// Linked from the "Saved addresses" card on /profile (ProfileContent.tsx).
import { ProtectedRoute } from "../../_components/ProtectedRoute";
import { SavedAddresses } from "../_components/SavedAddresses";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Addresses | African Freefire Community",
};

const page = () => {
  return (
    <ProtectedRoute>
      <SavedAddresses />
    </ProtectedRoute>
  );
};

export default page;
