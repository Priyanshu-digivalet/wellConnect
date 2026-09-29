import { Injectable } from '@nestjs/common';
import { WellnessAnalytics } from '../analytics/analytics.types';
import { LOW_CONSISTENCY_SCORE } from '../common/wellness.constants';
import { REASON_BY_STATE, ReasonCode, WellnessState } from './decision.types';

export interface WellnessDecision {
  state: WellnessState;
  reasonCode: ReasonCode;
}

@Injectable()
export class DecisionEngineService {
  decide(analytics: WellnessAnalytics): WellnessDecision {
    const activity = analytics.activity.level;
    const sleep = analytics.sleep.level;

    // Only when no metric can be classified (e.g. empty payload).
    // Steps-only or any single param is enough to recommend.
    if (
      analytics.insufficientData ||
      (activity === 'UNKNOWN' && sleep === 'UNKNOWN')
    ) {
      return decision('INSUFFICIENT_DATA');
    }

    // Steps-only (or activity known, sleep missing): decide from activity.
    if (sleep === 'UNKNOWN') {
      if (activity === 'LOW') {
        return decision('LOW_ACTIVITY');
      }
      if (activity === 'HIGH') {
        return decision(
          analytics.consistency.score < LOW_CONSISTENCY_SCORE ? 'BALANCED' : 'ACTIVE',
        );
      }
      return decision('BALANCED');
    }

    // Sleep-only (or sleep known, activity missing): decide from sleep.
    if (activity === 'UNKNOWN') {
      if (sleep === 'LOW') {
        return decision('SLEEP_FOCUS');
      }
      return decision('BALANCED');
    }

    let state: WellnessState;

    if (activity === 'HIGH' && sleep === 'LOW') {
      state = 'RECOVERY_NEEDED';
    } else if (
      activity === 'HIGH' &&
      sleep === 'MODERATE' &&
      analytics.sleep.trend === 'DECLINING'
    ) {
      state = 'RECOVERY_NEEDED';
    } else if (activity === 'HIGH') {
      state = analytics.consistency.score < LOW_CONSISTENCY_SCORE ? 'BALANCED' : 'ACTIVE';
    } else if (sleep === 'LOW') {
      state = 'SLEEP_FOCUS';
    } else if (activity === 'LOW') {
      state = 'LOW_ACTIVITY';
    } else {
      state = 'BALANCED';
    }

    return decision(state);
  }
}

function decision(state: WellnessState): WellnessDecision {
  return { state, reasonCode: REASON_BY_STATE[state] };
}
