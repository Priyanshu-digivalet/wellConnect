export const SCHEMA_VERSION = '1.0';

export const ACTIVITY_HIGH_STEPS = 7500;
export const ACTIVITY_MODERATE_STEPS = 4000;
export const SLEEP_HIGH_MINUTES = 420;
export const SLEEP_MODERATE_MINUTES = 390;
export const MIN_SAMPLES_FOR_LEVEL = 3;
export const MIN_DAYS_FOR_ANALYSIS = 3;
export const MIN_COMPLETENESS = 0.5;
export const TREND_CHANGE_THRESHOLD = 0.1;
export const LOW_CONSISTENCY_SCORE = 0.4;
export const STRONG_NEGATIVE_PREFERENCE = -0.75;
export const DISMISSAL_WINDOW_DAYS = 14;

export const MAX_STEPS = 100_000;
export const MAX_DISTANCE_METERS = 200_000;
export const MAX_ACTIVE_CALORIES = 20_000;
export const MIN_HEART_RATE = 30;
export const MAX_HEART_RATE = 220;
export const MAX_SLEEP_MINUTES = 24 * 60;
export const MAX_HEALTH_DAYS = 14;

export const AVAILABILITY_FIELDS = [
  'steps',
  'distance',
  'activeCalories',
  'restingHeartRate',
  'averageHeartRate',
  'sleep',
] as const;

export const STATE_FEATURE_TYPES = {
  // Include legacy types (GYM/POOL/SPA/RESTAURANT) and catalog types (FACILITY/SERVICE/OUTLET).
  ACTIVE: ['GYM', 'POOL', 'FACILITY'],
  LOW_ACTIVITY: ['GYM', 'POOL', 'FACILITY'],
  RECOVERY_NEEDED: ['SPA', 'POOL', 'SERVICE', 'FACILITY'],
  SLEEP_FOCUS: ['SPA', 'SERVICE'],
  BALANCED: ['GYM', 'POOL', 'RESTAURANT', 'FACILITY', 'OUTLET', 'SERVICE'],
  // When health data is sparse/missing, still recommend from property catalog.
  INSUFFICIENT_DATA: [
    'GYM',
    'POOL',
    'SPA',
    'RESTAURANT',
    'FACILITY',
    'SERVICE',
    'OUTLET',
  ],
} as const;

export const FEEDBACK_ACTIONS = [
  'SHOWN',
  'OPENED',
  'CLICKED',
  'BOOKED',
  'COMPLETED',
  'DISMISSED',
  'NOT_INTERESTED',
] as const;

export const NOTIFICATION_TYPES = [
  'WELLNESS_RECOMMENDATION',
  'DAILY_WELLNESS',
  'WEEKLY_WELLNESS_SUMMARY',
] as const;

export const NOTIFICATION_STATUSES = [
  'CREATED',
  'SCHEDULED',
  'SENT',
  'FAILED',
  'OPENED',
  'ACTIONED',
] as const;

export const RECOMMENDATION_STATUSES = ['ACTIVE', 'EXPIRED', 'SUPERSEDED'] as const;

export const LIFESTYLE_OBSERVATION_DAYS = 14;
export const LIFESTYLE_MIN_DAYS_FOR_PATTERNS = 7;
export const LIFESTYLE_ADAPTIVE_MIN_INSIGHTS = 2;
export const SHORT_BREAK_MAX_MINUTES = 3;
export const MOVEMENT_CATEGORIES = new Set(['ACTIVITY', 'FITNESS', 'WELLNESS']);

export const GENTLE_FEATURE_TAGS = new Set([
  'yoga',
  'gentle',
  'recovery',
  'relaxation',
  'stretch',
  'spa',
]);
export const INTENSE_FEATURE_TAGS = new Set([
  'fitness',
  'activity',
  'hi-intensity',
  'gym',
  'workout',
]);
