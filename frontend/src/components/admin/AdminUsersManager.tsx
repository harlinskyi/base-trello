import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/types";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { usersApi } from "@/lib/api";

export function AdminUsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    role: "user",
  });
  const currentUser = useAuthStore((state) => state.user);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll();
      setUsers(res.data);
    } catch {
      toast.error("Не вдалося завантажити користувачів");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role,
    });
  };

  const handleSave = async () => {
    if (!editUser) return;

    try {
      await usersApi.adminUpdate(editUser.id, editForm);
      setEditUser(null);
      toast.success("Користувача оновлено");
      fetchUsers();
    } catch {
      toast.error("Не вдалося зберегти зміни");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Видалити користувача?")) return;

    try {
      await usersApi.adminDelete(userId);
      toast.success("Користувача видалено");
      fetchUsers();
    } catch {
      toast.error("Не вдалося видалити користувача");
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Користувачі системи</h2>
          <p className="text-sm text-muted-foreground">
            Редагування профілів та ролей доступне лише адміністраторам.
          </p>
        </div>
        <Badge variant="outline">Всього {users.length}</Badge>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-card py-10 text-center text-muted-foreground shadow-sm">
          Завантаження користувачів...
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Username</th>
                <th className="p-3 text-left font-medium">Email</th>
                <th className="p-3 text-left font-medium">Роль</th>
                <th className="p-3 text-left font-medium">Створено</th>
                <th className="p-3 text-right font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">{user.username}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${user.role === "admin" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("uk-UA")}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати користувача</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={editForm.username}
                onChange={(e) =>
                  setEditForm({ ...editForm, username: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Скасувати
            </Button>
            <Button onClick={handleSave}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
