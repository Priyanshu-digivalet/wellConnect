import { Injectable } from '@nestjs/common';
import { average, roundTo } from '../common/math';
import {
  ACTIVITY_HIGH_STEPS,
  ACTIVITY_MODERATE_STEPS,
  AVAILABILITY_FIELDS,
  SLEEP_HIGH_MINUTES,
  SLEEP_MODERATE_MINUTES,
  TREND_CHANGE_THRESHOLD,
} from '../common/wellness.constants';
import {
  ActivityLevel,
  DailyMetric,
  DataAvailability,
  RecoveryLevel,
  SleepLevel,
  Trend,
  WellnessAnalytics,
} from './analytics.types';

@Injectable()
export class AnalyticsService {
  calculate(input: DailyMetric[]): WellnessAnalytics {
    const sorted = [...input].sort((a, b) => a.date.localeCompare(b.date));
    const window = sorted.slice(-7);
    const stepSamples = values(window, (day) => day.steps, (day) => day.dataAvailability.steps);
    const sleepSamples = values(
      window,
      (day) => day.sleepMinutes,
      (day) => day.dataAvailability.sleep,
    );
    const heartSamples = values(
      window,
      (day) => day.restingHeartRate,
      (day) => day.dataAvailability.restingHeartRate,
    );

    const avgSteps = stepSamples.length ? average(stepSamples) : 0;
    const avgSleep = sleepSamples.length ? average(sleepSamples) : 0;
    const avgHeart = heartSamples.length ? average(heartSamples) : null;
    // Classify from whatever samples exist — a single metric (e.g. steps-only) is enough.
    const activityLevel = classifyActivity(avgSteps, stepSamples.length);
    const sleepLevel = classifySleep(avgSleep, sleepSamples.length);
    const completeness = completenessScore(window);
    const coverage = Math.min(window.length, 7) / 7;
    const latest = window[window.length - 1];
    const hasAnyMetric =
      stepSamples.length > 0 || sleepSamples.length > 0 || heartSamples.length > 0;
    // Insufficient only when there is no usable metric at all.
    const insufficientData = window.length === 0 || !hasAnyMetric;

    return {
      activity: {
        level: activityLevel,
        trend: trend(stepSamples),
        avgSteps7d: roundTo(avgSteps, 0),
        todaySteps: latest && latest.dataAvailability.steps ? latest.steps ?? 0 : null,
      },
      sleep: {
        level: sleepLevel,
        trend: trend(sleepSamples),
        avgMinutes7d: roundTo(avgSleep, 0),
        todayMinutes: latest && latest.dataAvailability.sleep ? latest.sleepMinutes ?? 0 : null,
      },
      recovery: {
        level: recoveryLevel(activityLevel, sleepLevel, avgHeart),
      },
      consistency: {
        score: consistencyScore(stepSamples),
      },
      dataQuality: {
        completeness: roundTo(completeness, 2),
        confidence: roundTo(completeness * coverage, 2),
      },
      insufficientData,
      window: {
        from: window[0]?.date ?? null,
        to: latest?.date ?? null,
        days: window.length,
      },
    };
  }
}

function values(
  days: DailyMetric[],
  read: (day: DailyMetric) => number | null,
  available: (day: DailyMetric) => boolean,
): number[] {
  const samples: number[] = [];
  for (const day of days) {
    if (!available(day)) {
      continue;
    }
    // Null/missing numeric values are treated as zero for analysis.
    samples.push(read(day) ?? 0);
  }
  return samples;
}

export function classifyActivity(avgSteps: number, samples: number): ActivityLevel {
  // A single sample is enough to classify — steps-only streams are valid.
  if (samples < 1) {
    return 'UNKNOWN';
  }
  if (avgSteps >= ACTIVITY_HIGH_STEPS) {
    return 'HIGH';
  }
  if (avgSteps >= ACTIVITY_MODERATE_STEPS) {
    return 'MODERATE';
  }
  return 'LOW';
}

export function classifySleep(avgMinutes: number, samples: number): SleepLevel {
  if (samples < 1) {
    return 'UNKNOWN';
  }
  if (avgMinutes >= SLEEP_HIGH_MINUTES) {
    return 'HIGH';
  }
  if (avgMinutes >= SLEEP_MODERATE_MINUTES) {
    return 'MODERATE';
  }
  return 'LOW';
}

export function trend(samples: number[]): Trend {
  if (samples.length < 4) {
    return samples.length === 0 ? 'UNKNOWN' : 'STABLE';
  }
  const recent = samples.slice(-3);
  const older = samples.slice(0, samples.length - 3);
  const olderAvg = average(older);
  const recentAvg = average(recent);
  if (olderAvg === 0) {
    return recentAvg > 0 ? 'IMPROVING' : 'STABLE';
  }
  const delta = (recentAvg - olderAvg) / olderAvg;
  if (delta >= TREND_CHANGE_THRESHOLD) {
    return 'IMPROVING';
  }
  if (delta <= -TREND_CHANGE_THRESHOLD) {
    return 'DECLINING';
  }
  return 'STABLE';
}

function consistencyScore(steps: number[]): number {
  if (steps.length < 2) {
    return 0;
  }
  const mean = average(steps);
  if (mean === 0) {
    return 0;
  }
  const variance =
    steps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / steps.length;
  const coefficient = Math.sqrt(variance) / mean;
  return roundTo(Math.min(1, Math.max(0, 1 - coefficient)), 2);
}

function completenessScore(days: DailyMetric[]): number {
  if (days.length === 0) {
    return 0;
  }
  let present = 0;
  let total = 0;
  for (const day of days) {
    for (const field of AVAILABILITY_FIELDS) {
      total += 1;
      if (day.dataAvailability[field] && valuePresent(day, field)) {
        present += 1;
      }
    }
  }
  return present / total;
}

function valuePresent(
  _day: DailyMetric,
  field: (typeof AVAILABILITY_FIELDS)[number],
): boolean {
  // Null metric values are treated as zero, so availability alone is enough.
  return (
    field === 'steps' ||
    field === 'distance' ||
    field === 'activeCalories' ||
    field === 'restingHeartRate' ||
    field === 'averageHeartRate' ||
    field === 'sleep'
  );
}

function recoveryLevel(
  activity: ActivityLevel,
  sleep: SleepLevel,
  avgRestingHeartRate: number | null,
): RecoveryLevel {
  if (activity === 'UNKNOWN' || sleep === 'UNKNOWN') {
    return 'UNKNOWN';
  }
  if (avgRestingHeartRate != null && avgRestingHeartRate >= 90) {
    return 'LOW';
  }
  if (activity === 'HIGH' && sleep === 'LOW') {
    return 'MODERATE';
  }
  if (sleep === 'LOW') {
    return 'LOW';
  }
  if (sleep === 'HIGH' && activity !== 'LOW') {
    return 'HIGH';
  }
  return 'MODERATE';
}

export function emptyAvailability(value: boolean): DataAvailability {
  return {
    steps: value,
    distance: value,
    activeCalories: value,
    restingHeartRate: value,
    averageHeartRate: value,
    sleep: value,
  };
}
