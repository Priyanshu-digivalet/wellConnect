import { Injectable } from '@nestjs/common';
import { WellnessAnalytics } from '../analytics/analytics.types';
import { LOW_CONSISTENCY_SCORE, MIN_COMPLETENESS } from '../common/wellness.constants';
import { REASON_BY_STATE, ReasonCode, WellnessState } from './decision.types';

export interface WellnessDecision {
  state: WellnessState;
  reasonCode: ReasonCode;
}

@Injectable()
export class DecisionEngineService {
  decide(analytics: WellnessAnalytics): WellnessDecision {
    if (
      analytics.insufficientData ||
      analytics.activity.level === 'UNKNOWN' ||
      analytics.sleep.level === 'UNKNOWN' ||
      analytics.dataQuality.completeness < MIN_COMPLETENESS
    ) {
      return decision('INSUFFICIENT_DATA');
    }

    const activity = analytics.activity.level;
    const sleep = analytics.sleep.level;
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
