import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      <AdminSidebar adminName={admin.name ?? admin.email} />
      <div className="min-w-0 flex-1 space-y-6 pb-12">{children}</div>
    </div>
  );
}
