import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { Header } from "@/components/layout/Header";
import { Shield } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Адмін-панель: користувачі</h1>
        </div>
        <p className="mb-6 max-w-5xl text-sm text-muted-foreground">
          Окремий екран для керування обліковими записами, ролями та базовими
          даними користувачів.
        </p>

        <AdminSectionNav />
        <AdminUsersManager />
      </div>
    </div>
  );
}
