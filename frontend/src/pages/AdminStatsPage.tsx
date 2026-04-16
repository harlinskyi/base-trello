import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import type { AdminStats } from "@/types";
import { AdminStatsDashboard } from "@/components/admin/AdminStatsDashboard";
import { Header } from "@/components/layout/Header";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { usersApi } from "@/lib/api";

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await usersApi.getAdminStats();
        setStats(response.data);
      } catch {
        toast.error("Не вдалося завантажити адмінську статистику");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Адмін-панель: статистика</h1>
        </div>
        <p className="mb-6 max-w-5xl text-sm text-muted-foreground">
          Аналітика побудована на фактичних сутностях: користувачі, дошки,
          колонки, картки, коментарі, затраченому часу, сповіщення та
          запрошення.
        </p>

        <AdminSectionNav />

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Завантаження статистики...
            </CardContent>
          </Card>
        ) : stats ? (
          <AdminStatsDashboard stats={stats} />
        ) : null}
      </div>
    </div>
  );
}
