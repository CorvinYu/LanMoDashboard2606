// 纯工具函数：格式化、排序权重、电费估算等。
//
// 2026-10-06 从 app/App.tsx 抽出（原文件 4556 行，单文件过重）。
// 这些函数原本就是纯函数（无 React 状态、无 JSX），抽出后行为完全不变。

import type {
  CountdownEvent,
  ElectricityReading,
  ElectricitySummary,
  MediaRatingProvider,
  RoutineHabit,
  SleepLog,
  Task,
  TaskPriority,
} from '../api/client';

export const countdownRefreshMs = 30 * 60 * 1000;

export type CurrentTaskScore = {
  score: number;
  overdueCount: number;
  penalty: number;
};

export type MediaExternalRatingDraft = {
  id: string;
  provider: MediaRatingProvider;
  ratingValue: string;
  ratingScale: string;
  ratingCount: string;
  sourceUrl: string;
  fetchedAt: string;
};

export type ElectricityChartPoint = {
  label: string;
  value: number;
  isEstimated: boolean;
  readingId: string | null;
  timestampMs: number;
};

export function getScoreTone(score: number) {
  if (score >= 85) {
    return 'healthy';
  }

  if (score >= 70) {
    return 'stable';
  }

  if (score >= 50) {
    return 'warning';
  }

  return 'danger';
}

export function calculateCurrentTaskScore(
  tasks: Task[],
  routineHabits: RoutineHabit[],
  now: Date,
): CurrentTaskScore {
  const taskPenalty = tasks.reduce((sum, task) => {
    const overdueHours = getTaskOverdueHours(task, now);

    return overdueHours === null
      ? sum
      : sum + getOverduePenalty(task.priority, overdueHours);
  }, 0);

  const routinePenalty = routineHabits.reduce((sum, habit) => {
    const overdueHours = getRoutineOverdueHours(habit, now);

    return overdueHours === null
      ? sum
      : sum + getOverduePenalty('LOW', overdueHours);
  }, 0);
  const overdueCount =
    tasks.filter((task) => getTaskOverdueHours(task, now) !== null).length +
    routineHabits.filter((habit) => getRoutineOverdueHours(habit, now) !== null).length;
  const penalty = taskPenalty + routinePenalty;

  return {
    score: Math.max(0, Math.round(100 - penalty)),
    overdueCount,
    penalty: Math.round(penalty * 10) / 10,
  };
}

export function getTaskOverdueHours(task: Task, now: Date) {
  if (task.status === 'DONE' || task.status === 'ARCHIVED' || !task.dueAt) {
    return null;
  }

  return getOverdueHours(task.dueAt, now);
}

export function getRoutineOverdueHours(habit: RoutineHabit, now: Date) {
  if (!habit.isActive || habit.state !== 'overdue') {
    return null;
  }

  return getOverdueHours(habit.nextDueAt, now);
}

export function getOverdueHours(dateValue: string, now: Date) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime()) || date >= now) {
    return null;
  }

  return (now.getTime() - date.getTime()) / 3_600_000;
}

export function getOverduePenalty(priority: TaskPriority, overdueHours: number) {
  const basePenalty = {
    LOW: 4,
    MEDIUM: 8,
    HIGH: 14,
  }[priority];
  const timeMultiplier =
    overdueHours <= 2
      ? 0.5
      : overdueHours <= 12
        ? 1
        : overdueHours <= 24
          ? 1.4
          : overdueHours <= 72
            ? 2
            : overdueHours <= 168
              ? 3
              : 4;

  return Math.min(basePenalty * timeMultiplier, 60);
}

export function getRoutineStateLabel(habit: RoutineHabit) {
  if (habit.dependsOnId && !habit.isActive) {
    return '休眠';
  }

  if (!habit.isActive || habit.state === 'inactive') {
    return '已暂停';
  }

  if (habit.state === 'overdue') {
    return '已逾期';
  }

  if (habit.state === 'due-soon') {
    return '即将到期';
  }

  return '正常';
}

export function createEmptyExternalRatingDraft(): MediaExternalRatingDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    provider: 'DOUBAN',
    ratingValue: '',
    ratingScale: '10',
    ratingCount: '',
    sourceUrl: '',
    fetchedAt: '',
  };
}

export function getDefaultDateTimeLocalValue() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

export function isTaskVisibleInTodayBoard(task: Task, now: Date) {
  if (task.status === 'DONE' || task.status === 'ARCHIVED') {
    return false;
  }

  if (task.status === 'DOING') {
    return true;
  }

  if (!task.dueAt) {
    return false;
  }

  return new Date(task.dueAt).getTime() <= getTomorrowStart(now).getTime();
}

export function getTodayTaskSortValue(task: Task, now: Date) {
  if (task.status === 'DOING') {
    return -180_000 - getPriorityWeight(task.priority) * 100;
  }

  if (!task.dueAt) {
    return 300_000 - getPriorityWeight(task.priority) * 100;
  }

  const diffMs = new Date(task.dueAt).getTime() - now.getTime();

  if (diffMs < 0) {
    return -220_000 + diffMs / 3_600_000 - getPriorityWeight(task.priority) * 100;
  }

  return diffMs / 60_000 - getPriorityWeight(task.priority) * 100;
}

export function getTodayRoutineSortValue(habit: RoutineHabit, now: Date) {
  const diffMs = new Date(habit.nextDueAt).getTime() - now.getTime();

  if (habit.state === 'overdue') {
    return -240_000 + diffMs / 3_600_000;
  }

  return diffMs / 60_000 + 5_000;
}

export function getTodayTaskLabel(task: Task, now: Date) {
  if (task.status === 'DOING') {
    return '正在做';
  }

  if (!task.dueAt) {
    return '今日关注';
  }

  const dueAt = new Date(task.dueAt);

  if (dueAt.getTime() < now.getTime()) {
    return '已逾期';
  }

  if (isSameDay(task.dueAt, now)) {
    return '今日截止';
  }

  return '即将截止';
}

export function getTodayTimelineStatus(value: string, now: Date) {
  const diffMs = new Date(value).getTime() - now.getTime();

  if (diffMs < 0) {
    return '已过';
  }

  if (diffMs <= 60 * 60 * 1000) {
    return '即将开始';
  }

  return '待开始';
}

export function isSameDay(value: string, baseDate: Date) {
  const date = new Date(value);

  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth() &&
    date.getDate() === baseDate.getDate()
  );
}

export function getTomorrowStart(baseDate: Date) {
  const start = new Date(baseDate);

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);

  return start;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatSleepDuration(log: SleepLog) {
  const diffMs = new Date(log.wokeUpAt).getTime() - new Date(log.wentToBedAt).getTime();
  const totalMinutes = Math.max(0, Math.round(diffMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} 小时 ${minutes} 分钟`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatKwh(value: number) {
  return `${Number(value.toFixed(2))} 度`;
}

export function formatMoney(value: number) {
  return `${Number(value.toFixed(2))} 元`;
}

export function convertYuanToKwh(value: number) {
  return Math.round((value / 0.63) * 100) / 100;
}

export function convertKwhToYuan(value: number) {
  return Math.round(value * 0.63 * 100) / 100;
}

export function formatRechargeReading(reading: ElectricityReading) {
  if (reading.rechargeAmountYuan !== null && reading.rechargeKwh !== null) {
    return `充值：${Number(reading.rechargeAmountYuan.toFixed(2))} 元，折合 ${formatKwh(reading.rechargeKwh)}`;
  }

  if (reading.rechargeKwh !== null) {
    return `充值：${formatKwh(reading.rechargeKwh)}`;
  }

  return '充值：未填金额';
}

export function formatThresholdEstimate(summary: ElectricitySummary | null) {
  if (!summary || summary.daysUntilThreshold === null || summary.dailyUsageKwh <= 0) {
    return '--';
  }

  if (summary.daysUntilThreshold < 0) {
    return '已低于阈值';
  }

  if (summary.daysUntilThreshold < 1) {
    return '24 小时内';
  }

  return `${Number(summary.daysUntilThreshold.toFixed(1))} 天`;
}

export function getLiveEstimatedCurrentKwh(summary: ElectricitySummary | null, now: Date) {
  if (!summary?.latest) {
    return null;
  }

  if (summary.dailyUsageKwh <= 0) {
    return summary.latest.remainingKwh;
  }

  const latestRecordedAt = new Date(summary.latest.recordedAt);

  if (latestRecordedAt.getTime() >= now.getTime()) {
    return summary.latest.remainingKwh;
  }

  const elapsedDays = (now.getTime() - latestRecordedAt.getTime()) / (24 * 60 * 60 * 1000);

  return Math.max(0, roundToTwo(summary.latest.remainingKwh - summary.dailyUsageKwh * elapsedDays));
}

export function buildElectricityChartPoints(
  readings: ElectricityReading[],
  summary: ElectricitySummary | null,
  now: Date,
  rangeDays: number,
): ElectricityChartPoint[] {
  const cutoffMs = now.getTime() - rangeDays * 24 * 60 * 60 * 1000;
  const allSorted = readings
    .slice()
    .sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
  const visible = allSorted.filter((reading) => new Date(reading.recordedAt).getTime() >= cutoffMs);

  const actualPoints: ElectricityChartPoint[] = [];

  for (const reading of visible) {
    const timestampMs = new Date(reading.recordedAt).getTime();

    if (reading.didRecharge && reading.rechargeKwh !== null && reading.rechargeKwh > 0) {
      const preRechargeKwh = Math.max(0, roundToTwo(reading.remainingKwh - reading.rechargeKwh));

      actualPoints.push({
        label: formatChartDate(reading.recordedAt),
        value: preRechargeKwh,
        isEstimated: false,
        readingId: reading.id,
        timestampMs,
      });
    }

    actualPoints.push({
      label: formatChartDate(reading.recordedAt),
      value: reading.remainingKwh,
      isEstimated: false,
      readingId: reading.id,
      timestampMs,
    });
  }

  const liveEstimatedCurrentKwh = getLiveEstimatedCurrentKwh(summary, now);

  if (!summary?.latest || liveEstimatedCurrentKwh === null) {
    return actualPoints;
  }

  const latestRecordedAt = new Date(summary.latest.recordedAt);

  if (latestRecordedAt.getTime() >= now.getTime()) {
    return actualPoints;
  }

  return [
    ...actualPoints,
    {
      label: formatChartDate(now.toISOString()),
      value: liveEstimatedCurrentKwh,
      isEstimated: true,
      readingId: null,
      timestampMs: now.getTime(),
    },
  ];
}

export function formatChartDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatChartDateDateLine(timestampMs: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestampMs));
}

export function formatChartDateTimeLine(timestampMs: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestampMs));
}

export function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

export function getElectricityStatusLabel(status: ElectricitySummary['status']) {
  if (status === 'LOW') {
    return '电量不足';
  }

  if (status === 'WARNING') {
    return '即将不足';
  }

  if (status === 'OK') {
    return '正常';
  }

  return '待录入';
}

export function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function toDateOnlyIso(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function sortCountdownEvents(events: CountdownEvent[]) {
  return [...events].sort((left, right) => {
    const timeDiff = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();

    if (Math.abs(timeDiff) > 24 * 60 * 60 * 1000) {
      return timeDiff;
    }

    return getPriorityWeight(right.priority) - getPriorityWeight(left.priority) || timeDiff;
  });
}

export function getPriorityWeight(priority: TaskPriority) {
  if (priority === 'HIGH') {
    return 3;
  }

  if (priority === 'MEDIUM') {
    return 2;
  }

  return 1;
}

export function formatCountdown(value: string, now: Date) {
  const dueAt = new Date(value);
  const diffMs = dueAt.getTime() - now.getTime();
  const halfHours = Math.round(Math.abs(diffMs) / countdownRefreshMs);

  if (halfHours === 0) {
    return diffMs >= 0 ? '30 分钟内到期' : '刚刚逾期';
  }

  const duration = formatHalfHours(halfHours);

  return diffMs >= 0 ? `剩 ${duration}` : `已逾期 ${duration}`;
}

export function formatHalfHours(halfHours: number) {
  const days = Math.floor(halfHours / 48);
  const remainingHalfHours = halfHours % 48;
  const hours = remainingHalfHours / 2;

  if (days > 0 && remainingHalfHours > 0) {
    return `${days} 天 ${formatHours(hours)}`;
  }

  if (days > 0) {
    return `${days} 天`;
  }

  return formatHours(hours);
}

export function formatHours(hours: number) {
  if (hours === 0.5) {
    return '30 分钟';
  }

  return Number.isInteger(hours) ? `${hours} 小时` : `${hours} 小时`;
}

export function getCountdownState(value: string, now: Date) {
  const diffMs = new Date(value).getTime() - now.getTime();

  if (diffMs < 0) {
    return 'countdown-overdue';
  }

  if (diffMs <= 24 * 60 * 60 * 1000) {
    return 'countdown-soon';
  }

  return 'countdown-normal';
}
