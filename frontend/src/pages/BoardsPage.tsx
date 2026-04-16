/**
 * Сторінка зі списком дощок користувача.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { Board } from "@/types";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardsApi } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const fetchBoards = async () => {
    try {
      const res = await boardsApi.getAll();
      setBoards(res.data);
    } catch {
      toast.error("Не вдалося завантажити дошки");
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  useEffect(() => {
    const handleBoardsRefresh = () => {
      fetchBoards();
    };

    window.addEventListener("boards:refresh", handleBoardsRefresh);
    return () => {
      window.removeEventListener("boards:refresh", handleBoardsRefresh);
    };
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await boardsApi.create({ title: newTitle });
      setNewTitle("");
      setDialogOpen(false);
      toast.success("Дошку створено");
      fetchBoards();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка створення");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Видалити дошку?")) return;
    setDeletingId(id);
    try {
      await boardsApi.delete(id);
      toast.success("Дошку видалено");
      fetchBoards();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Помилка видалення");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Мої дошки</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Нова дошка
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Створити дошку</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Назва дошки</Label>
                  <Input
                    id="title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Моя нова дошка"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Створення..." : "Створити"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {boards.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>У вас ще немає дошок. Створіть першу!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board) => (
              <Card
                key={board.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">{board.title}</CardTitle>
                  {(board.owner_id === user?.id || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingId === board.id}
                      onClick={(e) => handleDelete(board.id, e)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Власник: {board.owner?.username || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Створено:{" "}
                    {new Date(board.created_at).toLocaleDateString("uk-UA")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
