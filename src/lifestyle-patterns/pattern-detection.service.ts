import { Injectable } from '@nestjs/common';
import {
  GENTLE_FEATURE_TAGS,
  INTENSE_FEATURE_TAGS,
  LIFESTYLE_ADAPTIVE_MIN_INSIGHTS,
  LIFESTYLE_MIN_DAYS_FOR_PATTERNS,
  MOVEMENT_CATEGORIES,
  SHORT_BREAK_MAX_MINUTES,
} from '../common/wellness.constants';
import { roundTo } from '../common/math';
import { getZonedParts } from '../common/timezone';
import {
  LifestyleAdaptationHints,
  LifestylePatternInsight,
  LifestylePhase,
  LifestyleSummaryView,
  PatternDetectionInput,
  PatternDetectionResult,
  WellnessJourneyView,
} from './lifestyle-patterns.types';

const POSITIVE_ACTIONS = new Set(['OPENED', 'CLICKED', 'BOOKED', 'COMPLETED']);
const MOVEMENT_TYPES = new Set(['WELLNESS_ACTIVITY', 'DAILY_WELLNESS']);

@Injectable()
export class PatternDetectionService {
  detect(input: PatternDetectionInput): PatternDetectionResult {
    const insights: LifestylePatternInsight[] = [
      ...this.detectLowActivityWindow(input),
      ...this.detectMorningMovementEngagement(input),
      ...this.detectIntensityPreference(input),
      ...this.detectMeetingHeavyDrop(input),
      ...this.detectBreakDurationPreference(input),
      ...this.detectWeekdayActivityDrop(input),
    ].filter((item) => item.confidence >= 0.55);

    const hints = this.buildHints(insights);
    const phase = this.resolvePhase(input.observationDays, insights.length);
    const summary = this.buildSummary(input, insights, phase);
    const journey = this.buildJourney(input, insights, hints, phase);
    return { insights, hints, summary, journey };
  }

  private resolvePhase(observationDays: number, insightCount: number): LifestylePhase {
    if (
      observationDays >= LIFESTYLE_MIN_DAYS_FOR_PATTERNS &&
      insightCount >= LIFESTYLE_ADAPTIVE_MIN_INSIGHTS
    ) {
      return 'ADAPTIVE';
    }
    return 'LEARNING';
  }

  private detectLowActivityWindow(input: PatternDetectionInput): LifestylePatternInsight[] {
    const buckets = new Array(24).fill(0);
    let days = 0;
    for (const day of input.dailyRecords) {
      if (!day.hourlySteps || day.hourlySteps.length !== 24) {
        continue;
      }
      days += 1;
      for (let hour = 0; hour < 24; hour += 1) {
        buckets[hour] += Math.max(0, day.hourlySteps[hour] ?? 0);
      }
    }
    if (days < 3) {
      return [];
    }
    const totals = buckets.map((value) => value / days);
    let bestStart = 14;
    let bestAvg = Number.POSITIVE_INFINITY;
    for (let start = 0; start <= 22; start += 1) {
      const windowAvg = (totals[start] + totals[start + 1]) / 2;
      if (windowAvg < bestAvg) {
        bestAvg = windowAvg;
        bestStart = start;
      }
    }
    const dayAvg = totals.reduce((sum, value) => sum + value, 0) / 24;
    if (dayAvg <= 0 || bestAvg >= dayAvg * 0.85) {
      return [];
    }
    const endHour = bestStart + 2;
    return [
      {
        code: 'LOW_ACTIVITY_WINDOW',
        category: 'ACTIVITY_TIMING',
        title: 'Afternoon lull',
        description: `You tend to be least active between ${formatHour(bestStart)}–${formatHour(endHour)}.`,
        confidence: roundTo(Math.min(0.92, 0.65 + days / 20), 2),
        evidenceDays: days,
        metadata: { startHour: bestStart, endHour },
      },
    ];
  }

  private detectMorningMovementEngagement(input: PatternDetectionInput): LifestylePatternInsight[] {
    const movement = input.feedbackEvents.filter(
      (event) =>
        MOVEMENT_TYPES.has(event.recommendationType) ||
        MOVEMENT_CATEGORIES.has(event.category),
    );
    if (movement.length < 4) {
      return [];
    }
    const positive = movement.filter((event) => POSITIVE_ACTIONS.has(event.action));
    if (positive.length < 3) {
      return [];
    }
    const beforeLunch = positive.filter(
      (event) => getZonedParts(event.createdAt, input.timezone).hour < 12,
    ).length;
    const rate = beforeLunch / positive.length;
    if (rate < 0.55) {
      return [];
    }
    const pct = Math.round(rate * 100);
    return [
      {
        code: 'MORNING_MOVEMENT_ENGAGEMENT',
        category: 'ENGAGEMENT',
        title: 'Morning momentum',
        description: `You complete about ${pct}% of movement recommendations before lunch.`,
        confidence: roundTo(Math.min(0.9, 0.6 + positive.length / 20), 2),
        evidenceDays: input.observationDays,
        metadata: { rate: roundTo(rate, 4) },
      },
    ];
  }

  private detectIntensityPreference(input: PatternDetectionInput): LifestylePatternInsight[] {
    let gentleScore = 0;
    let intenseScore = 0;
    let gentleCount = 0;
    let intenseCount = 0;
    for (const pref of input.preferences) {
      const tags = pref.tags.map((tag) => tag.toLowerCase());
      if (tags.some((tag) => GENTLE_FEATURE_TAGS.has(tag))) {
        gentleScore += pref.preferenceScore;
        gentleCount += 1;
      }
      if (tags.some((tag) => INTENSE_FEATURE_TAGS.has(tag))) {
        intenseScore += pref.preferenceScore;
        intenseCount += 1;
      }
    }
    if (gentleCount === 0 || intenseCount === 0) {
      return [];
    }
    const gentleAvg = gentleScore / gentleCount;
    const intenseAvg = intenseScore / intenseCount;
    const delta = gentleAvg - intenseAvg;
    if (Math.abs(delta) < 0.15) {
      return [];
    }
    const preferGentle = delta > 0;
    return [
      {
        code: preferGentle ? 'PREFERS_GENTLE_MOVEMENT' : 'PREFERS_INTENSE_MOVEMENT',
        category: 'PREFERENCE',
        title: preferGentle ? 'Gentle movement style' : 'Higher-intensity preference',
        description: preferGentle
          ? 'You frequently choose gentle wellness options over high-intensity workouts.'
          : 'You tend to respond better to more active, high-energy wellness options.',
        confidence: roundTo(Math.min(0.88, 0.58 + Math.abs(delta)), 2),
        evidenceDays: input.observationDays,
      },
    ];
  }

  private detectMeetingHeavyDrop(input: PatternDetectionInput): LifestylePatternInsight[] {
    const meetingDays = input.dailyRecords.filter((day) => day.dayContext?.meetingHeavy === true);
    const regularDays = input.dailyRecords.filter((day) => day.dayContext?.meetingHeavy === false);
    if (meetingDays.length < 2 || regularDays.length < 2) {
      return [];
    }
    const meetingAvg = average(meetingDays.map((day) => day.steps));
    const regularAvg = average(regularDays.map((day) => day.steps));
    if (regularAvg <= 0 || meetingAvg >= regularAvg * 0.9) {
      return [];
    }
    const dropPct = Math.round(((regularAvg - meetingAvg) / regularAvg) * 100);
    return [
      {
        code: 'MEETING_HEAVY_ACTIVITY_DROP',
        category: 'CONTEXT',
        title: 'Busy-day pattern',
        description: `Your activity drops on meeting-heavy days, often by around ${dropPct}%.`,
        confidence: roundTo(Math.min(0.9, 0.62 + meetingDays.length / 10), 2),
        evidenceDays: meetingDays.length + regularDays.length,
      },
    ];
  }

  private detectBreakDurationPreference(input: PatternDetectionInput): LifestylePatternInsight[] {
    const withDuration = input.feedbackEvents.filter(
      (event) =>
        event.context?.breakDurationMinutes != null && POSITIVE_ACTIONS.has(event.action),
    );
    if (withDuration.length < 4) {
      return [];
    }
    const short = withDuration.filter(
      (event) => (event.context?.breakDurationMinutes ?? 0) <= SHORT_BREAK_MAX_MINUTES,
    );
    const long = withDuration.filter(
      (event) => (event.context?.breakDurationMinutes ?? 0) > SHORT_BREAK_MAX_MINUTES,
    );
    if (short.length < 2 || long.length < 2) {
      return [];
    }
    const shortRate = short.length / withDuration.length;
    const longRate = long.length / withDuration.length;
    if (shortRate <= longRate) {
      return [];
    }
    const pct = Math.round(shortRate * 100);
    return [
      {
        code: 'PREFERS_SHORT_BREAKS',
        category: 'BREAK_STYLE',
        title: 'Short reset breaks',
        description: `You respond better to short ${SHORT_BREAK_MAX_MINUTES}-minute breaks than longer ones (${pct}% completion on short breaks).`,
        confidence: roundTo(Math.min(0.9, 0.6 + withDuration.length / 15), 2),
        evidenceDays: input.observationDays,
      },
    ];
  }

  private detectWeekdayActivityDrop(input: PatternDetectionInput): LifestylePatternInsight[] {
    const withContext = input.dailyRecords.some((day) => day.dayContext?.meetingHeavy != null);
    if (withContext) {
      return [];
    }
    const weekday: number[] = [];
    const weekend: number[] = [];
    for (const day of input.dailyRecords) {
      const dow = new Date(`${day.date}T12:00:00.000Z`).getUTCDay();
      if (dow === 0 || dow === 6) {
        weekend.push(day.steps);
      } else {
        weekday.push(day.steps);
      }
    }
    if (weekday.length < 4 || weekend.length < 2) {
      return [];
    }
    const weekdayAvg = average(weekday);
    const weekendAvg = average(weekend);
    if (weekendAvg <= 0 || weekdayAvg >= weekendAvg * 0.92) {
      return [];
    }
    return [
      {
        code: 'WEEKDAY_ACTIVITY_DIP',
        category: 'ROUTINE',
        title: 'Weekday rhythm',
        description:
          'Your movement tends to dip on weekdays compared with weekends, which may reflect a busier routine.',
        confidence: 0.62,
        evidenceDays: weekday.length + weekend.length,
      },
    ];
  }

  private buildHints(insights: LifestylePatternInsight[]): LifestyleAdaptationHints {
    const lowWindow = insights.find((item) => item.code === 'LOW_ACTIVITY_WINDOW');
    const start =
      typeof lowWindow?.metadata?.startHour === 'number' ? lowWindow.metadata.startHour : null;
    const end =
      typeof lowWindow?.metadata?.endHour === 'number' ? lowWindow.metadata.endHour : null;
    const morning = insights.find((item) => item.code === 'MORNING_MOVEMENT_ENGAGEMENT');
    const morningRate =
      typeof morning?.metadata?.rate === 'number' ? morning.metadata.rate : null;
    return {
      preferGentleActivities: insights.some((item) => item.code === 'PREFERS_GENTLE_MOVEMENT'),
      preferShortBreaks: insights.some((item) => item.code === 'PREFERS_SHORT_BREAKS'),
      lowActivityWindowStartHour: start,
      lowActivityWindowEndHour: end,
      morningEngagementRate: morningRate,
      topInsightCodes: insights.slice(0, 4).map((item) => item.code),
    };
  }

  private buildSummary(
    input: PatternDetectionInput,
    insights: LifestylePatternInsight[],
    phase: LifestylePhase,
  ): LifestyleSummaryView {
    const headline =
      phase === 'ADAPTIVE'
        ? 'Your wellness patterns are taking shape'
        : 'Learning your daily rhythm';
    const subheadline =
      phase === 'ADAPTIVE'
        ? 'Recommendations can now adapt to how you actually move, rest, and respond.'
        : `Week 1–2 focus: collecting ${LIFESTYLE_MIN_DAYS_FOR_PATTERNS}+ days of behavior before personalizing further.`;
    const focusMessage =
      insights.length > 0
        ? 'These are lifestyle patterns from your recent activity and in-app choices—not a medical assessment.'
        : 'Keep syncing health data and responding to suggestions; meaningful patterns usually appear within two weeks.';
    return {
      headline,
      subheadline,
      phase,
      observationDays: input.observationDays,
      insights,
      focusMessage,
      disclaimer:
        'Wellness patterns only. This summary does not diagnose conditions or replace clinical care.',
    };
  }

  private buildJourney(
    input: PatternDetectionInput,
    insights: LifestylePatternInsight[],
    hints: LifestyleAdaptationHints,
    phase: LifestylePhase,
  ): WellnessJourneyView {
    const focusAreas = this.journeyFocusAreas(input.wellnessState, insights);
    const steps = this.journeySteps(input, hints, insights);
    return {
      title: phase === 'ADAPTIVE' ? 'Your suggested wellness journey' : 'Building your wellness journey',
      subtitle:
        phase === 'ADAPTIVE'
          ? 'Short, behavior-based steps tuned to your recent patterns.'
          : 'Early guidance while the system learns your preferences over the first two weeks.',
      horizonDays: 14,
      focusAreas,
      steps,
      adaptationNote:
        'Week 1–2 → pattern detection → lifestyle profile → personalized recommendations. This view will refine as you engage.',
    };
  }

  private journeyFocusAreas(state: string, insights: LifestylePatternInsight[]): string[] {
    const areas = new Set<string>();
    if (state === 'LOW_ACTIVITY' || insights.some((i) => i.category === 'ACTIVITY_TIMING')) {
      areas.add('Movement through the day');
    }
    if (state === 'SLEEP_FOCUS' || state === 'RECOVERY_NEEDED') {
      areas.add('Rest and recovery');
    }
    if (insights.some((i) => i.category === 'PREFERENCE' || i.category === 'BREAK_STYLE')) {
      areas.add('What works for you');
    }
    if (areas.size === 0) {
      areas.add('Balanced daily care');
    }
    return [...areas];
  }

  private journeySteps(
    input: PatternDetectionInput,
    hints: LifestyleAdaptationHints,
    insights: LifestylePatternInsight[],
  ) {
    const steps: WellnessJourneyView['steps'] = [];
    if (hints.lowActivityWindowStartHour != null && hints.lowActivityWindowEndHour != null) {
      steps.push({
        id: 'afternoon_reset',
        title: 'Afternoon reset',
        detail: `Plan a brief walk or stretch between ${formatHour(hints.lowActivityWindowStartHour)} and ${formatHour(hints.lowActivityWindowEndHour)} when your activity usually dips.`,
        timingHint: `${formatHour(hints.lowActivityWindowStartHour)}–${formatHour(hints.lowActivityWindowEndHour)}`,
        category: 'ACTIVITY',
      });
    }
    if (hints.preferShortBreaks) {
      steps.push({
        id: 'micro_breaks',
        title: 'Micro-break habit',
        detail: `Try ${SHORT_BREAK_MAX_MINUTES}-minute movement breaks—you tend to complete these more often than longer ones.`,
        timingHint: 'Between tasks',
        category: 'BREAK_STYLE',
      });
    } else if (hints.morningEngagementRate != null && hints.morningEngagementRate >= 0.55) {
      steps.push({
        id: 'morning_move',
        title: 'Morning movement',
        detail: 'Schedule gentle movement before lunch when you are most likely to follow through.',
        timingHint: 'Before 12:00',
        category: 'ENGAGEMENT',
      });
    }
    if (hints.preferGentleActivities) {
      steps.push({
        id: 'gentle_choice',
        title: 'Gentle over intense',
        detail: 'Favor yoga, stretching, spa, or pool-style recovery over high-intensity sessions this week.',
        timingHint: null,
        category: 'PREFERENCE',
      });
    }
    if (insights.some((item) => item.code === 'MEETING_HEAVY_ACTIVITY_DROP')) {
      steps.push({
        id: 'busy_day_buffer',
        title: 'Busy-day buffer',
        detail: 'On meeting-heavy days, add one short walk between blocks to keep energy steady.',
        timingHint: 'Mid-afternoon',
        category: 'CONTEXT',
      });
    }
    if (input.wellnessState === 'LOW_ACTIVITY') {
      steps.push({
        id: 'step_goal_nudge',
        title: 'Short walk target',
        detail: 'A 10-minute walk after lunch is an easy way to lift a quieter activity stretch.',
        timingHint: 'After lunch',
        category: 'ACTIVITY',
      });
    }
    if (input.wellnessState === 'SLEEP_FOCUS') {
      steps.push({
        id: 'wind_down',
        title: 'Wind-down window',
        detail: 'Keep the last hour before bed calmer—dim lights, lighter screens, and a consistent bedtime.',
        timingHint: 'Evening',
        category: 'SLEEP',
      });
    }
    if (steps.length === 0) {
      steps.push({
        id: 'daily_checkin',
        title: 'Daily check-in',
        detail: 'Notice how rested and energized you feel after movement and sleep—small adjustments add up over two weeks.',
        timingHint: null,
        category: 'GENERAL',
      });
    }
    return steps.slice(0, 5);
  }
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) {
    return '12 AM';
  }
  if (normalized === 12) {
    return '12 PM';
  }
  if (normalized < 12) {
    return `${normalized} AM`;
  }
  return `${normalized - 12} PM`;
}
