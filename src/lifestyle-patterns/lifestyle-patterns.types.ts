export type LifestylePhase = 'LEARNING' | 'ADAPTIVE';

export type PatternCategory =
  | 'ACTIVITY_TIMING'
  | 'ENGAGEMENT'
  | 'PREFERENCE'
  | 'CONTEXT'
  | 'BREAK_STYLE'
  | 'ROUTINE';

export interface LifestylePatternInsight {
  code: string;
  category: PatternCategory;
  title: string;
  description: string;
  confidence: number;
  evidenceDays: number;
  metadata?: Record<string, number | string | boolean>;
}

export interface LifestyleSummaryView {
  headline: string;
  subheadline: string;
  phase: LifestylePhase;
  observationDays: number;
  insights: LifestylePatternInsight[];
  focusMessage: string;
  disclaimer: string;
}

export interface WellnessJourneyStep {
  id: string;
  title: string;
  detail: string;
  timingHint: string | null;
  category: string;
}

export interface WellnessJourneyView {
  title: string;
  subtitle: string;
  horizonDays: number;
  focusAreas: string[];
  steps: WellnessJourneyStep[];
  adaptationNote: string;
}

export interface LifestyleAdaptationHints {
  preferGentleActivities: boolean;
  preferShortBreaks: boolean;
  lowActivityWindowStartHour: number | null;
  lowActivityWindowEndHour: number | null;
  morningEngagementRate: number | null;
  topInsightCodes: string[];
}

export interface PatternDetectionInput {
  timezone: string;
  observationDays: number;
  dailyRecords: Array<{
    date: string;
    steps: number;
    hourlySteps: number[] | null;
    dayContext: { meetingHeavy?: boolean } | null;
  }>;
  feedbackEvents: Array<{
    action: string;
    createdAt: Date;
    category: string;
    recommendationType: string;
    featureTags: string[];
    context: { breakDurationMinutes?: number } | null;
  }>;
  preferences: Array<{
    featureId: string;
    preferenceScore: number;
    tags: string[];
  }>;
  wellnessState: string;
  reasonCode: string;
}

export interface PatternDetectionResult {
  insights: LifestylePatternInsight[];
  hints: LifestyleAdaptationHints;
  summary: LifestyleSummaryView;
  journey: WellnessJourneyView;
}

export interface DashboardView {
  wellnessUserId: string;
  propertyId: string;
  lifestyleSummary: LifestyleSummaryView;
  wellnessJourney: WellnessJourneyView;
  adaptationHints: LifestyleAdaptationHints;
  calculatedAt: string | null;
  profileVersion: number;
}
