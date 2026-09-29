import { FEEDBACK_ACTIONS } from '../common/wellness.constants';
import { clamp, roundTo } from '../common/math';

export type FeedbackAction = (typeof FEEDBACK_ACTIONS)[number];

export interface PreferenceState {
  preferenceScore: number;
  interactionCount: number;
  positiveCount: number;
  negativeCount: number;
}

const SCORE_DELTA: Record<FeedbackAction, number> = {
  SHOWN: 0,
  OPENED: 0.05,
  CLICKED: 0.15,
  BOOKED: 0.35,
  COMPLETED: 0.4,
  DISMISSED: -0.25,
  NOT_INTERESTED: -0.4,
};

const POSITIVE = new Set<FeedbackAction>(['OPENED', 'CLICKED', 'BOOKED', 'COMPLETED']);
const NEGATIVE = new Set<FeedbackAction>(['DISMISSED', 'NOT_INTERESTED']);

export function applyPreference(
  current: PreferenceState | null,
  action: FeedbackAction,
  rating?: number | null,
): PreferenceState {
  const base = current ?? {
    preferenceScore: 0,
    interactionCount: 0,
    positiveCount: 0,
    negativeCount: 0,
  };
  let delta = SCORE_DELTA[action];
  if (rating != null && rating >= 4) {
    delta += 0.1;
  } else if (rating != null && rating <= 2) {
    delta -= 0.1;
  }
  return {
    preferenceScore: roundTo(clamp(base.preferenceScore + delta, -1, 1), 4),
    interactionCount: base.interactionCount + 1,
    positiveCount: base.positiveCount + (POSITIVE.has(action) ? 1 : 0),
    negativeCount: base.negativeCount + (NEGATIVE.has(action) ? 1 : 0),
  };
}
