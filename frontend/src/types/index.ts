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
  color: string | null;
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
  comments_count?: number;
  logged_hours?: number;
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

export interface StatsBucket {
  label: string;
  value: number;
  percentage: number;
}

export interface AdminOverviewStats {
  total_users: number;
  admin_users: number;
  total_boards: number;
  total_columns: number;
  total_cards: number;
  assigned_cards: number;
  unassigned_cards: number;
  overdue_cards: number;
  due_this_week_cards: number;
  total_comments: number;
  total_worklog_entries: number;
  tracked_hours_total: number;
  estimated_hours_total: number;
  unread_notifications: number;
  pending_invitations: number;
  avg_cards_per_board: number;
  avg_members_per_board: number;
}

export interface AdminRecentActivityStats {
  new_users_last_30_days: number;
  new_boards_last_30_days: number;
  new_cards_last_30_days: number;
  new_comments_last_30_days: number;
}

export interface AdminTopUserStats {
  id: string;
  username: string;
  role: Role;
  owned_boards: number;
  assigned_cards: number;
  comments_count: number;
  worklog_entries: number;
  logged_hours: number;
}

export interface AdminTopBoardStats {
  id: string;
  title: string;
  owner_username: string;
  members_count: number;
  columns_count: number;
  cards_count: number;
  estimated_hours_total: number;
  tracked_hours_total: number;
}

export interface AdminActivityPoint {
  date: string;
  users: number;
  boards: number;
  cards: number;
  comments: number;
}

export interface AdminStats {
  generated_at: string;
  overview: AdminOverviewStats;
  recent_activity: AdminRecentActivityStats;
  users_by_role: StatsBucket[];
  cards_by_priority: StatsBucket[];
  cards_by_type: StatsBucket[];
  cards_by_status: StatsBucket[];
  invitations_by_status: StatsBucket[];
  notifications_by_type: StatsBucket[];
  top_users: AdminTopUserStats[];
  top_boards: AdminTopBoardStats[];
  activity_timeline: AdminActivityPoint[];
}
