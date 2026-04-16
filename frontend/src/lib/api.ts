/**
 * HTTP-клієнт для роботи з API.
 * Використовує axios з інтерцепторами для JWT.
 */

import axios from "axios";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Інтерцептор: додає JWT-токен до кожного запиту
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Інтерцептор: обробка помилок авторизації
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// --- Auth ---
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
};

// --- Users ---
export const usersApi = {
  getMe: () => api.get("/users/me"),
  updateMe: (data: { username?: string; email?: string }) =>
    api.put("/users/me", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/users/me/change-password", data),
  getAll: () => api.get("/users"),
  getAdminStats: () => api.get("/users/stats"),
  adminUpdate: (
    userId: string,
    data: { username?: string; email?: string; role?: string },
  ) => api.put(`/users/${userId}`, data),
  adminDelete: (userId: string) => api.delete(`/users/${userId}`),
};

// --- Boards ---
export const boardsApi = {
  create: (data: { title: string }) => api.post("/boards", data),
  getAll: () => api.get("/boards"),
  getById: (id: string) => api.get(`/boards/${id}`),
  update: (id: string, data: { title?: string }) =>
    api.put(`/boards/${id}`, data),
  delete: (id: string) => api.delete(`/boards/${id}`),
  inviteMember: (boardId: string, memberId: string) =>
    api.post(`/boards/${boardId}/members/${memberId}`),
  getPendingInvitations: (boardId: string) =>
    api.get(`/boards/${boardId}/invitations/pending`),
  removeMember: (boardId: string, memberId: string) =>
    api.delete(`/boards/${boardId}/members/${memberId}`),
  createColumn: (
    boardId: string,
    data: { name: string; position: number; color?: string | null },
  ) => api.post(`/boards/${boardId}/columns`, data),
  updateColumn: (
    columnId: string,
    data: { name?: string; position?: number; color?: string | null },
  ) => api.put(`/boards/columns/${columnId}`, data),
  deleteColumn: (columnId: string) => api.delete(`/boards/columns/${columnId}`),
};

// --- Cards ---
export const cardsApi = {
  create: (
    columnId: string,
    data: {
      title: string;
      description?: string;
      tags?: string[];
      assignee_id?: string | null;
      priority?: string | null;
      color?: string | null;
      estimate?: number | null;
      due_date?: string | null;
      card_type?: string | null;
    },
  ) => api.post(`/cards/column/${columnId}`, data),
  getByColumn: (columnId: string) => api.get(`/cards/column/${columnId}`),
  getById: (id: string) => api.get(`/cards/${id}`),
  update: (
    id: string,
    data: {
      title?: string;
      description?: string;
      tags?: string[];
      assignee_id?: string | null;
      priority?: string | null;
      color?: string | null;
      estimate?: number | null;
      due_date?: string | null;
      card_type?: string | null;
    },
  ) => api.put(`/cards/${id}`, data),
  move: (id: string, data: { column_id: string; position: number }) =>
    api.patch(`/cards/${id}/move`, data),
  delete: (id: string) => api.delete(`/cards/${id}`),
  addComment: (cardId: string, data: { text: string }) =>
    api.post(`/cards/${cardId}/comments`, data),
  getComments: (cardId: string) => api.get(`/cards/${cardId}/comments`),
  addWorklog: (cardId: string, data: { hours: number; description?: string }) =>
    api.post(`/cards/${cardId}/worklogs`, data),
  getWorklogs: (cardId: string) => api.get(`/cards/${cardId}/worklogs`),
};

// --- Notifications ---
export const notificationsApi = {
  getAll: (unreadOnly = false) =>
    api.get("/notifications", { params: { unread_only: unreadOnly } }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markRead: (ids: string[]) =>
    api.post("/notifications/mark-read", { notification_ids: ids }),
  markAllRead: () => api.post("/notifications/mark-all-read"),
  getInvitations: () => api.get("/notifications/invitations"),
  respondInvitation: (invitationId: string, action: "accept" | "decline") =>
    api.post(`/notifications/invitations/${invitationId}`, { action }),
};

export default api;
