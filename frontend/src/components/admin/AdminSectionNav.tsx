import { BarChart3, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminSections = [
  {
    href: "/admin/stats",
    label: "Статистика",
    icon: BarChart3,
  },
  {
    href: "/admin/users",
    label: "Користувачі",
    icon: Users,
  },
];

export function AdminSectionNav() {
  const { pathname } = useLocation();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {adminSections.map((section) => {
        const Icon = section.icon;
        const isActive = pathname === section.href;

        return (
          <Button
            key={section.href}
            asChild
            variant={isActive ? "default" : "outline"}
            className={cn("gap-2", !isActive && "text-muted-foreground")}
          >
            <Link to={section.href}>
              <Icon className="h-4 w-4" />
              {section.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
