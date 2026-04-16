# Base Kanban Trello

Kanban-дошка з Drag-and-Drop, системою авторизації та адмін-панеллю.

## Технології

- **Backend:** Python 3.11 + FastAPI + SQLAlchemy 2.0 (async)
- **Frontend:** React 18 + Vite + Shadcn UI + TailwindCSS + @hello-pangea/dnd
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker + Docker Compose

## Патерни проектування (GoF)

1. **Repository + Unit of Work** — ізоляція доступу до даних
2. **Observer** — сповіщення при зміні статусу картки/призначенні
3. **Factory** — створення карток з пресетами та дошок зі стандартними колонками

## Запуск

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432

## Наповнення БД тестовими даними

Із папки `backend`:

```bash
python -m app.scripts.seed_data
```

За замовчуванням скрипт **дозаповнює** БД (додає нові записи поверх існуючих).

Якщо потрібно очистити й заповнити з нуля:

```bash
python -m app.scripts.seed_data --reset
```

Корисні параметри:

```bash
python -m app.scripts.seed_data --users 12 --boards-per-owner 3 --cards-per-column 6 --seed 123
```

## Документація

Детальний опис архітектури, UML-діаграми та API: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
