import { Injectable } from '@nestjs/common';
import { ActivityLevel, RecoveryLevel, SleepLevel } from '../analytics/analytics.types';
import { WellnessState } from '../decision-engine/decision.types';
import { AIRecommendation, WellnessAIContext, WellnessAIProvider } from './ai.types';

@Injectable()
export class DemoWellnessProvider implements WellnessAIProvider {
  readonly name = 'demo';

  async generateRecommendation(context: WellnessAIContext): Promise<AIRecommendation> {
    const candidate = context.candidates[0];
    const copy = candidate
      ? (FEATURE_COPY[context.state] ?? FEATURE_COPY.BALANCED)
      : personalCareCopy(context);
    const confidence = Math.max(
      0.62,
      Math.min(0.92, 0.7 + context.consistencyScore * 0.2),
    );
    return {
      recommendation: {
        type: candidate ? 'WELLNESS_ACTIVITY' : 'DAILY_WELLNESS',
        category: copy.category,
        featureId: candidate?.featureId ?? null,
        title: copy.title,
        message: personalizeMessage(
          candidate ? copy.message(candidate.name) : copy.message(''),
          context,
        ),
        reasonCode: context.reasonCode,
        confidence: Number(confidence.toFixed(2)),
      },
      notification: {
        eligible: true,
        priority: context.state === 'BALANCED' ? 'LOW' : 'NORMAL',
        delivery: 'PUSH',
        scheduleType: 'IMMEDIATE',
      },
      safety: {
        medicalAdvice: false,
      },
    };
  }
}

type Copy = { title: string; category: string; message: (name: string) => string };

const FEATURE_COPY: Record<WellnessState, Copy> = {
  RECOVERY_NEEDED: {
    title: 'Time to unwind',
    category: 'RECOVERY',
    message: (name) =>
      `You've had a fairly active stretch and your sleep has been lighter. The ${name.toLowerCase()} is available if you'd like some time to relax.`,
  },
  ACTIVE: {
    title: 'Keep the momentum',
    category: 'ACTIVITY',
    message: (name) =>
      `Your activity has been strong and your sleep looks solid. The ${name.toLowerCase()} is available if you want to keep that rhythm going.`,
  },
  LOW_ACTIVITY: {
    title: 'A gentle start',
    category: 'ACTIVITY',
    message: (name) =>
      `The last few days have been on the quieter side. The ${name.toLowerCase()} is available if a short visit sounds useful.`,
  },
  SLEEP_FOCUS: {
    title: 'Leave room to rest',
    category: 'SLEEP',
    message: (name) =>
      `Sleep has been on the lighter side lately. The ${name.toLowerCase()} is available if you would like a calmer part of the day.`,
  },
  BALANCED: {
    title: 'A balanced day',
    category: 'GENERAL',
    message: (name) =>
      `Activity and sleep look steady. The ${name.toLowerCase()} is available if you want a simple option on the property.`,
  },
  INSUFFICIENT_DATA: {
    title: 'NO Recommendation for now',
    category: 'GENERAL',
    message: () => 'NO Recommendation for now',
  },
};

function personalCareCopy(context: WellnessAIContext): Copy {
  if (context.state === 'BALANCED' && context.sleep === 'HIGH') {
    return {
      title: 'How are you feeling?',
      category: 'SLEEP',
      message: () =>
        "You've been getting plenty of sleep lately. Checking in on how rested you feel can help you notice what is working well.",
    };
  }
  const byState = PERSONAL_CARE_BY_STATE[context.state];
  if (byState) {
    return byState;
  }
  return personalCareFromMetrics(context.activity, context.sleep, context.recovery);
}

const PERSONAL_CARE_BY_STATE: Partial<Record<WellnessState, Copy>> = {
  LOW_ACTIVITY: {
    title: 'Take a short walk',
    category: 'ACTIVITY',
    message: () =>
      'Your steps have been on the quieter side lately. A short break and a few minutes of walking can help reset your day.',
  },
  RECOVERY_NEEDED: {
    title: 'Make space to unwind',
    category: 'RECOVERY',
    message: () =>
      "You've been quite active while sleep has been lighter. A slower evening and a few quiet minutes may help you feel more settled.",
  },
  SLEEP_FOCUS: {
    title: 'Ease into the evening',
    category: 'SLEEP',
    message: () =>
      'Sleep has been lighter than usual. Consider winding down a bit earlier tonight with a calmer routine and fewer late stimulations.',
  },
  ACTIVE: {
    title: 'A light stretch',
    category: 'ACTIVITY',
    message: () =>
      'Your activity looks strong. A few minutes of gentle stretching can help you stay loose and keep that momentum feeling good.',
  },
  BALANCED: {
    title: 'A gentle check-in',
    category: 'GENERAL',
    message: () =>
      'Activity and sleep look steady. A short stretch or a brief walk is a simple way to keep the day feeling balanced.',
  },
};

function personalizeMessage(base: string, context: WellnessAIContext): string {
  const hints = context.lifestyle?.hints;
  if (!hints || base.length > 280) {
    return base;
  }
  if (hints.preferShortBreaks) {
    return `${base} A quick 3-minute reset tends to work well for you.`;
  }
  if (
    hints.lowActivityWindowStartHour != null &&
    hints.lowActivityWindowEndHour != null &&
    !candidateMention(base)
  ) {
    return `${base} Your activity often dips mid-afternoon, so now is a good window to move.`;
  }
  return base;
}

function candidateMention(message: string): boolean {
  return message.toLowerCase().includes('mid-afternoon');
}

function personalCareFromMetrics(
  activity: ActivityLevel,
  sleep: SleepLevel,
  recovery: RecoveryLevel,
): Copy {
  if (activity === 'LOW') {
    return PERSONAL_CARE_BY_STATE.LOW_ACTIVITY!;
  }
  if (sleep === 'LOW' || recovery === 'LOW') {
    return (
      PERSONAL_CARE_BY_STATE.SLEEP_FOCUS ?? {
        title: 'Leave room to rest',
        category: 'SLEEP',
        message: () =>
          'Rest has been lighter lately. A calmer evening and an earlier wind-down can help you feel more restored.',
      }
    );
  }
  if (sleep === 'HIGH') {
    return {
      title: 'How are you feeling?',
      category: 'SLEEP',
      message: () =>
        "You've been getting plenty of sleep lately. Checking in on how rested you feel can help you notice what is working well.",
    };
  }
  if (activity === 'HIGH') {
    return PERSONAL_CARE_BY_STATE.ACTIVE!;
  }
  return {
    title: 'A few gentle stretches',
    category: 'GENERAL',
    message: () =>
      'Things look fairly steady. A couple of minutes of light stretching is a simple way to care for yourself today.',
  };
}
