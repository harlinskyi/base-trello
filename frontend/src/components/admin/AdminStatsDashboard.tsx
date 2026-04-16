import type { AdminActivityPoint, AdminStats, StatsBucket } from "@/types";
import {
  BarChart3,
  BellRing,
  Clock3,
  FolderKanban,
  MessageSquare,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

function formatHours(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function DistributionList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: StatsBucket[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Дані відсутні.</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {item.value} • {item.percentage}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.max(item.percentage, 4)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ActivityTimeline({ points }: { points: AdminActivityPoint[] }) {
  const maxCards = Math.max(...points.map((point) => point.cards), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Активність за 7 днів</CardTitle>
        <CardDescription>
          Основна шкала показує нові картки, бейджі праворуч показують
          користувачів, дошки та коментарі за день.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {points.map((point) => (
          <div
            key={point.date}
            className="grid grid-cols-[72px_1fr_auto] items-center gap-3"
          >
            <span className="text-sm text-muted-foreground">
              {new Date(point.date).toLocaleDateString("uk-UA", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{
                  width: `${Math.max((point.cards / maxCards) * 100, point.cards > 0 ? 8 : 0)}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Badge variant="secondary">Картки {point.cards}</Badge>
              <Badge variant="outline">Дошки {point.boards}</Badge>
              <Badge variant="outline">Юзери {point.users}</Badge>
              <Badge variant="outline">Коментарі {point.comments}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AdminStatsDashboard({ stats }: { stats: AdminStats }) {
  const overviewCards = [
    {
      title: "Користувачі",
      value: stats.overview.total_users,
      description: `${stats.overview.admin_users} адміністраторів`,
      icon: Users,
    },
    {
      title: "Дошки",
      value: stats.overview.total_boards,
      description: `${stats.overview.avg_members_per_board} учасників у середньому`,
      icon: FolderKanban,
    },
    {
      title: "Картки",
      value: stats.overview.total_cards,
      description: `${stats.overview.avg_cards_per_board} на дошку`,
      icon: BarChart3,
    },
    {
      title: "Призначені картки",
      value: stats.overview.assigned_cards,
      description: `${stats.overview.unassigned_cards} без виконавця`,
      icon: UserCheck,
    },
    {
      title: "Прострочені",
      value: stats.overview.overdue_cards,
      description: `${stats.overview.due_this_week_cards} дедлайнів цього тижня`,
      icon: Clock3,
    },
    {
      title: "Коментарі",
      value: stats.overview.total_comments,
      description: `${stats.recent_activity.new_comments_last_30_days} за 30 днів`,
      icon: MessageSquare,
    },
    {
      title: "Облік часу",
      value: `${formatHours(stats.overview.tracked_hours_total)} год`,
      description: `${stats.overview.total_worklog_entries} записів, оцінено на ${formatHours(stats.overview.estimated_hours_total)} год`,
      icon: Clock3,
    },
    {
      title: "Системні сигнали",
      value: stats.overview.unread_notifications,
      description: `${stats.overview.pending_invitations} запрошень очікують`,
      icon: BellRing,
    },
  ];

  return (
    <>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className="mt-2 text-3xl">{card.value}</CardTitle>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <ActivityTimeline points={stats.activity_timeline} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Приріст за 30 днів</CardTitle>
            <CardDescription>
              Нові записи, які реально створювались у системі за останній
              місяць.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Користувачі</p>
              <p className="mt-2 text-2xl font-semibold">
                {stats.recent_activity.new_users_last_30_days}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Дошки</p>
              <p className="mt-2 text-2xl font-semibold">
                {stats.recent_activity.new_boards_last_30_days}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Картки</p>
              <p className="mt-2 text-2xl font-semibold">
                {stats.recent_activity.new_cards_last_30_days}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Коментарі</p>
              <p className="mt-2 text-2xl font-semibold">
                {stats.recent_activity.new_comments_last_30_days}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <DistributionList
          title="Картки за статусами"
          description="Розподіл по назвах колонок у всіх дошках."
          items={stats.cards_by_status}
        />
        <DistributionList
          title="Картки за пріоритетами"
          description="Включно з картками без пріоритету."
          items={stats.cards_by_priority}
        />
        <DistributionList
          title="Картки за типами"
          description="Включно з картками без типу."
          items={stats.cards_by_type}
        />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Топ користувачів</CardTitle>
            <CardDescription>
              Сортування за призначеними картками, затраченими годинами та
              власними дошками.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.top_users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Дані відсутні.</p>
            ) : (
              stats.top_users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.username}</p>
                      <Badge
                        variant={
                          user.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {user.assigned_cards} карток • {user.owned_boards} дошок •{" "}
                      {user.comments_count} коментарів
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{formatHours(user.logged_hours)} год</p>
                    <p>{user.worklog_entries} записів</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <DistributionList
          title="Ролі користувачів"
          description="Розподіл облікових записів за ролями."
          items={stats.users_by_role}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Системні події</CardTitle>
            <CardDescription>
              Типи сповіщень і стани запрошень у загальному потоці.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Запрошення</p>
              <div className="space-y-2">
                {stats.invitations_by_status.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Немає даних.</p>
                ) : (
                  stats.invitations_by_status.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{item.label}</span>
                      <Badge variant="outline">{item.value}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Сповіщення</p>
              <div className="space-y-2">
                {stats.notifications_by_type.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Немає даних.</p>
                ) : (
                  stats.notifications_by_type.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="pr-4">{item.label}</span>
                      <Badge variant="outline">{item.value}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Найбільш завантажені дошки</CardTitle>
          <CardDescription>
            Рейтинг за кількістю карток, за годинами та структурою дошки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.top_boards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Дані відсутні.</p>
          ) : (
            stats.top_boards.map((board) => (
              <div
                key={board.id}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]"
              >
                <div>
                  <p className="font-medium">{board.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Власник: {board.owner_username}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Учасники
                  </p>
                  <p className="text-lg font-semibold">{board.members_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Колонки
                  </p>
                  <p className="text-lg font-semibold">{board.columns_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Картки
                  </p>
                  <p className="text-lg font-semibold">{board.cards_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Години
                  </p>
                  <p className="text-lg font-semibold">
                    {formatHours(board.tracked_hours_total)} /{" "}
                    {formatHours(board.estimated_hours_total)}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
