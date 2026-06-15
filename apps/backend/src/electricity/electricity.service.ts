import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type CreateElectricityReadingBody = {
  recordedAt: string;
  remainingKwh: number;
  didRecharge?: boolean;
  rechargeKwh?: number | null;
  rechargeAmountYuan?: number | null;
  note?: string;
};

export type UpdateElectricityReadingBody = Partial<CreateElectricityReadingBody>;

type ElectricityReadingForEstimate = {
  recordedAt: Date;
  remainingKwh: number;
  didRecharge: boolean;
  rechargeKwh: number | null;
};

const alertThresholdKwh = 15;
const forecastWarningDays = 3;
const electricityPriceYuanPerKwh = 0.63;

@Injectable()
export class ElectricityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const readings = await this.prisma.electricityReading.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });
    const latest = readings[0] ?? null;
    const estimate = this.estimateUsage(readings.slice().reverse());
    const now = new Date();
    const estimatedCurrentKwh = latest
      ? this.estimateCurrentRemainingKwh(latest.recordedAt, latest.remainingKwh, estimate.dailyUsageKwh, now)
      : null;

    const daysUntilThreshold =
      estimatedCurrentKwh !== null && estimate.dailyUsageKwh > 0
        ? (estimatedCurrentKwh - alertThresholdKwh) / estimate.dailyUsageKwh
        : null;
    const isBelowThreshold = estimatedCurrentKwh !== null ? estimatedCurrentKwh < alertThresholdKwh : false;
    const shouldWarnSoon =
      daysUntilThreshold !== null && daysUntilThreshold >= 0 && daysUntilThreshold <= forecastWarningDays;

    return {
      latest,
      alertThresholdKwh,
      electricityPriceYuanPerKwh,
      dailyUsageKwh: estimate.dailyUsageKwh,
      dailyCostYuan: this.roundMoney(estimate.dailyUsageKwh * electricityPriceYuanPerKwh),
      validSegmentCount: estimate.validSegmentCount,
      ignoredSegmentCount: estimate.ignoredSegmentCount,
      estimatedCurrentKwh,
      estimatedCurrentAt: latest ? now : null,
      daysUntilThreshold,
      estimatedThresholdAt:
        estimatedCurrentKwh !== null && daysUntilThreshold !== null && daysUntilThreshold >= 0
          ? new Date(Date.now() + daysUntilThreshold * 24 * 60 * 60 * 1000)
          : null,
      status: isBelowThreshold ? 'LOW' : shouldWarnSoon ? 'WARNING' : latest ? 'OK' : 'NO_DATA',
    };
  }

  async listReadings(userId: string) {
    return this.prisma.electricityReading.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
  }

  async createReading(userId: string, body: CreateElectricityReadingBody) {
    const data = this.normalizeCreateReadingInput(body);

    return this.prisma.electricityReading.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async updateReading(userId: string, id: string, body: UpdateElectricityReadingBody) {
    await this.ensureOwnReading(userId, id);
    const data = this.normalizeReadingInput(body, true);

    return this.prisma.electricityReading.update({
      where: { id },
      data,
    });
  }

  async deleteReading(userId: string, id: string) {
    await this.ensureOwnReading(userId, id);

    return this.prisma.electricityReading.delete({
      where: { id },
    });
  }

  private estimateUsage(readings: ElectricityReadingForEstimate[]) {
    const segments: number[] = [];
    let ignoredSegmentCount = 0;

    for (let index = 1; index < readings.length; index += 1) {
      const previous = readings[index - 1];
      const current = readings[index];
      const days = (current.recordedAt.getTime() - previous.recordedAt.getTime()) / (24 * 60 * 60 * 1000);

      if (days <= 0) {
        ignoredSegmentCount += 1;
        continue;
      }

      if (current.didRecharge && current.rechargeKwh === null) {
        ignoredSegmentCount += 1;
        continue;
      }

      const usedKwh = previous.didRecharge
        ? previous.remainingKwh - current.remainingKwh
        : previous.remainingKwh + (current.rechargeKwh ?? 0) - current.remainingKwh;

      if (usedKwh < 0) {
        ignoredSegmentCount += 1;
        continue;
      }

      segments.push(usedKwh / days);
    }

    const recentSegments = segments.slice(-5);
    const weights = [0.08, 0.12, 0.18, 0.25, 0.37].slice(-recentSegments.length);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const dailyUsageKwh =
      recentSegments.length === 0
        ? 0
        : recentSegments.reduce((sum, usage, index) => sum + usage * weights[index], 0) / weightTotal;

    return {
      dailyUsageKwh,
      validSegmentCount: segments.length,
      ignoredSegmentCount,
    };
  }

  private normalizeReadingInput(body: UpdateElectricityReadingBody, partial: boolean) {
    const data: {
      recordedAt?: Date;
      remainingKwh?: number;
      didRecharge?: boolean;
      rechargeKwh?: number | null;
      rechargeAmountYuan?: number | null;
      note?: string | null;
    } = {};

    if (!partial || body.recordedAt !== undefined) {
      data.recordedAt = this.parseDate(body.recordedAt, '请选择记录时间');
    }

    if (!partial || body.remainingKwh !== undefined) {
      data.remainingKwh = this.parseKwh(body.remainingKwh, '请输入当前剩余电量');
    }

    if (body.didRecharge !== undefined) {
      data.didRecharge = Boolean(body.didRecharge);
    } else if (!partial) {
      data.didRecharge = false;
    }

    if (body.rechargeKwh !== undefined) {
      data.rechargeKwh = body.rechargeKwh === null ? null : this.parseKwh(body.rechargeKwh, '充值电量不能为负数');
    }

    if (body.rechargeAmountYuan !== undefined) {
      data.rechargeAmountYuan =
        body.rechargeAmountYuan === null
          ? null
          : this.parseMoney(body.rechargeAmountYuan, '充值金额不能为负数');
    }

    if (
      body.didRecharge &&
      body.rechargeKwh === undefined &&
      data.rechargeAmountYuan !== undefined &&
      data.rechargeAmountYuan !== null
    ) {
      data.rechargeKwh = this.convertYuanToKwh(data.rechargeAmountYuan);
    }

    if (body.didRecharge === false) {
      data.rechargeKwh = null;
      data.rechargeAmountYuan = null;
    }

    if (body.note !== undefined) {
      data.note = body.note.trim() || null;
    }

    return data;
  }

  private normalizeCreateReadingInput(body: CreateElectricityReadingBody) {
    const data = this.normalizeReadingInput(body, false);

    return {
      recordedAt: data.recordedAt as Date,
      remainingKwh: data.remainingKwh as number,
      didRecharge: data.didRecharge ?? false,
      rechargeKwh: data.rechargeKwh,
      rechargeAmountYuan: data.rechargeAmountYuan,
      note: data.note,
    };
  }

  private parseDate(value: string | undefined, message: string) {
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
      throw new BadRequestException(message);
    }

    return date;
  }

  private parseKwh(value: number | undefined, message: string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new BadRequestException(message);
    }

    return numberValue;
  }

  private parseMoney(value: number | undefined, message: string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new BadRequestException(message);
    }

    return numberValue;
  }

  private convertYuanToKwh(value: number) {
    return Math.round((value / electricityPriceYuanPerKwh) * 100) / 100;
  }

  private estimateCurrentRemainingKwh(
    latestRecordedAt: Date,
    latestRemainingKwh: number,
    dailyUsageKwh: number,
    now: Date,
  ) {
    if (dailyUsageKwh <= 0 || latestRecordedAt.getTime() >= now.getTime()) {
      return latestRemainingKwh;
    }

    const elapsedDays = (now.getTime() - latestRecordedAt.getTime()) / (24 * 60 * 60 * 1000);

    return Math.max(0, this.roundKwh(latestRemainingKwh - dailyUsageKwh * elapsedDays));
  }

  private roundKwh(value: number) {
    return Math.round(value * 100) / 100;
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async ensureOwnReading(userId: string, id: string) {
    const reading = await this.prisma.electricityReading.findFirst({
      where: { id, userId },
    });

    if (!reading) {
      throw new NotFoundException('电费记录不存在');
    }

    return reading;
  }
}
