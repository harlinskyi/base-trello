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
import { useEffect } from "react";

import AdminPage from "@/pages/AdminPage";
import BoardPage from "@/pages/BoardPage";
import BoardsPage from "@/pages/BoardsPage";
import LoginPage from "@/pages/LoginPage";
import ProfilePage from "@/pages/ProfilePage";
import RegisterPage from "@/pages/RegisterPage";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/authStore";

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
      </Routes>
    </BrowserRouter>
  );
}
