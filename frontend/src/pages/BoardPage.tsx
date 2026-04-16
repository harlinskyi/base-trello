/**
 * Сторінка Kanban-дошки з Drag-and-Drop (@hello-pangea/dnd).
 * Архітектура: компонент-контролер (MVC — Controller).
 * View — KanbanColumn та KanbanCard.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { useParams, useNavigate } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { boardsApi, cardsApi, usersApi } from "@/lib/api";
import type {
  Board,
  Card as CardType,
  Column,
  ColumnWithCards,
  User,
  Comment as CommentType,
  Worklog,
  BoardInvitation,
} from "@/types";
import { useAuthStore } from "@/store/authStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  UserPlus,
  X,
  Settings,
  Pencil,
  Check,
  ArrowRight,
  Clock,
  CalendarDays,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnWithCards[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [invitingUserIds, setInvitingUserIds] = useState<Set<string>>(
    new Set(),
  );

  // Dialogs
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<string | null>(null);
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  // Card form
  const [cardForm, setCardForm] = useState({
    title: "",
    description: "",
    tags: "",
    assignee_id: "",
    priority: "",
    color: "",
    estimate: "",
    due_date: "",
    card_type: "basic",
  });
  // Loading states
  const [savingCard, setSavingCard] = useState(false);
  const [savingColumn, setSavingColumn] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  // Comment
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<CommentType[]>([]);
  // Worklogs
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [worklogForm, setWorklogForm] = useState({
    days: "",
    hours: "",
    minutes: "",
    description: "",
  });
  const [worklogError, setWorklogError] = useState("");
  const [activeTab, setActiveTab] = useState<"comments" | "worklogs">(
    "comments",
  );

  // Edit card (owner)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    tags: "",
    assignee_id: "",
    priority: "",
    color: "",
    estimate: "",
    due_date: "",
    card_type: "",
  });

  // Move card via select
  const [moveToColumnId, setMoveToColumnId] = useState("");

  // Inline rename column
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");

  // Inline rename board
  const [editingBoardTitle, setEditingBoardTitle] = useState(false);
  const [boardTitleDraft, setBoardTitleDraft] = useState("");

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");

  // Collapsed columns
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(
    new Set(),
  );

  // Quick-add inline
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);

  // Color pickers
  const [columnColorPickerId, setColumnColorPickerId] = useState<string | null>(
    null,
  );
  const [showNewColumnColorPicker, setShowNewColumnColorPicker] =
    useState(false);
  const [showNewCardColorPicker, setShowNewCardColorPicker] = useState(false);
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);

  const isOwner =
    board?.owner_id === currentUser?.id || currentUser?.role === "admin";

  // Список учасників дошки (owner + members) — лише вони можуть бути виконавцями (без адмінів)
  const boardMembers: User[] = (() => {
    const members = (board?.members || []).filter((m) => m.role !== "admin");
    const owner = allUsers.find((u) => u.id === board?.owner_id);
    if (
      owner &&
      owner.role !== "admin" &&
      !members.some((m) => m.id === owner.id)
    ) {
      return [owner, ...members];
    }
    return members;
  })();

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const boardRes = await boardsApi.getById(boardId);
      setBoard(boardRes.data);

      // Завантажуємо картки для кожної колонки
      const cols: ColumnWithCards[] = [];
      if (boardRes.data.columns) {
        // Сортуємо колонки за position
        const sortedCols = [...boardRes.data.columns].sort(
          (a: Column, b: Column) => a.position - b.position,
        );
        for (const col of sortedCols) {
          const cardsRes = await cardsApi.getByColumn(col.id);
          cols.push({ ...col, cards: cardsRes.data });
        }
      }
      setColumns(cols);

      const usersRes = await usersApi.getAll();
      setAllUsers(usersRes.data);

      const canManageInvites =
        currentUser &&
        (boardRes.data.owner_id === currentUser.id ||
          currentUser.role === "admin");

      if (canManageInvites) {
        const invRes = await boardsApi.getPendingInvitations(boardId);
        const pendingInviteeIds = new Set<string>(
          (invRes.data as BoardInvitation[]).map((inv) => inv.invitee_id),
        );
        setInvitedUserIds(pendingInviteeIds);
      } else {
        setInvitedUserIds(new Set());
      }
    } catch {
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [boardId, navigate, currentUser]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // ----- Drag & Drop -----
  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, source, destination, type } = result;
    if (!destination) return;

    // Перетягування колонок (горизонтально)
    if (type === "COLUMN") {
      if (source.index === destination.index) return;

      const reordered = [...columns];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);

      // Оптимістично оновлюємо порядок і позиції
      const columnsWithPositions = reordered.map((col, idx) => ({
        ...col,
        position: idx,
      }));
      setColumns(columnsWithPositions);

      // Синхронізація з бекендом
      try {
        await Promise.all(
          columnsWithPositions.map((col, idx) =>
            boardsApi.updateColumn(col.id, { position: idx }),
          ),
        );
      } catch {
        fetchBoard(); // Відкат при помилці
      }
      return;
    }

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    // Оптимістичне оновлення UI
    const srcColIdx = columns.findIndex((c) => c.id === source.droppableId);
    const dstColIdx = columns.findIndex(
      (c) => c.id === destination.droppableId,
    );
    if (srcColIdx < 0 || dstColIdx < 0) return;

    const newColumns = [...columns];
    const srcCards = [...newColumns[srcColIdx].cards];
    const [movedCard] = srcCards.splice(source.index, 1);

    if (srcColIdx === dstColIdx) {
      srcCards.splice(destination.index, 0, movedCard);
      newColumns[srcColIdx] = { ...newColumns[srcColIdx], cards: srcCards };
    } else {
      const dstCards = [...newColumns[dstColIdx].cards];
      movedCard.column_id = destination.droppableId;
      dstCards.splice(destination.index, 0, movedCard);
      newColumns[srcColIdx] = { ...newColumns[srcColIdx], cards: srcCards };
      newColumns[dstColIdx] = { ...newColumns[dstColIdx], cards: dstCards };
    }
    setColumns(newColumns);

    // Синхронізація з бекендом
    try {
      await cardsApi.move(draggableId, {
        column_id: destination.droppableId,
        position: destination.index,
      });
    } catch {
      fetchBoard(); // Відкат при помилці
    }
  };

  // ----- Columns -----
  const handleAddColumn = async () => {
    if (!newColumnName.trim() || !boardId) return;
    setSavingColumn(true);
    try {
      await boardsApi.createColumn(boardId, {
        name: newColumnName,
        color: newColumnColor,
        position: columns.length,
      });
      setNewColumnName("");
      setNewColumnColor(null);
      setShowColumnDialog(false);
      toast.success("Колонку створено");
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка створення колонки");
    } finally {
      setSavingColumn(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm("Видалити колонку з усіма картками?")) return;
    try {
      await boardsApi.deleteColumn(columnId);
      toast.success("Колонку видалено");
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка видалення колонки");
    }
  };

  const startRenamingColumn = (column: Column) => {
    setEditingColumnId(column.id);
    setEditingColumnName(column.name);
  };

  const handleRenameColumn = async () => {
    if (!editingColumnId || !editingColumnName.trim()) {
      setEditingColumnId(null);
      return;
    }
    try {
      await boardsApi.updateColumn(editingColumnId, {
        name: editingColumnName.trim(),
      });
      setEditingColumnId(null);
      fetchBoard();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Помилка перейменування колонки",
      );
      setEditingColumnId(null);
    }
  };

  const colorDebounceRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const handleSetColumnColor = (columnId: string, color: string | null) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, color } : col)),
    );
  };

  const saveColumnColor = async (columnId: string, color: string | null) => {
    try {
      await boardsApi.updateColumn(columnId, { color });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка оновлення кольору");
    }
  };

  const debouncedSaveColumnColor = (columnId: string, color: string) => {
    clearTimeout(colorDebounceRef.current[columnId]);
    colorDebounceRef.current[columnId] = setTimeout(
      () => saveColumnColor(columnId, color),
      500,
    );
  };

  // ----- Cards -----
  const openAddCard = (columnId: string) => {
    setActiveColumnId(columnId);
    setCardForm({
      title: "",
      description: "",
      tags: "",
      assignee_id: "",
      priority: "",
      color: "",
      estimate: "",
      due_date: "",
      card_type: "basic",
    });
    setShowCardDialog(true);
  };

  const handleAddCard = async () => {
    if (!cardForm.title.trim() || !activeColumnId) return;
    setSavingCard(true);
    try {
      await cardsApi.create(activeColumnId, {
        title: cardForm.title,
        description: cardForm.description,
        tags: cardForm.tags
          ? cardForm.tags.split(",").map((t) => t.trim())
          : [],
        assignee_id: cardForm.assignee_id || null,
        priority: cardForm.priority || null,
        color: cardForm.color || null,
        estimate: cardForm.estimate ? parseFloat(cardForm.estimate) : null,
        due_date: cardForm.due_date || null,
        card_type: cardForm.card_type || null,
      });
      setShowCardDialog(false);
      toast.success("Картку створено");
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка створення картки");
    } finally {
      setSavingCard(false);
    }
  };

  const openCardDetail = async (card: CardType) => {
    setActiveCard(card);
    setIsEditing(false);
    setEditForm({
      title: card.title,
      description: card.description || "",
      tags: card.tags?.join(", ") || "",
      assignee_id: card.assignee_id || "",
      priority: card.priority || "",
      color: card.color || "",
      estimate: card.estimate != null ? String(card.estimate) : "",
      due_date: card.due_date || "",
      card_type: card.card_type || "basic",
    });
    setMoveToColumnId(card.column_id);
    setActiveTab("comments");
    setShowCardDetail(true);
    try {
      const [commentsRes, worklogsRes] = await Promise.all([
        cardsApi.getComments(card.id),
        cardsApi.getWorklogs(card.id),
      ]);
      setComments(commentsRes.data);
      setWorklogs(worklogsRes.data);
    } catch {}
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !activeCard) return;
    try {
      await cardsApi.addComment(activeCard.id, { text: commentText });
      setCommentText("");
      const res = await cardsApi.getComments(activeCard.id);
      setComments(res.data);
      toast.success("Коментар додано");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка додавання коментаря");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("Видалити картку?")) return;
    try {
      await cardsApi.delete(cardId);
      setShowCardDetail(false);
      toast.success("Картку видалено");
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка видалення картки");
    }
  };

  // Зберегти зміни картки (owner)
  const handleUpdateCard = async () => {
    if (!activeCard) return;
    setSavingEdit(true);
    try {
      const updatedRes = await cardsApi.update(activeCard.id, {
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags
          ? editForm.tags.split(",").map((t) => t.trim())
          : [],
        assignee_id:
          editForm.assignee_id && editForm.assignee_id !== "__none__"
            ? editForm.assignee_id
            : null,
        priority: editForm.priority || null,
        color: editForm.color || null,
        estimate: editForm.estimate ? parseFloat(editForm.estimate) : null,
        due_date: editForm.due_date || null,
        card_type: editForm.card_type || null,
      });
      setActiveCard(updatedRes.data);
      setIsEditing(false);
      toast.success("Картку оновлено");
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка оновлення картки");
    } finally {
      setSavingEdit(false);
    }
  };

  /** Конвертувати d/h/m у загальні години */
  const dhmToHours = (d: number, h: number, m: number): number =>
    d * 8 + h + m / 60;

  /** Години → Jira-формат "Xd Yh Zm" */
  const hoursToJira = (totalHours: number): string => {
    const totalMinutes = Math.round(totalHours * 60);
    const days = Math.floor(totalMinutes / (8 * 60));
    const remaining = totalMinutes % (8 * 60);
    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.length > 0 ? parts.join(" ") : "0m";
  };

  // Додати worklog
  const handleAddWorklog = async () => {
    if (!activeCard) return;
    setWorklogError("");

    const d = parseInt(worklogForm.days) || 0;
    const h = parseInt(worklogForm.hours) || 0;
    const m = parseInt(worklogForm.minutes) || 0;

    if (d < 0 || h < 0 || m < 0) {
      setWorklogError("Значення не можуть бути від'ємними");
      return;
    }
    if (d === 0 && h === 0 && m === 0) {
      setWorklogError("Вкажіть хоча б одне значення часу");
      return;
    }
    if (m > 59) {
      setWorklogError("Хвилини мають бути від 0 до 59");
      return;
    }
    if (h > 23) {
      setWorklogError("Години мають бути від 0 до 23");
      return;
    }

    const totalHours = dhmToHours(d, h, m);
    try {
      await cardsApi.addWorklog(activeCard.id, {
        hours: totalHours,
        description: worklogForm.description,
      });
      setWorklogForm({ days: "", hours: "", minutes: "", description: "" });
      const res = await cardsApi.getWorklogs(activeCard.id);
      setWorklogs(res.data);
      toast.success("Затрачений час додано");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Помилка додавання затраченого часу",
      );
    }
  };

  // Переміщення картки через select
  const handleMoveCardViaSelect = async (newColumnId: string) => {
    if (!activeCard || newColumnId === activeCard.column_id) return;
    setMoveToColumnId(newColumnId);
    try {
      await cardsApi.move(activeCard.id, {
        column_id: newColumnId,
        position: 0,
      });
      setActiveCard({ ...activeCard, column_id: newColumnId });
      fetchBoard();
      toast.success("Картку переміщено");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка переміщення картки");
      setMoveToColumnId(activeCard.column_id);
    }
  };

  // ----- Members (запрошення) -----
  const startRenamingBoard = () => {
    setEditingBoardTitle(true);
    setBoardTitleDraft(board?.title || "");
  };

  const handleRenameBoard = async () => {
    if (!boardId || !boardTitleDraft.trim()) {
      setEditingBoardTitle(false);
      return;
    }
    try {
      await boardsApi.update(boardId, { title: boardTitleDraft.trim() });
      setEditingBoardTitle(false);
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка перейменування дошки");
      setEditingBoardTitle(false);
    }
  };

  const handleInviteMember = async (userId: string) => {
    if (!boardId) return;
    if (invitedUserIds.has(userId) || invitingUserIds.has(userId)) return;

    setInvitingUserIds((prev) => new Set(prev).add(userId));
    try {
      await boardsApi.inviteMember(boardId, userId);
      setInvitedUserIds((prev) => new Set(prev).add(userId));
      toast.success("Запрошення надіслано!");
      fetchBoard();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string" && detail.includes("вже надіслано")) {
        setInvitedUserIds((prev) => new Set(prev).add(userId));
      }
      toast.error(detail || "Не вдалося надіслати запрошення");
    } finally {
      setInvitingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!boardId) return;
    try {
      await boardsApi.removeMember(boardId, userId);
      fetchBoard();
      toast.success("Учасника видалено");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка видалення учасника");
    }
  };

  // ----- Quick Add -----
  const handleQuickAdd = async (columnId: string) => {
    if (!quickAddTitle.trim()) {
      setQuickAddColumnId(null);
      setQuickAddTitle("");
      return;
    }
    setSavingQuickAdd(true);
    try {
      await cardsApi.create(columnId, { title: quickAddTitle.trim() });
      setQuickAddTitle("");
      setQuickAddColumnId(null);
      fetchBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка створення картки");
    } finally {
      setSavingQuickAdd(false);
    }
  };

  // ----- Helpers -----
  const toggleCollapse = (columnId: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getAvatarColor = (seed: string) => {
    const hue = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 70% 45%)`;
  };

  const DEFAULT_COLUMN_COLOR = "#d1d5db";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          Завантаження...
        </div>
      </div>
    );
  }

  const memberIds = new Set(board?.members?.map((m) => m.id) || []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container p-4">
        {/* Board header */}
        <div className="flex items-center justify-between mb-4">
          {editingBoardTitle ? (
            <Input
              className="text-2xl font-bold h-10 w-80"
              value={boardTitleDraft}
              onChange={(e) => setBoardTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameBoard();
                if (e.key === "Escape") setEditingBoardTitle(false);
              }}
              onBlur={handleRenameBoard}
              autoFocus
            />
          ) : (
            <h1
              className={`text-2xl font-bold ${isOwner ? "cursor-pointer hover:text-primary" : ""}`}
              onDoubleClick={() => isOwner && startRenamingBoard()}
              title={isOwner ? "Подвійний клік для редагування" : undefined}
            >
              {board?.title}
            </h1>
          )}
          <div className="flex gap-2">
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMembersDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" /> Учасники
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewColumnName("");
                setNewColumnColor(null);
                setShowColumnDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Колонка
            </Button>
          </div>
        </div>

        {/* Members bar */}
        {/* Search + Members bar */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Пошук карток..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 w-52"
            />
          </div>
          {board?.members && board.members.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Учасники:</span>
              {board.members.map((m) => (
                <div
                  key={m.id}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                  style={{
                    backgroundColor: getAvatarColor(m.username),
                  }}
                  title={m.username}
                >
                  {getInitials(m.username)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kanban board with DnD */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable
            droppableId="board-columns"
            direction="horizontal"
            type="COLUMN"
          >
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-4 overflow-x-auto pb-4"
                style={{ minHeight: "60vh" }}
              >
                {columns.map((column, columnIndex) => {
                  const accentColor = column.color ?? DEFAULT_COLUMN_COLOR;
                  const isCollapsed = collapsedColumns.has(column.id);
                  const filteredCards = searchQuery.trim()
                    ? column.cards.filter(
                        (c) =>
                          c.title
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          c.tags?.some((t) =>
                            t.toLowerCase().includes(searchQuery.toLowerCase()),
                          ) ||
                          c.assignee?.username
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()),
                      )
                    : column.cards;
                  return (
                    <Draggable
                      key={column.id}
                      draggableId={`column-${column.id}`}
                      index={columnIndex}
                      isDragDisabled={!isOwner}
                    >
                      {(columnProvided) => (
                        <div
                          ref={columnProvided.innerRef}
                          {...columnProvided.draggableProps}
                          className="flex-shrink-0 w-72"
                        >
                          <div className="bg-card rounded-lg border shadow-sm">
                            {/* Column accent bar */}
                            <div
                              className="h-1.5 rounded-t-lg"
                              style={{ backgroundColor: accentColor }}
                            />
                            {/* Column header */}
                            <div className="flex items-center justify-between p-3 border-b">
                              {editingColumnId === column.id ? (
                                <Input
                                  className="h-7 text-sm font-semibold flex-1 mr-2"
                                  value={editingColumnName}
                                  onChange={(e) =>
                                    setEditingColumnName(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameColumn();
                                    if (e.key === "Escape")
                                      setEditingColumnId(null);
                                  }}
                                  onBlur={handleRenameColumn}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex items-center gap-2 min-w-0">
                                  <h3
                                    className="font-semibold text-sm cursor-pointer hover:text-primary truncate"
                                    onDoubleClick={() =>
                                      startRenamingColumn(column)
                                    }
                                    title="Подвійний клік для редагування"
                                  >
                                    {column.name}
                                  </h3>
                                  <span
                                    className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white shrink-0"
                                    style={{ backgroundColor: accentColor }}
                                  >
                                    {filteredCards.length}
                                  </span>
                                </div>
                              )}
                              <div className="flex gap-1 shrink-0">
                                {isOwner && (
                                  <span
                                    {...columnProvided.dragHandleProps}
                                    className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground cursor-grab"
                                  >
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {isOwner && (
                                  <>
                                    <div
                                      className="relative"
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        className="h-7 w-7 rounded border cursor-pointer shrink-0"
                                        style={{
                                          backgroundColor:
                                            column.color ??
                                            DEFAULT_COLUMN_COLOR,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setColumnColorPickerId(
                                            columnColorPickerId === column.id
                                              ? null
                                              : column.id,
                                          );
                                        }}
                                        title="Колір колонки"
                                      />
                                      {columnColorPickerId === column.id && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-40"
                                            onClick={() =>
                                              setColumnColorPickerId(null)
                                            }
                                          />
                                          <div className="absolute top-8 right-0 z-50">
                                            <HexColorPicker
                                              color={
                                                column.color ??
                                                DEFAULT_COLUMN_COLOR
                                              }
                                              onChange={(hex) => {
                                                handleSetColumnColor(
                                                  column.id,
                                                  hex,
                                                );
                                                debouncedSaveColumnColor(
                                                  column.id,
                                                  hex,
                                                );
                                              }}
                                            />
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    {column.color && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          setColumnColorPickerId(null);
                                          saveColumnColor(column.id, null);
                                          handleSetColumnColor(column.id, null);
                                        }}
                                        title="Скинути колір"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleCollapse(column.id)}
                                  title={
                                    isCollapsed ? "Розгорнути" : "Згорнути"
                                  }
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openAddCard(column.id)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteColumn(column.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            {/* Droppable area */}
                            {!isCollapsed && (
                              <Droppable droppableId={column.id} type="CARD">
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-2 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                                  >
                                    {filteredCards.length === 0 &&
                                      !snapshot.isDraggingOver && (
                                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 select-none">
                                          <div className="text-3xl mb-1">
                                            · · ·
                                          </div>
                                          <span className="text-xs">
                                            {searchQuery
                                              ? "Нічого не знайдено"
                                              : "Перетягніть сюди картку"}
                                          </span>
                                        </div>
                                      )}
                                    {filteredCards.map((card, index) => (
                                      <Draggable
                                        key={card.id}
                                        draggableId={card.id}
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`mb-2 bg-card border rounded-md shadow-sm cursor-pointer hover:shadow transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
                                            onClick={() => openCardDetail(card)}
                                          >
                                            {card.color && (
                                              <div
                                                className="h-1.5 rounded-t-md"
                                                style={{
                                                  backgroundColor: card.color,
                                                }}
                                              />
                                            )}
                                            <div className="p-3">
                                              <div className="flex items-start gap-2">
                                                <div
                                                  {...provided.dragHandleProps}
                                                  className="mt-0.5"
                                                >
                                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-medium text-sm truncate">
                                                    {card.title}
                                                  </p>
                                                  {card.priority && (
                                                    <Badge
                                                      variant={
                                                        card.priority === "high"
                                                          ? "destructive"
                                                          : card.priority ===
                                                              "medium"
                                                            ? "default"
                                                            : "secondary"
                                                      }
                                                      className="text-xs py-0 mt-1"
                                                    >
                                                      {card.priority === "high"
                                                        ? "Високий"
                                                        : card.priority ===
                                                            "medium"
                                                          ? "Середній"
                                                          : "Низький"}
                                                    </Badge>
                                                  )}
                                                  {/* Assignee avatar + comment count */}
                                                  {(card.assignee ||
                                                    (card.comments_count ?? 0) >
                                                      0) && (
                                                    <div className="flex items-center justify-between mt-1.5">
                                                      {card.assignee ? (
                                                        <div className="flex items-center gap-1.5">
                                                          <div
                                                            className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                            style={{
                                                              backgroundColor:
                                                                getAvatarColor(
                                                                  card.assignee
                                                                    .username,
                                                                ),
                                                            }}
                                                            title={
                                                              card.assignee
                                                                .username
                                                            }
                                                          >
                                                            {getInitials(
                                                              card.assignee
                                                                .username,
                                                            )}
                                                          </div>
                                                          <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                                                            {
                                                              card.assignee
                                                                .username
                                                            }
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <span />
                                                      )}
                                                      {(card.comments_count ??
                                                        0) > 0 && (
                                                        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                                          <MessageSquare className="h-3 w-3" />
                                                          <span>
                                                            {
                                                              card.comments_count
                                                            }
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                  {card.tags &&
                                                    card.tags.length > 0 && (
                                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {card.tags.map(
                                                          (tag, i) => (
                                                            <Badge
                                                              key={i}
                                                              variant="outline"
                                                              className="text-xs py-0"
                                                            >
                                                              {tag}
                                                            </Badge>
                                                          ),
                                                        )}
                                                      </div>
                                                    )}
                                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {card.card_type &&
                                                      card.card_type !==
                                                        "basic" && (
                                                        <Badge
                                                          variant="outline"
                                                          className="text-xs py-0"
                                                        >
                                                          {card.card_type ===
                                                          "urgent"
                                                            ? "Термінова"
                                                            : card.card_type ===
                                                                "bug"
                                                              ? "Баг"
                                                              : card.card_type ===
                                                                  "feature"
                                                                ? "Фіча"
                                                                : card.card_type}
                                                        </Badge>
                                                      )}
                                                    {card.due_date && (
                                                      <Badge
                                                        variant={
                                                          new Date(
                                                            card.due_date,
                                                          ) < new Date()
                                                            ? "destructive"
                                                            : "outline"
                                                        }
                                                        className="text-xs py-0 flex items-center gap-0.5"
                                                      >
                                                        <CalendarDays className="h-3 w-3" />
                                                        {new Date(
                                                          card.due_date,
                                                        ).toLocaleDateString(
                                                          "uk-UA",
                                                        )}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  {/* Mini worklog progress */}
                                                  {card.estimate != null &&
                                                    card.estimate > 0 &&
                                                    (() => {
                                                      const logged =
                                                        card.logged_hours ?? 0;
                                                      const pct = Math.min(
                                                        (logged /
                                                          card.estimate) *
                                                          100,
                                                        100,
                                                      );
                                                      const isOver =
                                                        logged > card.estimate;
                                                      return (
                                                        <div className="mt-1.5">
                                                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                                            <span className="flex items-center gap-0.5">
                                                              <Clock className="h-2.5 w-2.5" />
                                                              {logged}h /{" "}
                                                              {card.estimate}h
                                                            </span>
                                                            {isOver && (
                                                              <span className="text-red-500">
                                                                +
                                                                {(
                                                                  logged -
                                                                  card.estimate
                                                                ).toFixed(1)}
                                                                h
                                                              </span>
                                                            )}
                                                          </div>
                                                          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                                                            <div
                                                              className={`h-1 transition-all ${isOver ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
                                                              style={{
                                                                width: `${pct}%`,
                                                              }}
                                                            />
                                                          </div>
                                                        </div>
                                                      );
                                                    })()}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                            {/* Quick-add card */}
                            {!isCollapsed && !searchQuery && (
                              <div className="px-2 pb-2">
                                {quickAddColumnId === column.id ? (
                                  <div className="flex gap-1">
                                    <Input
                                      autoFocus
                                      className="h-7 text-xs"
                                      placeholder="Назва картки..."
                                      value={quickAddTitle}
                                      onChange={(e) =>
                                        setQuickAddTitle(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleQuickAdd(column.id);
                                        if (e.key === "Escape") {
                                          setQuickAddColumnId(null);
                                          setQuickAddTitle("");
                                        }
                                      }}
                                      disabled={savingQuickAdd}
                                    />
                                    <Button
                                      size="icon"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => handleQuickAdd(column.id)}
                                      disabled={savingQuickAdd}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => {
                                        setQuickAddColumnId(null);
                                        setQuickAddTitle("");
                                      }}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground py-1 px-1 rounded hover:bg-muted/50 transition-colors flex items-center gap-1"
                                    onClick={() => {
                                      setQuickAddColumnId(column.id);
                                      setQuickAddTitle("");
                                    }}
                                  >
                                    <Plus className="h-3 w-3" /> Додати картку
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* ----- Dialog: Add Column ----- */}
      <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова колонка</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Назва</Label>
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Назва колонки"
                onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
              />
            </div>
            <div className="space-y-2">
              <Label>Колір (опційно)</Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="h-9 w-9 rounded border cursor-pointer"
                    style={{
                      backgroundColor: newColumnColor ?? DEFAULT_COLUMN_COLOR,
                    }}
                    onClick={() =>
                      setShowNewColumnColorPicker(!showNewColumnColorPicker)
                    }
                    title="Вибрати колір"
                  />
                  {showNewColumnColorPicker && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowNewColumnColorPicker(false)}
                      />
                      <div className="absolute top-10 left-0 z-50">
                        <HexColorPicker
                          color={newColumnColor ?? DEFAULT_COLUMN_COLOR}
                          onChange={(hex) => setNewColumnColor(hex)}
                        />
                      </div>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewColumnColor(null);
                    setShowNewColumnColorPicker(false);
                  }}
                >
                  Без кольору
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Якщо колір не задано, використовується світло-сірий.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddColumn} disabled={savingColumn}>
              {savingColumn ? "Створення..." : "Створити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Dialog: Add Card ----- */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова картка</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Назва</Label>
              <Input
                value={cardForm.title}
                onChange={(e) =>
                  setCardForm({ ...cardForm, title: e.target.value })
                }
                placeholder="Назва картки"
              />
            </div>
            <div className="space-y-2">
              <Label>Опис</Label>
              <Textarea
                value={cardForm.description}
                onChange={(e) =>
                  setCardForm({ ...cardForm, description: e.target.value })
                }
                placeholder="Опис..."
              />
            </div>
            <div className="space-y-2">
              <Label>Теги (через кому)</Label>
              <Input
                value={cardForm.tags}
                onChange={(e) =>
                  setCardForm({ ...cardForm, tags: e.target.value })
                }
                placeholder="баг, терміново"
              />
            </div>
            <div className="space-y-2">
              <Label>Виконавець</Label>
              <Select
                value={cardForm.assignee_id}
                onValueChange={(val) =>
                  setCardForm({ ...cardForm, assignee_id: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть виконавця" />
                </SelectTrigger>
                <SelectContent>
                  {boardMembers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Пріоритет</Label>
              <Select
                value={cardForm.priority}
                onValueChange={(val) =>
                  setCardForm({ ...cardForm, priority: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть пріоритет" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низький</SelectItem>
                  <SelectItem value="medium">Середній</SelectItem>
                  <SelectItem value="high">Високий</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Колір</Label>
              <div className="relative inline-block">
                <button
                  type="button"
                  className="h-9 w-9 rounded border cursor-pointer"
                  style={{ backgroundColor: cardForm.color || "#3b82f6" }}
                  onClick={() =>
                    setShowNewCardColorPicker(!showNewCardColorPicker)
                  }
                  title="Вибрати колір"
                />
                {showNewCardColorPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNewCardColorPicker(false)}
                    />
                    <div className="absolute top-10 left-0 z-50">
                      <HexColorPicker
                        color={cardForm.color || "#3b82f6"}
                        onChange={(hex) =>
                          setCardForm({ ...cardForm, color: hex })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Оцінка часу (годин)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={cardForm.estimate}
                onChange={(e) =>
                  setCardForm({ ...cardForm, estimate: e.target.value })
                }
                placeholder="Оцінка в годинах"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип картки</Label>
              <Select
                value={cardForm.card_type}
                onValueChange={(val) =>
                  setCardForm({ ...cardForm, card_type: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Звичайна</SelectItem>
                  <SelectItem value="urgent">Термінова</SelectItem>
                  <SelectItem value="bug">Баг</SelectItem>
                  <SelectItem value="feature">Фіча</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Крайній термін</Label>
              <Input
                type="date"
                value={cardForm.due_date}
                onChange={(e) =>
                  setCardForm({ ...cardForm, due_date: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCard} disabled={savingCard}>
              {savingCard ? "Створення..." : "Створити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Dialog: Card Detail ----- */}
      <Dialog open={showCardDetail} onOpenChange={setShowCardDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              {isEditing ? (
                <Input
                  className="text-lg font-semibold"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                />
              ) : (
                <span>{activeCard?.title}</span>
              )}
              <div className="flex gap-1 ml-2 shrink-0">
                {isOwner && !isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Редагувати
                  </Button>
                )}
                {isEditing && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleUpdateCard}
                      disabled={savingEdit}
                    >
                      <Check className="h-4 w-4 mr-1" />{" "}
                      {savingEdit ? "Збереження..." : "Зберегти"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        if (activeCard) {
                          setEditForm({
                            title: activeCard.title,
                            description: activeCard.description || "",
                            tags: activeCard.tags?.join(", ") || "",
                            assignee_id: activeCard.assignee_id || "",
                            priority: activeCard.priority || "",
                            color: activeCard.color || "",
                            estimate:
                              activeCard.estimate != null
                                ? String(activeCard.estimate)
                                : "",
                            due_date: activeCard.due_date || "",
                            card_type: activeCard.card_type || "basic",
                          });
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {isOwner && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      activeCard && handleDeleteCard(activeCard.id)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Переміщення картки через select (для owner і member) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1">
                <ArrowRight className="h-3.5 w-3.5" /> Колонка
              </Label>
              <Select
                value={moveToColumnId}
                onValueChange={handleMoveCardViaSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Оберіть колонку" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground">Опис</Label>
              {isEditing ? (
                <Textarea
                  className="mt-1"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  placeholder="Опис..."
                />
              ) : (
                <p className="text-sm mt-1">
                  {activeCard?.description || "Немає опису"}
                </p>
              )}
            </div>

            {/* Виконавець — owner може редагувати */}
            <div>
              <Label className="text-muted-foreground">Виконавець</Label>
              {isEditing ? (
                <Select
                  value={editForm.assignee_id}
                  onValueChange={(val) =>
                    setEditForm({ ...editForm, assignee_id: val })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Оберіть виконавця" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не призначено</SelectItem>
                    {boardMembers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm mt-1">
                  {activeCard?.assignee?.username || "Не призначено"}
                </p>
              )}
            </div>

            <div className="flex gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Створено</Label>
                <p className="mt-1">
                  {activeCard
                    ? new Date(activeCard.created_at).toLocaleString("uk-UA")
                    : ""}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Оновлено</Label>
                <p className="mt-1">
                  {activeCard
                    ? new Date(activeCard.updated_at).toLocaleString("uk-UA")
                    : ""}
                </p>
              </div>
            </div>

            {/* Теги — owner може редагувати */}
            <div>
              <Label className="text-muted-foreground">Теги</Label>
              {isEditing ? (
                <Input
                  className="mt-1"
                  value={editForm.tags}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tags: e.target.value })
                  }
                  placeholder="баг, терміново"
                />
              ) : activeCard?.tags && activeCard.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {activeCard.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">
                  Немає тегів
                </p>
              )}
            </div>

            {/* Пріоритет */}
            <div>
              <Label className="text-muted-foreground">Пріоритет</Label>
              {isEditing ? (
                <Select
                  value={editForm.priority || "__none__"}
                  onValueChange={(val) =>
                    setEditForm({
                      ...editForm,
                      priority: val === "__none__" ? "" : val,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Оберіть пріоритет" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без пріоритету</SelectItem>
                    <SelectItem value="low">Низький</SelectItem>
                    <SelectItem value="medium">Середній</SelectItem>
                    <SelectItem value="high">Високий</SelectItem>
                  </SelectContent>
                </Select>
              ) : activeCard?.priority ? (
                <Badge
                  variant={
                    activeCard.priority === "high"
                      ? "destructive"
                      : activeCard.priority === "medium"
                        ? "default"
                        : "secondary"
                  }
                  className="mt-1"
                >
                  {activeCard.priority}
                </Badge>
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">Не вказано</p>
              )}
            </div>

            {/* Колір */}
            <div>
              <Label className="text-muted-foreground">Колір</Label>
              {isEditing ? (
                <div className="mt-1 relative inline-block">
                  <button
                    type="button"
                    className="h-8 w-8 rounded border cursor-pointer"
                    style={{ backgroundColor: editForm.color || "#3b82f6" }}
                    onClick={() => setShowEditColorPicker(!showEditColorPicker)}
                    title="Вибрати колір"
                  />
                  {showEditColorPicker && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowEditColorPicker(false)}
                      />
                      <div className="absolute top-9 left-0 z-50">
                        <HexColorPicker
                          color={editForm.color || "#3b82f6"}
                          onChange={(hex) =>
                            setEditForm({ ...editForm, color: hex })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : activeCard?.color ? (
                <div
                  className="mt-1 w-8 h-8 rounded border"
                  style={{ backgroundColor: activeCard.color }}
                />
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">Не вказано</p>
              )}
            </div>

            {/* Тип картки */}
            <div>
              <Label className="text-muted-foreground">Тип картки</Label>
              {isEditing ? (
                <Select
                  value={editForm.card_type || "basic"}
                  onValueChange={(val) =>
                    setEditForm({ ...editForm, card_type: val })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Оберіть тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Звичайна</SelectItem>
                    <SelectItem value="urgent">Термінова</SelectItem>
                    <SelectItem value="bug">Баг</SelectItem>
                    <SelectItem value="feature">Фіча</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="mt-1">
                  {activeCard?.card_type === "urgent"
                    ? "Термінова"
                    : activeCard?.card_type === "bug"
                      ? "Баг"
                      : activeCard?.card_type === "feature"
                        ? "Фіча"
                        : "Звичайна"}
                </Badge>
              )}
            </div>

            {/* Крайній термін */}
            <div>
              <Label className="text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Крайній термін
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  className="mt-1"
                  value={editForm.due_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, due_date: e.target.value })
                  }
                />
              ) : activeCard?.due_date ? (
                <p
                  className={`text-sm mt-1 ${new Date(activeCard.due_date) < new Date() ? "text-red-500 font-medium" : ""}`}
                >
                  {new Date(activeCard.due_date).toLocaleDateString("uk-UA")}
                  {new Date(activeCard.due_date) < new Date() &&
                    " (прострочено)"}
                </p>
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">Не вказано</p>
              )}
            </div>

            {/* Оцінка часу + Progress */}
            <div>
              <Label className="text-muted-foreground">
                Оцінка часу (годин)
              </Label>
              {isEditing ? (
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  className="mt-1"
                  value={editForm.estimate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, estimate: e.target.value })
                  }
                  placeholder="Оцінка в годинах"
                />
              ) : activeCard?.estimate != null ? (
                <>
                  <p className="text-sm mt-1">
                    {hoursToJira(activeCard.estimate)}
                  </p>
                  {(() => {
                    const totalLogged = worklogs.reduce(
                      (sum, w) => sum + w.hours,
                      0,
                    );
                    const pct =
                      activeCard.estimate > 0
                        ? (totalLogged / activeCard.estimate) * 100
                        : 0;
                    const isOver = pct > 100;
                    const greenWidth = isOver ? (100 / pct) * 100 : pct;
                    const redWidth = isOver ? 100 - greenWidth : 0;
                    return (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            Записано: {hoursToJira(totalLogged)} /{" "}
                            {hoursToJira(activeCard.estimate)}
                          </span>
                          <span
                            className={isOver ? "text-red-500 font-medium" : ""}
                          >
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 flex overflow-hidden">
                          <div
                            className={`h-2.5 transition-all ${pct >= 80 && !isOver ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${greenWidth}%` }}
                          />
                          {isOver && (
                            <div
                              className="h-2.5 bg-red-500 transition-all"
                              style={{ width: `${redWidth}%` }}
                            />
                          )}
                        </div>
                        {isOver && (
                          <p className="text-xs text-red-500 mt-1">
                            Перевищення: +
                            {hoursToJira(totalLogged - activeCard.estimate)} (
                            {(pct - 100).toFixed(0)}%)
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">Не вказано</p>
              )}
            </div>

            {/* Tabs: Коментарі / Worklogs */}
            <div className="border-t pt-4">
              <div className="flex gap-4 mb-3 border-b">
                <button
                  className={`pb-2 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${activeTab === "comments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("comments")}
                >
                  <MessageSquare className="h-4 w-4" />
                  Коментарі ({comments.length})
                </button>
                <button
                  className={`pb-2 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${activeTab === "worklogs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("worklogs")}
                >
                  <Clock className="h-4 w-4" />
                  Затрачений час ({worklogs.length})
                </button>
              </div>

              {activeTab === "comments" && (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-muted p-2 rounded text-sm">
                        <span className="font-medium">
                          {c.author?.username || "Анонім"}
                        </span>
                        <span className="text-muted-foreground text-xs ml-2">
                          {new Date(c.created_at).toLocaleString("uk-UA")}
                        </span>
                        <p className="mt-1">{c.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Додати коментар..."
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    />
                    <Button size="sm" onClick={handleAddComment}>
                      Надіслати
                    </Button>
                  </div>
                </>
              )}

              {activeTab === "worklogs" && (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {worklogs.map((w) => (
                      <div key={w.id} className="bg-muted p-2 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {w.author?.username || "Анонім"}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {new Date(w.created_at).toLocaleString("uk-UA")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {hoursToJira(w.hours)}
                          </Badge>
                          {w.description && (
                            <span className="text-muted-foreground">
                              {w.description}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {worklogError && (
                    <p className="text-sm text-red-500 mt-2">{worklogError}</p>
                  )}
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2 items-end">
                      <div className="w-20">
                        <Label className="text-xs text-muted-foreground">
                          Дні
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0.5"
                          value={worklogForm.days}
                          onChange={(e) =>
                            setWorklogForm({
                              ...worklogForm,
                              days: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs text-muted-foreground">
                          Години
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          className="mt-0.5"
                          value={worklogForm.hours}
                          onChange={(e) =>
                            setWorklogForm({
                              ...worklogForm,
                              hours: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs text-muted-foreground">
                          Хвилини
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          className="mt-0.5"
                          value={worklogForm.minutes}
                          onChange={(e) =>
                            setWorklogForm({
                              ...worklogForm,
                              minutes: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        value={worklogForm.description}
                        onChange={(e) =>
                          setWorklogForm({
                            ...worklogForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Опис роботи..."
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddWorklog()
                        }
                      />
                      <Button size="sm" onClick={handleAddWorklog}>
                        Додати
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      1d = 8 годин
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ----- Dialog: Members ----- */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Управління учасниками</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label>Поточні учасники</Label>
            {board?.members && board.members.length > 0 ? (
              <div className="space-y-2">
                {board.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-muted p-2 rounded"
                  >
                    <span className="text-sm">
                      {m.username} ({m.email})
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveMember(m.id)}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Немає учасників</p>
            )}

            <Label className="mt-4">Запросити учасника</Label>
            <div className="space-y-2">
              {allUsers
                .filter(
                  (u) =>
                    u.id !== board?.owner_id &&
                    !memberIds.has(u.id) &&
                    u.role !== "admin",
                )
                .map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                  >
                    <span className="text-sm">
                      {u.username} ({u.email})
                    </span>
                    {invitedUserIds.has(u.id) ? (
                      <Button variant="secondary" size="sm" disabled>
                        <Check className="h-4 w-4 mr-1" /> Запрошення надіслано
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInviteMember(u.id)}
                        disabled={invitingUserIds.has(u.id)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        {invitingUserIds.has(u.id)
                          ? "Надсилаємо..."
                          : "Запросити"}
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
