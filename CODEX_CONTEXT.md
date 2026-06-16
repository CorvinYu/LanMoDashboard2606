# Codex 接手上下文

这个文档给下一次启动的 Codex 使用，用来快速理解项目目标、当前状态、工作原则和已知问题。

如果重新启动 Codex，建议先阅读这个文档，再阅读 `PROGRESS_MAP.md`、`TODO_AND_BUGS.md` 和 `PROJECT_STATE.md`。

## 项目目标

这是一个个人管理面板，用来管理任务、倒计时事件、定时检查、电费监控、提醒、日历、每日评分和 AI 建议。

项目目标不是做一个复杂的大平台，而是做一个可以每天使用、能逐步扩展、容易替换外部能力的个人工作台。

## 核心工程方针

项目采用“拼好码 / 胶水编程”方针。

核心意思是：

- 优先复用成熟能力。
- 优先使用官方 API、官方 SDK、成熟库和事实标准。
- 自研代码只负责连接、编排、适配、隔离和表达业务规则。
- 不重复造轮子。
- 不让第三方 API 的模型污染核心业务模型。
- 能配置就不要自研。
- 能适配就不要侵入。
- 能替换就不要强绑定。
- 能回滚就不要做不可逆改动。

## 协作记录规则

- 每当完成一项修改，需要同步更新相关文档。
- 每当完成一项修改，需要同步提交并推送到 GitHub。
- 提交时使用用户的本机 git 身份（non claude/codex），不得以 Claude 或 Codex 的名义提交。

## AI 助手相关规则

AI 助手只能生成建议，不能直接修改任务、倒计时、提醒或日历。

用户确认后，AI 助手建议才能应用。

如果后续实现“AI 助手根据描述自动确定时间”，应该让 AI 返回结构化建议，然后由用户确认创建任务、倒计时或提醒。

## 当前技术栈

- 前端：React、Vite、TypeScript、lucide-react
- 后端：NestJS、TypeScript、Prisma
- 数据库：PostgreSQL
- Redis：已接入，后续可用于提醒或后台任务
- 部署：Docker Compose
- AI：OpenAI-compatible provider
- 外部集成：Microsoft To Do，通过 Microsoft Graph
- 登录：NestJS Passport JWT、@nestjs/jwt、argon2、Prisma User 表

## 当前主要功能

项目已实现以下功能模块，具体细节见 `PROGRESS_MAP.md`：

- **任务管理** — 创建/编辑/完成/归档/恢复，截止倒计时，自动排序
- **Microsoft To Do 同步** — 双向同步，时区处理，JWT 绑定
- **登录与身份管理** — JWT + argon2，注册/登录/修改信息
- **倒计时表** — 基于 CalendarEvent，独立于任务
- **定时检查** — 生活规律维护打卡，周期计算，暂停恢复，关联依赖
- **电费监控** — 独立模块，读数录入，曲线图，耗电估算
- **每日评分** — 当前任务分，逾期扣分制
- **作品评分记录** — MediaWork/MediaReview/MediaExternalRating 三层模型
- **今日看板** — 聚合任务、倒计时、时间表
- **兴趣记录** — 已设计待实现
- **外部面板** — iframe 胶囊嵌入，可视化裁剪

## 重要业务边界

- 任务和倒计时不是同一个东西。
- 任务表示“我要完成的事”。
- 倒计时表示“会发生的事”。
- 任务可以完成、恢复、归档。
- 倒计时不能完成，只能新增、编辑和删除。
- 任务删除目前是归档。
- 倒计时删除目前是物理删除。
- Microsoft To Do 是外部能力，必须通过适配层隔离。
- Microsoft To Do 的原始数据不能直接污染本地任务模型。
- 登录后的业务接口必须从 JWT 当前用户取 userId，不能重新退回默认用户模式。
- 定时检查表示“生活规律维护”，不是普通任务，也不是倒计时或日历事件。
- 兴趣记录表示“我主动记录一次兴趣活动”，不是任务、倒计时或定时检查；它不应该有到期和逾期概念。
- 作品评分记录表示“内容资产记录”，不是每日评分、不是任务、不是提醒，也不应该混入当前状态分模型。

## 当前已知问题

Microsoft To Do 上传和同步的时间字段问题已经做了代码层修复，但还需要真实 Microsoft 账号回归验证：

- 新增 `MICROSOFT_TODO_TIME_ZONE` 配置，默认 `Asia/Shanghai`。
- 上传到 Microsoft To Do 时，把本地任务截止时间格式化为配置时区里的本地时间，并发送对应 `timeZone`。
- 从 Microsoft To Do 拉取时，按 Graph 返回的 `dateTime` 和 `timeZone` 明确还原成本地存储用的 UTC `Date`。

下一步应该用真实 Microsoft To Do 账号验证：本地创建带截止时间任务 -> 推送 -> 拉取 -> 编辑截止时间 -> 再拉取，确认时间不改变、不消失。

Docker 镜像重建时曾遇到 Docker Hub 元数据请求超时。最近一次定时检查改动已经完成本地构建、容器内 `prisma db push`，并通过标准重建启动：

```bash
docker compose up --build -d backend frontend
```

云服务器首版生产部署基础文件已经补充：

- `docker-compose.prod.yml`
- `deploy/Caddyfile`
- `.env.production.example`

当前生产部署思路是：

- 云服务器作为唯一中心后端和数据库。
- 只对公网暴露 `80/443`。
- 由 Caddy 提供 HTTPS 并反代到前端。
- 前端继续通过同源 `/api` 访问后端。
- PostgreSQL、Redis、NestJS 和 Adminer 不直接暴露公网。

当前后端在生产环境下默认关闭 Swagger，可通过 `ENABLE_SWAGGER=true` 临时开启。

## 常用命令

### Docker 构建与启动

后端构建：

```bash
cd apps/backend
npx prisma generate
npm run build
```

前端构建：

```bash
cd apps/frontend
npm run build
```

启动或更新 Docker：

```bash
docker compose up --build -d
```

只更新前端：

```bash
docker compose up --build -d frontend
```

只更新后端：

```bash
docker compose up --build -d backend
```

### npm 开发启动

后端开发模式（端口 4000）：

```bash
cd apps/backend
npx prisma generate
npx prisma db push
npm run start:dev
```

前端开发模式（端口 3000）：

```bash
cd apps/frontend
npm run dev
```

前端 Vite dev server 已将 `/api` 代理到 `http://localhost:4000`，开发时无需额外配置。

## 本地访问地址

- 前端：http://localhost:3000
- 后端健康检查：http://localhost:4000/api/health
- Swagger：http://localhost:4000/api/docs
- Adminer：http://localhost:8080

## 关键文档

- `README.md`：项目简介和启动方式
- `PROJECT_STATE.md`：工程状态
- `TODO_AND_BUGS.md`：用户可读的未完成待办、未修复问题和待判断想法记录；已完成内容不要保留在这里
- `PROGRESS_MAP.md`：用户可读的项目进度地图
- `OPEN_SOURCE_REFERENCES.md`：开源项目参考、接入和复制代码记录
- `DONETICK_REFERENCE_ANALYSIS.md`：Donetick 参考项目分析，主要用于定时检查重做
- `CODEX_CONTEXT.md`：Codex 接手上下文，也就是当前文档

## 文档更新规则

完成较大的功能后，应该同步更新文档。

- 用户视角的未完成待办、未修复问题和待判断想法，更新 `TODO_AND_BUGS.md`。
- 项目进度变化和已完成内容，更新 `PROGRESS_MAP.md`。
- 当 `TODO_AND_BUGS.md` 里的事项完成后，应从 `TODO_AND_BUGS.md` 删除，并在 `PROGRESS_MAP.md` 记录完成状态。
- Codex 接手需要知道的信息，更新 `CODEX_CONTEXT.md`。
- 启动方式或项目简介变化，更新 `README.md`。
- 工程状态变化，更新 `PROJECT_STATE.md`。
- 新增、接入或复制开源项目时，更新 `OPEN_SOURCE_REFERENCES.md`。

## 下一步建议

优先处理：

1. Microsoft To Do 时间字段问题。
2. AI 根据描述自动识别事件时间。
3. 拖动调整任务顺序。
4. 日历视图。
5. 提醒功能。

## 给下一次 Codex 的提醒

开始工作前，先读：

1. `CODEX_CONTEXT.md`
2. `PROGRESS_MAP.md`
3. `TODO_AND_BUGS.md`
4. `PROJECT_STATE.md`

如果用户要求继续实现功能，优先遵守“拼好码 / 胶水编程”原则。

不要为了控制感自研成熟生态已经解决的问题。

新增外部集成时，要做适配层和边界隔离。

新增 AI 能力时，要保持“AI 只生成建议，用户确认后应用”的规则。
