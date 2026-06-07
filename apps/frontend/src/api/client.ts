const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const authTokenStorageKey = 'lanmo2606_access_token';

let authToken = typeof window === 'undefined' ? '' : window.localStorage.getItem(authTokenStorageKey) ?? '';
let unauthorizedHandler: (() => void) | null = null;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export function getStoredAuthToken() {
  return authToken;
}

export function setAuthToken(token: string) {
  authToken = token;

  if (token) {
    window.localStorage.setItem(authTokenStorageKey, token);
    return;
  }

  window.localStorage.removeItem(authTokenStorageKey);
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json() as Promise<{
    status: string;
    service: string;
  }>;
}

export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CountdownEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  priority: TaskPriority;
  source: 'MANUAL' | 'AI_APPLIED' | 'IMPORTED';
  createdAt: string;
  updatedAt: string;
};

export type RoutineIntervalUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
export type RoutineCheckInStatus = 'COMPLETED' | 'SKIPPED' | 'MISSED' | 'RESCHEDULED';
export type RoutineHabitState = 'inactive' | 'overdue' | 'due-soon' | 'ok';

export type RoutineCheckIn = {
  id: string;
  userId: string;
  habitId: string;
  performedAt: string;
  dueAt: string | null;
  status: RoutineCheckInStatus;
  note: string | null;
  createdAt: string;
  habit?: {
    id: string;
    title: string;
    category: string;
  };
};

export type RoutineHabit = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  intervalValue: number;
  intervalUnit: RoutineIntervalUnit;
  nextDueAt: string;
  isRolling: boolean;
  reminderEnabled: boolean;
  addToToday: boolean;
  isActive: boolean;
  lastRemindedAt: string | null;
  createdAt: string;
  updatedAt: string;
  state: RoutineHabitState;
  lastCheckIn: RoutineCheckIn | null;
};

export type CreateRoutineHabitInput = {
  title: string;
  description?: string;
  category?: string;
  intervalValue: number;
  intervalUnit: RoutineIntervalUnit;
  nextDueAt: string;
  isRolling?: boolean;
  reminderEnabled?: boolean;
  addToToday?: boolean;
};

export type UpdateRoutineHabitInput = Partial<CreateRoutineHabitInput> & {
  isActive?: boolean;
};

export type RoutineHabitActionInput = {
  performedAt?: string;
  note?: string;
};

export type SleepLog = {
  id: string;
  wentToBedAt: string;
  fellAsleepAt: string | null;
  wokeUpAt: string;
  quality: number | null;
  note: string | null;
  source: 'MANUAL' | 'IMPORTED';
  createdAt: string;
  updatedAt: string;
};

export type CreateSleepLogInput = {
  wentToBedAt: string;
  fellAsleepAt?: string | null;
  wokeUpAt: string;
  quality?: number | null;
  note?: string;
};

export type ElectricityReading = {
  id: string;
  recordedAt: string;
  remainingKwh: number;
  didRecharge: boolean;
  rechargeKwh: number | null;
  rechargeAmountYuan: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ElectricitySummary = {
  latest: ElectricityReading | null;
  alertThresholdKwh: number;
  electricityPriceYuanPerKwh: number;
  dailyUsageKwh: number;
  validSegmentCount: number;
  ignoredSegmentCount: number;
  daysUntilThreshold: number | null;
  estimatedThresholdAt: string | null;
  status: 'NO_DATA' | 'OK' | 'WARNING' | 'LOW';
};

export type CreateElectricityReadingInput = {
  recordedAt: string;
  remainingKwh: number;
  didRecharge?: boolean;
  rechargeKwh?: number | null;
  rechargeAmountYuan?: number | null;
  note?: string;
};

export type UpdateElectricityReadingInput = Partial<CreateElectricityReadingInput>;

export type CreateTaskInput = {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueAt?: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type CreateCountdownEventInput = {
  title: string;
  description?: string;
  startsAt: string;
  priority: TaskPriority;
};

export type UpdateCountdownEventInput = Partial<CreateCountdownEventInput>;

async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      setAuthToken('');
      unauthorizedHandler?.();
      throw new Error('登录已失效，请重新登录');
    }

    const errorText = await response.text().catch(() => '');
    const errorBody = errorText
      ? safeParseJson<{ message?: string | string[] }>(errorText)
      : null;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join('；')
      : errorBody?.message;

    if (message) {
      throw new Error(message);
    }

    throw new Error(`API 请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function register(input: { email: string; password: string; displayName?: string }) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getMe() {
  return request<{ user: AuthUser }>('/auth/me');
}

export function updateMe(input: { email?: string; password?: string; displayName?: string }) {
  return request<AuthResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function logout() {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export function listTasks() {
  return request<Task[]>('/tasks');
}

export function createTask(input: CreateTaskInput) {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: UpdateTaskInput) {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function completeTask(id: string) {
  return request<Task>(`/tasks/${id}/complete`, {
    method: 'PATCH',
  });
}

export function restoreTask(id: string) {
  return request<Task>(`/tasks/${id}/restore`, {
    method: 'PATCH',
  });
}

export function deleteTask(id: string) {
  return request<Task>(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

export function listCountdownEvents() {
  return request<CountdownEvent[]>('/calendar-events');
}

export function createCountdownEvent(input: CreateCountdownEventInput) {
  return request<CountdownEvent>('/calendar-events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCountdownEvent(id: string, input: UpdateCountdownEventInput) {
  return request<CountdownEvent>(`/calendar-events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCountdownEvent(id: string) {
  return request<CountdownEvent>(`/calendar-events/${id}`, {
    method: 'DELETE',
  });
}

export type MicrosoftTodoSyncResult = {
  provider: 'MICROSOFT_TODO';
  lists: number;
  created: number;
  updated: number;
  total: number;
};

export type MicrosoftTodoPushResult = {
  provider: 'MICROSOFT_TODO';
  list: string;
  created: number;
  skipped: number;
  total: number;
};

export async function getMicrosoftTodoAuthUrl() {
  return request<{ url: string }>('/integrations/microsoft-todo/auth-url');
}

export function syncMicrosoftTodo() {
  return request<MicrosoftTodoSyncResult>('/integrations/microsoft-todo/sync', {
    method: 'POST',
  });
}

export function pushMicrosoftTodo() {
  return request<MicrosoftTodoPushResult>('/integrations/microsoft-todo/push', {
    method: 'POST',
  });
}

export function listRoutineHabits() {
  return request<RoutineHabit[]>('/routine-habits');
}

export function createRoutineHabit(input: CreateRoutineHabitInput) {
  return request<RoutineHabit>('/routine-habits', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRoutineHabit(id: string, input: UpdateRoutineHabitInput) {
  return request<RoutineHabit>(`/routine-habits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteRoutineHabit(id: string) {
  return request<RoutineHabit>(`/routine-habits/${id}`, {
    method: 'DELETE',
  });
}

export function checkInRoutineHabit(id: string, input: RoutineHabitActionInput = {}) {
  return request<{ habit: RoutineHabit; checkIn: RoutineCheckIn }>(`/routine-habits/${id}/check-ins`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function skipRoutineHabit(id: string, input: RoutineHabitActionInput = {}) {
  return request<{ habit: RoutineHabit; checkIn: RoutineCheckIn }>(`/routine-habits/${id}/skip`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function checkOverdueRoutineHabits() {
  return request<{ created: number; habits: RoutineHabit[] }>('/routine-habits/check-overdue', {
    method: 'POST',
  });
}

export function listRecentRoutineCheckIns() {
  return request<RoutineCheckIn[]>('/routine-check-ins/recent');
}

export function listSleepLogs() {
  return request<SleepLog[]>('/sleep-logs');
}

export function createSleepLog(input: CreateSleepLogInput) {
  return request<SleepLog>('/sleep-logs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getElectricitySummary() {
  return request<ElectricitySummary>('/electricity/summary');
}

export function listElectricityReadings() {
  return request<ElectricityReading[]>('/electricity/readings');
}

export function createElectricityReading(input: CreateElectricityReadingInput) {
  return request<ElectricityReading>('/electricity/readings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateElectricityReading(id: string, input: UpdateElectricityReadingInput) {
  return request<ElectricityReading>(`/electricity/readings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteElectricityReading(id: string) {
  return request<ElectricityReading>(`/electricity/readings/${id}`, {
    method: 'DELETE',
  });
}
