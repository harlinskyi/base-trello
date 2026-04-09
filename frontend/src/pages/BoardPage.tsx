/**
 * Сторінка Kanban-дошки з Drag-and-Drop (@hello-pangea/dnd).
 * Архітектура: компонент-контролер (MVC — Controller).
 * View — KanbanColumn та KanbanCard.
 */

import { useEffect, useState, useCallback } from "react";
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
  const [invitingUserIds, setInvitingUserIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [newColumnName, setNewColumnName] = useState("");
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
        (boardRes.data.owner_id === currentUser.id || currentUser.role === "admin");

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
        position: columns.length,
      });
      setNewColumnName("");
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
      toast.success("Worklog додано");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка додавання worklog");
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
      toast.error(
        detail || "Не вдалося надіслати запрошення",
      );
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          Завантаження...
        </div>
      </div>
    );
  }

  const memberIds = new Set(board?.members?.map((m) => m.id) || []);

  return (
    <div className="min-h-screen bg-gray-50">
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
              onClick={() => setShowColumnDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Колонка
            </Button>
          </div>
        </div>

        {/* Members bar */}
        {board?.members && board.members.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Учасники:</span>
            {board.members.map((m) => (
              <Badge key={m.id} variant="secondary">
                {m.username}
              </Badge>
            ))}
          </div>
        )}

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
                {columns.map((column, columnIndex) => (
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
                        <div className="bg-white rounded-lg border shadow-sm">
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between p-3 border-b"
                    {...columnProvided.dragHandleProps}
                  >
                    {editingColumnId === column.id ? (
                      <Input
                        className="h-7 text-sm font-semibold flex-1 mr-2"
                        value={editingColumnName}
                        onChange={(e) => setEditingColumnName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameColumn();
                          if (e.key === "Escape") setEditingColumnId(null);
                        }}
                        onBlur={handleRenameColumn}
                        autoFocus
                      />
                    ) : (
                      <h3
                        className="font-semibold text-sm cursor-pointer hover:text-primary truncate"
                        onDoubleClick={() => startRenamingColumn(column)}
                        title="Подвійний клік для редагування"
                      >
                        {column.name}
                      </h3>
                    )}
                    <div className="flex gap-1">
                      {isOwner && (
                        <span className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground">
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      )}
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
                  <Droppable droppableId={column.id} type="CARD">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-2 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? "bg-blue-50" : ""}`}
                      >
                        {column.cards.map((card, index) => (
                          <Draggable
                            key={card.id}
                            draggableId={card.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`mb-2 bg-white border rounded-md shadow-sm cursor-pointer hover:shadow transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
                                onClick={() => openCardDetail(card)}
                              >
                                {card.color && (
                                  <div
                                    className="h-1.5 rounded-t-md"
                                    style={{ backgroundColor: card.color }}
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
                                              : card.priority === "medium"
                                                ? "default"
                                                : "secondary"
                                          }
                                          className="text-xs py-0 mt-1"
                                        >
                                          {card.priority}
                                        </Badge>
                                      )}
                                      {card.assignee && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Виконавець: {card.assignee.username}
                                        </p>
                                      )}
                                      {card.tags && card.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {card.tags.map((tag, i) => (
                                            <Badge
                                              key={i}
                                              variant="outline"
                                              className="text-xs py-0"
                                            >
                                              {tag}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {card.card_type &&
                                          card.card_type !== "basic" && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs py-0"
                                            >
                                              {card.card_type === "urgent"
                                                ? "Термінова"
                                                : card.card_type === "bug"
                                                  ? "Баг"
                                                  : card.card_type === "feature"
                                                    ? "Фіча"
                                                    : card.card_type}
                                            </Badge>
                                          )}
                                        {card.due_date && (
                                          <Badge
                                            variant={
                                              new Date(card.due_date) <
                                              new Date()
                                                ? "destructive"
                                                : "outline"
                                            }
                                            className="text-xs py-0 flex items-center gap-0.5"
                                          >
                                            <CalendarDays className="h-3 w-3" />
                                            {new Date(
                                              card.due_date,
                                            ).toLocaleDateString("uk-UA")}
                                          </Badge>
                                        )}
                                      </div>
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
                </div>
                      </div>
                    )}
                  </Draggable>
                ))}
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
              <Input
                type="color"
                value={cardForm.color || "#3b82f6"}
                onChange={(e) =>
                  setCardForm({ ...cardForm, color: e.target.value })
                }
              />
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
                <Input
                  type="color"
                  className="mt-1 w-20 h-8"
                  value={editForm.color || "#3b82f6"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, color: e.target.value })
                  }
                />
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
              <Label className="text-muted-foreground">Оцінка часу (годин)</Label>
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
                  Worklogs ({worklogs.length})
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
