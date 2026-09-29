import {
  ActivityLevel,
  RecoveryLevel,
  SleepLevel,
  Trend,
} from '../analytics/analytics.types';
import { ReasonCode, WellnessState } from '../decision-engine/decision.types';
import {
  LifestyleAdaptationHints,
  LifestylePatternInsight,
} from '../lifestyle-patterns/lifestyle-patterns.types';

export interface AICandidate {
  featureId: string;
  name: string;
  category: string;
  featureType: string;
  deepLink: string;
}

export interface WellnessAIContext {
  state: WellnessState;
  reasonCode: ReasonCode;
  activity: ActivityLevel;
  sleep: SleepLevel;
  recovery: RecoveryLevel;
  activityTrend: Trend;
  sleepTrend: Trend;
  consistencyScore: number;
  candidates: AICandidate[];
  preferences: Array<{ featureId: string; preferenceScore: number }>;
  lifestyle?: {
    phase: string;
    insights: LifestylePatternInsight[];
    hints: LifestyleAdaptationHints;
    journeyFocus: string[];
  };
}

export interface AIRecommendation {
  recommendation: {
    type: string;
    category: string;
    featureId: string | null;
    title: string;
    message: string;
    reasonCode: string;
    confidence: number;
    deepLink?: string | null;
  };
  notification: {
    eligible: boolean;
    priority: string;
    delivery: string;
    scheduleType: string;
  };
  safety: {
    medicalAdvice: boolean;
  };
}

export interface WellnessAIProvider {
  readonly name: string;
  generateRecommendation(context: WellnessAIContext): Promise<AIRecommendation>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
