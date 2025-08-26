import AdminLayout from "@/components/AdminLayout";
import { AllNews } from "./_components/AllNews";

export default function AdminNewsPage() {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          News & Announcements Management
        </h1>

        <AllNews />
      </div>
    </AdminLayout>
  );
}
