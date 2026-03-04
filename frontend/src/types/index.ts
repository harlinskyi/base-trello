/**
 * Типи даних фронтенду.
 * Відповідають Pydantic-схемам бекенду.
 */

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Board {
  id: string;
  title: string;
  owner_id: string;
  owner?: User;
  created_at: string;
  members?: User[];
  columns?: Column[];
}

export interface Column {
  id: string;
  name: string;
  position: number;
  board_id: string;
}

export interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  tags: string[] | null;
  priority: string | null;
  color: string | null;
  estimate: number | null;
  due_date: string | null;
  card_type: string | null;
  column_id: string;
  assignee_id: string | null;
  assignee: User | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  text: string;
  card_id: string;
  author_id: string;
  author: User | null;
  created_at: string;
}

export interface Worklog {
  id: string;
  hours: number;
  description: string;
  card_id: string;
  author_id: string;
  author: User | null;
  created_at: string;
}

export interface BoardDetail extends Board {
  columns: Column[];
}

// Дані колонки з картками для відображення на дошці
export interface ColumnWithCards extends Column {
  cards: Card[];
}

// --- Notifications / Invitations ---

export type NotificationType =
  | "board_invitation"
  | "card_assigned"
  | "card_moved"
  | "card_updated"
  | "card_commented";

export type InvitationStatus = "pending" | "accepted" | "declined";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  related_id: string | null;
  created_at: string;
}

export interface BoardInvitation {
  id: string;
  board_id: string;
  inviter_id: string;
  invitee_id: string;
  status: InvitationStatus;
  created_at: string;
  board_title?: string;
  inviter_username?: string;
}
