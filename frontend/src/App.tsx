/**
 * Головний компонент додатку з маршрутизацією (React Router).
 * Архітектура MVC: App = Controller, Pages = View, API/Store = Model.
 */

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  matchPath,
  useLocation,
} from "react-router-dom";

import AdminPage from "@/pages/AdminPage";
import AdminStatsPage from "@/pages/AdminStatsPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import BoardPage from "@/pages/BoardPage";
import BoardsPage from "@/pages/BoardsPage";
import LoginPage from "@/pages/LoginPage";
import ProfilePage from "@/pages/ProfilePage";
import RegisterPage from "@/pages/RegisterPage";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useEffect } from "react";

const APP_TITLE = "Base Kanban Trello";

function PageTitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    let pageTitle = "Сторінка";

    if (pathname === "/") pageTitle = "Мої дошки";
    else if (pathname === "/login") pageTitle = "Вхід";
    else if (pathname === "/register") pageTitle = "Реєстрація";
    else if (pathname === "/profile") pageTitle = "Профіль";
    else if (pathname === "/admin") pageTitle = "Адмін-панель";
    else if (pathname === "/admin/stats") pageTitle = "Адмін-статистика";
    else if (pathname === "/admin/users") pageTitle = "Керування користувачами";
    else if (matchPath("/board/:boardId", pathname)) pageTitle = "Дошка";

    document.title = `${pageTitle} - ${APP_TITLE}`;
  }, [pathname]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== "admin") return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <PageTitleManager />
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <BoardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/board/:boardId"
            element={
              <ProtectedRoute>
                <BoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/stats"
            element={
              <AdminRoute>
                <AdminStatsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
