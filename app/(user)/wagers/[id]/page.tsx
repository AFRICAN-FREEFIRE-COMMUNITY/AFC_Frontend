import MarketDetailClient from "../_components/MarketDetailClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market | African Freefire Community",
};

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

const page = async ({ params }: MarketPageProps) => {
  const { id } = await params;
  return (
    <div>
      <MarketDetailClient marketId={id} />
    </div>
  );
};

export default page;
