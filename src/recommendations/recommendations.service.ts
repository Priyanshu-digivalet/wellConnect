import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Recommendation } from '@prisma/client';
import { AiGuideService } from '../ai-guide/ai-guide.service';
import { AIOutputValidator } from '../ai-guide/ai-output.validator';
import { WellnessAIContext } from '../ai-guide/ai.types';
import { AnalyticsService } from '../analytics/analytics.service';
import { WellnessAnalytics } from '../analytics/analytics.types';
import { AuthUser } from '../auth/auth.types';
import { CandidateResolverService } from '../candidate-resolver/candidate-resolver.service';
import { formatIsoDate, isIsoDate, parseIsoDate } from '../common/dates';
import { AppException } from '../common/exceptions/app.exception';
import { createPublicId } from '../common/ids';
import { DecisionEngineService } from '../decision-engine/decision-engine.service';
import { WellnessDecision } from '../decision-engine/decision-engine.service';
import { PrismaService } from '../database/prisma.service';
import { FeedbackService } from '../feedback/feedback.service';
import { toDailyMetric } from '../health-data/daily-metric.mapper';
import { NotificationView, NotificationService } from '../notifications/notification.service';
import { NotificationPriority } from '../notifications/notification-policy.types';
import { LifestylePatternsService } from '../lifestyle-patterns/lifestyle-patterns.service';
import {
  LifestyleSummaryView,
  WellnessJourneyView,
} from '../lifestyle-patterns/lifestyle-patterns.types';
import { UsersService } from '../users/users.service';
import { TodayRecommendationQueryDto } from './dto/today-recommendation.query.dto';

export interface ProfileView {
  wellnessUserId: string;
  propertyId: string;
  state: string;
  reasonCode: string;
  activity: WellnessAnalytics['activity'];
  sleep: WellnessAnalytics['sleep'];
  recovery: WellnessAnalytics['recovery'];
  consistency: WellnessAnalytics['consistency'];
  dataQuality: WellnessAnalytics['dataQuality'];
  avgRestingHeartRate7d: number | null;
  calculatedAt: string;
  profileVersion: number;
}

export interface RecommendationView {
  recommendationId: string;
  propertyId: string;
  featureId: string | null;
  featureName: string | null;
  recommendationType: string;
  category: string;
  title: string;
  message: string;
  reasonCode: string;
  confidence: number;
  deepLink: string | null;
  status: string;
  generatedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface PipelineWarning {
  code: string;
  message: string;
}

export interface PipelineResult {
  profile: ProfileView;
  recommendation: RecommendationView | null;
  notification: NotificationView | null;
  lifestyleSummary: LifestyleSummaryView | null;
  wellnessJourney: WellnessJourneyView | null;
  warnings: PipelineWarning[];
  reused: boolean;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  /** Coalesce parallel health-data generates for the same user into one FCM. */
  private readonly inFlightNotify = new Map<string, Promise<PipelineResult>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly analytics: AnalyticsService,
    private readonly decisions: DecisionEngineService,
    private readonly candidates: CandidateResolverService,
    private readonly ai: AiGuideService,
    private readonly validator: AIOutputValidator,
    private readonly notifications: NotificationService,
    private readonly feedback: FeedbackService,
    private readonly lifestyle: LifestylePatternsService,
    private readonly config: ConfigService,
  ) {}

  async getProfile(user: AuthUser): Promise<ProfileView> {
    const profile = await this.prisma.wellnessProfile.findUnique({
      where: { wellnessUserId: user.wellnessUserId },
    });
    if (!profile) {
      throw new AppException(
        'PROFILE_NOT_FOUND',
        'Wellness profile has not been calculated yet',
        HttpStatus.NOT_FOUND,
      );
    }
    const data = profile.profileData as unknown as ProfileSnapshot;
    return {
      wellnessUserId: profile.wellnessUserId,
      propertyId: user.propertyId,
      state: data.state,
      reasonCode: data.reasonCode,
      activity: data.activity,
      sleep: data.sleep,
      recovery: data.recovery,
      consistency: data.consistency,
      dataQuality: data.dataQuality,
      avgRestingHeartRate7d: profile.avgRestingHeartRate7d,
      calculatedAt: profile.calculatedAt.toISOString(),
      profileVersion: profile.profileVersion,
    };
  }

  async list(user: AuthUser): Promise<RecommendationView[]> {
    const now = new Date();
    await this.expireStale(user.wellnessUserId, now);
    const rows = await this.prisma.recommendation.findMany({
      where: { wellnessUserId: user.wellnessUserId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const links = await this.featureLinks(user.propertyId);
    return rows.map((row) => toRecommendationView(row, links));
  }

  async getToday(user: AuthUser, query: TodayRecommendationQueryDto): Promise<RecommendationView> {
    const day = query.date ?? formatIsoDate(new Date());
    if (!isIsoDate(day)) {
      throw new AppException(
        'INVALID_DATE',
        'date must be a valid YYYY-MM-DD calendar day',
        HttpStatus.BAD_REQUEST,
      );
    }

    const propertyId = query.propertyId ?? user.propertyId;
    const now = new Date();
    await this.expireStale(user.wellnessUserId, now);

    const dayStart = parseIsoDate(day);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const row = await this.prisma.recommendation.findFirst({
      where: {
        wellnessUserId: user.wellnessUserId,
        propertyId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new AppException(
        'RECOMMENDATION_NOT_FOUND',
        `No active recommendation for ${day}`,
        HttpStatus.NOT_FOUND,
      );
    }
    const links = await this.featureLinks(propertyId);
    return toRecommendationView(row, links);
  }

  async generateForUser(
    wellnessUserId: string,
    requestId: string,
    options?: { notifyEveryTime?: boolean },
  ): Promise<PipelineResult> {
    const notifyEveryTime = Boolean(options?.notifyEveryTime);
    if (notifyEveryTime) {
      const existingRun = this.inFlightNotify.get(wellnessUserId);
      if (existingRun) {
        this.logger.log(
          `generate_coalesced wellnessUserId=${wellnessUserId} requestId=${requestId}`,
        );
        return existingRun;
      }
      const run = this.runGenerateForUser(wellnessUserId, requestId, true).finally(() => {
        this.inFlightNotify.delete(wellnessUserId);
      });
      this.inFlightNotify.set(wellnessUserId, run);
      return run;
    }
    return this.runGenerateForUser(wellnessUserId, requestId, false);
  }

  private async runGenerateForUser(
    wellnessUserId: string,
    requestId: string,
    notifyEveryTime: boolean,
  ): Promise<PipelineResult> {
    const user = await this.users.requireById(wellnessUserId);
    const rows = await this.prisma.dailyHealthData.findMany({
      where: { wellnessUserId },
      orderBy: { date: 'desc' },
      take: 14,
    });
    const metrics = rows.map(toDailyMetric);
    const analytics = this.analytics.calculate(metrics);
    const decision = this.decisions.decide(analytics);
    const profile = await this.saveProfile(user.wellnessUserId, user.propertyId, analytics, decision);
    const lifestyleBundle = await this.lifestyle.refresh(wellnessUserId);
    this.logger.log(
      `analytics_calculated wellnessUserId=${wellnessUserId} state=${decision.state} completeness=${analytics.dataQuality.completeness} requestId=${requestId}`,
    );

    const now = new Date();
    const dismissedFeatureIds = await this.feedback.dismissedFeatureIds(wellnessUserId, now);
    const existing = await this.prisma.recommendation.findFirst({
      where: {
        wellnessUserId,
        reasonCode: decision.reasonCode,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !notifyEveryTime &&
      existing &&
      existing.reasonCode !== 'INSUFFICIENT_DATA' &&
      (await this.canReuse(existing, user.propertyId, dismissedFeatureIds))
    ) {
      const notification = await this.prisma.notification.findFirst({
        where: { recommendationId: existing.recommendationId },
        orderBy: { createdAt: 'desc' },
      });
      // Reuse only when a notification already exists. Otherwise regenerate so
      // eligible recommendations (including general wellbeing) can create a push.
      if (notification) {
        const links = await this.featureLinks(user.propertyId);
        return {
          profile,
          recommendation: toRecommendationView(existing, links),
          notification: {
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
          },
          lifestyleSummary: lifestyleBundle?.lifestyleSummary ?? null,
          wellnessJourney: lifestyleBundle?.wellnessJourney ?? null,
          warnings: [],
          reused: true,
        };
      }
    }
    if (existing) {
      await this.prisma.recommendation.update({
        where: { id: existing.id },
        data: { status: 'SUPERSEDED' },
      });
    }

    // Always resolve from PropertyFeature catalog — including sparse/missing health metrics.
    // (INSUFFICIENT_DATA no longer short-circuits to a feature-less static message when
    // the property has recommendable facilities/outlets/services.)

    const features = await this.prisma.propertyFeature.findMany({
      where: { propertyId: user.propertyId },
    });
    const cooldownHours = this.config.get<number>('recommendationCooldownHours') ?? 20;
    const historySince = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
    const history = await this.prisma.recommendation.findMany({
      where: { wellnessUserId, createdAt: { gte: historySince } },
    });
    const preferences = await this.prisma.userPreferenceSignal.findMany({
      where: { wellnessUserId },
    });
    const lifestyleHints = lifestyleBundle?.adaptationHints ?? null;
    const resolved = this.candidates.resolve({
      state: decision.state,
      propertyId: user.propertyId,
      features: features.map((feature) => ({
        featureId: feature.featureId,
        propertyId: feature.propertyId,
        featureType: feature.featureType,
        name: feature.name,
        category: feature.category,
        enabled: feature.enabled,
        available: feature.available,
        deepLink: feature.deepLink,
        tags: parseFeatureTags(feature.tags),
      })),
      history: history.map((item) => ({
        featureId: item.featureId,
        createdAt: item.createdAt,
      })),
      preferences: preferences.map((item) => ({
        featureId: item.featureId,
        preferenceScore: item.preferenceScore,
      })),
      dismissedFeatureIds,
      now,
      cooldownHours,
      lifestyleHints,
    });

    if (resolved.length === 0) {
      this.logger.log(
        `personal_care_fallback wellnessUserId=${wellnessUserId} reason=NO_CANDIDATES requestId=${requestId}`,
      );
    }

    const context: WellnessAIContext = {
      state: decision.state,
      reasonCode: decision.reasonCode,
      activity: analytics.activity.level,
      sleep: analytics.sleep.level,
      recovery: analytics.recovery.level,
      activityTrend: analytics.activity.trend,
      sleepTrend: analytics.sleep.trend,
      consistencyScore: analytics.consistency.score,
      candidates: resolved.map((feature) => ({
        featureId: feature.featureId,
        name: feature.name,
        category: feature.category,
        featureType: feature.featureType,
        deepLink: feature.deepLink,
      })),
      preferences: preferences.map((item) => ({
        featureId: item.featureId,
        preferenceScore: item.preferenceScore,
      })),
      lifestyle: lifestyleBundle
        ? {
            phase: lifestyleBundle.lifestyleSummary.phase,
            insights: lifestyleBundle.lifestyleSummary.insights,
            hints: lifestyleBundle.adaptationHints,
            journeyFocus: lifestyleBundle.wellnessJourney.focusAreas,
          }
        : undefined,
    };

    let generated;
    try {
      generated = await this.ai.generate(context);
    } catch {
      return {
        profile,
        recommendation: null,
        notification: null,
        lifestyleSummary: lifestyleBundle?.lifestyleSummary ?? null,
        wellnessJourney: lifestyleBundle?.wellnessJourney ?? null,
        warnings: [
          { code: 'AI_PROVIDER_ERROR', message: 'The wellness guide could not generate a recommendation' },
        ],
        reused: false,
      };
    }

    const validated = this.validator.validate(
      generated.recommendation,
      context.candidates,
      decision.reasonCode,
    );
    if (!validated.ok) {
      this.logger.error(
        `ai_output_rejected code=${validated.code} requestId=${requestId}`,
      );
      return {
        profile,
        recommendation: null,
        notification: null,
        lifestyleSummary: lifestyleBundle?.lifestyleSummary ?? null,
        wellnessJourney: lifestyleBundle?.wellnessJourney ?? null,
        warnings: [{ code: validated.code, message: validated.message }],
        reused: false,
      };
    }

    if (!validated.value.featureId) {
      return this.storeDeterministic(user, profile, decision, analytics, requestId, lifestyleBundle, {
        type: validated.value.type,
        category: validated.value.category,
        featureId: null,
        featureName: null,
        deepLink: null,
        title: validated.value.title,
        message: validated.value.message,
        confidence: validated.value.confidence,
        generatedBy: generated.provider,
        eligible: validated.value.notification.eligible,
        priority: validated.value.notification.priority,
        hasFeature: false,
        featureAvailable: false,
        candidateFeatureIds: [],
        forceNotify: notifyEveryTime,
      });
    }

    const feature = await this.prisma.propertyFeature.findUnique({
      where: {
        propertyId_featureId: {
          propertyId: user.propertyId,
          featureId: validated.value.featureId,
        },
      },
    });
    if (!feature || !feature.enabled || !feature.available) {
      return {
        profile,
        recommendation: null,
        notification: null,
        lifestyleSummary: lifestyleBundle?.lifestyleSummary ?? null,
        wellnessJourney: lifestyleBundle?.wellnessJourney ?? null,
        warnings: [
          {
            code: 'UNKNOWN_FEATURE',
            message: 'The selected feature is not available at this property',
          },
        ],
        reused: false,
      };
    }

    return this.storeDeterministic(user, profile, decision, analytics, requestId, lifestyleBundle, {
      type: validated.value.type,
      category: validated.value.category,
      featureId: feature.featureId,
      featureName: feature.name,
      deepLink: feature.deepLink,
      title: validated.value.title,
      message: validated.value.message,
      confidence: validated.value.confidence,
      generatedBy: generated.provider,
      eligible: validated.value.notification.eligible,
      priority: validated.value.notification.priority,
      hasFeature: true,
      featureAvailable: feature.enabled && feature.available,
      candidateFeatureIds: resolved.map((item) => item.featureId),
      forceNotify: notifyEveryTime,
    });
  }

  private async storeDeterministic(
    user: { wellnessUserId: string; propertyId: string; timezone: string },
    profile: ProfileView,
    decision: WellnessDecision,
    analytics: WellnessAnalytics,
    requestId: string,
    lifestyleBundle: {
      lifestyleSummary: LifestyleSummaryView;
      wellnessJourney: WellnessJourneyView;
    } | null,
    draft: {
      type: string;
      category: string;
      featureId: string | null;
      featureName: string | null;
      deepLink: string | null;
      title: string;
      message: string;
      confidence: number;
      generatedBy: string;
      eligible: boolean;
      priority: NotificationPriority;
      hasFeature: boolean;
      featureAvailable: boolean;
      candidateFeatureIds?: string[];
      forceNotify?: boolean;
    },
  ): Promise<PipelineResult> {
    const ttlHours = this.config.get<number>('recommendationTtlHours') ?? 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    const recommendation = await this.prisma.recommendation.create({
      data: {
        recommendationId: createPublicId('rec'),
        wellnessUserId: user.wellnessUserId,
        propertyId: user.propertyId,
        featureId: draft.featureId,
        recommendationType: draft.type,
        category: draft.category,
        title: draft.title,
        message: draft.message,
        reasonCode: decision.reasonCode,
        confidence: draft.confidence,
        generatedBy: draft.generatedBy,
        status: 'ACTIVE',
        expiresAt,
        context: {
          state: decision.state,
          reasonCode: decision.reasonCode,
          provider: draft.generatedBy,
          featureName: draft.featureName,
          candidateFeatureIds: draft.candidateFeatureIds ?? [],
          summary: {
            activity: analytics.activity.level,
            sleep: analytics.sleep.level,
            recovery: analytics.recovery.level,
            activityTrend: analytics.activity.trend,
            sleepTrend: analytics.sleep.trend,
          },
          lifestyleInsightCodes: lifestyleBundle?.lifestyleSummary.insights.map((item) => item.code) ?? [],
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `recommendation_generated recommendationId=${recommendation.recommendationId} featureId=${draft.featureId ?? 'none'} state=${decision.state} provider=${draft.generatedBy} requestId=${requestId}`,
    );

    // Notify only after the recommendation row is persisted and ACTIVE (ready to send).
    const planned = await this.notifications.enqueueAndSendForRecommendation(
      recommendation.recommendationId,
      {
        requestId,
        timezone: user.timezone,
        forceNotify: draft.forceNotify,
        eligible: draft.forceNotify ? true : draft.eligible,
        priority: draft.forceNotify ? 'HIGH' : draft.priority,
        deepLink: draft.deepLink,
        hasFeature: draft.hasFeature,
        featureAvailable: draft.featureAvailable,
        type: draft.hasFeature ? 'WELLNESS_RECOMMENDATION' : 'DAILY_WELLNESS',
      },
    );

    const links = await this.featureLinks(user.propertyId);
    return {
      profile,
      recommendation: toRecommendationView(recommendation, links),
      notification: planned.notification,
      lifestyleSummary: lifestyleBundle?.lifestyleSummary ?? null,
      wellnessJourney: lifestyleBundle?.wellnessJourney ?? null,
      warnings:
        (draft.forceNotify || draft.eligible) && planned.skippedReason
          ? [{ code: planned.skippedReason, message: 'Notification was not created' }]
          : [],
      reused: false,
    };
  }

  private async saveProfile(
    wellnessUserId: string,
    propertyId: string,
    analytics: WellnessAnalytics,
    decision: WellnessDecision,
  ): Promise<ProfileView> {
    const existing = await this.prisma.wellnessProfile.findUnique({
      where: { wellnessUserId },
    });
    const snapshot: ProfileSnapshot = {
      state: decision.state,
      reasonCode: decision.reasonCode,
      activity: analytics.activity,
      sleep: analytics.sleep,
      recovery: analytics.recovery,
      consistency: analytics.consistency,
      dataQuality: analytics.dataQuality,
    };
    const calculatedAt = new Date();
    const saved = await this.prisma.wellnessProfile.upsert({
      where: { wellnessUserId },
      create: {
        wellnessUserId,
        activityLevel: analytics.activity.level,
        sleepLevel: analytics.sleep.level,
        recoveryLevel: analytics.recovery.level,
        activityTrend: analytics.activity.trend,
        sleepTrend: analytics.sleep.trend,
        consistencyScore: analytics.consistency.score,
        avgSteps7d: analytics.activity.avgSteps7d,
        avgSleepMinutes7d: analytics.sleep.avgMinutes7d,
        avgRestingHeartRate7d: null,
        profileData: snapshot as unknown as Prisma.InputJsonValue,
        calculatedAt,
        profileVersion: 1,
      },
      update: {
        activityLevel: analytics.activity.level,
        sleepLevel: analytics.sleep.level,
        recoveryLevel: analytics.recovery.level,
        activityTrend: analytics.activity.trend,
        sleepTrend: analytics.sleep.trend,
        consistencyScore: analytics.consistency.score,
        avgSteps7d: analytics.activity.avgSteps7d,
        avgSleepMinutes7d: analytics.sleep.avgMinutes7d,
        profileData: snapshot as unknown as Prisma.InputJsonValue,
        calculatedAt,
        profileVersion: (existing?.profileVersion ?? 0) + 1,
      },
    });

    const avgRestingHeartRate7d = await this.averageRestingHeartRate(wellnessUserId);
    if (avgRestingHeartRate7d != null) {
      await this.prisma.wellnessProfile.update({
        where: { wellnessUserId },
        data: { avgRestingHeartRate7d },
      });
    }

    return {
      wellnessUserId,
      propertyId,
      ...snapshot,
      avgRestingHeartRate7d,
      calculatedAt: saved.calculatedAt.toISOString(),
      profileVersion: saved.profileVersion,
    };
  }

  private async canReuse(
    recommendation: Recommendation,
    propertyId: string,
    dismissedFeatureIds: string[],
  ): Promise<boolean> {
    if (recommendation.featureId && dismissedFeatureIds.includes(recommendation.featureId)) {
      return false;
    }
    if (!recommendation.featureId) {
      return true;
    }
    const feature = await this.prisma.propertyFeature.findUnique({
      where: {
        propertyId_featureId: { propertyId, featureId: recommendation.featureId },
      },
    });
    return Boolean(feature?.enabled && feature.available);
  }

  private async averageRestingHeartRate(wellnessUserId: string): Promise<number | null> {
    const rows = await this.prisma.dailyHealthData.findMany({
      where: { wellnessUserId, restingHeartRate: { not: null } },
      orderBy: { date: 'desc' },
      take: 7,
      select: { restingHeartRate: true },
    });
    const values = rows
      .map((row) => row.restingHeartRate)
      .filter((value): value is number => value != null);
    if (values.length === 0) {
      return null;
    }
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(avg * 10) / 10;
  }

  private async expireStale(wellnessUserId: string, now: Date): Promise<void> {
    await this.prisma.recommendation.updateMany({
      where: {
        wellnessUserId,
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private async featureLinks(propertyId: string): Promise<Map<string, { name: string; deepLink: string }>> {
    const features = await this.prisma.propertyFeature.findMany({ where: { propertyId } });
    return new Map(
      features.map((feature) => [
        feature.featureId,
        { name: feature.name, deepLink: feature.deepLink },
      ]),
    );
  }
}

interface ProfileSnapshot {
  state: string;
  reasonCode: string;
  activity: WellnessAnalytics['activity'];
  sleep: WellnessAnalytics['sleep'];
  recovery: WellnessAnalytics['recovery'];
  consistency: WellnessAnalytics['consistency'];
  dataQuality: WellnessAnalytics['dataQuality'];
}

function parseFeatureTags(tags: Prisma.JsonValue): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags.map((tag) => String(tag).toLowerCase());
}

function toRecommendationView(
  row: Recommendation,
  links: Map<string, { name: string; deepLink: string }>,
): RecommendationView {
  const feature = row.featureId ? links.get(row.featureId) : undefined;
  const status =
    row.status === 'ACTIVE' && row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : row.status;
  return {
    recommendationId: row.recommendationId,
    propertyId: row.propertyId,
    featureId: row.featureId,
    featureName: feature?.name ?? null,
    recommendationType: row.recommendationType,
    category: row.category,
    title: row.title,
    message: row.message,
    reasonCode: row.reasonCode,
    confidence: row.confidence,
    deepLink: feature?.deepLink ?? null,
    status,
    generatedBy: row.generatedBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}
