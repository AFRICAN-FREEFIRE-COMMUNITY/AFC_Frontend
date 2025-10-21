import AdminLayout from "@/components/AdminLayout";
import { NewsDetails } from "./_components/NewsDetails";

type Params = Promise<{
  id: string;
}>;

export default async function AdminNewsPostPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  return (
    <AdminLayout>
      <NewsDetails id={id} />
    </AdminLayout>
  );
}
