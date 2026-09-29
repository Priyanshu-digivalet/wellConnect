import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationDevice } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { createPublicId } from '../common/ids';
import { DatabaseNotificationQueue } from './database-notification.queue';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { FcmService } from './fcm.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationPriority } from './notification-policy.types';

export interface NotificationView {
  notificationId: string;
  recommendationId: string | null;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  featureId: string | null;
  status: string;
  priority: string;
  scheduledAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  actionedAt: string | null;
}

export interface CreateNotificationInput {
  wellnessUserId: string;
  recommendationId: string;
  title: string;
  body: string;
  type: string;
  priority: NotificationPriority;
  eligible: boolean;
  expiresAt: Date;
  featureId: string | null;
  deepLink: string | null;
  featureAvailable: boolean;
  hasFeature: boolean;
  timezone: string;
  requestId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private loggedMissingFcm = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: NotificationPolicyService,
    private readonly fcm: FcmService,
    private readonly queue: DatabaseNotificationQueue,
    private readonly config: ConfigService,
  ) {}

  async registerDevice(user: AuthUser, dto: RegisterDeviceDto) {
    const now = new Date();
    const device = await this.prisma.notificationDevice.upsert({
      where: {
        wellnessUserId_deviceId: {
          wellnessUserId: user.wellnessUserId,
          deviceId: dto.deviceId,
        },
      },
      create: {
        wellnessUserId: user.wellnessUserId,
        deviceId: dto.deviceId,
        platform: dto.platform,
        fcmToken: dto.fcmToken,
        appVersion: dto.appVersion,
        notificationsEnabled: dto.notificationsEnabled ?? true,
        lastSeenAt: now,
      },
      update: {
        platform: dto.platform,
        fcmToken: dto.fcmToken,
        appVersion: dto.appVersion,
        notificationsEnabled: dto.notificationsEnabled ?? true,
        lastSeenAt: now,
      },
    });
    this.logger.log(
      `device_registered wellnessUserId=${user.wellnessUserId} deviceId=${dto.deviceId} platform=${dto.platform}`,
    );
    return toDeviceView(device);
  }

  async createForRecommendation(
    input: CreateNotificationInput,
  ): Promise<{ notification: NotificationView | null; skippedReason: string | null }> {
    const now = new Date();
    const devices = await this.prisma.notificationDevice.findMany({
      where: { wellnessUserId: input.wellnessUserId },
    });
    const enabledDevices = devices.filter((device) => device.notificationsEnabled);
    const duplicate = await this.prisma.notification.findFirst({
      where: {
        recommendationId: input.recommendationId,
        status: { not: 'FAILED' },
      },
    });
    const lastNotification = await this.prisma.notification.findFirst({
      where: {
        wellnessUserId: input.wellnessUserId,
        status: { in: ['CREATED', 'SCHEDULED', 'SENT', 'OPENED', 'ACTIONED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const decision = this.policy.evaluate({
      now,
      timezone: input.timezone,
      quietStartHour: this.config.get<number>('quietHoursStart') ?? 22,
      quietEndHour: this.config.get<number>('quietHoursEnd') ?? 7,
      notificationsEnabled: enabledDevices.length > 0,
      hasDevice: devices.length > 0,
      recommendationExpiresAt: input.expiresAt,
      featureAvailable: input.featureAvailable,
      hasFeature: input.hasFeature,
      duplicateNotification: duplicate != null,
      lastNotificationAt: lastNotification?.createdAt ?? null,
      cooldownHours: this.config.get<number>('notificationCooldownHours') ?? 4,
      priority: input.priority,
      eligible: input.eligible,
    });

    if (!decision.allow || !decision.scheduledAt) {
      this.logger.log(
        `notification_skipped recommendationId=${input.recommendationId} reason=${decision.reason} requestId=${input.requestId}`,
      );
      return { notification: null, skippedReason: decision.reason };
    }

    const status = decision.action === 'SCHEDULE' ? 'SCHEDULED' : 'CREATED';
    const created = await this.prisma.notification.create({
      data: {
        notificationId: createPublicId('ntf'),
        recommendationId: input.recommendationId,
        wellnessUserId: input.wellnessUserId,
        type: input.type,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        featureId: input.featureId,
        status,
        priority: input.priority,
        scheduledAt: decision.scheduledAt,
        provider: 'fcm',
      },
    });
    await this.queue.enqueue(created.notificationId);
    this.logger.log(
      `notification_generated notificationId=${created.notificationId} status=${status} requestId=${input.requestId}`,
    );
    return { notification: toNotificationView(created), skippedReason: null };
  }

  async markOpened(user: AuthUser, notificationId: string): Promise<NotificationView> {
    const notification = await this.requireOwned(user, notificationId);
    const now = new Date();
    const status = notification.status === 'ACTIONED' ? 'ACTIONED' : 'OPENED';
    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status,
        openedAt: notification.openedAt ?? now,
      },
    });
    this.logger.log(
      `notification_opened notificationId=${notificationId} wellnessUserId=${user.wellnessUserId}`,
    );
    return toNotificationView(updated);
  }

  async markActioned(user: AuthUser, notificationId: string): Promise<NotificationView> {
    const notification = await this.requireOwned(user, notificationId);
    const now = new Date();
    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'ACTIONED',
        actionedAt: now,
        openedAt: notification.openedAt ?? now,
      },
    });
    this.logger.log(
      `notification_actioned notificationId=${notificationId} wellnessUserId=${user.wellnessUserId}`,
    );
    return toNotificationView(updated);
  }

  async dispatchDue(now: Date): Promise<void> {
    const due = await this.prisma.notification.findMany({
      where: {
        status: { in: ['CREATED', 'SCHEDULED'] },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
      include: {
        recommendation: true,
        user: true,
      },
    });

    for (const notification of due) {
      await this.dispatchOne(notification, now);
    }
  }

  private async dispatchOne(
    notification: Notification & {
      recommendation: { expiresAt: Date; featureId: string | null; propertyId: string } | null;
      user: { timezone: string };
    },
    now: Date,
  ): Promise<void> {
    if (notification.recommendation && notification.recommendation.expiresAt <= now) {
      await this.fail(notification.notificationId, notification.id, 'RECOMMENDATION_EXPIRED');
      return;
    }
    if (notification.featureId && notification.recommendation) {
      const feature = await this.prisma.propertyFeature.findUnique({
        where: {
          propertyId_featureId: {
            propertyId: notification.recommendation.propertyId,
            featureId: notification.featureId,
          },
        },
      });
      if (!feature || !feature.enabled || !feature.available) {
        await this.fail(notification.notificationId, notification.id, 'FEATURE_UNAVAILABLE');
        return;
      }
    }

    const devices = await this.prisma.notificationDevice.findMany({
      where: {
        wellnessUserId: notification.wellnessUserId,
        notificationsEnabled: true,
      },
    });
    if (devices.length === 0) {
      await this.fail(notification.notificationId, notification.id, 'NO_DEVICE');
      return;
    }
    if (!this.fcm.isConfigured()) {
      if (!this.loggedMissingFcm) {
        this.logger.warn('fcm_send_skipped reason=FCM_NOT_CONFIGURED');
        this.loggedMissingFcm = true;
      }
      return;
    }

    let providerMessageId: string | undefined;
    let success = false;
    let lastError = 'FCM_SEND_FAILED';
    for (const device of devices) {
      const result = await this.fcm.send(device.fcmToken, {
        title: notification.title,
        body: notification.body,
        notificationId: notification.notificationId,
        recommendationId: notification.recommendationId ?? '',
        type: notification.type,
        featureId: notification.featureId,
        deepLink: notification.deepLink,
      });
      if (result.ok) {
        success = true;
        providerMessageId = result.providerMessageId;
      } else if (result.errorCode) {
        lastError = result.errorCode;
      }
    }

    if (!success) {
      await this.fail(notification.notificationId, notification.id, lastError);
      return;
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: now,
        deliveredAt: now,
        provider: 'fcm',
        providerMessageId: providerMessageId ?? null,
        failureReason: null,
      },
    });
  }

  private async fail(notificationId: string, id: string, reason: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'FAILED', failureReason: reason },
    });
    this.logger.error(`fcm_failure notificationId=${notificationId} code=${reason}`);
  }

  private async requireOwned(user: AuthUser, notificationId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { notificationId },
    });
    if (!notification || notification.wellnessUserId !== user.wellnessUserId) {
      throw new AppException(
        'NOTIFICATION_NOT_FOUND',
        'Notification was not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return notification;
  }
}

function toDeviceView(device: NotificationDevice) {
  return {
    deviceId: device.deviceId,
    platform: device.platform,
    appVersion: device.appVersion,
    notificationsEnabled: device.notificationsEnabled,
    lastSeenAt: device.lastSeenAt.toISOString(),
  };
}

export function toNotificationView(notification: Notification): NotificationView {
  return {
    notificationId: notification.notificationId,
    recommendationId: notification.recommendationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    deepLink: notification.deepLink,
    featureId: notification.featureId,
    status: notification.status,
    priority: notification.priority,
    scheduledAt: notification.scheduledAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    openedAt: notification.openedAt?.toISOString() ?? null,
    actionedAt: notification.actionedAt?.toISOString() ?? null,
  };
}
