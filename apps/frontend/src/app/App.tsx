import {
  Activity,
  Bot,
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  Edit3,
  ListTodo,
  LogOut,
  PanelLeft,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Star,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CountdownEvent,
  AuthUser,
  ElectricityReading,
  ElectricitySummary,
  RoutineHabit,
  RoutineIntervalUnit,
  SleepLog,
  Task,
  TaskPriority,
  checkInRoutineHabit,
  checkOverdueRoutineHabits,
  completeTask,
  createCountdownEvent,
  createElectricityReading,
  createRoutineHabit,
  createSleepLog,
  createTask,
  deleteCountdownEvent,
  deleteElectricityReading,
  deleteRoutineHabit,
  deleteTask,
  getElectricitySummary,
  getHealth,
  getMe,
  getMicrosoftTodoAuthUrl,
  listElectricityReadings,
  getStoredAuthToken,
  listCountdownEvents,
  listTodayCountdownEvents,
  listRecentRoutineCheckIns,
  listRoutineHabits,
  listSleepLogs,
  listTasks,
  login,
  logout,
  pushMicrosoftTodo,
  register,
  restoreTask,
  setAuthToken,
  setUnauthorizedHandler,
  skipRoutineHabit,
  syncMicrosoftTodo,
  updateCountdownEvent,
  updateElectricityReading,
  updateMe,
  updateRoutineHabit,
  updateTask,
} from '../api/client';

type PageKey =
  | 'today'
  | 'tasks'
  | 'routine'
  | 'electricity'
  | 'calendar'
  | 'reminders'
  | 'scores'
  | 'ai'
  | 'account';

const navigationItems: Array<{
  key: PageKey;
  title: string;
  description: string;
  icon: typeof ListTodo;
}> = [
  {
    key: 'today',
    title: '今日看板',
    description: '今日任务、倒数日和时间表',
    icon: Clock,
  },
  {
    key: 'tasks',
    title: '任务面板',
    description: '任务、倒计时和 To Do 同步',
    icon: ListTodo,
  },
  {
    key: 'routine',
    title: '定时检查',
    description: '固定节奏和每日结构',
    icon: Clock,
  },
  {
    key: 'electricity',
    title: '电费监控',
    description: '余量、耗电和充值记录',
    icon: Zap,
  },
  {
    key: 'calendar',
    title: '日历',
    description: '事件和计划时间块',
    icon: CalendarDays,
  },
  {
    key: 'reminders',
    title: '提醒',
    description: '到期提醒和后续处理',
    icon: CheckSquare,
  },
  {
    key: 'scores',
    title: '每日评分',
    description: '状态记录和趋势',
    icon: Star,
  },
  {
    key: 'ai',
    title: 'AI 助手',
    description: '生成建议并确认应用',
    icon: Bot,
  },
];

const priorityLabels: Record<TaskPriority, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
};

const countdownRefreshMs = 30 * 60 * 1000;

type CurrentTaskScore = {
  score: number;
  overdueCount: number;
  penalty: number;
};

type TodayBoardTaskItem =
  | {
      kind: 'task';
      task: Task;
      sortValue: number;
    }
  | {
      kind: 'routine';
      habit: RoutineHabit;
      sortValue: number;
    };

const todayBoardRefreshMs = 60 * 1000;

export function App() {
  const [activePage, setActivePage] = useState<PageKey>('today');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 1180px)').matches,
  );
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => Boolean(getStoredAuthToken()));
  const [currentTaskScore, setCurrentTaskScore] = useState<CurrentTaskScore | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCurrentUser(null);
    });

    if (!getStoredAuthToken()) {
      setIsCheckingAuth(false);
      return () => setUnauthorizedHandler(null);
    }

    getMe()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => {
        setAuthToken('');
        setCurrentUser(null);
      })
      .finally(() => setIsCheckingAuth(false));

    return () => setUnauthorizedHandler(null);
  }, []);

  const currentPage = navigationItems.find((item) => item.key === activePage) ?? {
    key: 'account',
    title: '账号管理',
    description: '账号、邮箱和显示名称',
    icon: User,
  };

  function handleAuthSuccess(accessToken: string, user: AuthUser) {
    setAuthToken(accessToken);
    setCurrentUser(user);
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    setAuthToken('');
    setCurrentUser(null);
    setCurrentTaskScore(null);
  }

  const handleTaskScoreChange = useCallback((score: CurrentTaskScore) => {
    setCurrentTaskScore(score);
  }, []);

  if (isCheckingAuth) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">个人管理</p>
          <h1>正在检查登录状态</h1>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <AuthPage apiStatus={apiStatus} onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <main className={`app-layout ${isSidebarOpen ? '' : 'app-layout-sidebar-closed'}`}>
      <button
        aria-label={isSidebarOpen ? '收起目录' : '展开目录'}
        aria-pressed={isSidebarOpen}
        className="sidebar-toggle"
        onClick={() => setIsSidebarOpen((current) => !current)}
        type="button"
      >
        <PanelLeft size={20} />
      </button>
      {isSidebarOpen ? (
        <button
          aria-label="关闭目录"
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">个人管理</p>
          <h1>管理面板</h1>
        </div>

        <nav className="sidebar-nav" aria-label="功能目录">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activePage;

            return (
              <button
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                key={item.key}
                onClick={() => {
                  setActivePage(item.key);

                  if (window.matchMedia('(max-width: 1180px)').matches) {
                    setIsSidebarOpen(false);
                  }
                }}
                type="button"
              >
                <Icon size={18} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="app-main">
        <section className="topbar">
          <div>
            <p className="eyebrow">当前页面</p>
            <div className="page-title-row">
              <h2>{currentPage.title}</h2>
              {activePage === 'today' || activePage === 'tasks' ? (
                <ScoreSummaryPanel score={currentTaskScore} />
              ) : null}
            </div>
          </div>
          <div className="topbar-actions">
            <button className="user-pill" onClick={() => setActivePage('account')} type="button">
              <User size={16} />
              <span>{currentUser.displayName}</span>
            </button>
            <div className={`status status-${apiStatus}`}>
              <Activity size={16} />
              <span>API {apiStatus}</span>
            </div>
            <button className="icon-button" onClick={handleLogout} title="退出登录" type="button">
              <LogOut size={17} />
            </button>
          </div>
        </section>

        {activePage === 'today' ? <TodayDashboardPage onTaskScoreChange={handleTaskScoreChange} /> : null}
        {activePage === 'tasks' ? <TaskDashboardPage onTaskScoreChange={handleTaskScoreChange} /> : null}
        {activePage === 'routine' ? <RoutinePage /> : null}
        {activePage === 'electricity' ? <ElectricityPage /> : null}
        {activePage === 'calendar' ? <PlaceholderPage title="日历" /> : null}
        {activePage === 'reminders' ? <PlaceholderPage title="提醒" /> : null}
        {activePage === 'scores' ? <PlaceholderPage title="每日评分" /> : null}
        {activePage === 'ai' ? <PlaceholderPage title="AI 助手" /> : null}
        {activePage === 'account' ? (
          <AccountPage currentUser={currentUser} onAccountUpdated={handleAuthSuccess} />
        ) : null}
      </section>
    </main>
  );
}

function TodayDashboardPage({
  onTaskScoreChange,
}: {
  onTaskScoreChange: (score: CurrentTaskScore) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routineHabits, setRoutineHabits] = useState<RoutineHabit[]>([]);
  const [todayEvents, setTodayEvents] = useState<CountdownEvent[]>([]);
  const [countdownEvents, setCountdownEvents] = useState<CountdownEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    refreshTodayBoard();
  }, []);

  useEffect(() => {
    onTaskScoreChange(calculateCurrentTaskScore(tasks, routineHabits, now));
  }, [now, onTaskScoreChange, routineHabits, tasks]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, todayBoardRefreshMs);

    return () => window.clearInterval(timer);
  }, []);

  const todayTaskItems = useMemo(() => {
    const taskItems: TodayBoardTaskItem[] = tasks
      .filter((task) => isTaskVisibleInTodayBoard(task, now))
      .map((task) => ({
        kind: 'task',
        task,
        sortValue: getTodayTaskSortValue(task, now),
      }));

    const routineItems: TodayBoardTaskItem[] = routineHabits
      .filter((habit) => habit.isActive && (habit.state === 'overdue' || habit.state === 'due-soon'))
      .map((habit) => ({
        kind: 'routine',
        habit,
        sortValue: getTodayRoutineSortValue(habit, now),
      }));

    return [...taskItems, ...routineItems].sort((left, right) => left.sortValue - right.sortValue);
  }, [now, routineHabits, tasks]);

  const nextTodayEvent = useMemo(
    () => todayEvents.find((event) => new Date(event.startsAt).getTime() >= now.getTime()) ?? null,
    [now, todayEvents],
  );
  const nextSchedule = nextTodayEvent ?? countdownEvents[0] ?? null;
  const highlightedCountdowns = useMemo(() => countdownEvents.slice(0, 5), [countdownEvents]);

  async function refreshTodayBoard() {
    setIsLoading(true);
    setError('');

    try {
      const [loadedTasks, loadedRoutineHabits, loadedTodayEvents, loadedCountdownEvents] =
        await Promise.all([
          listTasks(),
          listRoutineHabits(),
          listTodayCountdownEvents(),
          listCountdownEvents(),
        ]);

      setTasks(loadedTasks);
      setRoutineHabits(loadedRoutineHabits);
      setTodayEvents(loadedTodayEvents);
      setCountdownEvents(loadedCountdownEvents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '今日看板加载失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCompleteTodayTask(id: string) {
    setActionError('');

    try {
      await completeTask(id);
      await refreshTodayBoard();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : '任务更新失败');
    }
  }

  async function handleCheckInTodayHabit(id: string) {
    setActionError('');

    try {
      await checkInRoutineHabit(id);
      await refreshTodayBoard();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : '检查事项打卡失败');
    }
  }

  return (
    <section className="today-board">
      <div className="today-column today-column-primary">
        <div className="task-panel today-panel">
          <div className="section-heading">
            <div>
              <h2>今日任务列表</h2>
            </div>
            <div className="heading-actions">
              <span className="counter">{todayTaskItems.length} 项</span>
              <button className="heading-button" onClick={refreshTodayBoard} type="button">
                <RefreshCw size={16} />
                <span>刷新</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className="muted">正在加载今日任务</p>
          ) : todayTaskItems.length === 0 ? (
            <p className="muted">今天没有需要处理的任务。</p>
          ) : (
            <div className="task-list">
              {todayTaskItems.map((item) =>
                item.kind === 'routine' ? (
                  <article
                    className={`task-item routine-task-item routine-${item.habit.state}`}
                    key={`today-routine-${item.habit.id}`}
                  >
                    <div className="task-content">
                      <div className="task-title-row">
                        <h3>{item.habit.title}</h3>
                        <span className="priority priority-low">检查</span>
                      </div>
                      {item.habit.description ? <p>{item.habit.description}</p> : null}
                      <div className="task-meta">
                        <span>{getRoutineStateLabel(item.habit)}</span>
                        <span>预期：{formatDate(item.habit.nextDueAt)}</span>
                        <span className={`countdown ${getCountdownState(item.habit.nextDueAt, now)}`}>
                          {formatCountdown(item.habit.nextDueAt, now)}
                        </span>
                      </div>
                    </div>
                    <div className="task-actions">
                      <button
                        aria-label="检查事项打卡"
                        onClick={() => handleCheckInTodayHabit(item.habit.id)}
                        type="button"
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  </article>
                ) : (
                  <article className="task-item" key={`today-task-${item.task.id}`}>
                    <div className="task-content">
                      <div className="task-title-row">
                        <h3>{item.task.title}</h3>
                        <span className={`priority priority-${item.task.priority.toLowerCase()}`}>
                          {priorityLabels[item.task.priority]}
                        </span>
                      </div>
                      {item.task.description ? <p>{item.task.description}</p> : null}
                      <div className="task-meta">
                        <span>{getTodayTaskLabel(item.task, now)}</span>
                        {item.task.dueAt ? <span>截止：{formatDate(item.task.dueAt)}</span> : null}
                        {item.task.dueAt ? (
                          <span className={`countdown ${getCountdownState(item.task.dueAt, now)}`}>
                            {formatCountdown(item.task.dueAt, now)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="task-actions">
                      <button
                        aria-label="完成今日任务"
                        onClick={() => handleCompleteTodayTask(item.task.id)}
                        type="button"
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          {error ? <p className="error-text">{error}</p> : null}
          {actionError ? <p className="error-text">{actionError}</p> : null}
        </div>
      </div>

      <div className="today-column today-column-secondary">
        <div className="task-panel today-panel">
          <div className="section-heading">
            <div>
              <h2>下一项日程</h2>
            </div>
          </div>

          {isLoading ? (
            <p className="muted">正在计算下一项日程</p>
          ) : !nextSchedule ? (
            <p className="muted">还没有接下来的日程。</p>
          ) : (
            <div className="today-next-schedule">
              <p className="eyebrow">{isSameDay(nextSchedule.startsAt, now) ? '今天' : '最近事件'}</p>
              <h3>{nextSchedule.title}</h3>
              {nextSchedule.description ? <p>{nextSchedule.description}</p> : null}
              <div className="today-next-meta">
                <span>{formatDate(nextSchedule.startsAt)}</span>
                <span className={`countdown ${getCountdownState(nextSchedule.startsAt, now)}`}>
                  {formatCountdown(nextSchedule.startsAt, now)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="task-panel today-panel">
          <div className="section-heading">
            <div>
              <h2>倒数日</h2>
            </div>
            <span className="counter">{highlightedCountdowns.length} 条</span>
          </div>

          {isLoading ? (
            <p className="muted">正在加载倒数日</p>
          ) : highlightedCountdowns.length === 0 ? (
            <p className="muted">还没有未来事件。</p>
          ) : (
            <div className="today-countdown-list">
              {highlightedCountdowns.map((event) => (
                <article className="today-countdown-item" key={`today-countdown-${event.id}`}>
                  <div className="task-title-row">
                    <h3>{event.title}</h3>
                    <span className={`priority priority-${event.priority.toLowerCase()}`}>
                      {priorityLabels[event.priority]}
                    </span>
                  </div>
                  <div className="task-meta">
                    <span>{formatDate(event.startsAt)}</span>
                    <span className={`countdown ${getCountdownState(event.startsAt, now)}`}>
                      {formatCountdown(event.startsAt, now)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="today-column today-column-tertiary">
        <div className="task-panel today-panel">
          <div className="section-heading">
            <div>
              <h2>今日时间表</h2>
            </div>
            <span className="counter">{todayEvents.length} 项</span>
          </div>

          {isLoading ? (
            <p className="muted">正在加载今日时间表</p>
          ) : todayEvents.length === 0 ? (
            <p className="muted">今天还没有安排事件。</p>
          ) : (
            <div className="today-timeline">
              {todayEvents.map((event) => (
                <article className="today-timeline-item" key={`today-timeline-${event.id}`}>
                  <div className="today-timeline-time">
                    <strong>{formatTime(event.startsAt)}</strong>
                    <span>{getTodayTimelineStatus(event.startsAt, now)}</span>
                  </div>
                  <div className="today-timeline-content">
                    <div className="task-title-row">
                      <h3>{event.title}</h3>
                      <span className={`priority priority-${event.priority.toLowerCase()}`}>
                        {priorityLabels[event.priority]}
                      </span>
                    </div>
                    {event.description ? <p>{event.description}</p> : null}
                    <div className="task-meta">
                      <span>{formatDate(event.startsAt)}</span>
                      <span className={`countdown ${getCountdownState(event.startsAt, now)}`}>
                        {formatCountdown(event.startsAt, now)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AccountPage({
  currentUser,
  onAccountUpdated,
}: {
  currentUser: AuthUser;
  onAccountUpdated: (accessToken: string, user: AuthUser) => void;
}) {
  const [email, setEmail] = useState(currentUser.email);
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setEmail(currentUser.email);
    setDisplayName(currentUser.displayName);
  }, [currentUser]);

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const result = await updateMe({
        email,
        displayName,
        ...(password ? { password } : {}),
      });

      onAccountUpdated(result.accessToken, result.user);
      setPassword('');
      setMessage('账号信息已更新。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '账号更新失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="account-page">
      <div className="task-panel account-panel">
        <div className="section-heading">
          <div>
            <h2>账号信息</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={handleSaveAccount}>
          <label>
            <span>邮箱</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>显示名称</span>
            <input
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>

          <label>
            <span>新密码</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="不修改请留空"
              type="password"
              value={password}
            />
          </label>

          <button className="primary-button" disabled={isSaving} type="submit">
            <Save size={18} />
            <span>{isSaving ? '保存中' : '保存账号信息'}</span>
          </button>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}

function ScoreSummaryPanel({ score }: { score: CurrentTaskScore | null }) {
  const scoreTone = score ? getScoreTone(score.score) : 'pending';

  return (
    <div className={`score-summary-panel score-summary-${scoreTone}`} aria-label="当前评分">
      <span>当前任务分</span>
      <strong>{score ? score.score : '--'}</strong>
      <small>{score ? `${score.overdueCount} 项逾期` : '计算中'}</small>
    </div>
  );
}

function getScoreTone(score: number) {
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

function AuthPage({
  apiStatus,
  onAuthSuccess,
}: {
  apiStatus: 'checking' | 'ok' | 'error';
  onAuthSuccess: (accessToken: string, user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const result =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password, displayName });

      onAuthSuccess(result.accessToken, result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-heading">
          <div>
            <p className="eyebrow">个人管理</p>
            <h1>账号登录</h1>
          </div>
          <div className={`status status-${apiStatus}`}>
            <Activity size={16} />
            <span>API {apiStatus}</span>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="登录方式">
          <button
            className={mode === 'login' ? 'auth-tab-active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            登录
          </button>
          <button
            className={mode === 'register' ? 'auth-tab-active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>邮箱</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          {mode === 'register' ? (
            <label>
              <span>显示名称</span>
              <input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：本地用户"
                value={displayName}
              />
            </label>
          ) : null}

          <label>
            <span>密码</span>
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? '处理中' : mode === 'login' ? '登录' : '创建账号'}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        {mode === 'register' ? (
          <p className="muted auth-note">
            如果使用默认用户邮箱注册，会为现有本地数据设置真实密码。
          </p>
        ) : null}
      </section>
    </main>
  );
}

function TaskDashboardPage({
  onTaskScoreChange,
}: {
  onTaskScoreChange: (score: CurrentTaskScore) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routineHabits, setRoutineHabits] = useState<RoutineHabit[]>([]);
  const [countdownEvents, setCountdownEvents] = useState<CountdownEvent[]>([]);
  const [taskError, setTaskError] = useState('');
  const [eventError, setEventError] = useState('');
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSyncingMicrosoftTodo, setIsSyncingMicrosoftTodo] = useState(false);
  const [isPushingMicrosoftTodo, setIsPushingMicrosoftTodo] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [integrationError, setIntegrationError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventPriority, setEventPriority] = useState<TaskPriority>('MEDIUM');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editDueAt, setEditDueAt] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventDescription, setEditEventDescription] = useState('');
  const [editEventPriority, setEditEventPriority] = useState<TaskPriority>('MEDIUM');
  const [editEventStartsAt, setEditEventStartsAt] = useState('');
  const [isSavingEventEdit, setIsSavingEventEdit] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    refreshTasks();
    refreshCountdownEvents();
  }, []);

  useEffect(() => {
    onTaskScoreChange(calculateCurrentTaskScore(tasks, routineHabits, now));
  }, [now, onTaskScoreChange, routineHabits, tasks]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('microsoftTodo');

    if (status === 'connected') {
      setIntegrationMessage('Microsoft To Do 已连接，可以同步任务。');
    } else if (status === 'error' || status === 'invalid') {
      setIntegrationError('Microsoft To Do 连接失败，请重试。');
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, countdownRefreshMs);

    return () => window.clearInterval(timer);
  }, []);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'DONE'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === 'DONE'), [tasks]);
  const visibleRoutineHabits = useMemo(
    () => routineHabits.filter((habit) => habit.isActive && (habit.state === 'overdue' || habit.state === 'due-soon')),
    [routineHabits],
  );

  async function refreshTasks() {
    setIsLoadingTasks(true);
    setTaskError('');

    try {
      const [loadedTasks, loadedRoutineHabits] = await Promise.all([
        listTasks(),
        listRoutineHabits(),
      ]);

      setTasks(loadedTasks);
      setRoutineHabits(loadedRoutineHabits);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : '任务加载失败');
    } finally {
      setIsLoadingTasks(false);
    }
  }

  async function refreshCountdownEvents() {
    setIsLoadingEvents(true);
    setEventError('');

    try {
      setCountdownEvents(await listCountdownEvents());
    } catch (error) {
      setEventError(error instanceof Error ? error.message : '倒计时加载失败');
    } finally {
      setIsLoadingEvents(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setTaskError('请输入任务标题');
      return;
    }

    setIsSaving(true);
    setTaskError('');

    try {
      await createTask({
        title,
        description,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      await refreshTasks();
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueAt('');
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : '任务创建失败');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateCountdownEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventTitle.trim()) {
      setEventError('请输入倒计时标题');
      return;
    }

    if (!eventStartsAt) {
      setEventError('请选择发生时间');
      return;
    }

    setIsSavingEvent(true);
    setEventError('');

    try {
      const created = await createCountdownEvent({
        title: eventTitle,
        description: eventDescription,
        priority: eventPriority,
        startsAt: new Date(eventStartsAt).toISOString(),
      });

      setCountdownEvents((current) => sortCountdownEvents([created, ...current]));
      setEventTitle('');
      setEventDescription('');
      setEventPriority('MEDIUM');
      setEventStartsAt('');
    } catch (error) {
      setEventError(error instanceof Error ? error.message : '倒计时创建失败');
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function handleCompleteTask(id: string) {
    await completeTask(id);
    await refreshTasks();
  }

  async function handleRestoreTask(id: string) {
    await restoreTask(id);
    await refreshTasks();
  }

  async function handleDeleteTask(id: string) {
    await deleteTask(id);
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  async function handleCheckInRoutineHabitFromTaskList(id: string) {
    await checkInRoutineHabit(id);
    await refreshTasks();
  }

  async function handleDeleteCountdownEvent(id: string) {
    await deleteCountdownEvent(id);
    setCountdownEvents((current) => current.filter((event) => event.id !== id));
  }

  function handleStartEventEdit(event: CountdownEvent) {
    setEditingEventId(event.id);
    setEditEventTitle(event.title);
    setEditEventDescription(event.description ?? '');
    setEditEventPriority(event.priority);
    setEditEventStartsAt(toDateTimeLocalValue(event.startsAt));
    setEventError('');
  }

  function handleCancelEventEdit() {
    setEditingEventId(null);
    setEditEventTitle('');
    setEditEventDescription('');
    setEditEventPriority('MEDIUM');
    setEditEventStartsAt('');
    setIsSavingEventEdit(false);
  }

  async function handleSaveEventEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEventId) {
      return;
    }

    if (!editEventTitle.trim()) {
      setEventError('请输入倒计时标题');
      return;
    }

    if (!editEventStartsAt) {
      setEventError('请选择发生时间');
      return;
    }

    setIsSavingEventEdit(true);
    setEventError('');

    try {
      const updated = await updateCountdownEvent(editingEventId, {
        title: editEventTitle,
        description: editEventDescription,
        priority: editEventPriority,
        startsAt: new Date(editEventStartsAt).toISOString(),
      });

      setCountdownEvents((current) =>
        sortCountdownEvents(current.map((item) => (item.id === updated.id ? updated : item))),
      );
      handleCancelEventEdit();
    } catch (error) {
      setEventError(error instanceof Error ? error.message : '倒计时更新失败');
    } finally {
      setIsSavingEventEdit(false);
    }
  }

  function handleStartEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditPriority(task.priority);
    setEditDueAt(task.dueAt ? toDateTimeLocalValue(task.dueAt) : '');
    setTaskError('');
  }

  function handleCancelEdit() {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
    setEditPriority('MEDIUM');
    setEditDueAt('');
    setIsSavingEdit(false);
  }

  async function handleSaveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTaskId) {
      return;
    }

    if (!editTitle.trim()) {
      setTaskError('请输入任务标题');
      return;
    }

    setIsSavingEdit(true);
    setTaskError('');

    try {
      await updateTask(editingTaskId, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        dueAt: editDueAt ? new Date(editDueAt).toISOString() : null,
      });

      await refreshTasks();
      handleCancelEdit();
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : '任务更新失败');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleConnectMicrosoftTodo() {
    setIntegrationError('');
    setIntegrationMessage('');

    try {
      setIntegrationMessage('正在打开 Microsoft 登录页面...');
      const { url } = await getMicrosoftTodoAuthUrl();
      window.location.assign(url);
    } catch (error) {
      setIntegrationMessage('');
      setIntegrationError(error instanceof Error ? error.message : 'Microsoft To Do 连接失败');
    }
  }

  async function handleSyncMicrosoftTodo() {
    setIsSyncingMicrosoftTodo(true);
    setIntegrationError('');
    setIntegrationMessage('');

    try {
      setIntegrationMessage('正在从 Microsoft To Do 拉取任务...');
      const result = await syncMicrosoftTodo();

      setIntegrationMessage(
        `Microsoft To Do 同步完成：新增 ${result.created} 个，更新 ${result.updated} 个。`,
      );
      await refreshTasks();
    } catch (error) {
      setIntegrationMessage('');
      setIntegrationError(error instanceof Error ? error.message : 'Microsoft To Do 同步失败');
    } finally {
      setIsSyncingMicrosoftTodo(false);
    }
  }

  async function handlePushMicrosoftTodo() {
    setIsPushingMicrosoftTodo(true);
    setIntegrationError('');
    setIntegrationMessage('');

    try {
      setIntegrationMessage('正在推送本地任务到 Microsoft To Do...');
      const result = await pushMicrosoftTodo();

      setIntegrationMessage(
        `已推送到 Microsoft To Do：新增 ${result.created} 个任务到 ${result.list}。`,
      );
      await refreshTasks();
    } catch (error) {
      setIntegrationMessage('');
      setIntegrationError(error instanceof Error ? error.message : 'Microsoft To Do 推送失败');
    } finally {
      setIsPushingMicrosoftTodo(false);
    }
  }

  return (
    <>
      <section className="task-workspace">
        <div className="task-panel task-create-panel">
          <div className="section-heading">
            <div>
              <h2>任务管理</h2>
            </div>
          </div>

          <form className="task-form" onSubmit={handleCreateTask}>
            <label>
              <span>标题</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：整理下周计划"
              />
            </label>

            <label>
              <span>描述</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="补充背景、目标或注意事项"
                rows={3}
              />
            </label>

            <div className="form-row">
              <label>
                <span>优先级</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                >
                  <option value="LOW">低</option>
                  <option value="MEDIUM">中</option>
                  <option value="HIGH">高</option>
                </select>
              </label>

              <label>
                <span>截止时间</span>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
            </div>

            <button className="primary-button" disabled={isSaving} type="submit">
              <Plus size={18} />
              <span>{isSaving ? '保存中' : '新增任务'}</span>
            </button>
          </form>

          {taskError && <p className="error-text">{taskError}</p>}
        </div>

        <div className="task-panel integration-panel">
          <div className="section-heading">
            <div>
              <h2>Microsoft To Do</h2>
            </div>
          </div>

          <div className="integration-actions">
            <button onClick={handleConnectMicrosoftTodo} type="button">
              连接账号
            </button>
            <button disabled={isSyncingMicrosoftTodo} onClick={handleSyncMicrosoftTodo} type="button">
              {isSyncingMicrosoftTodo ? '拉取中' : '拉取任务'}
            </button>
            <button disabled={isPushingMicrosoftTodo} onClick={handlePushMicrosoftTodo} type="button">
              {isPushingMicrosoftTodo ? '推送中' : '推送本地'}
            </button>
          </div>

          {integrationMessage && <p className="success-text">{integrationMessage}</p>}
          {integrationError && <p className="error-text">{integrationError}</p>}
        </div>

        <div className="task-panel countdown-panel">
          <div className="section-heading">
            <div>
              <h2>新增倒计时</h2>
            </div>
          </div>

          <form className="countdown-form" onSubmit={handleCreateCountdownEvent}>
            <label>
              <span>标题</span>
              <input
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="例如：考试开始"
              />
            </label>

            <label>
              <span>描述</span>
              <textarea
                rows={2}
                value={eventDescription}
                onChange={(event) => setEventDescription(event.target.value)}
                placeholder="补充地点、准备事项或备注"
              />
            </label>

            <div className="form-row">
              <label>
                <span>重要性</span>
                <select
                  value={eventPriority}
                  onChange={(event) => setEventPriority(event.target.value as TaskPriority)}
                >
                  <option value="LOW">低</option>
                  <option value="MEDIUM">中</option>
                  <option value="HIGH">高</option>
                </select>
              </label>

              <label>
                <span>发生时间</span>
                <input
                  type="datetime-local"
                  value={eventStartsAt}
                  onChange={(event) => setEventStartsAt(event.target.value)}
                />
              </label>
            </div>

            <button className="primary-button" disabled={isSavingEvent} type="submit">
              <Clock size={18} />
              <span>{isSavingEvent ? '保存中' : '新增倒计时'}</span>
            </button>
          </form>

          {eventError && <p className="error-text">{eventError}</p>}
        </div>

        <div className="task-panel task-list-panel">
          <div className="section-heading">
            <div>
              <h2>当前任务</h2>
            </div>
            <div className="heading-actions">
              <span className="counter">{openTasks.length + visibleRoutineHabits.length} 个待处理</span>
              <button
                aria-label="重新整理任务排序"
                className="heading-button"
                onClick={refreshTasks}
                type="button"
              >
                <RefreshCw size={16} />
                <span>重新排序</span>
              </button>
            </div>
          </div>

          {isLoadingTasks ? (
            <p className="muted">正在加载任务</p>
          ) : tasks.length === 0 && visibleRoutineHabits.length === 0 ? (
            <p className="muted">还没有任务，先创建一个。</p>
          ) : (
            <div className="task-list">
              {visibleRoutineHabits.map((habit) => (
                <article className={`task-item routine-task-item routine-${habit.state}`} key={`routine-${habit.id}`}>
                  <div className="task-content">
                    <div className="task-title-row">
                      <h3>{habit.title}</h3>
                      <span className="priority priority-low">低</span>
                    </div>
                    {habit.description && <p>{habit.description}</p>}
                    <div className="task-meta">
                      <span>检查事项</span>
                      <span>预期：{formatDate(habit.nextDueAt)}</span>
                      <span className={`countdown ${getCountdownState(habit.nextDueAt, now)}`}>
                        {formatCountdown(habit.nextDueAt, now)}
                      </span>
                    </div>
                  </div>
                  <div className="task-actions">
                    <button aria-label="检查事项打卡" onClick={() => handleCheckInRoutineHabitFromTaskList(habit.id)} type="button">
                      <Check size={18} />
                    </button>
                  </div>
                </article>
              ))}
              {[...openTasks, ...doneTasks].map((task) => (
                <article className={`task-item ${task.status === 'DONE' ? 'task-done' : ''}`} key={task.id}>
                  <div className="task-content">
                    {editingTaskId === task.id ? (
                      <form className="task-edit-form" onSubmit={handleSaveTaskEdit}>
                        <label>
                          <span>标题</span>
                          <input
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                          />
                        </label>

                        <label>
                          <span>描述</span>
                          <textarea
                            rows={3}
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                          />
                        </label>

                        <div className="form-row">
                          <label>
                            <span>优先级</span>
                            <select
                              value={editPriority}
                              onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                            >
                              <option value="LOW">低</option>
                              <option value="MEDIUM">中</option>
                              <option value="HIGH">高</option>
                            </select>
                          </label>

                          <label>
                            <span>截止时间</span>
                            <input
                              type="datetime-local"
                              value={editDueAt}
                              onChange={(event) => setEditDueAt(event.target.value)}
                            />
                          </label>
                        </div>

                        <div className="edit-actions">
                          <button disabled={isSavingEdit} type="submit">
                            <Save size={16} />
                            <span>{isSavingEdit ? '保存中' : '保存'}</span>
                          </button>
                          <button onClick={handleCancelEdit} type="button">
                            <X size={16} />
                            <span>取消</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="task-title-row">
                          <h3>{task.title}</h3>
                          <span className={`priority priority-${task.priority.toLowerCase()}`}>
                            {priorityLabels[task.priority]}
                          </span>
                        </div>
                        {task.description && <p>{task.description}</p>}
                        <div className="task-meta">
                          <span>{task.status === 'DONE' ? '已完成' : '待处理'}</span>
                          {task.dueAt && <span>截止：{formatDate(task.dueAt)}</span>}
                          {task.dueAt && task.status !== 'DONE' && (
                            <span className={`countdown ${getCountdownState(task.dueAt, now)}`}>
                              {formatCountdown(task.dueAt, now)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="task-actions">
                    {editingTaskId !== task.id && (
                      <button aria-label="编辑任务" onClick={() => handleStartEdit(task)} type="button">
                        <Edit3 size={18} />
                      </button>
                    )}
                    {editingTaskId !== task.id && (
                      task.status === 'DONE' ? (
                        <button aria-label="恢复任务" onClick={() => handleRestoreTask(task.id)} type="button">
                          <RotateCcw size={18} />
                        </button>
                      ) : (
                        <button aria-label="完成任务" onClick={() => handleCompleteTask(task.id)} type="button">
                          <Check size={18} />
                        </button>
                      )
                    )}
                    {editingTaskId !== task.id && (
                      <button aria-label="删除任务" onClick={() => handleDeleteTask(task.id)} type="button">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="task-panel countdown-list-panel">
          <div className="section-heading">
            <div>
              <h2>倒计时表</h2>
            </div>
            <div className="heading-actions">
              <span className="counter">{countdownEvents.length} 个未来事件</span>
              <button
                aria-label="重新整理倒计时排序"
                className="heading-button"
                onClick={refreshCountdownEvents}
                type="button"
              >
                <RefreshCw size={16} />
                <span>重新排序</span>
              </button>
            </div>
          </div>

          {isLoadingEvents ? (
            <p className="muted countdown-empty">正在加载倒计时</p>
          ) : countdownEvents.length === 0 ? (
            <p className="muted countdown-empty">还没有未来事件。</p>
          ) : (
            <div className="countdown-list">
              {countdownEvents.map((event) => (
                <article className="countdown-item" key={event.id}>
                  <div>
                    {editingEventId === event.id ? (
                      <form className="task-edit-form" onSubmit={handleSaveEventEdit}>
                        <label>
                          <span>标题</span>
                          <input
                            value={editEventTitle}
                            onChange={(item) => setEditEventTitle(item.target.value)}
                          />
                        </label>

                        <label>
                          <span>描述</span>
                          <textarea
                            rows={3}
                            value={editEventDescription}
                            onChange={(item) => setEditEventDescription(item.target.value)}
                          />
                        </label>

                        <div className="form-row">
                          <label>
                            <span>重要性</span>
                            <select
                              value={editEventPriority}
                              onChange={(item) => setEditEventPriority(item.target.value as TaskPriority)}
                            >
                              <option value="LOW">低</option>
                              <option value="MEDIUM">中</option>
                              <option value="HIGH">高</option>
                            </select>
                          </label>

                          <label>
                            <span>发生时间</span>
                            <input
                              type="datetime-local"
                              value={editEventStartsAt}
                              onChange={(item) => setEditEventStartsAt(item.target.value)}
                            />
                          </label>
                        </div>

                        <div className="edit-actions">
                          <button disabled={isSavingEventEdit} type="submit">
                            <Save size={16} />
                            <span>{isSavingEventEdit ? '保存中' : '保存'}</span>
                          </button>
                          <button onClick={handleCancelEventEdit} type="button">
                            <X size={16} />
                            <span>取消</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="task-title-row">
                          <h3>{event.title}</h3>
                          <span className={`priority priority-${event.priority.toLowerCase()}`}>
                            {priorityLabels[event.priority]}
                          </span>
                        </div>
                        {event.description && <p>{event.description}</p>}
                        <div className="task-meta">
                          <span>{formatDate(event.startsAt)}</span>
                          <span className={`countdown ${getCountdownState(event.startsAt, now)}`}>
                            {formatCountdown(event.startsAt, now)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="task-actions">
                    {editingEventId !== event.id && (
                      <button aria-label="编辑倒计时" onClick={() => handleStartEventEdit(event)} type="button">
                        <Edit3 size={18} />
                      </button>
                    )}
                    {editingEventId !== event.id && (
                      <button aria-label="删除倒计时" onClick={() => handleDeleteCountdownEvent(event.id)} type="button">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

    </>
  );
}

function calculateCurrentTaskScore(
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

function getTaskOverdueHours(task: Task, now: Date) {
  if (task.status === 'DONE' || task.status === 'ARCHIVED' || !task.dueAt) {
    return null;
  }

  return getOverdueHours(task.dueAt, now);
}

function getRoutineOverdueHours(habit: RoutineHabit, now: Date) {
  if (!habit.isActive || habit.state !== 'overdue') {
    return null;
  }

  return getOverdueHours(habit.nextDueAt, now);
}

function getOverdueHours(dateValue: string, now: Date) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime()) || date >= now) {
    return null;
  }

  return (now.getTime() - date.getTime()) / 3_600_000;
}

function getOverduePenalty(priority: TaskPriority, overdueHours: number) {
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

function RoutinePage() {
  const [habits, setHabits] = useState<RoutineHabit[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<Awaited<ReturnType<typeof listRecentRoutineCheckIns>>>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [isLoadingRoutine, setIsLoadingRoutine] = useState(true);
  const [routineMessage, setRoutineMessage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('生活');
  const [intervalValue, setIntervalValue] = useState(7);
  const [intervalUnit, setIntervalUnit] = useState<RoutineIntervalUnit>('DAYS');
  const [nextDueAt, setNextDueAt] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [addToToday, setAddToToday] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [editHabitDescription, setEditHabitDescription] = useState('');
  const [editHabitCategory, setEditHabitCategory] = useState('生活');
  const [editHabitIntervalValue, setEditHabitIntervalValue] = useState(7);
  const [editHabitIntervalUnit, setEditHabitIntervalUnit] = useState<RoutineIntervalUnit>('DAYS');
  const [editHabitNextDueAt, setEditHabitNextDueAt] = useState('');
  const [editHabitIsRolling, setEditHabitIsRolling] = useState(false);
  const [editHabitReminderEnabled, setEditHabitReminderEnabled] = useState(true);
  const [editHabitAddToToday, setEditHabitAddToToday] = useState(false);
  const [isSavingHabitEdit, setIsSavingHabitEdit] = useState(false);
  const [wentToBedAt, setWentToBedAt] = useState('');
  const [fellAsleepAt, setFellAsleepAt] = useState('');
  const [wokeUpAt, setWokeUpAt] = useState('');
  const [sleepQuality, setSleepQuality] = useState(3);
  const [sleepNote, setSleepNote] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, countdownRefreshMs);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    refreshRoutinePage();
  }, []);

  async function refreshRoutinePage() {
    setIsLoadingRoutine(true);
    setError('');

    try {
      const [loadedHabits, loadedCheckIns, loadedSleepLogs] = await Promise.all([
        listRoutineHabits(),
        listRecentRoutineCheckIns(),
        listSleepLogs(),
      ]);

      setHabits(loadedHabits);
      setRecentCheckIns(loadedCheckIns);
      setSleepLogs(loadedSleepLogs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '定时检查加载失败');
    } finally {
      setIsLoadingRoutine(false);
    }
  }

  async function handleCreateRoutineHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError('请输入检查事项标题');
      return;
    }

    if (!nextDueAt) {
      setError('请选择预期执行时间点');
      return;
    }

    setError('');
    setRoutineMessage('');

    try {
      await createRoutineHabit({
        title,
        description,
        category,
        intervalValue,
        intervalUnit,
        nextDueAt: new Date(nextDueAt).toISOString(),
        isRolling,
        reminderEnabled,
        addToToday,
      });
      setRoutineMessage('检查事项已创建。');
      setTitle('');
      setDescription('');
      setCategory('生活');
      setIntervalValue(7);
      setIntervalUnit('DAYS');
      setNextDueAt('');
      setIsRolling(false);
      setReminderEnabled(true);
      setAddToToday(false);
      await refreshRoutinePage();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '检查事项创建失败');
    }
  }

  async function handleCheckInHabit(id: string) {
    setError('');
    setRoutineMessage('');

    try {
      await checkInRoutineHabit(id);
      setRoutineMessage('已打卡，并计算了下一次到期时间。');
      await refreshRoutinePage();
    } catch (checkInError) {
      setError(checkInError instanceof Error ? checkInError.message : '打卡失败');
    }
  }

  async function handleSkipHabit(id: string) {
    setError('');
    setRoutineMessage('');

    try {
      await skipRoutineHabit(id);
      setRoutineMessage('已跳过本轮，并计算了下一次到期时间。');
      await refreshRoutinePage();
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : '跳过失败');
    }
  }

  async function handleCheckOverdueHabits() {
    setError('');
    setRoutineMessage('');

    try {
      const result = await checkOverdueRoutineHabits();

      setRoutineMessage(`已检查逾期事项，生成 ${result.created} 条提醒。`);
      await refreshRoutinePage();
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : '逾期检查失败');
    }
  }

  async function handleCreateSleepLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!wentToBedAt || !wokeUpAt) {
      setError('请选择上床时间和起床时间');
      return;
    }

    setError('');
    setRoutineMessage('');

    try {
      await createSleepLog({
        wentToBedAt: new Date(wentToBedAt).toISOString(),
        fellAsleepAt: fellAsleepAt ? new Date(fellAsleepAt).toISOString() : null,
        wokeUpAt: new Date(wokeUpAt).toISOString(),
        quality: sleepQuality,
        note: sleepNote,
      });
      setRoutineMessage('睡眠记录已保存。');
      setWentToBedAt('');
      setFellAsleepAt('');
      setWokeUpAt('');
      setSleepQuality(3);
      setSleepNote('');
      await refreshRoutinePage();
    } catch (sleepError) {
      setError(sleepError instanceof Error ? sleepError.message : '睡眠记录保存失败');
    }
  }

  function handleStartHabitEdit(habit: RoutineHabit) {
    setEditingHabitId(habit.id);
    setEditHabitTitle(habit.title);
    setEditHabitDescription(habit.description ?? '');
    setEditHabitCategory(habit.category);
    setEditHabitIntervalValue(habit.intervalValue);
    setEditHabitIntervalUnit(habit.intervalUnit);
    setEditHabitNextDueAt(toDateTimeLocalValue(habit.nextDueAt));
    setEditHabitIsRolling(habit.isRolling);
    setEditHabitReminderEnabled(habit.reminderEnabled);
    setEditHabitAddToToday(habit.addToToday);
    setError('');
  }

  function handleCancelHabitEdit() {
    setEditingHabitId(null);
    setEditHabitTitle('');
    setEditHabitDescription('');
    setEditHabitCategory('生活');
    setEditHabitIntervalValue(7);
    setEditHabitIntervalUnit('DAYS');
    setEditHabitNextDueAt('');
    setEditHabitIsRolling(false);
    setEditHabitReminderEnabled(true);
    setEditHabitAddToToday(false);
    setIsSavingHabitEdit(false);
  }

  async function handleSaveHabitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingHabitId) {
      return;
    }

    if (!editHabitTitle.trim()) {
      setError('请输入检查事项标题');
      return;
    }

    if (!editHabitNextDueAt) {
      setError('请选择预期执行时间点');
      return;
    }

    setIsSavingHabitEdit(true);
    setError('');
    setRoutineMessage('');

    try {
      await updateRoutineHabit(editingHabitId, {
        title: editHabitTitle,
        description: editHabitDescription,
        category: editHabitCategory,
        intervalValue: editHabitIntervalValue,
        intervalUnit: editHabitIntervalUnit,
        nextDueAt: new Date(editHabitNextDueAt).toISOString(),
        isRolling: editHabitIsRolling,
        reminderEnabled: editHabitReminderEnabled,
        addToToday: editHabitAddToToday,
      });
      setRoutineMessage('检查事项已更新。');
      handleCancelHabitEdit();
      await refreshRoutinePage();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '检查事项更新失败');
    } finally {
      setIsSavingHabitEdit(false);
    }
  }

  async function handleDeleteHabit(id: string) {
    setError('');
    setRoutineMessage('');

    try {
      await deleteRoutineHabit(id);
      setRoutineMessage('检查事项已删除。');
      await refreshRoutinePage();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '检查事项删除失败');
    }
  }

  const overdueCount = habits.filter((habit) => habit.state === 'overdue').length;

  return (
    <section className="routine-page">
      <div className="task-panel routine-form-panel">
        <div className="section-heading">
          <div>
            <h2>新增检查事项</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={handleCreateRoutineHabit}>
          <label>
            <span>标题</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：整理桌面"
            />
          </label>

          <label>
            <span>说明</span>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="补充触发标准或注意事项"
            />
          </label>

          <div className="form-row">
            <label>
              <span>类型</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="生活">生活</option>
                <option value="家务">家务</option>
                <option value="健康">健康</option>
                <option value="维护">维护</option>
              </select>
            </label>

            <label>
              <span>间隔</span>
              <input
                min={1}
                type="number"
                value={intervalValue}
                onChange={(event) => setIntervalValue(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span>单位</span>
              <select value={intervalUnit} onChange={(event) => setIntervalUnit(event.target.value as RoutineIntervalUnit)}>
                <option value="HOURS">小时</option>
                <option value="DAYS">天</option>
                <option value="WEEKS">周</option>
                <option value="MONTHS">月</option>
              </select>
            </label>

            <label>
              <span>预期时间</span>
              <input
                type="datetime-local"
                value={nextDueAt}
                onChange={(event) => setNextDueAt(event.target.value)}
              />
            </label>
          </div>

          <div className="routine-options">
            <label>
              <input
                checked={isRolling}
                onChange={(event) => setIsRolling(event.target.checked)}
                type="checkbox"
              />
              <span>按打卡时间滚动计算</span>
            </label>
            <label>
              <input
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>逾期后生成提醒</span>
            </label>
            <label>
              <input
                checked={addToToday}
                onChange={(event) => setAddToToday(event.target.checked)}
                type="checkbox"
              />
              <span>后续加入今日面板</span>
            </label>
          </div>

          <button className="primary-button" type="submit">
            <Plus size={18} />
            <span>新增检查事项</span>
          </button>
        </form>
      </div>

      <div className="task-panel routine-list-panel">
        <div className="section-heading">
          <div>
            <h2>检查事项</h2>
          </div>
          <div className="heading-actions">
            <span className="counter">{overdueCount} 个逾期</span>
            <button className="heading-button" onClick={handleCheckOverdueHabits} type="button">
              <RefreshCw size={16} />
              <span>生成提醒</span>
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {routineMessage && <p className="success-text">{routineMessage}</p>}

        {isLoadingRoutine ? (
          <p className="muted">正在加载检查事项</p>
        ) : habits.length === 0 ? (
          <p className="muted">还没有检查事项，先创建一个。</p>
        ) : (
        <div className="routine-timeline">
          {habits.map((habit) => (
            <article className={`routine-block routine-${habit.state}`} key={habit.id}>
              <div className="routine-time">
                <strong>{formatDate(habit.nextDueAt)}</strong>
                <span>{getRoutineStateLabel(habit)}</span>
              </div>
              <div>
                <div className="task-title-row">
                  <h3>{habit.title}</h3>
                  <span className="priority priority-medium">{habit.category}</span>
                </div>
                {habit.description && <p>{habit.description}</p>}
                <div className="task-meta">
                  {editingHabitId === habit.id ? (
                    <form className="task-edit-form routine-edit-form" onSubmit={handleSaveHabitEdit}>
                      <label>
                        <span>标题</span>
                        <input value={editHabitTitle} onChange={(event) => setEditHabitTitle(event.target.value)} />
                      </label>
                      <label>
                        <span>说明</span>
                        <textarea rows={2} value={editHabitDescription} onChange={(event) => setEditHabitDescription(event.target.value)} />
                      </label>
                      <div className="form-row">
                        <label>
                          <span>类型</span>
                          <select value={editHabitCategory} onChange={(event) => setEditHabitCategory(event.target.value)}>
                            <option value="生活">生活</option>
                            <option value="家务">家务</option>
                            <option value="健康">健康</option>
                            <option value="维护">维护</option>
                          </select>
                        </label>
                        <label>
                          <span>间隔</span>
                          <input min={1} type="number" value={editHabitIntervalValue} onChange={(event) => setEditHabitIntervalValue(Number(event.target.value))} />
                        </label>
                      </div>
                      <div className="form-row">
                        <label>
                          <span>单位</span>
                          <select value={editHabitIntervalUnit} onChange={(event) => setEditHabitIntervalUnit(event.target.value as RoutineIntervalUnit)}>
                            <option value="HOURS">小时</option>
                            <option value="DAYS">天</option>
                            <option value="WEEKS">周</option>
                            <option value="MONTHS">月</option>
                          </select>
                        </label>
                        <label>
                          <span>预期时间</span>
                          <input type="datetime-local" value={editHabitNextDueAt} onChange={(event) => setEditHabitNextDueAt(event.target.value)} />
                        </label>
                      </div>
                      <div className="routine-options">
                        <label>
                          <input checked={editHabitIsRolling} onChange={(event) => setEditHabitIsRolling(event.target.checked)} type="checkbox" />
                          <span>按打卡时间滚动计算</span>
                        </label>
                        <label>
                          <input checked={editHabitReminderEnabled} onChange={(event) => setEditHabitReminderEnabled(event.target.checked)} type="checkbox" />
                          <span>逾期后生成提醒</span>
                        </label>
                        <label>
                          <input checked={editHabitAddToToday} onChange={(event) => setEditHabitAddToToday(event.target.checked)} type="checkbox" />
                          <span>后续加入今日面板</span>
                        </label>
                      </div>
                      <div className="edit-actions">
                        <button disabled={isSavingHabitEdit} type="submit">
                          <Save size={16} />
                          <span>{isSavingHabitEdit ? '保存中' : '保存'}</span>
                        </button>
                        <button onClick={handleCancelHabitEdit} type="button">
                          <X size={16} />
                          <span>取消</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span>每 {habit.intervalValue} {routineUnitLabels[habit.intervalUnit]}</span>
                      <span>{habit.isRolling ? '滚动计算' : '固定时间'}</span>
                      <span className={`countdown ${getCountdownState(habit.nextDueAt, now)}`}>
                        {formatCountdown(habit.nextDueAt, now)}
                      </span>
                      {habit.lastCheckIn && <span>上次：{formatDate(habit.lastCheckIn.performedAt)}</span>}
                    </>
                  )}
                </div>
              </div>
              {editingHabitId !== habit.id && (
                <div className="task-actions">
                  <button aria-label="打卡" onClick={() => handleCheckInHabit(habit.id)} type="button">
                    <Check size={18} />
                  </button>
                  <button aria-label="跳过本轮" onClick={() => handleSkipHabit(habit.id)} type="button">
                    <RotateCcw size={18} />
                  </button>
                  <button aria-label="编辑检查事项" onClick={() => handleStartHabitEdit(habit)} type="button">
                    <Edit3 size={18} />
                  </button>
                  <button aria-label="删除检查事项" onClick={() => handleDeleteHabit(habit.id)} type="button">
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        )}
      </div>

      <div className="task-panel routine-history-panel">
        <div className="section-heading">
          <div>
            <h2>最近打卡</h2>
          </div>
        </div>
        {recentCheckIns.length === 0 ? (
          <p className="muted">还没有打卡记录。</p>
        ) : (
          <div className="routine-compact-list routine-recent-list">
            {recentCheckIns.slice(0, 10).map((item) => (
              <div className="routine-compact-item" key={item.id}>
                <strong>{item.habit?.title ?? '检查事项'}</strong>
                <span>{checkInStatusLabels[item.status]} · {formatDate(item.performedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="task-panel sleep-panel">
        <div className="section-heading">
          <div>
            <h2>睡眠记录</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={handleCreateSleepLog}>
          <div className="form-row">
            <label>
              <span>上床</span>
              <input type="datetime-local" value={wentToBedAt} onChange={(event) => setWentToBedAt(event.target.value)} />
            </label>
            <label>
              <span>入睡</span>
              <input type="datetime-local" value={fellAsleepAt} onChange={(event) => setFellAsleepAt(event.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>起床</span>
              <input type="datetime-local" value={wokeUpAt} onChange={(event) => setWokeUpAt(event.target.value)} />
            </label>
            <label>
              <span>质量</span>
              <select value={sleepQuality} onChange={(event) => setSleepQuality(Number(event.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </label>
          </div>
          <label>
            <span>备注</span>
            <textarea rows={2} value={sleepNote} onChange={(event) => setSleepNote(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            <Save size={18} />
            <span>保存睡眠</span>
          </button>
        </form>

        <div className="routine-compact-list sleep-log-list">
          {sleepLogs.slice(0, 5).map((log) => (
            <div className="routine-compact-item" key={log.id}>
              <strong>{formatSleepDuration(log)}</strong>
              <span>{formatDate(log.wentToBedAt)} - {formatDate(log.wokeUpAt)} · 质量 {log.quality ?? '-'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ElectricityPage() {
  const [summary, setSummary] = useState<ElectricitySummary | null>(null);
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [recordedAt, setRecordedAt] = useState(() => toDateTimeLocalValue(new Date().toISOString()));
  const [remainingKwh, setRemainingKwh] = useState('');
  const [didRecharge, setDidRecharge] = useState(false);
  const [rechargeAmountYuan, setRechargeAmountYuan] = useState('');
  const [note, setNote] = useState('');
  const [editingReadingId, setEditingReadingId] = useState<string | null>(null);
  const [editRecordedAt, setEditRecordedAt] = useState('');
  const [editRemainingKwh, setEditRemainingKwh] = useState('');
  const [editDidRecharge, setEditDidRecharge] = useState(false);
  const [editRechargeAmountYuan, setEditRechargeAmountYuan] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    refreshElectricityPage();
  }, []);

  async function refreshElectricityPage() {
    setIsLoading(true);
    setError('');

    try {
      const [loadedSummary, loadedReadings] = await Promise.all([
        getElectricitySummary(),
        listElectricityReadings(),
      ]);

      setSummary(loadedSummary);
      setReadings(loadedReadings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '电费记录加载失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateReading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!recordedAt) {
      setError('请选择记录时间');
      return;
    }

    if (!remainingKwh) {
      setError('请输入当前剩余电量');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      await createElectricityReading({
        recordedAt: new Date(recordedAt).toISOString(),
        remainingKwh: Number(remainingKwh),
        didRecharge,
        rechargeAmountYuan: didRecharge && rechargeAmountYuan ? Number(rechargeAmountYuan) : null,
        rechargeKwh: didRecharge && rechargeAmountYuan ? convertYuanToKwh(Number(rechargeAmountYuan)) : null,
        note,
      });
      setMessage('电费读数已保存。');
      setRecordedAt(toDateTimeLocalValue(new Date().toISOString()));
      setRemainingKwh('');
      setDidRecharge(false);
      setRechargeAmountYuan('');
      setNote('');
      await refreshElectricityPage();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '电费读数保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartReadingEdit(reading: ElectricityReading) {
    setEditingReadingId(reading.id);
    setEditRecordedAt(toDateTimeLocalValue(reading.recordedAt));
    setEditRemainingKwh(String(reading.remainingKwh));
    setEditDidRecharge(reading.didRecharge);
    setEditRechargeAmountYuan(
      reading.rechargeAmountYuan === null
        ? reading.rechargeKwh === null
          ? ''
          : String(convertKwhToYuan(reading.rechargeKwh))
        : String(reading.rechargeAmountYuan),
    );
    setEditNote(reading.note ?? '');
    setMessage('');
    setError('');
  }

  function handleCancelReadingEdit() {
    setEditingReadingId(null);
    setEditRecordedAt('');
    setEditRemainingKwh('');
    setEditDidRecharge(false);
    setEditRechargeAmountYuan('');
    setEditNote('');
    setIsSavingEdit(false);
  }

  async function handleSaveReadingEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingReadingId) {
      return;
    }

    if (!editRecordedAt || !editRemainingKwh) {
      setError('请填写记录时间和剩余电量');
      return;
    }

    setIsSavingEdit(true);
    setMessage('');
    setError('');

    try {
      await updateElectricityReading(editingReadingId, {
        recordedAt: new Date(editRecordedAt).toISOString(),
        remainingKwh: Number(editRemainingKwh),
        didRecharge: editDidRecharge,
        rechargeAmountYuan: editDidRecharge && editRechargeAmountYuan ? Number(editRechargeAmountYuan) : null,
        rechargeKwh: editDidRecharge && editRechargeAmountYuan
          ? convertYuanToKwh(Number(editRechargeAmountYuan))
          : null,
        note: editNote,
      });
      setMessage('电费读数已更新。');
      handleCancelReadingEdit();
      await refreshElectricityPage();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '电费读数更新失败');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteReading(id: string) {
    setMessage('');
    setError('');

    try {
      await deleteElectricityReading(id);
      setMessage('电费读数已删除。');
      await refreshElectricityPage();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '电费读数删除失败');
    }
  }

  return (
    <section className="electricity-page">
      <div className="task-panel electricity-summary-panel">
        <div className="section-heading">
          <div>
            <h2>电费概览</h2>
          </div>
          <span className={`electricity-status electricity-status-${summary?.status ?? 'NO_DATA'}`}>
            {getElectricityStatusLabel(summary?.status ?? 'NO_DATA')}
          </span>
        </div>

        {isLoading ? (
          <p className="muted">正在加载电费记录</p>
        ) : (
          <div className="electricity-metrics">
            <div className="electricity-metric electricity-metric-primary">
              <span>当前剩余</span>
              <strong>{summary?.latest ? formatKwh(summary.latest.remainingKwh) : '--'}</strong>
              <small>{summary?.latest ? `记录于 ${formatDate(summary.latest.recordedAt)}` : '还没有读数'}</small>
            </div>
            <div className="electricity-metric">
              <span>估算日耗电</span>
              <strong>{summary ? formatKwh(summary.dailyUsageKwh) : '--'}</strong>
              <small>{summary ? `电价 ${summary.electricityPriceYuanPerKwh} 元/度` : '需要至少两次读数'}</small>
            </div>
            <div className="electricity-metric">
              <span>低于 15 度</span>
              <strong>{formatThresholdEstimate(summary)}</strong>
              <small>{summary?.estimatedThresholdAt ? formatDate(summary.estimatedThresholdAt) : '数据不足时不预测'}</small>
            </div>
          </div>
        )}

        {summary?.status === 'LOW' ? (
          <p className="electricity-alert">当前剩余电量低于 {summary.alertThresholdKwh} 度，建议尽快充值。</p>
        ) : null}
        {summary?.status === 'WARNING' ? (
          <p className="electricity-warning">按近期耗电速度，预计 3 天内会低于 {summary.alertThresholdKwh} 度。</p>
        ) : null}
      </div>

      <div className="task-panel electricity-form-panel">
        <div className="section-heading">
          <div>
            <h2>录入读数</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={handleCreateReading}>
          <label>
            <span>记录时间</span>
            <input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} />
          </label>

          <label>
            <span>当前剩余电量</span>
            <input
              min={0}
              step="0.01"
              type="number"
              value={remainingKwh}
              onChange={(event) => setRemainingKwh(event.target.value)}
              placeholder="例如：23.5"
            />
          </label>

          <div className="routine-options">
            <label>
              <input checked={didRecharge} onChange={(event) => setDidRecharge(event.target.checked)} type="checkbox" />
              <span>这次读数前发生过充值</span>
            </label>
          </div>

          {didRecharge ? (
            <>
            <label>
              <span>充值金额</span>
              <input
                min={0}
                step="0.01"
                type="number"
                value={rechargeAmountYuan}
                onChange={(event) => setRechargeAmountYuan(event.target.value)}
                placeholder="例如：20"
              />
            </label>
            <p className="muted electricity-conversion">
              {rechargeAmountYuan
                ? `按 0.63 元/度折合 ${formatKwh(convertYuanToKwh(Number(rechargeAmountYuan)))}`
                : '填写充值金额后自动折算电量。'}
            </p>
            </>
          ) : null}

          <label>
            <span>备注</span>
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          <button className="primary-button" disabled={isSaving} type="submit">
            <Save size={18} />
            <span>{isSaving ? '保存中' : '保存读数'}</span>
          </button>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="task-panel electricity-history-panel">
        <div className="section-heading">
          <div>
            <h2>读数记录</h2>
          </div>
          <button className="heading-button" onClick={refreshElectricityPage} type="button">
            <RefreshCw size={16} />
            <span>刷新</span>
          </button>
        </div>

        {readings.length === 0 ? (
          <p className="muted">还没有电费读数。</p>
        ) : (
          <div className="electricity-reading-list">
            {readings.map((reading) => (
              <article className="electricity-reading-item" key={reading.id}>
                {editingReadingId === reading.id ? (
                  <form className="task-edit-form" onSubmit={handleSaveReadingEdit}>
                    <div className="form-row">
                      <label>
                        <span>时间</span>
                        <input type="datetime-local" value={editRecordedAt} onChange={(event) => setEditRecordedAt(event.target.value)} />
                      </label>
                      <label>
                        <span>剩余</span>
                        <input min={0} step="0.01" type="number" value={editRemainingKwh} onChange={(event) => setEditRemainingKwh(event.target.value)} />
                      </label>
                    </div>
                    <div className="routine-options">
                      <label>
                        <input checked={editDidRecharge} onChange={(event) => setEditDidRecharge(event.target.checked)} type="checkbox" />
                        <span>发生过充值</span>
                      </label>
                    </div>
                    {editDidRecharge ? (
                      <>
                        <label>
                          <span>充值金额</span>
                          <input min={0} step="0.01" type="number" value={editRechargeAmountYuan} onChange={(event) => setEditRechargeAmountYuan(event.target.value)} />
                        </label>
                        <p className="muted electricity-conversion">
                          {editRechargeAmountYuan
                            ? `按 0.63 元/度折合 ${formatKwh(convertYuanToKwh(Number(editRechargeAmountYuan)))}`
                            : '填写充值金额后自动折算电量。'}
                        </p>
                      </>
                    ) : null}
                    <label>
                      <span>备注</span>
                      <textarea rows={2} value={editNote} onChange={(event) => setEditNote(event.target.value)} />
                    </label>
                    <div className="edit-actions">
                      <button disabled={isSavingEdit} type="submit">
                        <Save size={16} />
                        <span>{isSavingEdit ? '保存中' : '保存'}</span>
                      </button>
                      <button onClick={handleCancelReadingEdit} type="button">
                        <X size={16} />
                        <span>取消</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="electricity-reading-main">
                      <div>
                        <h3>{formatKwh(reading.remainingKwh)}</h3>
                        <p>{formatDate(reading.recordedAt)}</p>
                      </div>
                      <div className="task-meta">
                        {reading.didRecharge ? (
                          <span>{formatRechargeReading(reading)}</span>
                        ) : (
                          <span>未充值</span>
                        )}
                        {reading.note ? <span>{reading.note}</span> : null}
                      </div>
                    </div>
                    <div className="task-actions">
                      <button aria-label="编辑电费读数" onClick={() => handleStartReadingEdit(reading)} type="button">
                        <Edit3 size={18} />
                      </button>
                      <button aria-label="删除电费读数" onClick={() => handleDeleteReading(reading.id)} type="button">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="placeholder-page task-panel">
      <h2>{title}</h2>
      <p className="muted">这个页面已接入左侧目录，后续会在这里实现独立功能。</p>
    </section>
  );
}

const routineUnitLabels: Record<RoutineIntervalUnit, string> = {
  HOURS: '小时',
  DAYS: '天',
  WEEKS: '周',
  MONTHS: '月',
};

const checkInStatusLabels = {
  COMPLETED: '已打卡',
  SKIPPED: '已跳过',
  MISSED: '已错过',
  RESCHEDULED: '已重排',
};

function getRoutineStateLabel(habit: RoutineHabit) {
  if (!habit.isActive || habit.state === 'inactive') {
    return '已停用';
  }

  if (habit.state === 'overdue') {
    return '已逾期';
  }

  if (habit.state === 'due-soon') {
    return '即将到期';
  }

  return '正常';
}

function isTaskVisibleInTodayBoard(task: Task, now: Date) {
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

function getTodayTaskSortValue(task: Task, now: Date) {
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

function getTodayRoutineSortValue(habit: RoutineHabit, now: Date) {
  const diffMs = new Date(habit.nextDueAt).getTime() - now.getTime();

  if (habit.state === 'overdue') {
    return -240_000 + diffMs / 3_600_000;
  }

  return diffMs / 60_000 + 5_000;
}

function getTodayTaskLabel(task: Task, now: Date) {
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

function getTodayTimelineStatus(value: string, now: Date) {
  const diffMs = new Date(value).getTime() - now.getTime();

  if (diffMs < 0) {
    return '已过';
  }

  if (diffMs <= 60 * 60 * 1000) {
    return '即将开始';
  }

  return '待开始';
}

function isSameDay(value: string, baseDate: Date) {
  const date = new Date(value);

  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth() &&
    date.getDate() === baseDate.getDate()
  );
}

function getTomorrowStart(baseDate: Date) {
  const start = new Date(baseDate);

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);

  return start;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatSleepDuration(log: SleepLog) {
  const diffMs = new Date(log.wokeUpAt).getTime() - new Date(log.wentToBedAt).getTime();
  const totalMinutes = Math.max(0, Math.round(diffMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} 小时 ${minutes} 分钟`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatKwh(value: number) {
  return `${Number(value.toFixed(2))} 度`;
}

function convertYuanToKwh(value: number) {
  return Math.round((value / 0.63) * 100) / 100;
}

function convertKwhToYuan(value: number) {
  return Math.round(value * 0.63 * 100) / 100;
}

function formatRechargeReading(reading: ElectricityReading) {
  if (reading.rechargeAmountYuan !== null && reading.rechargeKwh !== null) {
    return `充值：${Number(reading.rechargeAmountYuan.toFixed(2))} 元，折合 ${formatKwh(reading.rechargeKwh)}`;
  }

  if (reading.rechargeKwh !== null) {
    return `充值：${formatKwh(reading.rechargeKwh)}`;
  }

  return '充值：未填金额';
}

function formatThresholdEstimate(summary: ElectricitySummary | null) {
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

function getElectricityStatusLabel(status: ElectricitySummary['status']) {
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

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function sortCountdownEvents(events: CountdownEvent[]) {
  return [...events].sort((left, right) => {
    const timeDiff = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();

    if (Math.abs(timeDiff) > 24 * 60 * 60 * 1000) {
      return timeDiff;
    }

    return getPriorityWeight(right.priority) - getPriorityWeight(left.priority) || timeDiff;
  });
}

function getPriorityWeight(priority: TaskPriority) {
  if (priority === 'HIGH') {
    return 3;
  }

  if (priority === 'MEDIUM') {
    return 2;
  }

  return 1;
}

function formatCountdown(value: string, now: Date) {
  const dueAt = new Date(value);
  const diffMs = dueAt.getTime() - now.getTime();
  const halfHours = Math.round(Math.abs(diffMs) / countdownRefreshMs);

  if (halfHours === 0) {
    return diffMs >= 0 ? '30 分钟内到期' : '刚刚逾期';
  }

  const duration = formatHalfHours(halfHours);

  return diffMs >= 0 ? `剩 ${duration}` : `已逾期 ${duration}`;
}

function formatHalfHours(halfHours: number) {
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

function formatHours(hours: number) {
  if (hours === 0.5) {
    return '30 分钟';
  }

  return Number.isInteger(hours) ? `${hours} 小时` : `${hours} 小时`;
}

function getCountdownState(value: string, now: Date) {
  const diffMs = new Date(value).getTime() - now.getTime();

  if (diffMs < 0) {
    return 'countdown-overdue';
  }

  if (diffMs <= 24 * 60 * 60 * 1000) {
    return 'countdown-soon';
  }

  return 'countdown-normal';
}
