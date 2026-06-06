# LanMo Dashboard 2606

一个个人管理面板，用来管理任务、倒计时事件、规律作息、提醒、每日评分和 AI 建议。

本项目由 **vibecoding** 完成，目标不是做复杂平台，而是做一个每天可用、可逐步扩展、容易替换外部能力的个人工作台。

## 技术栈

- 前端：React、Vite、TypeScript、lucide-react
- 后端：NestJS、TypeScript、Prisma
- 数据库：PostgreSQL
- 后台依赖：Redis
- 部署：Docker Compose
- AI：OpenAI-compatible provider
- 外部集成：Microsoft To Do / Microsoft Graph

## 已完成功能

- 账号登录：注册、登录、当前用户、退出，JWT 保护业务接口。
- 任务管理：新增、查看、编辑、完成、恢复、归档删除、优先级、截止时间、自动排序。
- 当前任务分：根据普通任务和规律作息中的逾期事项计算 0-100 分，并用颜色显示健康度。
- 倒计时表：新增、查看、编辑、删除未来事件，显示距离发生还有多久。
- Microsoft To Do：连接账号、拉取任务、推送本地任务、本地完成/恢复时尝试同步。
- 规律作息：周期事项配置、打卡、跳过、自动计算下次到期、逾期提醒、睡眠手动记录。
- 响应式布局：桌面三列任务面板，移动端优先显示任务和倒计时，侧边菜单适配手机。
- Docker 化：前端、后端、PostgreSQL、Redis、Adminer 一键启动。

## 预期功能

- 今日视图和本周视图。
- 日历视图、甘特图、四象限视图。
- 提醒列表、提醒创建和到期提醒。
- 每日评分录入、历史评分、趋势分析，以及由任务分、作息分、睡眠分、兴趣记录分等组成的总分。
- 兴趣记录：类似打卡，但不设置倒计时和逾期，只记录上次活动距今多久和频率变化。
- AI 助手：根据自然语言识别任务、倒计时事件或提醒，生成建议并由用户确认应用。
- Microsoft To Do 冲突处理、自动同步、OAuth state 与当前登录用户绑定。
- refresh token、忘记密码、邮箱验证、多设备会话管理。

## 启动

```bash
cp .env.example .env
docker compose up --build -d
```

访问地址：

- 前端：http://localhost:3000
- 后端健康检查：http://localhost:4000/api/health
- 同源健康检查：http://localhost:3000/api/health
- Swagger：http://localhost:4000/api/docs
- Adminer：http://localhost:8080

首次打开前端后先注册账号。如果使用 `.env` 里的 `DEFAULT_USER_EMAIL` 注册，会给默认本地用户设置真实密码，并保留已有数据归属。

## 手机访问

如果手机和电脑在同一局域网，打开：

```text
http://电脑局域网IP:3000
```

前端默认使用同源 `/api`，Docker Nginx 会代理到后端，因此手机不会错误请求手机自己的 `localhost:4000`。

## 常用命令

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
docker compose up --build -d backend
docker compose up --build -d frontend
```
