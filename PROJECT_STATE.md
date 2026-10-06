# Project State

> 本文件只写**工程状态**：技术栈、部署形态、已实现、验证记录、启动方式。
> 文档分工见 `README.md` 的「文档地图」；未完成事项的唯一清单是 `TODO_AND_BUGS.md`。

## Overview

A personal management dashboard built with a glue-code approach: reuse mature components,
keep business code focused, and avoid vendor lock-in. 目标与工程方针的完整说明见
`README.md` 与 `AGENT_CONTEXT.md`。

## Current Stack

- Frontend: React, Vite, TypeScript, lucide-react
- Backend: NestJS, TypeScript, Prisma
- Database: PostgreSQL 16
- Cache / background dependency: Redis 7
- Deployment: Docker Compose（通用/生产）+ npm dev 常驻（本机长期运行）
- AI: OpenAI-compatible API behind a replaceable provider interface
- Auth: NestJS Passport JWT, @nestjs/jwt, argon2, Prisma `User`
- External integration: Microsoft To Do via Microsoft Graph（适配层隔离）

## Deployment Forms

| 形态 | 说明 |
|---|---|
| 本机长期运行（当前主力） | Mac mini `192.168.9.7`：launchd 常驻 `nest start --watch`（后端 **4100**）+ `vite`（前端 3000）；依赖容器 postgres（**5433**）/ redis（**6380**）；公网入口 `https://lmd.corvinyu.icu`（Cloudflare Tunnel）。运维事实与回滚见 hub 项目 `E:\claude\lanmo-dashboard\NOTES.md` |
| Docker Compose（通用） | `docker compose up --build -d`：frontend 3000 / backend 4000 / postgres 5432 / redis 6379 / adminer 8080 |
| 生产（云服务器） | `docker-compose.prod.yml` + Caddy，只暴露 80/443，库与后端不进公网 |

> 本机端口与通用 Docker 端口不同，是因为这台 Mac 上 4000 已被其它服务占用；
> 前端代理目标通过 `apps/frontend/.env.local` 的 `VITE_API_PROXY_TARGET` 覆盖（默认 4000）。

## Docker Services

- `frontend`: serves the React app through Nginx on port `3000`
- `backend`: NestJS API on port `4000`
- `postgres`: PostgreSQL on port `5432`
- `redis`: Redis on port `6379`
- `adminer`: database UI on port `8080`
- `docker-compose.prod.yml`: production-oriented compose that exposes only `80/443` through Caddy

## Useful URLs

- 本机开发：frontend `http://localhost:3000` ｜ health `http://localhost:4100/api/health` ｜ Swagger `http://localhost:4100/api/docs`
- 同源健康检查（经前端代理）：`http://localhost:3000/api/health`
- Docker 形态：frontend `3000` ｜ backend `4000` ｜ Adminer `8080`
- 公网：`https://lmd.corvinyu.icu`

## Data Models (Prisma, 18 tables)

`users`、`tasks`、`calendar_events`、`reminders`、`daily_scores`、`electricity_readings`、
`routine_habits`、`routine_check_ins`、`sleep_logs`、`ai_conversations`、`ai_messages`、
`ai_suggestions`、`suggestion_applications`、`integration_accounts`、`task_integrations`、
`media_works`、`media_reviews`、`media_external_ratings`

## Implemented

- Monorepo skeleton, Docker Compose stack, health endpoint, Swagger
- Auth & accounts: register / login / me / update (email, displayName, password) / logout,
  JWT-protected business APIs, default local user can be claimed by registering its email,
  frontend auto-attaches `Authorization` and clears state on 401
- Task management: create / list / edit / complete / restore / archive-on-delete, priority,
  due date, countdown, auto sorting, manual re-sort, daily auto-archive of finished tasks
- Current task score (0–100) derived from overdue tasks and check-ins, shown in the task panel
  and today board
- Countdown events (`CalendarEvent`): CRUD, future list, countdown display, manual re-sort
- Microsoft To Do: OAuth connect, pull, push, complete/restore sync, explicit timezone
  conversion via `MICROSOFT_TODO_TIME_ZONE`
- Routine check-ins (`RoutineHabit` / `RoutineCheckIn`): intervals, check-in / skip, auto
  next-due, overdue display, dependency between items, pause/resume, manual overdue scan that
  creates reminders, manual sleep logs
- Today board: aggregates today's tasks, tomorrow-due and overdue check-ins, countdowns, next
  event, timetable; supports completing tasks and checking in inline
- Electricity monitoring: reading CRUD (current or historical), recharge amount → kWh at
  0.63 CNY/kWh, weighted moving average daily usage, predicted current remaining kWh,
  distinguishing last actual reading vs prediction, threshold alerts (below 15 kWh / approaching),
  chart with recharge split into two points
- Media review records: `MediaWork` / `MediaReview` / `MediaExternalRating`, page with manual
  entry, list, edit, delete, and multiple external ratings per work
- External panel: iframe capsules with persisted drag-region cropping (localStorage)
- Maintenance: **一键恢复正常日程** — preview / apply / snapshots / undo; overdue tasks and
  countdown events shift as a batch (preserving relative spacing, status untouched), routine
  habits advance by their own interval algorithm, pending reminders follow their host
- Responsive layout: desktop three-column task panel, mobile-first ordering, sidebar drawer
- Production baseline: `docker-compose.prod.yml`, `deploy/Caddyfile`,
  `.env.production.example`
- Security hardening (2026-10-03): `JwtAuthGuard` on `/api/ai/chat` (previously unguarded);
  Swagger now opt-in via `ENABLE_SWAGGER=true` (previously served on the public dev instance)
- Engineering baseline (2026-10-06): Prisma migration baseline (`0_init`), ESLint 9 + Prettier +
  editorconfig with `lint`/`format` npm scripts, real cron-based daily task archiving
  (`TasksArchiveScheduler`, 00:05 daily, all users), and pure-helper extraction into
  `apps/frontend/src/lib/format.ts` (`App.tsx` 4556 → 4048 lines)

## Ops Note: Swagger

`/api/docs` 自 2026-10-03 起**默认关闭**，只有显式设置 `ENABLE_SWAGGER=true` 才开启。
原因：本机主力形态是 `NODE_ENV` 非 production 的 dev 常驻实例，却通过 Cloudflare Tunnel 暴露在公网，
旧逻辑（`NODE_ENV !== 'production'` 即开启）导致 45 个端点的完整 schema 对公网可见。
临时开启方式：在 `apps/backend/.env` 加 `ENABLE_SWAGGER=true`，重启后端即可。

`/api/ai/chat` 自 2026-10-03 起需要 JWT，与其它业务接口一致。

## Important AI Rule

AI 只能生成建议，不能直接修改任务、倒计时、提醒或日历；用户确认后才应用。
规则全文见 `AGENT_CONTEXT.md`。

## Current Verification

最近一次（2026-10-06，本机 Mac mini dev 形态 · 工程债清理）：

- 前后端 `npx tsc --noEmit` 均无错误；`eslint src` 零错误零警告
- 前端 `npx vite build` 成功（1579 modules，624ms）
- Prisma 迁移基线：`prisma migrate status` → "Database schema is up to date!"；
  用 shadow 库跑 `migrate diff --from-migrations` → "No difference detected"（基线可精确重建 schema）
- 定时归档：`ScheduleModule dependencies initialized` 出现在启动日志；
  功能验证 —— 造一条 3 天前完成的 DONE 任务 → 归档谓词命中（UPDATE 1）→ 变 ARCHIVED → 清理后总数回到 256
- 数据完好：tasks=256、users=4、`_prisma_migrations`=1
- 运行时：health=200、frontend=200、ai 无 token=401、docs=404

前次（2026-10-03，本机 Mac mini dev 形态 · 安全与运维加固）：

- `npx tsc --noEmit` 后端与前端均无错误
- 无 token 访问 `/api/ai/chat` → **401**（修复前为 500，且公网可调用）
- 无 token 访问 `/api/tasks` → 401；`/api/health` → 200
- `/api/docs`（Swagger）本机与公网均 → **404**（修复前 200）
- 公网 `https://lmd.corvinyu.icu/api/health` → 200，前端根路径 → 200
  （⚠️ 公网侧**间歇返回连接中断**，与本轮改动无关，根因见 `TODO_AND_BUGS.md` 的 Bug 条目）
- cloudflared 隧道 `ha_connections` 恒为 2；33 MB 日志已轮转（copytruncate，进程句柄 inode 未变）
- `com.corvinyu.logrotate` 每 3600 秒执行，首次 `last exit code = 0`

前次（2026-09-28，本机 Mac mini dev 形态）：

- `npx tsc --noEmit` 后端与前端均无错误
- 未携带 token 访问受保护接口返回 `401`
- 一键恢复正常日程：dry-run 预览 → 执行 → 逾期项归零 → 撤销后精确还原，全链路实测通过
- 本机依赖容器健康（postgres/redis），dev 热更新实测生效（vite HMR + `nest --watch` 自动重编译）
- 公网入口 `https://lmd.corvinyu.icu/api/health` 返回 `200`

历史记录（Docker 形态）：

- `npx prisma generate && npm run build`（后端）、`npm run build`（前端）通过
- `docker compose up --build -d backend frontend` 后 `curl` 前后端 health 均通过
- 账号全流程 API 验证通过：register → login → `/auth/me` → PATCH `/auth/me` → logout
- npm dev 启动（前端 `npm run dev` + 后端 `npm run start:dev`）验证通过

仍待真实环境验证：

- Microsoft To Do 时间字段修复需要用真实 Microsoft 账号回归（见 `TODO_AND_BUGS.md`）

## Start Command

### 本机（Mac mini，dev 常驻，改代码即生效）

```bash
# 依赖容器（compose 文件里已固定 5433/6380，避开本机其它服务）
cd /Users/corvinyu/code/LanMoDashboard2606
docker compose -f docker-compose.macmini.yml up -d

# 后端 :4100（launchd 常驻，也可手动）
cd apps/backend && npm run start:dev
# 前端 :3000（代理目标来自 apps/frontend/.env.local）
cd apps/frontend && npm run dev
```

### Docker（通用）

```bash
cp .env.example .env
docker compose up --build -d
```

### npm 开发（通用，后端默认 4000）

```bash
# 1. 依赖
cd apps/backend && npm install
cd ../frontend && npm install

# 2. .env（数据库与 Redis 指向本地）
# 3. 初始化数据库
cd apps/backend
npx prisma generate
npx prisma db push

# 4. 启动后端（默认 4000，可用 PORT 覆盖）
npm run start:dev

# 5. 启动前端（3000；代理目标用 VITE_API_PROXY_TARGET 覆盖，默认 http://localhost:4000）
cd ../frontend && npm run dev
```

If Docker permission is not configured for the current user:

```bash
sudo docker compose up --build -d
```

## Next Recommended Step

未完成事项**唯一清单**是 `TODO_AND_BUGS.md`（含 `## 开发难度评估` 的推荐顺序）。
工程侧当前最该先做的一件事：**用真实 Microsoft 账号回归验证 To Do 的时间字段**。
