import AdminLayout from "@/components/AdminLayout";
import { EditNewsForm } from "./_components/EditNewsForm";

export default function EditNewsPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      <EditNewsForm />
    </AdminLayout>
  );
}
