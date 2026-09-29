import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthorizationService } from '../auth/authorization.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/exceptions/app.exception';
import { parseIsoDate } from '../common/dates';
import { AVAILABILITY_FIELDS } from '../common/wellness.constants';
import { PrismaService } from '../database/prisma.service';
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
  ) {}

  async ingest(user: AuthUser, dto: SubmitHealthDataDto, requestId: string) {
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

    await this.prisma.$transaction(async (tx) => {
      for (const day of dto.dailyHealthData) {
        const quality = qualityScore(day.dataAvailability);
        const data = {
          steps: day.steps,
          distanceMeters: day.distanceMeters,
          activeCalories: day.activeCalories,
          restingHeartRate: day.restingHeartRate ?? null,
          averageHeartRate: day.averageHeartRate ?? null,
          sleepMinutes: day.sleepMinutes ?? null,
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
      `health_data_received wellnessUserId=${dto.userContext.wellnessUserId} propertyId=${dto.userContext.propertyId} days=${dto.dailyHealthData.length} requestId=${requestId}`,
    );

    const pipeline = await this.recommendations.generateForUser(
      dto.userContext.wellnessUserId,
      requestId,
    );

    return {
      wellnessUserId: dto.userContext.wellnessUserId,
      propertyId: dto.userContext.propertyId,
      daysStored: dto.dailyHealthData.length,
      ...pipeline,
    };
  }
}

function qualityScore(availability: DataAvailabilityDto): number {
  const present = AVAILABILITY_FIELDS.filter((field) => availability[field]).length;
  return present / AVAILABILITY_FIELDS.length;
}
