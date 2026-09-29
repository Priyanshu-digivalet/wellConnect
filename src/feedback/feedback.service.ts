import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { DISMISSAL_WINDOW_DAYS } from '../common/wellness.constants';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { applyPreference } from './preference';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submit(user: AuthUser, dto: SubmitFeedbackDto, requestId: string) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { recommendationId: dto.recommendationId },
    });
    if (!recommendation || recommendation.wellnessUserId !== user.wellnessUserId) {
      throw new AppException(
        'RECOMMENDATION_NOT_FOUND',
        'Recommendation was not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const feedback = await this.prisma.wellnessFeedback.create({
      data: {
        recommendationId: recommendation.recommendationId,
        wellnessUserId: user.wellnessUserId,
        action: dto.action,
        rating: dto.rating ?? null,
        feedback: dto.feedback ?? null,
      },
    });

    let preference = null;
    if (recommendation.featureId) {
      const existing = await this.prisma.userPreferenceSignal.findUnique({
        where: {
          wellnessUserId_featureId: {
            wellnessUserId: user.wellnessUserId,
            featureId: recommendation.featureId,
          },
        },
      });
      const next = applyPreference(
        existing
          ? {
              preferenceScore: existing.preferenceScore,
              interactionCount: existing.interactionCount,
              positiveCount: existing.positiveCount,
              negativeCount: existing.negativeCount,
            }
          : null,
        dto.action,
        dto.rating,
      );
      preference = await this.prisma.userPreferenceSignal.upsert({
        where: {
          wellnessUserId_featureId: {
            wellnessUserId: user.wellnessUserId,
            featureId: recommendation.featureId,
          },
        },
        create: {
          wellnessUserId: user.wellnessUserId,
          featureId: recommendation.featureId,
          ...next,
        },
        update: next,
      });
    }

    this.logger.log(
      `feedback_received wellnessUserId=${user.wellnessUserId} recommendationId=${dto.recommendationId} action=${dto.action} requestId=${requestId}`,
    );

    return {
      recommendationId: feedback.recommendationId,
      action: feedback.action,
      rating: feedback.rating,
      createdAt: feedback.createdAt.toISOString(),
      preference: preference
        ? {
            featureId: preference.featureId,
            preferenceScore: preference.preferenceScore,
            interactionCount: preference.interactionCount,
            positiveCount: preference.positiveCount,
            negativeCount: preference.negativeCount,
          }
        : null,
    };
  }

  async dismissedFeatureIds(wellnessUserId: string, now: Date): Promise<string[]> {
    const since = new Date(now.getTime() - DISMISSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.wellnessFeedback.findMany({
      where: {
        wellnessUserId,
        action: { in: ['DISMISSED', 'NOT_INTERESTED'] },
        createdAt: { gte: since },
      },
      include: { recommendation: true },
    });
    return [
      ...new Set(
        rows
          .map((row) => row.recommendation.featureId)
          .filter((featureId): featureId is string => Boolean(featureId)),
      ),
    ];
  }
}
