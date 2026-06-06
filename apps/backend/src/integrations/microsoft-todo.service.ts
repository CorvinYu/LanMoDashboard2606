import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, Prisma, Priority, TaskStatus } from '@prisma/client';
import { DefaultUserService } from '../default-user.service';
import { PrismaService } from '../prisma.service';

type OAuthCallbackInput = {
  code?: string;
  state?: string;
  error?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type GraphCollection<T> = {
  value: T[];
  '@odata.nextLink'?: string;
};

type MicrosoftTodoList = {
  id: string;
  displayName: string;
};

type MicrosoftDateTimeTimeZone = {
  dateTime: string;
  timeZone: string;
};

type MicrosoftTodoTask = {
  id: string;
  title: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  status?: 'notStarted' | 'inProgress' | 'completed' | string;
  importance?: 'low' | 'normal' | 'high' | string;
  dueDateTime?: MicrosoftDateTimeTimeZone;
  completedDateTime?: MicrosoftDateTimeTimeZone;
  '@odata.etag'?: string;
};

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const provider = IntegrationProvider.MICROSOFT_TODO;
const graphBaseUrl = 'https://graph.microsoft.com/v1.0';
const authState = 'microsoft-todo-local-mvp';
const defaultListName = 'LanMo2606';
const defaultMicrosoftTodoTimeZone = 'Asia/Shanghai';
const windowsTimeZoneMap: Record<string, string> = {
  'China Standard Time': 'Asia/Shanghai',
  'Coordinated Universal Time': 'UTC',
  UTC: 'UTC',
};

@Injectable()
export class MicrosoftTodoService {
  constructor(
    private readonly config: ConfigService,
    private readonly defaultUser: DefaultUserService,
    private readonly prisma: PrismaService,
  ) {}

  getAuthUrl() {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri();
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID', 'common');
    const scopes = this.getScopes();
    const url = new URL(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    );

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', authState);

    return { url: url.toString() };
  }

  async handleCallback(input: OAuthCallbackInput) {
    const frontendUrl = this.getFrontendUrl();

    if (input.error) {
      return `${frontendUrl}?microsoftTodo=error`;
    }

    if (!input.code || input.state !== authState) {
      return `${frontendUrl}?microsoftTodo=invalid`;
    }

    const userId = await this.defaultUser.getUserId();
    const token = await this.exchangeCode(input.code);

    await this.prisma.integrationAccount.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: this.getExpiresAt(token.expires_in),
        scope: token.scope,
      },
      create: {
        userId,
        provider,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: this.getExpiresAt(token.expires_in),
        scope: token.scope,
      },
    });

    return `${frontendUrl}?microsoftTodo=connected`;
  }

  async sync(userId: string) {
    const accessToken = await this.getAccessToken(userId);
    const lists = await this.getAllPages<MicrosoftTodoList>(
      `${graphBaseUrl}/me/todo/lists`,
      accessToken,
    );

    let created = 0;
    let updated = 0;

    for (const list of lists) {
      const tasks = await this.getAllPages<MicrosoftTodoTask>(
        `${graphBaseUrl}/me/todo/lists/${list.id}/tasks`,
        accessToken,
      );

      for (const task of tasks) {
        const result = await this.upsertTask(userId, list.id, task);

        if (result === 'created') {
          created += 1;
        } else {
          updated += 1;
        }
      }
    }

    return {
      provider,
      lists: lists.length,
      created,
      updated,
      total: created + updated,
    };
  }

  async pushLocalTasks(userId: string) {
    await this.ensureWritePermission(userId);

    const accessToken = await this.getAccessToken(userId);
    const list = await this.getOrCreateList(accessToken);
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { not: 'ARCHIVED' },
        integrations: {
          none: {
            provider,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    let created = 0;

    for (const task of tasks) {
      const microsoftTask = await this.createMicrosoftTask(
        list.id,
        this.mapLocalTaskToMicrosoft(task),
        accessToken,
      );

      await this.prisma.taskIntegration.create({
        data: {
          userId,
          taskId: task.id,
          provider,
          externalTaskId: microsoftTask.id,
          externalListId: list.id,
          externalEtag: microsoftTask['@odata.etag'],
          rawJson: microsoftTask as unknown as Prisma.InputJsonValue,
        },
      });
      created += 1;
    }

    return {
      provider,
      list: list.displayName,
      created,
      skipped: 0,
      total: created,
    };
  }

  async completeLinkedTask(userId: string, taskId: string) {
    const integration = await this.prisma.taskIntegration.findFirst({
      where: {
        userId,
        taskId,
        provider,
      },
    });

    if (!integration) {
      return;
    }

    await this.ensureWritePermission(userId);

    const accessToken = await this.getAccessToken(userId);
    const microsoftTask = await this.patchMicrosoftTask(
      integration.externalListId,
      integration.externalTaskId,
      {
        status: 'completed',
      },
      accessToken,
    );

    await this.prisma.taskIntegration.update({
      where: { id: integration.id },
      data: {
        externalEtag: microsoftTask['@odata.etag'],
        rawJson: microsoftTask as unknown as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
  }

  async restoreLinkedTask(userId: string, taskId: string) {
    const integration = await this.prisma.taskIntegration.findFirst({
      where: {
        userId,
        taskId,
        provider,
      },
    });

    if (!integration) {
      return;
    }

    await this.ensureWritePermission(userId);

    const accessToken = await this.getAccessToken(userId);
    const microsoftTask = await this.patchMicrosoftTask(
      integration.externalListId,
      integration.externalTaskId,
      {
        status: 'notStarted',
      },
      accessToken,
    );

    await this.prisma.taskIntegration.update({
      where: { id: integration.id },
      data: {
        externalEtag: microsoftTask['@odata.etag'],
        rawJson: microsoftTask as unknown as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
  }

  private async upsertTask(
    userId: string,
    externalListId: string,
    task: MicrosoftTodoTask,
  ) {
    const existing = await this.prisma.taskIntegration.findUnique({
      where: {
        provider_externalTaskId: {
          provider,
          externalTaskId: task.id,
        },
      },
      select: {
        taskId: true,
      },
    });
    const taskData = this.mapTask(task);

    if (existing) {
      await this.prisma.task.update({
        where: {
          id: existing.taskId,
          userId,
        },
        data: taskData,
      });
      await this.prisma.taskIntegration.update({
        where: {
          provider_externalTaskId: {
            provider,
            externalTaskId: task.id,
          },
        },
        data: {
          externalListId,
          externalEtag: task['@odata.etag'],
          rawJson: task as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      });

      return 'updated';
    }

    await this.prisma.task.create({
      data: {
        userId,
        ...taskData,
        integrations: {
          create: {
            userId,
            provider,
            externalTaskId: task.id,
            externalListId,
            externalEtag: task['@odata.etag'],
            rawJson: task as unknown as Prisma.InputJsonValue,
          },
        },
      },
    });

    return 'created';
  }

  private mapTask(task: MicrosoftTodoTask) {
    const status = this.mapStatus(task.status);

    return {
      title: task.title.trim() || '未命名 Microsoft To Do 任务',
      description: task.body?.content?.trim() || null,
      priority: this.mapPriority(task.importance),
      dueAt: task.dueDateTime ? this.toDate(task.dueDateTime) : null,
      status,
      completedAt:
        status === 'DONE'
          ? task.completedDateTime
            ? this.toDate(task.completedDateTime)
            : new Date()
          : null,
    };
  }

  private mapLocalTaskToMicrosoft(task: {
    title: string;
    description: string | null;
    priority: Priority;
    dueAt: Date | null;
    status: TaskStatus;
  }) {
    return {
      title: task.title,
      body: task.description
        ? {
            content: task.description,
            contentType: 'text',
          }
        : undefined,
      importance: this.mapLocalPriority(task.priority),
      dueDateTime: task.dueAt
        ? {
            dateTime: this.toMicrosoftDateTime(task.dueAt),
            timeZone: this.getMicrosoftTodoTimeZone(),
          }
        : undefined,
      status: task.status === 'DONE' ? 'completed' : undefined,
    };
  }

  private mapLocalPriority(priority: Priority) {
    if (priority === 'HIGH') {
      return 'high';
    }

    if (priority === 'LOW') {
      return 'low';
    }

    return 'normal';
  }

  private mapStatus(status: MicrosoftTodoTask['status']): TaskStatus {
    if (status === 'completed') {
      return 'DONE';
    }

    if (status === 'inProgress') {
      return 'DOING';
    }

    return 'TODO';
  }

  private mapPriority(importance: MicrosoftTodoTask['importance']): Priority {
    if (importance === 'high') {
      return 'HIGH';
    }

    if (importance === 'low') {
      return 'LOW';
    }

    return 'MEDIUM';
  }

  private toDate(value: MicrosoftDateTimeTimeZone) {
    const normalizedDateTime = value.dateTime.trim();

    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedDateTime)) {
      return new Date(normalizedDateTime);
    }

    const parts = this.parseMicrosoftDateTime(normalizedDateTime);

    if (!parts) {
      return new Date(normalizedDateTime);
    }

    return this.fromZonedTime(parts, this.normalizeTimeZone(value.timeZone));
  }

  private toMicrosoftDateTime(value: Date) {
    const parts = this.getDateTimeParts(value, this.getMicrosoftTodoTimeZone());

    return `${parts.year}-${this.pad(parts.month)}-${this.pad(parts.day)}T${this.pad(parts.hour)}:${this.pad(parts.minute)}:${this.pad(parts.second)}`;
  }

  private parseMicrosoftDateTime(value: string): DateTimeParts | null {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/,
    );

    if (!match) {
      return null;
    }

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6] ?? 0),
      millisecond: Number((match[7] ?? '0').slice(0, 3).padEnd(3, '0')),
    };
  }

  private fromZonedTime(parts: DateTimeParts, timeZone: string) {
    let utcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    );

    for (let index = 0; index < 3; index += 1) {
      const offsetMs = this.getTimeZoneOffsetMs(new Date(utcMs), timeZone);
      const nextUtcMs = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
      ) - offsetMs;

      if (nextUtcMs === utcMs) {
        break;
      }

      utcMs = nextUtcMs;
    }

    return new Date(utcMs);
  }

  private getTimeZoneOffsetMs(date: Date, timeZone: string) {
    const parts = this.getDateTimeParts(date, timeZone);
    const zonedUtcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    );

    return zonedUtcMs - date.getTime();
  }

  private getDateTimeParts(date: Date, timeZone: string): DateTimeParts {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const values = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
      millisecond: date.getUTCMilliseconds(),
    };
  }

  private normalizeTimeZone(timeZone: string | undefined) {
    const configuredTimeZone = this.getMicrosoftTodoTimeZone();
    const mappedTimeZone = timeZone ? windowsTimeZoneMap[timeZone] ?? timeZone : configuredTimeZone;

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: mappedTimeZone });
      return mappedTimeZone;
    } catch {
      return configuredTimeZone;
    }
  }

  private getMicrosoftTodoTimeZone() {
    const timeZone = this.config.get<string>(
      'MICROSOFT_TODO_TIME_ZONE',
      defaultMicrosoftTodoTimeZone,
    );

    try {
      new Intl.DateTimeFormat('en-US', { timeZone });
      return timeZone;
    } catch {
      return defaultMicrosoftTodoTimeZone;
    }
  }

  private pad(value: number) {
    return String(value).padStart(2, '0');
  }

  private async getOrCreateList(accessToken: string) {
    const lists = await this.getAllPages<MicrosoftTodoList>(
      `${graphBaseUrl}/me/todo/lists`,
      accessToken,
    );
    const existing = lists.find((list) => list.displayName === defaultListName);

    if (existing) {
      return existing;
    }

    return this.graphRequest<MicrosoftTodoList>(
      `${graphBaseUrl}/me/todo/lists`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ displayName: defaultListName }),
      },
    );
  }

  private async createMicrosoftTask(
    listId: string,
    body: Record<string, unknown>,
    accessToken: string,
  ) {
    return this.graphRequest<MicrosoftTodoTask>(
      `${graphBaseUrl}/me/todo/lists/${listId}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }

  private async patchMicrosoftTask(
    listId: string,
    taskId: string,
    body: Record<string, unknown>,
    accessToken: string,
  ) {
    return this.graphRequest<MicrosoftTodoTask>(
      `${graphBaseUrl}/me/todo/lists/${listId}/tasks/${taskId}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
  }

  private async getAccessToken(userId: string) {
    const account = await this.prisma.integrationAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!account) {
      throw new NotFoundException('请先连接 Microsoft To Do');
    }

    if (account.expiresAt.getTime() > Date.now() + 60_000) {
      return account.accessToken;
    }

    if (!account.refreshToken) {
      throw new BadRequestException('Microsoft To Do 授权已过期，请重新连接');
    }

    const token = await this.refreshToken(account.refreshToken);

    await this.prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? account.refreshToken,
        expiresAt: this.getExpiresAt(token.expires_in),
        scope: token.scope,
      },
    });

    return token.access_token;
  }

  private async exchangeCode(code: string) {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getRequiredConfig('MICROSOFT_CLIENT_SECRET'),
      code,
      redirect_uri: this.getRedirectUri(),
      grant_type: 'authorization_code',
      scope: this.getScopes(),
    });

    return this.tokenRequest(body);
  }

  private async refreshToken(refreshToken: string) {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getRequiredConfig('MICROSOFT_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: this.getScopes(),
    });

    return this.tokenRequest(body);
  }

  private async tokenRequest(body: URLSearchParams) {
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID', 'common');
    const response = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      throw new BadRequestException('Microsoft 授权失败');
    }

    return (await response.json()) as TokenResponse;
  }

  private async getAllPages<T>(url: string, accessToken: string) {
    const items: T[] = [];
    let nextUrl: string | undefined = url;

    while (nextUrl) {
      const page: GraphCollection<T> = await this.graphRequest(nextUrl, accessToken);

      items.push(...page.value);
      nextUrl = page['@odata.nextLink'];
    }

    return items;
  }

  private async graphRequest<T>(
    url: string,
    accessToken: string,
    options?: RequestInit,
  ) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new BadRequestException(`Microsoft Graph 请求失败：${response.status}`);
    }

    return (await response.json()) as T;
  }

  private getExpiresAt(expiresIn: number) {
    return new Date(Date.now() + expiresIn * 1000);
  }

  private getScopes() {
    return this.config.get<string>(
      'MICROSOFT_SCOPES',
      'offline_access User.Read Tasks.ReadWrite',
    );
  }

  private async ensureWritePermission(userId: string) {
    const account = await this.prisma.integrationAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      select: {
        scope: true,
      },
    });

    if (!account) {
      throw new NotFoundException('请先连接 Microsoft To Do');
    }

    if (!account.scope?.includes('Tasks.ReadWrite')) {
      throw new BadRequestException('请重新连接 Microsoft To Do 并授权写入权限');
    }
  }

  private getRedirectUri() {
    return this.getRequiredConfig('MICROSOFT_REDIRECT_URI');
  }

  private getClientId() {
    const clientId = this.getRequiredConfig('MICROSOFT_CLIENT_ID');

    if (!/^[0-9a-fA-F-]{36}$/.test(clientId)) {
      throw new BadRequestException('MICROSOFT_CLIENT_ID 必须是 36 位应用程序客户端 ID');
    }

    return clientId;
  }

  private getFrontendUrl() {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  private getRequiredConfig(key: string) {
    const value = this.config.get<string>(key);

    if (!value || value === 'replace_me') {
      throw new BadRequestException(`缺少配置：${key}`);
    }

    return value;
  }
}
