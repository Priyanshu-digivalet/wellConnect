import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { LIFESTYLE_OBSERVATION_DAYS } from '../common/wellness.constants';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import {
  DashboardView,
  LifestyleAdaptationHints,
  LifestyleSummaryView,
  PatternDetectionInput,
  WellnessJourneyView,
} from './lifestyle-patterns.types';
import { PatternDetectionService } from './pattern-detection.service';

@Injectable()
export class LifestylePatternsService {
  private readonly logger = new Logger(LifestylePatternsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly detector: PatternDetectionService,
  ) {}

  async getDashboard(user: AuthUser): Promise<DashboardView> {
    let saved = await this.prisma.wellnessLifestyleProfile.findUnique({
      where: { wellnessUserId: user.wellnessUserId },
    });
    if (!saved) {
      await this.refresh(user.wellnessUserId);
      saved = await this.prisma.wellnessLifestyleProfile.findUnique({
        where: { wellnessUserId: user.wellnessUserId },
      });
      if (!saved) {
        throw new AppException(
          'LIFESTYLE_PROFILE_NOT_FOUND',
          'Lifestyle profile has not been calculated yet. Sync health data first.',
          HttpStatus.NOT_FOUND,
        );
      }
    }
    return this.toDashboardView(user, saved);
  }

  async refresh(wellnessUserId: string): Promise<{
    lifestyleSummary: LifestyleSummaryView;
    wellnessJourney: WellnessJourneyView;
    adaptationHints: LifestyleAdaptationHints;
    calculatedAt: Date;
    profileVersion: number;
  } | null> {
    const user = await this.prisma.wellnessUser.findUnique({
      where: { wellnessUserId },
    });
    if (!user) {
      return null;
    }
    const wellnessProfile = await this.prisma.wellnessProfile.findUnique({
      where: { wellnessUserId },
    });
    const profileData = wellnessProfile?.profileData as
      | { state?: string; reasonCode?: string }
      | undefined;

    const dailyRows = await this.prisma.dailyHealthData.findMany({
      where: { wellnessUserId },
      orderBy: { date: 'desc' },
      take: LIFESTYLE_OBSERVATION_DAYS,
    });
    const observationDays = dailyRows.length;
    if (observationDays === 0) {
      return null;
    }

    const since = dailyRows[dailyRows.length - 1]?.date ?? new Date();
    const feedbackRows = await this.prisma.wellnessFeedback.findMany({
      where: { wellnessUserId, createdAt: { gte: since } },
      include: { recommendation: true },
      orderBy: { createdAt: 'desc' },
    });
    const preferences = await this.prisma.userPreferenceSignal.findMany({
      where: { wellnessUserId },
    });
    const features = await this.prisma.propertyFeature.findMany({
      where: { propertyId: user.propertyId },
    });
    const featureTags = new Map<string, string[]>(
      features.map((feature) => [
        feature.featureId,
        Array.isArray(feature.tags)
          ? (feature.tags as string[]).map((tag) => String(tag).toLowerCase())
          : [],
      ]),
    );

    const input: PatternDetectionInput = {
      timezone: user.timezone,
      observationDays,
      wellnessState: profileData?.state ?? 'BALANCED',
      reasonCode: profileData?.reasonCode ?? 'BALANCED',
      dailyRecords: dailyRows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        steps: row.steps,
        hourlySteps: parseHourlySteps(row.hourlySteps),
        dayContext: parseDayContext(row.dayContext),
      })),
      feedbackEvents: feedbackRows.map((row) => ({
        action: row.action,
        createdAt: row.createdAt,
        category: row.recommendation.category,
        recommendationType: row.recommendation.recommendationType,
        featureTags: row.recommendation.featureId
          ? (featureTags.get(row.recommendation.featureId) ?? [])
          : [],
        context: parseFeedbackContext(row.context),
      })),
      preferences: preferences.map((pref) => ({
        featureId: pref.featureId,
        preferenceScore: pref.preferenceScore,
        tags: featureTags.get(pref.featureId) ?? [],
      })),
    };

    const detected = this.detector.detect(input);
    const existing = await this.prisma.wellnessLifestyleProfile.findUnique({
      where: { wellnessUserId },
    });
    const calculatedAt = new Date();
    const saved = await this.prisma.wellnessLifestyleProfile.upsert({
      where: { wellnessUserId },
      create: {
        wellnessUserId,
        phase: detected.summary.phase,
        observationDays,
        patternsData: {
          insights: detected.insights,
          hints: detected.hints,
        } as unknown as Prisma.InputJsonValue,
        lifestyleSummary: detected.summary as unknown as Prisma.InputJsonValue,
        wellnessJourney: detected.journey as unknown as Prisma.InputJsonValue,
        calculatedAt,
        profileVersion: 1,
      },
      update: {
        phase: detected.summary.phase,
        observationDays,
        patternsData: {
          insights: detected.insights,
          hints: detected.hints,
        } as unknown as Prisma.InputJsonValue,
        lifestyleSummary: detected.summary as unknown as Prisma.InputJsonValue,
        wellnessJourney: detected.journey as unknown as Prisma.InputJsonValue,
        calculatedAt,
        profileVersion: (existing?.profileVersion ?? 0) + 1,
      },
    });

    this.logger.log(
      `lifestyle_profile_refreshed wellnessUserId=${wellnessUserId} phase=${saved.phase} insights=${detected.insights.length}`,
    );

    return {
      lifestyleSummary: detected.summary,
      wellnessJourney: detected.journey,
      adaptationHints: detected.hints,
      calculatedAt: saved.calculatedAt,
      profileVersion: saved.profileVersion,
    };
  }

  async getAdaptationHints(wellnessUserId: string): Promise<LifestyleAdaptationHints | null> {
    const saved = await this.prisma.wellnessLifestyleProfile.findUnique({
      where: { wellnessUserId },
    });
    if (!saved) {
      return null;
    }
    const patterns = saved.patternsData as { hints?: LifestyleAdaptationHints };
    return patterns.hints ?? null;
  }

  private toDashboardView(
    user: AuthUser,
    saved: {
      lifestyleSummary: unknown;
      wellnessJourney: unknown;
      patternsData: unknown;
      calculatedAt: Date;
      profileVersion: number;
    },
  ): DashboardView {
    const patterns = saved.patternsData as { hints?: LifestyleAdaptationHints };
    return {
      wellnessUserId: user.wellnessUserId,
      propertyId: user.propertyId,
      lifestyleSummary: saved.lifestyleSummary as LifestyleSummaryView,
      wellnessJourney: saved.wellnessJourney as WellnessJourneyView,
      adaptationHints: patterns.hints ?? {
        preferGentleActivities: false,
        preferShortBreaks: false,
        lowActivityWindowStartHour: null,
        lowActivityWindowEndHour: null,
        morningEngagementRate: null,
        topInsightCodes: [],
      },
      calculatedAt: saved.calculatedAt.toISOString(),
      profileVersion: saved.profileVersion,
    };
  }
}

function parseHourlySteps(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value) || value.length !== 24) {
    return null;
  }
  const buckets = value.map((item) => Number(item));
  if (buckets.some((item) => !Number.isFinite(item) || item < 0)) {
    return null;
  }
  return buckets;
}

function parseDayContext(value: Prisma.JsonValue | null): { meetingHeavy?: boolean } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const meetingHeavy = (value as { meetingHeavy?: unknown }).meetingHeavy;
  return { meetingHeavy: meetingHeavy === true };
}

function parseFeedbackContext(
  value: Prisma.JsonValue | null,
): { breakDurationMinutes?: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const minutes = (value as { breakDurationMinutes?: unknown }).breakDurationMinutes;
  if (minutes == null) {
    return null;
  }
  const parsed = Number(minutes);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return { breakDurationMinutes: Math.round(parsed) };
}
