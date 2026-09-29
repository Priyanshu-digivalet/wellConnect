import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthorizationService } from '../auth/authorization.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/exceptions/app.exception';
import { parseIsoDate } from '../common/dates';
import { AVAILABILITY_FIELDS } from '../common/wellness.constants';
import { PrismaService } from '../database/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { PropertyService } from '../property/property.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { UsersService } from '../users/users.service';
import { DataAvailabilityDto, SubmitHealthDataDto } from './dto/submit-health-data.dto';
import { validateHealthSubmission } from './health-data.validator';

@Injectable()
export class HealthDataService {
  private readonly logger = new Logger(HealthDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly properties: PropertyService,
    private readonly users: UsersService,
    private readonly recommendations: RecommendationsService,
    private readonly notifications: NotificationService,
  ) {}

  async ingest(user: AuthUser, dto: SubmitHealthDataDto, requestId: string) {
    this.logRequestReceived(dto, user, requestId);

    this.authorization.assertSameUser(user, dto.userContext.wellnessUserId);
    this.authorization.assertPropertyAccess(user, dto.userContext.propertyId);
    const details = validateHealthSubmission(dto);
    if (details.length > 0) {
      throw new AppException(
        'INVALID_HEALTH_DATA',
        'Health data validation failed',
        HttpStatus.BAD_REQUEST,
        details,
      );
    }

    await this.properties.requireEnabledProperty(dto.userContext.propertyId);
    await this.users.upsert({
      wellnessUserId: dto.userContext.wellnessUserId,
      propertyId: dto.userContext.propertyId,
      timezone: dto.userContext.timezone,
      platform: dto.userContext.platform,
      appVersion: dto.userContext.appVersion,
    });

    let device = null;
    const { deviceId, fcmToken } = dto.userContext;
    if (deviceId && fcmToken) {
      device = await this.notifications.registerDevice(
        {
          ...user,
          wellnessUserId: dto.userContext.wellnessUserId,
          propertyId: dto.userContext.propertyId,
        },
        {
          wellnessUserId: dto.userContext.wellnessUserId,
          propertyId: dto.userContext.propertyId,
          deviceId,
          platform: dto.userContext.platform,
          fcmToken,
          appVersion: dto.userContext.appVersion,
          timezone: dto.userContext.timezone,
          notificationsEnabled: dto.userContext.notificationsEnabled ?? true,
        },
      );
    } else if (deviceId || fcmToken) {
      this.logger.warn(
        `device_registration_skipped wellnessUserId=${dto.userContext.wellnessUserId} reason=incomplete_device_fields hasDeviceId=${Boolean(deviceId)} hasFcmToken=${Boolean(fcmToken)} requestId=${requestId}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const day of dto.dailyHealthData) {
        const quality = qualityScore(day.dataAvailability);
        const data = {
          steps: day.steps,
          distanceMeters: day.distanceMeters,
          activeCalories: day.activeCalories,
          restingHeartRate: day.restingHeartRate ?? 0,
          averageHeartRate: day.averageHeartRate ?? 0,
          sleepMinutes: day.sleepMinutes ?? 0,
          ...(day.hourlySteps
            ? { hourlySteps: day.hourlySteps as unknown as Prisma.InputJsonValue }
            : {}),
          ...(day.dayContext
            ? { dayContext: day.dayContext as unknown as Prisma.InputJsonValue }
            : {}),
          dataAvailability: day.dataAvailability as unknown as Prisma.InputJsonValue,
          dataQuality: quality,
        };
        await tx.dailyHealthData.upsert({
          where: {
            wellnessUserId_date: {
              wellnessUserId: dto.userContext.wellnessUserId,
              date: parseIsoDate(day.date),
            },
          },
          create: {
            wellnessUserId: dto.userContext.wellnessUserId,
            date: parseIsoDate(day.date),
            ...data,
          },
          update: data,
        });
      }
    });

    this.logger.log(
      `health_data_received wellnessUserId=${dto.userContext.wellnessUserId} propertyId=${dto.userContext.propertyId} days=${dto.dailyHealthData.length} deviceRegistered=${Boolean(device)} deviceId=${device?.deviceId ?? 'none'} requestId=${requestId}`,
    );

    // Generate recommendation first; notification is enqueued/sent only after
    // the recommendation is persisted and ready (inside generateForUser).
    const pipeline = await this.recommendations.generateForUser(
      dto.userContext.wellnessUserId,
      requestId,
      { notifyEveryTime: true },
    );

    return {
      wellnessUserId: dto.userContext.wellnessUserId,
      propertyId: dto.userContext.propertyId,
      daysStored: dto.dailyHealthData.length,
      device,
      recommendationId: pipeline.recommendation?.recommendationId ?? null,
      notificationId: pipeline.notification?.notificationId ?? null,
      notificationStatus: pipeline.notification?.status ?? null,
      state: pipeline.profile.state,
      reasonCode: pipeline.profile.reasonCode,
    };
  }

  private logRequestReceived(
    dto: SubmitHealthDataDto,
    user: AuthUser,
    requestId: string,
  ): void {
    const days = dto.dailyHealthData ?? [];
    const daySummaries = days.map((day) => ({
      date: day.date,
      steps: day.steps,
      distanceMeters: day.distanceMeters,
      activeCalories: day.activeCalories,
      restingHeartRate: day.restingHeartRate ?? null,
      averageHeartRate: day.averageHeartRate ?? null,
      sleepMinutes: day.sleepMinutes ?? null,
      dataAvailability: day.dataAvailability,
      hasHourlySteps: Boolean(day.hourlySteps?.length),
      dayContext: day.dayContext ?? null,
    }));

    const payload = {
      requestId,
      authUser: {
        wellnessUserId: user.wellnessUserId,
        propertyId: user.propertyId,
        role: user.role,
      },
      schemaVersion: dto.schemaVersion,
      userContext: {
        wellnessUserId: dto.userContext.wellnessUserId,
        propertyId: dto.userContext.propertyId,
        appVersion: dto.userContext.appVersion,
        platform: dto.userContext.platform,
        timezone: dto.userContext.timezone,
        deviceId: dto.userContext.deviceId ?? null,
        fcmToken: redactToken(dto.userContext.fcmToken),
        notificationsEnabled: dto.userContext.notificationsEnabled ?? null,
      },
      dataContext: dto.dataContext,
      dailyHealthDataCount: days.length,
      dailyHealthData: daySummaries,
    };

    this.logger.log(
      `health_data_request_received ${JSON.stringify(payload)}`,
    );
  }
}

function redactToken(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  if (token.length <= 16) {
    return `${token.slice(0, 4)}…(len=${token.length})`;
  }
  return `${token.slice(0, 12)}…${token.slice(-6)}(len=${token.length})`;
}

function qualityScore(availability: DataAvailabilityDto): number {
  const present = AVAILABILITY_FIELDS.filter((field) => availability[field]).length;
  return present / AVAILABILITY_FIELDS.length;
}
