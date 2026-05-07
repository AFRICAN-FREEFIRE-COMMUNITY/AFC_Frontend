import AdminMarketDetailClient from "../_components/AdminMarketDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

const AdminMarketDetailPage = async ({ params }: PageProps) => {
  const { id } = await params;
  return (
    <div>
      <AdminMarketDetailClient marketId={id} />
    </div>
  );
};

export default AdminMarketDetailPage;
