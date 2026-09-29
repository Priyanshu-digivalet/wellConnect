import { Injectable } from '@nestjs/common';
import { average, roundTo } from '../common/math';
import {
  ACTIVITY_HIGH_STEPS,
  ACTIVITY_MODERATE_STEPS,
  AVAILABILITY_FIELDS,
  MIN_COMPLETENESS,
  MIN_DAYS_FOR_ANALYSIS,
  MIN_SAMPLES_FOR_LEVEL,
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
    const activityLevel = classifyActivity(avgSteps, stepSamples.length);
    const sleepLevel = classifySleep(avgSleep, sleepSamples.length);
    const completeness = completenessScore(window);
    const coverage = Math.min(window.length, 7) / 7;
    const latest = window[window.length - 1];
    const insufficientData =
      window.length < MIN_DAYS_FOR_ANALYSIS ||
      completeness < MIN_COMPLETENESS ||
      stepSamples.length < MIN_SAMPLES_FOR_LEVEL ||
      sleepSamples.length < MIN_SAMPLES_FOR_LEVEL;

    return {
      activity: {
        level: activityLevel,
        trend: trend(stepSamples),
        avgSteps7d: roundTo(avgSteps, 0),
        todaySteps: latest && latest.dataAvailability.steps ? latest.steps : null,
      },
      sleep: {
        level: sleepLevel,
        trend: trend(sleepSamples),
        avgMinutes7d: roundTo(avgSleep, 0),
        todayMinutes: latest && latest.dataAvailability.sleep ? latest.sleepMinutes : null,
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
    const value = read(day);
    if (available(day) && value != null) {
      samples.push(value);
    }
  }
  return samples;
}

export function classifyActivity(avgSteps: number, samples: number): ActivityLevel {
  if (samples < MIN_SAMPLES_FOR_LEVEL) {
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
  if (samples < MIN_SAMPLES_FOR_LEVEL) {
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
  day: DailyMetric,
  field: (typeof AVAILABILITY_FIELDS)[number],
): boolean {
  switch (field) {
    case 'steps':
      return day.steps != null;
    case 'distance':
      return day.distanceMeters != null;
    case 'activeCalories':
      return day.activeCalories != null;
    case 'restingHeartRate':
      return day.restingHeartRate != null;
    case 'averageHeartRate':
      return day.averageHeartRate != null;
    case 'sleep':
      return day.sleepMinutes != null;
    default:
      return false;
  }
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
