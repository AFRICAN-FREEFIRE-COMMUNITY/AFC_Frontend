import AdminLayout from "@/components/AdminLayout";
import { EditNewsForm } from "./_components/EditNewsForm";

type Params = Promise<{
  id: string;
}>;

export default async function EditNewsPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <AdminLayout>
      <EditNewsForm id={id} />
    </AdminLayout>
  );
}
