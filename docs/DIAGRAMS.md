# UML Діаграми проєкту Base Kanban Trello

## 1. Діаграма класів (Class Diagram) — Domain Models

```mermaid
classDiagram
    direction TB

    class User {
        +UUID id
        +String username
        +String email
        +String hashed_password
        +Role role
        +DateTime created_at
        +__repr__() str
    }

    class Role {
        <<enumeration>>
        ADMIN
        USER
    }

    class Board {
        +UUID id
        +String title
        +UUID owner_id
        +DateTime created_at
        +add_member(user) void
        +remove_member(user) void
        +__repr__() str
    }

    class Column {
        +UUID id
        +String name
        +String color
        +int position
        +UUID board_id
        +__repr__() str
    }

    class Card {
        +UUID id
        +String title
        +String description
        +int position
        +List~String~ tags
        +String priority
        +String color
        +float estimate
        +Date due_date
        +String card_type
        +UUID column_id
        +UUID assignee_id
        +DateTime created_at
        +DateTime updated_at
        +update_status(new_column_id) void
        +__repr__() str
    }

    class Comment {
        +UUID id
        +String text
        +UUID card_id
        +UUID author_id
        +DateTime created_at
        +__repr__() str
    }

    class Worklog {
        +UUID id
        +float hours
        +String description
        +UUID card_id
        +UUID author_id
        +DateTime created_at
        +__repr__() str
    }

    class Notification {
        +UUID id
        +UUID user_id
        +NotificationType type
        +String title
        +String message
        +bool is_read
        +String link
        +UUID related_id
        +DateTime created_at
    }

    class BoardInvitation {
        +UUID id
        +UUID board_id
        +UUID inviter_id
        +UUID invitee_id
        +InvitationStatus status
        +DateTime created_at
    }

    class InvitationStatus {
        <<enumeration>>
        PENDING
        ACCEPTED
        DECLINED
    }

    class NotificationType {
        <<enumeration>>
        BOARD_INVITATION
        CARD_ASSIGNED
        CARD_MOVED
        CARD_UPDATED
        CARD_COMMENTED
    }

    User "1" --> "*" Board : owns
    User "*" <--> "*" Board : members
    User "1" --> "*" Card : assigned
    User "1" --> "*" Comment : authored
    User "1" --> "*" Notification : receives
    Board "1" --> "*" Column : contains
    Column "1" --> "*" Card : contains
    Card "1" --> "*" Comment : has
    Card "1" --> "*" Worklog : has
    Board "1" --> "*" BoardInvitation : invitations
    User ..> Role : has
    Notification ..> NotificationType : type
    BoardInvitation ..> InvitationStatus : status
```

---

## 2. Діаграма компонентів (Component Diagram) — Архітектура

```mermaid
graph TB
    subgraph Frontend["Frontend (React + Vite)"]
        UI["Pages / Components<br/>(View)"]
        Store["Zustand Store<br/>(State Management)"]
        API["API Layer<br/>(axios)"]
    end

    subgraph Backend["Backend (FastAPI)"]
        Routers["Routers<br/>(Controller)"]
        Services["Services<br/>(Business Logic)<br/>AuthService, UserService, BoardService,<br/>CardService, NotificationService,<br/>AdminStatsService"]
        Patterns["Patterns<br/>(GoF: Factory, Observer,<br/>Singleton, Strategy, Repository)"]
        Repositories["Repositories<br/>(Data Access)"]
        Models["Models<br/>(Domain Entities)"]
        Schemas["Schemas<br/>(DTO / Validation)"]
        Middleware["Middleware<br/>(Auth / JWT)"]
    end

    subgraph Database["PostgreSQL"]
        Tables["Tables:<br/>users, boards, columns,<br/>cards, comments, worklogs,<br/>notifications, board_invitations,<br/>board_members"]
    end

    UI --> Store
    UI --> API
    API -->|HTTP / REST| Routers
    Routers --> Middleware
    Middleware --> Services
    Services --> Patterns
    Services --> Repositories
    Repositories --> Models
    Routers --> Schemas
    Models -->|SQLAlchemy ORM| Tables

    style Frontend fill:#e0f2fe,stroke:#0284c7
    style Backend fill:#f0fdf4,stroke:#16a34a
    style Database fill:#fef3c7,stroke:#d97706
```

---

## 3. Діаграма патернів проєктування (GoF Patterns)

```mermaid
classDiagram
    direction TB

    %% === Singleton ===
    class SingletonMeta {
        <<metaclass>>
        -Dict _instances
        -Lock _lock
        +__call__(*args, **kwargs) object
        +_reset(cls) void
    }

    %% === Factory ===
    class AbstractCardFactory {
        <<abstract>>
        +create_card(title, column_id, **kwargs)* Card
    }

    class CardFactory {
        +Dict PRESETS
        +create_card(title, column_id, ...) Card
    }

    class BoardFactory {
        +List DEFAULT_COLUMNS
        +create_board(title, owner_id)$ tuple
    }

    AbstractCardFactory <|-- CardFactory
    SingletonMeta <.. CardFactory : metaclass

    %% === Observer ===
    class EventObserver {
        <<abstract>>
        +handle(event, data)* void
    }

    class EventManager {
        -Dict _observers
        +subscribe(event, observer) void
        +unsubscribe(event, observer) void
        +notify(event, data) void
    }

    class CardStatusObserver {
        +handle(event, data) void
    }

    class CardAssignmentObserver {
        +handle(event, data) void
    }

    EventObserver <|-- CardStatusObserver
    EventObserver <|-- CardAssignmentObserver
    EventManager --> EventObserver : manages
    SingletonMeta <.. EventManager : metaclass

    %% === Strategy ===
    class NotificationStrategy {
        <<abstract>>
        +send(user_id, ntype, title, message, ...)* Notification
    }

    class DatabaseNotificationStrategy {
        +send(...) Notification
    }

    class LogNotificationStrategy {
        +send(...) None
    }

    NotificationStrategy <|-- DatabaseNotificationStrategy
    NotificationStrategy <|-- LogNotificationStrategy

    %% === Repository ===
    class BaseRepository~T~ {
        #Type _model
        #AsyncSession _session
        +get_by_id(id) T
        +get_all() Sequence~T~
        +create(entity) T
        +update(entity) T
        +delete(id) void
    }

    class UserRepository {
        +get_by_email(email) User
        +get_by_username(username) User
    }

    class BoardRepository {
        +get_by_id_with_relations(id) Board
        +get_boards_for_user(user_id) list
        +get_all_with_owner() list
    }

    class CardRepository {
        +get_by_column(column_id) list
        +get_by_id_with_relations(id) Card
    }

    BaseRepository <|-- UserRepository
    BaseRepository <|-- BoardRepository
    BaseRepository <|-- CardRepository

    %% === Unit of Work ===
    class UnitOfWork {
        -AsyncSession _session
        +UserRepository users
        +BoardRepository boards
        +CardRepository cards
        +BaseRepository columns
        +BaseRepository comments
        +BaseRepository worklogs
        +NotificationRepository notifications
        +InvitationRepository invitations
        +commit() void
        +rollback() void
    }

    UnitOfWork --> BaseRepository : coordinates
```

---

## 4. Діаграма послідовності (Sequence Diagram) — Створення картки

```mermaid
sequenceDiagram
    actor User as Користувач
    participant UI as React UI
    participant API as API Layer (axios)
    participant Router as FastAPI Router
    participant Auth as JWT Middleware
    participant Service as CardService
    participant Factory as CardFactory
    participant Observer as EventManager
    participant Repo as CardRepository
    participant DB as PostgreSQL

    User->>UI: Заповнює форму картки
    UI->>API: cardsApi.create(columnId, data)
    API->>Router: POST /api/cards/column/{column_id}
    Router->>Auth: get_current_user(token)
    Auth-->>Router: User object
    Router->>Service: create_card(column_id, data, user_id)
    Service->>Repo: get_by_column(column_id)
    Repo->>DB: SELECT cards WHERE column_id
    DB-->>Repo: cards list
    Repo-->>Service: cards (для позиції)
    Service->>Factory: create_card(title, column_id, preset, ...)
    Factory-->>Service: Card object
    Service->>Repo: create(card)
    Repo->>DB: INSERT INTO cards
    DB-->>Repo: ok
    Service->>Observer: notify("card.assigned", data)
    Observer->>Observer: CardAssignmentObserver.handle()
    Service->>Service: create_notification (Strategy via NotificationService)
    Service->>DB: commit()
    Service-->>Router: CardResponse
    Router-->>API: JSON Response
    API-->>UI: card data
    UI-->>User: Картка відображена на дошці
```

---

## 5. Діаграма послідовності — Drag-and-Drop переміщення картки

```mermaid
sequenceDiagram
    actor User as Користувач
    participant UI as React UI (DnD)
    participant API as API Layer
    participant Router as FastAPI Router
    participant Service as CardService
    participant Observer as EventManager
    participant Strategy as NotificationStrategy
    participant DB as PostgreSQL

    User->>UI: Перетягує картку
    UI->>API: cardsApi.move(cardId, {column_id, position})
    API->>Router: PATCH /api/cards/{id}/move
    Router->>Service: move_card(card_id, data, user_id)
    Service->>DB: get card, old_column, new_column

    alt Та сама колонка
        Service->>DB: Перерахунок позицій (зсув)
    else Інша колонка
        Service->>DB: Зсув позицій у старій колонці
        Service->>DB: Зсув позицій у новій колонці
    end

    Service->>DB: UPDATE card (column_id, position)
    Service->>Observer: notify("card.status_changed", data)
    Observer->>Observer: CardStatusObserver.handle() → log
    Service->>Strategy: send() — Database + Log strategies
    Service->>DB: commit()
    Service-->>Router: CardResponse
    Router-->>API: JSON
    API-->>UI: updated card
    UI-->>User: Картка на новому місці
```

---

## 6. Діаграма послідовності — Автентифікація (Login)

```mermaid
sequenceDiagram
    actor User as Користувач
    participant UI as LoginPage
    participant Store as AuthStore (Zustand)
    participant API as API Layer
    participant Router as Auth Router
    participant Service as AuthService
    participant Repo as UserRepository
    participant Security as JWT Utils
    participant DB as PostgreSQL

    User->>UI: Вводить email + пароль
    UI->>Store: login(email, password)
    Store->>API: authApi.login({email, password})
    API->>Router: POST /api/auth/login
    Router->>Service: login(data)
    Service->>Repo: get_by_email(email)
    Repo->>DB: SELECT user WHERE email
    DB-->>Repo: User
    Repo-->>Service: User object
    Service->>Security: verify_password(plain, hashed)
    Security-->>Service: true
    Service->>Security: create_access_token({sub: user.id})
    Security-->>Service: JWT token
    Service-->>Router: TokenResponse
    Router-->>API: {access_token, user}
    API-->>Store: response.data
    Store->>Store: setUser(user), setToken(token)
    Store-->>UI: authenticated
    UI-->>User: Перенаправлення на /
```

---

## 7. Діаграма послідовності — Отримання адмін-статистики

```mermaid
sequenceDiagram
    actor Admin as Адміністратор
    participant UI as AdminStatsPage
    participant API as API Layer
    participant Router as Users Router
    participant Auth as require_admin
    participant Service as AdminStatsService
    participant UoW as UnitOfWork
    participant DB as PostgreSQL

    Admin->>UI: Відкриває /admin/stats
    UI->>API: usersApi.getAdminStats()
    API->>Router: GET /api/users/stats
    Router->>Auth: require_admin(current_user)
    Auth-->>Router: admin user
    Router->>Service: get_dashboard_stats()
    Service->>UoW: агрегувати users / boards / columns / cards
    UoW->>DB: COUNT / SUM / GROUP BY / JOIN
    DB-->>UoW: агреговані дані
    UoW-->>Service: overview, buckets, top_users, top_boards
    Service-->>Router: AdminStatsResponse
    Router-->>API: JSON statistics payload
    API-->>UI: stats data
    UI-->>Admin: Відображення KPI, розподілів і таймлайну
```

---

## 7. Діаграма розгортання (Deployment Diagram)

```mermaid
graph LR
    subgraph Docker Compose
        subgraph "kanban-frontend"
            Nginx["Nginx:alpine<br/>Port 80"]
            ReactBuild["React Build<br/>(static files)"]
        end

        subgraph "kanban-backend"
            Uvicorn["Uvicorn<br/>Port 8000"]
            FastAPI_App["FastAPI App<br/>Python 3.11"]
        end

        subgraph "kanban-db"
            PostgreSQL["PostgreSQL 16<br/>Port 5432"]
            Volume["Volume: pgdata"]
        end
    end

    Browser["🌐 Browser<br/>localhost:80"] --> Nginx
    Nginx -->|"/api/*"| Uvicorn
    Nginx -->|"static"| ReactBuild
    Uvicorn --> FastAPI_App
    FastAPI_App -->|"asyncpg"| PostgreSQL
    PostgreSQL --> Volume

    style Docker Compose fill:#f8fafc,stroke:#64748b
```
