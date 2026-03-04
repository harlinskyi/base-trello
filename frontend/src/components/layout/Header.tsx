/**
 * Компонент навігації (Header).
 * Включає дзвіночок нотифікацій із підрахунком непрочитаних.
 */

import {
  Bell,
  Check,
  CheckCheck,
  LayoutDashboard,
  LogOut,
  Shield,
  User,
  X,
} from "lucide-react";
import type { BoardInvitation, Notification } from "@/types";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notificationsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<BoardInvitation[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Підрахунок непрочитаних
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch {}
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Клік поза панеллю — закрити
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    if (showPanel) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPanel]);

  const openPanel = async () => {
    setShowPanel((v) => !v);
    if (!showPanel) {
      setPanelLoading(true);
      try {
        const [notifRes, invRes] = await Promise.all([
          notificationsApi.getAll(),
          notificationsApi.getInvitations(),
        ]);
        setNotifications(notifRes.data);
        setInvitations(invRes.data);
      } catch {}
      setPanelLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleInvitationAction = async (
    invId: string,
    action: "accept" | "decline",
  ) => {
    try {
      await notificationsApi.respondInvitation(invId, action);
      setInvitations((prev) => prev.filter((i) => i.id !== invId));
      fetchUnreadCount();
    } catch {}
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isAuthenticated) return null;

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <LayoutDashboard className="h-5 w-5" />
            Kanban Board
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Дошки
            </Link>
            <Link
              to="/profile"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Профіль
            </Link>
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                Адмін
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <div className="relative" ref={panelRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={openPanel}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>

            {/* Dropdown panel */}
            {showPanel && (
              <div className="absolute right-0 top-10 w-96 bg-white border rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="font-semibold text-sm">Сповіщення</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Прочитати всі
                  </Button>
                </div>

                {panelLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Завантаження...
                  </div>
                ) : (
                  <>
                    {/* Pending invitations */}
                    {invitations.length > 0 && (
                      <div className="border-b">
                        <p className="text-xs font-semibold text-muted-foreground px-3 pt-2">
                          Запрошення
                        </p>
                        {invitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="px-3 py-2 border-b last:border-0 hover:bg-muted/50"
                          >
                            <p className="text-sm">
                              <span className="font-medium">
                                {inv.inviter_username}
                              </span>{" "}
                              запрошує вас на дошку{" "}
                              <span className="font-medium">
                                {inv.board_title}
                              </span>
                            </p>
                            <div className="flex gap-2 mt-1.5">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  handleInvitationAction(inv.id, "accept")
                                }
                              >
                                <Check className="h-3 w-3 mr-1" /> Прийняти
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  handleInvitationAction(inv.id, "decline")
                                }
                              >
                                <X className="h-3 w-3 mr-1" /> Відхилити
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notifications list */}
                    {notifications.length > 0 ? (
                      notifications.slice(0, 20).map((n) => (
                        <div
                          key={n.id}
                          className={`px-3 py-2 border-b last:border-0 text-sm ${!n.is_read ? "bg-blue-50/50" : ""}`}
                        >
                          <p className="font-medium text-xs">{n.title}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleString("uk-UA")}
                          </p>
                        </div>
                      ))
                    ) : invitations.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Немає сповіщень
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>

          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <User className="h-4 w-4" />
            {user?.username}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Вийти
          </Button>
        </div>
      </div>
    </header>
  );
}
