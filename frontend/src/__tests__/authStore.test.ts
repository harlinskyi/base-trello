/**
 * Unit-тести для Zustand authStore.
 * Перевіряють login, logout, updateUser та ініціалізацію з localStorage.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { User } from "@/types";
import { useAuthStore } from "@/store/authStore";

const mockUser: User = {
  id: "user-1",
  username: "testuser",
  email: "test@example.com",
  role: "user",
  created_at: "2024-01-01T00:00:00Z",
};

const mockAdmin: User = {
  id: "admin-1",
  username: "admin",
  email: "admin@kanban.com",
  role: "admin",
  created_at: "2024-01-01T00:00:00Z",
};

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    // Скидаємо стор до початкового стану
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  describe("початковий стан", () => {
    it("повинен мати порожній стан без localStorage", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("login", () => {
    it("повинен зберігати користувача та токен", () => {
      const { login } = useAuthStore.getState();

      login(mockUser, "test-jwt-token");

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe("test-jwt-token");
      expect(state.isAuthenticated).toBe(true);
    });

    it("повинен зберігати дані в localStorage", () => {
      const { login } = useAuthStore.getState();

      login(mockUser, "test-jwt-token");

      expect(localStorage.getItem("token")).toBe("test-jwt-token");
      expect(localStorage.getItem("user")).toBe(JSON.stringify(mockUser));
    });

    it("повинен перезаписувати попередній стан при повторному логіні", () => {
      const { login } = useAuthStore.getState();

      login(mockUser, "token-1");
      login(mockAdmin, "token-2");

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockAdmin);
      expect(state.token).toBe("token-2");
    });
  });

  describe("logout", () => {
    it("повинен очищати стан користувача", () => {
      const store = useAuthStore.getState();
      store.login(mockUser, "test-token");

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("повинен видаляти дані з localStorage", () => {
      const store = useAuthStore.getState();
      store.login(mockUser, "test-token");

      useAuthStore.getState().logout();

      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("повинен оновлювати дані користувача", () => {
      const store = useAuthStore.getState();
      store.login(mockUser, "test-token");

      const updatedUser = { ...mockUser, username: "newname" };
      useAuthStore.getState().updateUser(updatedUser);

      const state = useAuthStore.getState();
      expect(state.user?.username).toBe("newname");
      // Токен не повинен змінитися
      expect(state.token).toBe("test-token");
    });

    it("повинен оновлювати localStorage", () => {
      const store = useAuthStore.getState();
      store.login(mockUser, "test-token");

      const updatedUser = { ...mockUser, email: "new@test.com" };
      useAuthStore.getState().updateUser(updatedUser);

      const stored = JSON.parse(localStorage.getItem("user")!);
      expect(stored.email).toBe("new@test.com");
    });
  });

  describe("ролі користувачів", () => {
    it("повинен розрізняти user та admin ролі", () => {
      const { login } = useAuthStore.getState();

      login(mockUser, "token");
      expect(useAuthStore.getState().user?.role).toBe("user");

      login(mockAdmin, "admin-token");
      expect(useAuthStore.getState().user?.role).toBe("admin");
    });
  });
});
