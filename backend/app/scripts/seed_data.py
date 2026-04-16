"""Seed database with demo data for local development.

Run from backend directory:
    python -m app.scripts.seed_data --reset
"""

from __future__ import annotations

import argparse
import asyncio
import random
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import delete, select

from app.database import Base, engine, async_session_factory
from app.models.board import Board, board_members
from app.models.card import Card
from app.models.column import Column
from app.models.comment import Comment
from app.models.notification import (
    BoardInvitation,
    InvitationStatus,
    Notification,
    NotificationType,
)
from app.models.user import Role, User
from app.models.worklog import Worklog
from app.utils.security import hash_password

USERNAMES = [
    "admin",
    "anna",
    "bohdan",
    "maria",
    "taras",
    "olena",
    "yurii",
    "iryna",
    "nazar",
    "sofia",
    "roman",
    "vika",
    "andrii",
]

BOARD_TOPICS = [
    "Product",
    "Mobile",
    "Website",
    "Marketing",
    "Operations",
    "Analytics",
    "Support",
    "Design",
]

COLUMN_TEMPLATES = [
    ("Backlog", "#64748B"),
    ("In Progress", "#3B82F6"),
    ("Review", "#F59E0B"),
    ("Done", "#22C55E"),
]

CARD_TITLES = [
    "Implement authentication flow",
    "Refactor board API",
    "Create admin dashboard widgets",
    "Improve card drag-and-drop",
    "Fix notification badge sync",
    "Add optimistic UI updates",
    "Write integration tests",
    "Tune PostgreSQL indexes",
    "Create dark/light theme polish",
    "Add invitation acceptance flow",
    "Optimize board loading",
    "Document deployment checklist",
]

CARD_TAGS = [
    ["backend", "api"],
    ["frontend", "ui"],
    ["bugfix"],
    ["tech-debt"],
    ["security"],
    ["performance"],
    ["docs"],
    ["tests"],
]

COMMENT_TEMPLATES = [
    "I checked this part and left a note in the PR.",
    "Please verify edge cases with empty column state.",
    "Looks good, but we should add one more test.",
    "I can take this after current task is done.",
    "Updated according to feedback.",
]

WORKLOG_TEMPLATES = [
    "Backend endpoint implementation and validation.",
    "UI integration and state synchronization.",
    "Regression testing and bug fixing.",
    "Code review changes and refactoring.",
    "Documentation and release notes update.",
]


@dataclass
class SeedConfig:
    users_count: int
    boards_per_owner: int
    cards_per_column: int
    seed: int
    reset: bool


async def clear_all_data() -> None:
    """Delete all application records in FK-safe order."""
    async with async_session_factory() as session:
        await session.execute(delete(Worklog))
        await session.execute(delete(Comment))
        await session.execute(delete(Notification))
        await session.execute(delete(BoardInvitation))
        await session.execute(delete(Card))
        await session.execute(delete(Column))
        await session.execute(delete(board_members))
        await session.execute(delete(Board))
        await session.execute(delete(User))
        await session.commit()


def _pick_users(count: int) -> list[str]:
    if count <= len(USERNAMES):
        return USERNAMES[:count]

    generated = USERNAMES.copy()
    while len(generated) < count:
        generated.append(f"user{len(generated) + 1}")
    return generated


def _build_unique_username(base: str, taken: set[str]) -> str:
    """Return unique username by adding numeric suffix when needed."""
    if base not in taken:
        taken.add(base)
        return base

    suffix = 2
    while True:
        candidate = f"{base}{suffix}"
        if candidate not in taken:
            taken.add(candidate)
            return candidate
        suffix += 1


async def seed_database(config: SeedConfig) -> dict[str, int]:
    random.seed(config.seed)

    # Ensure tables exist when script runs outside API lifespan.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if config.reset:
        await clear_all_data()

    users: list[User] = []
    boards: list[Board] = []
    columns: list[Column] = []
    cards: list[Card] = []
    comments: list[Comment] = []
    worklogs: list[Worklog] = []
    notifications: list[Notification] = []
    invitations: list[BoardInvitation] = []

    usernames = _pick_users(config.users_count)

    async with async_session_factory() as session:
        existing_users = (await session.execute(select(User))).scalars().all()
        taken_usernames = {user.username for user in existing_users}

        for idx, username in enumerate(usernames):
            unique_username = _build_unique_username(username, taken_usernames)
            role = Role.ADMIN if idx == 0 and not existing_users else Role.USER
            user = User(
                username=unique_username,
                email=f"{unique_username}@kanban.local",
                hashed_password=hash_password("test1234"),
                role=role,
            )
            users.append(user)

        if users:
            session.add_all(users)
            await session.flush()

        all_users = [*existing_users, *users]
        if not all_users:
            raise RuntimeError("No users available for seeding")

        owners_count = max(1, min(3, len(all_users)))
        owners = all_users[:owners_count]

        for owner_idx, owner in enumerate(owners):
            for board_idx in range(config.boards_per_owner):
                topic = BOARD_TOPICS[(owner_idx + board_idx) % len(BOARD_TOPICS)]
                board = Board(
                    title=f"{topic} Board {board_idx + 1}",
                    owner_id=owner.id,
                )

                board.members.append(owner)
                member_pool = [u for u in all_users if u.id != owner.id]
                extra_member_count = min(len(member_pool), random.randint(2, 5))
                if extra_member_count:
                    board.members.extend(random.sample(member_pool, k=extra_member_count))

                boards.append(board)

        session.add_all(boards)
        await session.flush()

        board_member_map: dict[str, list[User]] = {
            str(board.id): list(board.members) for board in boards
        }

        for board in boards:
            for position, (name, color) in enumerate(COLUMN_TEMPLATES):
                column = Column(
                    name=name,
                    color=color,
                    position=position,
                    board_id=board.id,
                )
                columns.append(column)

        session.add_all(columns)
        await session.flush()

        columns_by_board: dict[str, list[Column]] = {}
        for column in columns:
            key = str(column.board_id)
            columns_by_board.setdefault(key, []).append(column)

        for board in boards:
            board_columns = sorted(
                columns_by_board[str(board.id)],
                key=lambda col: col.position,
            )
            board_members_list = board_member_map[str(board.id)]

            for column in board_columns:
                for position in range(config.cards_per_column):
                    card_title = random.choice(CARD_TITLES)
                    card = Card(
                        title=f"{card_title} [{position + 1}]",
                        description=f"Task for {board.title} in {column.name}.",
                        position=position,
                        tags=random.choice(CARD_TAGS),
                        priority=random.choice(["low", "medium", "high"]),
                        color=random.choice(["blue", "green", "amber", "rose", None]),
                        estimate=round(random.uniform(1.0, 16.0), 1),
                        due_date=date.today() + timedelta(days=random.randint(2, 30)),
                        card_type=random.choice(["basic", "feature", "bug", "task"]),
                        column_id=column.id,
                        assignee_id=random.choice(board_members_list).id,
                    )
                    cards.append(card)

        session.add_all(cards)
        await session.flush()

        for card in cards:
            comment_count = random.randint(1, 3)
            worklog_count = random.randint(0, 2)

            for _ in range(comment_count):
                author = random.choice(users)
                comments.append(
                    Comment(
                        text=random.choice(COMMENT_TEMPLATES),
                        card_id=card.id,
                        author_id=author.id,
                    )
                )

            for _ in range(worklog_count):
                author = random.choice(users)
                worklogs.append(
                    Worklog(
                        hours=round(random.uniform(0.5, 6.0), 1),
                        description=random.choice(WORKLOG_TEMPLATES),
                        card_id=card.id,
                        author_id=author.id,
                    )
                )

            if card.assignee_id:
                notifications.append(
                    Notification(
                        user_id=card.assignee_id,
                        type=NotificationType.CARD_ASSIGNED,
                        title="Card assigned",
                        message=f"You were assigned to '{card.title}'.",
                        is_read=False,
                        link=f"/boards/{card.column_id}",
                        related_id=card.id,
                    )
                )

        session.add_all(comments)
        session.add_all(worklogs)
        session.add_all(notifications)
        await session.flush()

        for board in boards:
            non_owner_users = [u for u in all_users if u.id != board.owner_id]
            if not non_owner_users:
                continue

            for invitee in random.sample(
                non_owner_users,
                k=min(2, len(non_owner_users)),
            ):
                invitations.append(
                    BoardInvitation(
                        board_id=board.id,
                        inviter_id=board.owner_id,
                        invitee_id=invitee.id,
                        status=random.choice(
                            [
                                InvitationStatus.PENDING,
                                InvitationStatus.ACCEPTED,
                                InvitationStatus.DECLINED,
                            ]
                        ),
                    )
                )

        session.add_all(invitations)
        await session.commit()

    return {
        "users": len(users),
        "boards": len(boards),
        "columns": len(columns),
        "cards": len(cards),
        "comments": len(comments),
        "worklogs": len(worklogs),
        "notifications": len(notifications),
        "invitations": len(invitations),
    }


def parse_args() -> SeedConfig:
    parser = argparse.ArgumentParser(description="Seed demo data for Base Kanban Trello")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing records before seeding",
    )
    parser.add_argument(
        "--users",
        type=int,
        default=10,
        help="How many NEW users to add",
    )
    parser.add_argument(
        "--boards-per-owner",
        type=int,
        default=2,
        help="Boards to create for each owner",
    )
    parser.add_argument(
        "--cards-per-column",
        type=int,
        default=5,
        help="Cards to create in each column",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic data",
    )

    args = parser.parse_args()

    return SeedConfig(
        users_count=max(1, args.users),
        boards_per_owner=max(1, args.boards_per_owner),
        cards_per_column=max(1, args.cards_per_column),
        seed=args.seed,
        reset=args.reset,
    )


async def _main() -> None:
    config = parse_args()
    result = await seed_database(config)

    print("Seeding completed:")
    for key, value in result.items():
        print(f"  - {key}: {value}")
    print("Default password for all generated users: test1234")


if __name__ == "__main__":
    asyncio.run(_main())
