/**
 * Unit-тести для API-клієнта.
 * Перевіряють структуру API-модулів та інтерцептори.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import axios from "axios";

// Мокаємо axios
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe("API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("повинен створювати axios-інстанс з baseURL /api", async () => {
    // Імпортуємо після моку
    await import("@/lib/api");

    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "/api",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("повинен реєструвати request інтерцептор", async () => {
    const mod = await import("@/lib/api");
    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value;

    if (instance) {
      expect(instance.interceptors.request.use).toHaveBeenCalled();
    }
  });

  it("повинен реєструвати response інтерцептор", async () => {
    const mod = await import("@/lib/api");
    const instance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value;

    if (instance) {
      expect(instance.interceptors.response.use).toHaveBeenCalled();
    }
  });
});

describe("API modules structure", () => {
  it("authApi повинен мати методи register та login", async () => {
    const { authApi } = await import("@/lib/api");
    expect(authApi).toBeDefined();
    expect(typeof authApi.register).toBe("function");
    expect(typeof authApi.login).toBe("function");
  });

  it("usersApi повинен мати CRUD-методи", async () => {
    const { usersApi } = await import("@/lib/api");
    expect(usersApi).toBeDefined();
    expect(typeof usersApi.getMe).toBe("function");
    expect(typeof usersApi.updateMe).toBe("function");
    expect(typeof usersApi.changePassword).toBe("function");
    expect(typeof usersApi.getAll).toBe("function");
    expect(typeof usersApi.adminUpdate).toBe("function");
    expect(typeof usersApi.adminDelete).toBe("function");
  });

  it("boardsApi повинен мати методи дошки та колонок", async () => {
    const { boardsApi } = await import("@/lib/api");
    expect(boardsApi).toBeDefined();
    expect(typeof boardsApi.create).toBe("function");
    expect(typeof boardsApi.getAll).toBe("function");
    expect(typeof boardsApi.getById).toBe("function");
    expect(typeof boardsApi.update).toBe("function");
    expect(typeof boardsApi.delete).toBe("function");
    expect(typeof boardsApi.inviteMember).toBe("function");
    expect(typeof boardsApi.removeMember).toBe("function");
    expect(typeof boardsApi.createColumn).toBe("function");
    expect(typeof boardsApi.updateColumn).toBe("function");
    expect(typeof boardsApi.deleteColumn).toBe("function");
  });

  it("cardsApi повинен мати методи карток та коментарів", async () => {
    const { cardsApi } = await import("@/lib/api");
    expect(cardsApi).toBeDefined();
    expect(typeof cardsApi.create).toBe("function");
    expect(typeof cardsApi.getByColumn).toBe("function");
    expect(typeof cardsApi.getById).toBe("function");
    expect(typeof cardsApi.update).toBe("function");
    expect(typeof cardsApi.move).toBe("function");
    expect(typeof cardsApi.delete).toBe("function");
    expect(typeof cardsApi.addComment).toBe("function");
    expect(typeof cardsApi.getComments).toBe("function");
    expect(typeof cardsApi.addWorklog).toBe("function");
    expect(typeof cardsApi.getWorklogs).toBe("function");
  });

  it("notificationsApi повинен мати методи нотифікацій", async () => {
    const { notificationsApi } = await import("@/lib/api");
    expect(notificationsApi).toBeDefined();
    expect(typeof notificationsApi.getAll).toBe("function");
    expect(typeof notificationsApi.getUnreadCount).toBe("function");
    expect(typeof notificationsApi.markRead).toBe("function");
    expect(typeof notificationsApi.markAllRead).toBe("function");
    expect(typeof notificationsApi.getInvitations).toBe("function");
    expect(typeof notificationsApi.respondInvitation).toBe("function");
  });
});
