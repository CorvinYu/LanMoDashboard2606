# 接手上下文（任何 AI / Agent 都先读这份）

> 这份文档给**下一次接手项目的 AI/Agent** 使用（Claude Code、Codex、DSH 等一视同仁），
> 用来快速理解项目目标、工程方针、业务边界和协作规则。
>
> **建议接手顺序**：本文件 → `PROGRESS_MAP.md`（走到哪一步）→ `TODO_AND_BUGS.md`（未完成事项，唯一权威清单）→ `PROJECT_STATE.md`（工程状态）。
> 文档分工与「完工三步」见 `README.md` 的「文档地图」。

## 项目目标

一个**个人管理面板**：任务、倒计时事件、定时检查、电费监控、提醒、日历、每日评分、作品评分、兴趣记录和 AI 建议。

目标不是做复杂的大平台，而是做一个**每天可用、能逐步扩展、容易替换外部能力**的个人工作台。

## 核心工程方针（拼好码 / 胶水编程）

- 优先复用成熟能力。
- 优先使用官方 API、官方 SDK、成熟库和事实标准。
- 自研代码只负责连接、编排、适配、隔离和表达业务规则。
- 不重复造轮子。
- 不让第三方 API 的模型污染核心业务模型。
- 能配置就不要自研。
- 能适配就不要侵入。
- 能替换就不要强绑定。
- 能回滚就不要做不可逆改动。

## 协作与提交规则

- **完工三步**（缺一步文档就会分叉）：
  1. `PROGRESS_MAP.md` 记录完成状态；
  2. `TODO_AND_BUGS.md` **删掉**已完成的对应条目（它只记未完成项）；
  3. 需要接手方知道的信息（新模块、新边界、新命令、新坑）更新本文件；工程状态变化更新 `PROJECT_STATE.md`。
- 每完成一项修改，同步更新相关文档，并**提交推送到 GitHub**。
- 提交必须使用用户本机 git 身份（`CorvinYu <CorvinYu@yeah.net>`），**不得以 Claude / Codex / AI 的名义提交**。
- 涉及数据或线上配置的破坏性操作，先落快照/回滚点，再执行。

## 重要业务边界

- **任务 ≠ 倒计时**：任务表示“我要完成的事”，倒计时表示“会发生的事”。
- 任务可以完成、恢复、归档；倒计时**不能完成**，只能新增、编辑、删除。
- 任务删除目前是**归档**；倒计时删除目前是**物理删除**。
- Microsoft To Do 是外部能力，必须通过**适配层**隔离；它的原始数据不能直接污染本地任务模型。
- 登录后的业务接口必须从 **JWT 当前用户**取 userId，不能退回默认用户模式。
- 定时检查表示“生活规律维护”，不是普通任务、不是倒计时、也不是日历事件。
- 兴趣记录表示“我主动记录一次兴趣活动”，**不应有到期和逾期概念**。
- 作品评分记录表示“内容资产记录”，不是每日评分、不是任务、不是提醒，也不应混入当前状态分模型。
- **AI 只生成建议**，不能直接修改任务、倒计时、提醒或日历；用户确认后才应用。

## 当前主要功能（速览，细节见 `PROGRESS_MAP.md`）

- **任务管理** — 创建/编辑/完成/归档/恢复，截止倒计时，自动排序
- **倒计时表** — 基于 `CalendarEvent`，独立于任务
- **今日看板** — 聚合今日任务、检查事项、倒数日、下一项日程与今日时间表
- **定时检查** — 生活规律打卡、周期计算、暂停恢复、事项依赖、逾期提醒、睡眠记录
- **电费监控** — 读数录入、充值换算、日耗电估算、当前剩余电量预测、曲线图与阈值提示
- **每日评分** — 当前任务分（逾期扣分制），独立的每日评分与总分仍待做
- **作品评分记录** — `MediaWork` / `MediaReview` / `MediaExternalRating` 三层模型
- **Microsoft To Do 同步** — 双向同步、时区处理、JWT 绑定
- **登录与身份管理** — JWT + argon2，注册/登录/修改信息
- **维护（一键恢复正常日程）** — 逾期内容整体平移到今天之后，先预览、自动快照、可撤销
- **外部面板** — iframe 胶囊嵌入，可视化裁剪
- **兴趣记录** — 已设计待实现

## 重要配置与开关

- `MICROSOFT_TODO_TIME_ZONE`：默认 `Asia/Shanghai`，Microsoft To Do 时间转换用。
- 电价：`0.63` 元/度（写在电费服务里，用于充值金额 → 电量换算）。
- Swagger：生产环境默认关闭，`ENABLE_SWAGGER=true` 可临时开启。
- 前端代理目标：`VITE_API_PROXY_TARGET`（默认 `http://localhost:4000`；本机用 `apps/frontend/.env.local` 指到 4100）。

## 当前已知问题（真正未解决的）

- **Microsoft To Do 时间字段**：代码层已按“配置时区 + Graph 返回时区”做转换，但仍需**用真实账号回归验证**：
  本地创建带截止时间任务 → 推送 → 拉取 → 编辑截止时间 → 再拉取，确认时间不改变、不消失。
- 其余未完成项一律记在 `TODO_AND_BUGS.md`，本文件不重复维护清单。

## 本机（Mac mini）部署事实

当前主力形态是**本机 dev 常驻**（不是 Docker 容器）：launchd 常驻后端 `nest start --watch`（**4100**）与前端 `vite`（3000），依赖容器 postgres（**5433**）/ redis（**6380**），公网入口 `https://lmd.corvinyu.icu`（Cloudflare Tunnel）。

端口、隧道、备份、回滚与踩坑记录都在 hub 项目：**`E:\claude\lanmo-dashboard\NOTES.md`**。

## 常用命令

### 本机（Mac mini：改代码即生效）

```bash
cd /Users/corvinyu/code/LanMoDashboard2606

# 依赖容器
docker compose -f docker-compose.macmini.yml up -d

# 后端 / 前端（launchd 已常驻，需要时手动重启）
launchctl kickstart -k gui/501/com.lmd.backend
launchctl kickstart -k gui/501/com.lmd.frontend
curl -s http://localhost:4100/api/health
curl -s http://localhost:3000/api/health
```

### Docker（通用）

```bash
docker compose up --build -d
docker compose up --build -d backend      # 只更新后端
docker compose up --build -d frontend     # 只更新前端
```

### 构建校验

```bash
cd apps/backend  && npx prisma generate && npm run build
cd apps/frontend && npm run build
```

### npm 开发（通用，后端默认 4000）

```bash
cd apps/backend  && npx prisma generate && npx prisma db push && npm run start:dev
cd apps/frontend && npm run dev
```

## 访问地址

- 本机开发：前端 `http://localhost:3000` ｜ health `http://localhost:4100/api/health` ｜ Swagger `http://localhost:4100/api/docs`
- Docker 形态：前端 `3000` ｜ 后端 `4000` ｜ Adminer `8080`
- 公网：`https://lmd.corvinyu.icu`

## 文档地图（每份文档只有一个职责）

| 文档 | 职责 |
|---|---|
| `README.md` | 项目简介、技术栈、启动与部署方式、文档地图 |
| `AGENT_CONTEXT.md` | **接手上下文**（本文件）：工程方针、业务边界、协作与提交规则、已知问题 |
| `PROGRESS_MAP.md` | 进度地图：每个功能走到哪一步（已完成 / 待做 / 待研究 / 已验证） |
| `TODO_AND_BUGS.md` | **未完成事项的唯一权威清单**：待办、Bug、想法池、待分析、开发难度评估 |
| `PROJECT_STATE.md` | 工程状态：技术栈、部署形态、已实现、验证记录、启动命令 |
| `OPEN_SOURCE_REFERENCES.md` | 开源项目参考、接入与复制代码登记（含许可证义务） |
| `DONETICK_REFERENCE_ANALYSIS.md` | Donetick 参考项目分析（定时检查的设计来源） |

## 给下一次接手的提醒

1. 先按上面的顺序读四份文档，再动手。
2. 遵守“拼好码 / 胶水编程”，不要为了控制感自研成熟生态已经解决的问题。
3. 新增外部集成时，做适配层和边界隔离。
4. 新增 AI 能力时，保持“AI 只生成建议，用户确认后应用”。
5. 大规模改动前先落回滚点（数据库快照 / 文件备份），并说清楚回滚方式。
