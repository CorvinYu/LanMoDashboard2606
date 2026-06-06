# Donetick Reference Analysis

Donetick 已 clone 到 `references/opensource/donetick`，仅作为参考项目阅读。

- URL: https://github.com/donetick/donetick
- License: AGPL-3.0
- Code copied into this project: No

## Relevant Findings

Donetick 的核心功能和“规律作息”中的“周期事项打卡”高度相关。

重点参考位置：

- `internal/chore/model/model.go`
  - `Chore`：周期事项配置。
  - `ChoreHistory`：完成、跳过、错过、重排等历史记录。
  - `FrequencyMetadata`：周期规则扩展数据。
  - `NotificationMetadata`：提醒策略。
- `internal/chore/scheduler.go`
  - 根据完成时间、到期时间和周期规则计算下一次到期时间。
  - 支持 daily、weekly、monthly、yearly、interval、days_of_the_week、day_of_the_month、adaptive。
- `internal/chore/handler.go`
  - `CompleteChore` 串起“打卡 -> 计算下一次到期 -> 写历史 -> 生成提醒”。
  - `SkipChore` 支持跳过一次周期事项。
- `internal/chore/repo/repository.go`
  - `CompleteChore` 在一个事务里更新事项和写入历史。
  - `GetOverdueChoresForNotification` 查询逾期且需要持续提醒的事项。
  - `GetPreDueChoresForNotification` 查询即将到期的事项。
- `internal/notifier/service/planner.go`
  - 根据提醒模板生成提醒记录。
  - 模板 value 小于 0 表示提前提醒，0 表示到期提醒，大于 0 表示逾期提醒。
- `internal/notifier/scheduler.go`
  - 定时扫描待发送提醒，并标记为已发送。
- `internal/thing/model/model.go` 和 `internal/thing/helper.go`
  - “Thing” 用于记录非任务状态，并可在状态满足条件时触发 chore 完成。

## Useful Ideas For LanMo2606

### 1. 规律事项和打卡记录分离

Donetick 把事项配置和完成历史分开，这是我们应该采用的方向。

建议模型：

- `RoutineHabit`
  - 标题、说明、分类。
  - 是否启用。
  - 期望间隔和单位。
  - 下次到期时间。
  - 是否滚动计算。
  - 提醒策略。
  - 是否加入今日面板。
- `RoutineCheckIn`
  - 规律事项 ID。
  - 打卡时间。
  - 状态：completed / skipped / missed / rescheduled。
  - 备注。
  - 本次打卡前的到期时间。

### 2. 下一次到期时间计算

Donetick 的关键设计是区分两种模式：

- 固定节奏：基于上一轮到期时间计算下一次到期。
- 滚动节奏：基于实际完成时间计算下一次到期。

这正适合“整理桌面”“洗衣服”这类事项。

第一版不需要完整复刻 Donetick 的复杂周期。建议先支持：

- 每 N 小时 / 天 / 周 / 月。
- 固定每周某几天。
- 固定每月某一天。
- 固定节奏 vs 滚动节奏。

### 3. 逾期提醒

Donetick 的提醒机制是：

1. 事项有 `next_due_date`。
2. 根据提醒模板生成 notification 记录。
3. 后台 scheduler 扫描待发送 notification。

我们可以简化为：

1. 后端提供 `GET /routine-habits/due` 或 `POST /routine-habits/check-overdue`。
2. 找出 `nextDueAt < now` 且还没有生成提醒的规律事项。
3. 写入本项目已有 `Reminder` 表，或后续写入今日面板。
4. 后续再用 Redis / 后台任务自动扫描。

### 4. 跳过、错过、重排

Donetick 不只记录完成，还记录 skipped、missed、rescheduled。

我们第一版可以先做：

- 打卡完成。
- 跳过本轮。
- 修改下次到期时间。

后续再补 missed 统计。

### 5. Thing 的思路

Donetick 的 Thing 可以记录非任务状态，并在状态变化时触发任务完成。

这对我们未来接入手机、手环、传感器有启发，但不应第一版实现。

睡眠自动化可以沿用类似思路：

- 外部数据源同步出一个状态或记录。
- 由适配层转换成本地 `SleepLog`。
- 不让外部 API 模型污染本地核心模型。

## Not Directly Useful

以下能力对当前个人规律作息不是第一优先级：

- 多人圈子、家庭协作、指派轮换。
- 积分系统。
- 子任务树。
- 图片附件。
- NFC 标签。
- 多平台通知发送。
- 实时同步和离线同步。
- 审批流程。

这些可以以后再考虑，第一版不应引入复杂度。

## Natural Language Creation

Donetick README 提到自然语言创建，例如根据一句话解析周期任务。

在当前 `donetick/donetick` 后端仓库中，没有明显找到自然语言解析实现。README 说明前端在另一个仓库 `donetick/frontend`，该能力可能在前端或其他服务中。

对 LanMo2606 来说，这个能力可以后续通过现有 AI provider 实现：AI 只生成结构化建议，用户确认后创建规律事项。

## Recommended Implementation Plan

### Phase 1: Replace Current Routine Page

把当前“规律作息”的一天时间段排程原型替换为生活规律维护面板。

Status: completed.

前端页面分区：

- 规律事项列表。
- 需要打卡 / 已逾期 / 正常状态。
- 新增规律事项表单。
- 最近打卡记录。
- 睡眠记录入口。

### Phase 2: Backend Persistence

新增 Prisma 模型：

- `RoutineHabit`
- `RoutineCheckIn`
- `SleepLog`

Status: completed.

新增 NestJS 模块：

- `routine`
- `sleep` 或合并在 `routine`

API：

- `GET /routine-habits`
- `POST /routine-habits`
- `PATCH /routine-habits/:id`
- `POST /routine-habits/:id/check-ins`
- `POST /routine-habits/:id/skip`
- `POST /routine-habits/check-overdue`
- `GET /sleep-logs`
- `POST /sleep-logs`

### Phase 3: Reminder Integration

逾期规律事项生成本地提醒：

- 使用已有 `Reminder` 模型。
- 保留来源关系，避免把规律事项复制成普通 `Task`。
- 后续需要时再加入今日面板。

Status: partially completed.

- 已完成手动检查逾期事项并生成本地提醒。
- 尚未实现后台自动扫描。
- 尚未实现今日面板。

### Phase 4: Automation Research

睡眠自动化单独研究：

- Samsung Health 数据导出或 API。
- Google Fit。
- Android Health Connect。
- 可行后通过独立适配层导入 `SleepLog`。

## License Notes

Donetick 是 AGPL-3.0。

当前只 clone 和分析，没有复制代码到本项目。

如果后续复制代码，需要在 `OPEN_SOURCE_REFERENCES.md` 记录：

- 复制了哪些文件。
- 放到本项目哪里。
- 修改了什么。
- 如何履行 AGPL-3.0 义务。
