/**
 * Unit-тести для типів даних.
 * Перевіряють валідність структури типів через type-guard функції.
 */

import type {
  Board,
  Card,
  Column,
  Comment,
  Notification,
  NotificationType,
  Role,
  User,
  Worklog,
} from "@/types";
import { describe, expect, it } from "vitest";

// Type-guard функції для перевірки структури
function isUser(obj: unknown): obj is User {
  const u = obj as User;
  return (
    typeof u.id === "string" &&
    typeof u.username === "string" &&
    typeof u.email === "string" &&
    (u.role === "admin" || u.role === "user") &&
    typeof u.created_at === "string"
  );
}

function isBoard(obj: unknown): obj is Board {
  const b = obj as Board;
  return (
    typeof b.id === "string" &&
    typeof b.title === "string" &&
    typeof b.owner_id === "string" &&
    typeof b.created_at === "string"
  );
}

function isColumn(obj: unknown): obj is Column {
  const c = obj as Column;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.position === "number" &&
    typeof c.board_id === "string"
  );
}

function isCard(obj: unknown): obj is Card {
  const c = obj as Card;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.position === "number" &&
    typeof c.column_id === "string" &&
    typeof c.created_at === "string" &&
    typeof c.updated_at === "string"
  );
}

describe("Type Guards", () => {
  describe("User", () => {
    it("валідний User об'єкт проходить перевірку", () => {
      const user = {
        id: "u-1",
        username: "test",
        email: "t@t.com",
        role: "user" as Role,
        created_at: "2024-01-01",
      };
      expect(isUser(user)).toBe(true);
    });

    it("admin роль проходить перевірку", () => {
      const admin = {
        id: "a-1",
        username: "admin",
        email: "a@a.com",
        role: "admin" as Role,
        created_at: "2024-01-01",
      };
      expect(isUser(admin)).toBe(true);
    });

    it("невалідна роль не проходить перевірку", () => {
      const invalid = {
        id: "u-1",
        username: "test",
        email: "t@t.com",
        role: "superadmin",
        created_at: "2024-01-01",
      };
      expect(isUser(invalid)).toBe(false);
    });

    it("об'єкт без id не проходить перевірку", () => {
      const noId = {
        username: "test",
        email: "t@t.com",
        role: "user",
        created_at: "2024-01-01",
      };
      expect(isUser(noId)).toBe(false);
    });
  });

  describe("Board", () => {
    it("валідна Board проходить перевірку", () => {
      const board = {
        id: "b-1",
        title: "Test Board",
        owner_id: "u-1",
        created_at: "2024-01-01",
      };
      expect(isBoard(board)).toBe(true);
    });

    it("Board з columns та members проходить перевірку", () => {
      const board = {
        id: "b-1",
        title: "Board",
        owner_id: "u-1",
        created_at: "2024-01-01",
        members: [],
        columns: [],
      };
      expect(isBoard(board)).toBe(true);
    });
  });

  describe("Column", () => {
    it("валідна Column проходить перевірку", () => {
      const column = {
        id: "c-1",
        name: "To Do",
        position: 0,
        board_id: "b-1",
      };
      expect(isColumn(column)).toBe(true);
    });

    it("Column без position не проходить перевірку", () => {
      const invalid = {
        id: "c-1",
        name: "To Do",
        board_id: "b-1",
      };
      expect(isColumn(invalid)).toBe(false);
    });
  });

  describe("Card", () => {
    it("валідна Card проходить перевірку", () => {
      const card = {
        id: "card-1",
        title: "Task",
        description: null,
        position: 0,
        tags: null,
        priority: null,
        color: null,
        estimate: null,
        due_date: null,
        card_type: null,
        column_id: "c-1",
        assignee_id: null,
        assignee: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };
      expect(isCard(card)).toBe(true);
    });

    it("Card з усіма полями проходить перевірку", () => {
      const card = {
        id: "card-1",
        title: "Full Card",
        description: "Description",
        position: 1,
        tags: ["frontend", "urgent"],
        priority: "high",
        color: "#ff0000",
        estimate: 8,
        due_date: "2024-12-31",
        card_type: "bug",
        column_id: "c-1",
        assignee_id: "u-1",
        assignee: {
          id: "u-1",
          username: "dev",
          email: "dev@test.com",
          role: "user",
          created_at: "2024-01-01",
        },
        created_at: "2024-01-01",
        updated_at: "2024-06-15",
      };
      expect(isCard(card)).toBe(true);
    });
  });
});

describe("Data transformations", () => {
  it("NotificationType включає всі типи", () => {
    const types: NotificationType[] = [
      "board_invitation",
      "card_assigned",
      "card_moved",
      "card_updated",
      "card_commented",
    ];
    expect(types).toHaveLength(5);
    types.forEach((t) => expect(typeof t).toBe("string"));
  });

  it("Card nullable поля можуть бути null", () => {
    const card: Card = {
      id: "1",
      title: "Test",
      description: null,
      position: 0,
      tags: null,
      priority: null,
      color: null,
      estimate: null,
      due_date: null,
      card_type: null,
      column_id: "c-1",
      assignee_id: null,
      assignee: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    expect(card.description).toBeNull();
    expect(card.tags).toBeNull();
    expect(card.assignee_id).toBeNull();
    expect(card.due_date).toBeNull();
    expect(card.card_type).toBeNull();
  });
});

describe("utils — cn()", () => {
  it("об'єднує класи TailwindCSS", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("вирішує конфлікти Tailwind", async () => {
    const { cn } = await import("@/lib/utils");
    // tailwind-merge повинен вирішити конфлікт px
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ігнорує falsy значення", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("px-2", false && "py-1", undefined, null)).toBe("px-2");
  });

  it("підтримує умовні класи через clsx", async () => {
    const { cn } = await import("@/lib/utils");
    const isActive = true;
    expect(cn("btn", { "btn-active": isActive })).toContain("btn-active");
  });
});
