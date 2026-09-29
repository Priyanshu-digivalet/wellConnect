import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationDevice } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { createPublicId } from '../common/ids';
import { DatabaseNotificationQueue } from './database-notification.queue';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';
import { FcmService } from './fcm.service';
import { isLikelyValidFcmToken } from './fcm-token';
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
  /** Health-data ingest: one immediate FCM per call (bypass cooldown / quiet deferral). */
  forceNotify?: boolean;
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
    // Prefer body wellnessUserId so /notifications/devices binds to the
    // dynamic resident id, not the auth-bypass default (wu_recovery_001).
    const wellnessUserId = dto.wellnessUserId || user.wellnessUserId;
    const propertyId = dto.propertyId || user.propertyId;
    if (!wellnessUserId || !propertyId) {
      throw new AppException(
        'INVALID_DEVICE_REGISTRATION',
        'wellnessUserId and propertyId are required to register a device',
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    await this.prisma.wellnessUser.upsert({
      where: { wellnessUserId },
      create: {
        wellnessUserId,
        propertyId,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        platform: dto.platform,
        appVersion: dto.appVersion,
      },
      update: {
        propertyId,
        platform: dto.platform,
        appVersion: dto.appVersion,
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
      },
    });

    const existing = await this.prisma.notificationDevice.findUnique({
      where: {
        wellnessUserId_deviceId: {
          wellnessUserId,
          deviceId: dto.deviceId,
        },
      },
    });

    const incomingToken = dto.fcmToken?.trim() ?? '';
    const incomingValid = isLikelyValidFcmToken(incomingToken);
    const existingValid = isLikelyValidFcmToken(existing?.fcmToken);
    // Never overwrite a real FCM token with a mock/short placeholder from health-data sync.
    const fcmToken =
      !incomingValid && existingValid ? (existing?.fcmToken as string) : incomingToken;

    if (!incomingValid) {
      this.logger.warn(
        `device_fcm_token_invalid wellnessUserId=${wellnessUserId} deviceId=${dto.deviceId} tokenLen=${incomingToken.length} keptExisting=${!incomingValid && existingValid}`,
      );
    }

    const device = await this.prisma.notificationDevice.upsert({
      where: {
        wellnessUserId_deviceId: {
          wellnessUserId,
          deviceId: dto.deviceId,
        },
      },
      create: {
        wellnessUserId,
        deviceId: dto.deviceId,
        platform: dto.platform,
        fcmToken,
        appVersion: dto.appVersion,
        notificationsEnabled: dto.notificationsEnabled ?? true,
        lastSeenAt: now,
      },
      update: {
        platform: dto.platform,
        fcmToken,
        appVersion: dto.appVersion,
        notificationsEnabled: dto.notificationsEnabled ?? true,
        lastSeenAt: now,
      },
    });
    this.logger.log(
      `device_registered wellnessUserId=${wellnessUserId} deviceId=${dto.deviceId} platform=${dto.platform} tokenValid=${isLikelyValidFcmToken(device.fcmToken)}`,
    );
    return toDeviceView(device);
  }

  /**
   * Sends a push immediately via FCM, bypassing quiet hours / cooldown / recommendation policy.
   * Intended for local and integration testing against a registered device token.
   */
  async sendTestPush(user: AuthUser, dto: SendTestPushDto) {
    if (!this.fcm.isConfigured()) {
      throw new AppException(
        'FCM_NOT_CONFIGURED',
        'Firebase Cloud Messaging is not configured on this server',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const devices = await this.prisma.notificationDevice.findMany({
      where: {
        wellnessUserId: user.wellnessUserId,
        notificationsEnabled: true,
        ...(dto.deviceId ? { deviceId: dto.deviceId } : {}),
      },
    });
    if (devices.length === 0) {
      throw new AppException(
        'NO_DEVICE',
        dto.deviceId
          ? 'No enabled device matched the given deviceId for this user'
          : 'No enabled FCM device is registered for this user',
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    const title = dto.title?.trim() || 'WellConnect test';
    const body =
      dto.body?.trim() || 'If you see this, FCM delivery is working.';
    const featureId = dto.featureId?.trim() || null;
    const deepLink = dto.deepLink?.trim() || null;
    const notificationId = createPublicId('ntf');

    const created = await this.prisma.notification.create({
      data: {
        notificationId,
        recommendationId: null,
        wellnessUserId: user.wellnessUserId,
        type: 'DAILY_WELLNESS',
        title,
        body,
        deepLink,
        featureId,
        status: 'CREATED',
        priority: 'HIGH',
        scheduledAt: now,
        provider: 'fcm',
      },
    });

    let providerMessageId: string | undefined;
    let success = false;
    let lastError = 'FCM_SEND_FAILED';
    const results: Array<{
      deviceId: string;
      ok: boolean;
      providerMessageId?: string;
      errorCode?: string;
    }> = [];

    for (const device of devices) {
      const result = await this.fcm.send(device.fcmToken, {
        title,
        body,
        notificationId,
        recommendationId: '',
        type: 'DAILY_WELLNESS',
        featureId,
        deepLink,
      });
      results.push({
        deviceId: device.deviceId,
        ok: result.ok,
        providerMessageId: result.providerMessageId,
        errorCode: result.errorCode,
      });
      if (result.ok) {
        success = true;
        providerMessageId = result.providerMessageId;
      } else if (result.errorCode) {
        lastError = result.errorCode;
      }
    }

    if (!success) {
      await this.fail(notificationId, created.id, lastError);
      throw new AppException(
        lastError,
        'Failed to deliver test push via FCM',
        HttpStatus.BAD_GATEWAY,
        results,
      );
    }

    const updated = await this.prisma.notification.update({
      where: { id: created.id },
      data: {
        status: 'SENT',
        sentAt: now,
        deliveredAt: now,
        provider: 'fcm',
        providerMessageId: providerMessageId ?? null,
        failureReason: null,
      },
    });

    this.logger.log(
      `test_push_sent notificationId=${notificationId} wellnessUserId=${user.wellnessUserId} devices=${devices.length}`,
    );

    return {
      notification: toNotificationView(updated),
      devices: results,
    };
  }

  async createForRecommendation(
    input: CreateNotificationInput,
  ): Promise<{ notification: NotificationView | null; skippedReason: string | null }> {
    const now = new Date();

    // Only notify after the recommendation exists and is ready to send.
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { recommendationId: input.recommendationId },
    });
    if (!recommendation || recommendation.status !== 'ACTIVE') {
      this.logger.log(
        `notification_skipped recommendationId=${input.recommendationId} reason=RECOMMENDATION_NOT_READY requestId=${input.requestId}`,
      );
      return { notification: null, skippedReason: 'RECOMMENDATION_NOT_READY' };
    }
    if (recommendation.expiresAt.getTime() <= now.getTime()) {
      this.logger.log(
        `notification_skipped recommendationId=${input.recommendationId} reason=RECOMMENDATION_EXPIRED requestId=${input.requestId}`,
      );
      return { notification: null, skippedReason: 'RECOMMENDATION_EXPIRED' };
    }

    const devices = await this.prisma.notificationDevice.findMany({
      where: { wellnessUserId: input.wellnessUserId },
      orderBy: { lastSeenAt: 'desc' },
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
      recommendationExpiresAt: recommendation.expiresAt,
      featureAvailable: input.featureAvailable,
      hasFeature: input.hasFeature,
      duplicateNotification: duplicate != null,
      lastNotificationAt: lastNotification?.createdAt ?? null,
      cooldownHours: this.config.get<number>('notificationCooldownHours') ?? 4,
      priority: input.priority,
      eligible: input.eligible,
      forceNotify: input.forceNotify,
    });

    if (!decision.allow || !decision.scheduledAt) {
      this.logger.log(
        `notification_skipped recommendationId=${input.recommendationId} reason=${decision.reason} requestId=${input.requestId}`,
      );
      return { notification: null, skippedReason: decision.reason };
    }

    // Copy comes from the ready recommendation record (source of truth).
    const status = decision.action === 'SCHEDULE' ? 'SCHEDULED' : 'CREATED';
    const created = await this.prisma.notification.create({
      data: {
        notificationId: createPublicId('ntf'),
        recommendationId: recommendation.recommendationId,
        wellnessUserId: recommendation.wellnessUserId,
        type: input.type,
        title: recommendation.title,
        body: recommendation.message,
        deepLink: input.deepLink ?? null,
        featureId: recommendation.featureId,
        status,
        priority: input.priority,
        scheduledAt: decision.scheduledAt,
        provider: 'fcm',
      },
    });
    await this.queue.enqueue(created.notificationId);
    this.logger.log(
      `notification_enqueued notificationId=${created.notificationId} recommendationId=${recommendation.recommendationId} status=${status} action=${decision.action} requestId=${input.requestId}`,
    );

    // Send via FCM only after enqueue, and only when policy says SEND now.
    let latest = created;
    if (decision.action === 'SEND') {
      const full = await this.prisma.notification.findUnique({
        where: { id: created.id },
        include: { recommendation: true, user: true },
      });
      if (full) {
        await this.dispatchOne(full, now);
        latest = await this.prisma.notification.findUniqueOrThrow({
          where: { id: created.id },
        });
        this.logger.log(
          `notification_fcm_sent notificationId=${latest.notificationId} status=${latest.status} recommendationId=${recommendation.recommendationId} requestId=${input.requestId}`,
        );
      }
    }

    return { notification: toNotificationView(latest), skippedReason: null };
  }

  /**
   * Enqueue + send notification strictly from an ACTIVE recommendation that is ready.
   */
  async enqueueAndSendForRecommendation(
    recommendationId: string,
    options: {
      requestId: string;
      timezone: string;
      forceNotify?: boolean;
      eligible?: boolean;
      priority?: NotificationPriority;
      deepLink?: string | null;
      hasFeature?: boolean;
      featureAvailable?: boolean;
      type?: string;
    },
  ): Promise<{ notification: NotificationView | null; skippedReason: string | null }> {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { recommendationId },
    });
    if (!recommendation || recommendation.status !== 'ACTIVE') {
      this.logger.log(
        `notification_skipped recommendationId=${recommendationId} reason=RECOMMENDATION_NOT_READY requestId=${options.requestId}`,
      );
      return { notification: null, skippedReason: 'RECOMMENDATION_NOT_READY' };
    }

    this.logger.log(
      `recommendation_ready_for_notify recommendationId=${recommendationId} title=${recommendation.title} requestId=${options.requestId}`,
    );

    return this.createForRecommendation({
      wellnessUserId: recommendation.wellnessUserId,
      recommendationId: recommendation.recommendationId,
      title: recommendation.title,
      body: recommendation.message,
      type:
        options.type ??
        (recommendation.featureId ? 'WELLNESS_RECOMMENDATION' : 'DAILY_WELLNESS'),
      priority: options.forceNotify ? 'HIGH' : (options.priority ?? 'NORMAL'),
      eligible: options.forceNotify ? true : (options.eligible ?? true),
      expiresAt: recommendation.expiresAt,
      featureId: recommendation.featureId,
      deepLink: options.deepLink ?? null,
      featureAvailable: options.featureAvailable ?? true,
      hasFeature: options.hasFeature ?? Boolean(recommendation.featureId),
      timezone: options.timezone,
      requestId: options.requestId,
      forceNotify: options.forceNotify,
    });
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

    // Prefer the freshest enabled token (avoid stale duplicate device rows).
    const devices = await this.prisma.notificationDevice.findMany({
      where: {
        wellnessUserId: notification.wellnessUserId,
        notificationsEnabled: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    const devicesToSend = devices.slice(0, 1);
    if (devicesToSend.length === 0) {
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
    for (const device of devicesToSend) {
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
      await this.fail(notification.notificationId, notification.id, lastError, {
        soft: lastError === 'INVALID_FCM_TOKEN',
      });
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

  private async fail(
    notificationId: string,
    id: string,
    reason: string,
    options?: { soft?: boolean },
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'FAILED', failureReason: reason },
    });
    const line = `fcm_failure notificationId=${notificationId} code=${reason}`;
    if (options?.soft) {
      this.logger.warn(line);
    } else {
      this.logger.error(line);
    }
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
    wellnessUserId: device.wellnessUserId,
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
