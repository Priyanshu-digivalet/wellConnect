export type ActivityLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
export type SleepLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
export type RecoveryLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
export type Trend = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';

export interface DataAvailability {
  steps: boolean;
  distance: boolean;
  activeCalories: boolean;
  restingHeartRate: boolean;
  averageHeartRate: boolean;
  sleep: boolean;
}

export interface DailyMetric {
  date: string;
  steps: number | null;
  distanceMeters: number | null;
  activeCalories: number | null;
  restingHeartRate: number | null;
  averageHeartRate: number | null;
  sleepMinutes: number | null;
  dataAvailability: DataAvailability;
}

export interface WellnessAnalytics {
  activity: {
    level: ActivityLevel;
    trend: Trend;
    avgSteps7d: number;
    todaySteps: number | null;
  };
  sleep: {
    level: SleepLevel;
    trend: Trend;
    avgMinutes7d: number;
    todayMinutes: number | null;
  };
  recovery: {
    level: RecoveryLevel;
  };
  consistency: {
    score: number;
  };
  dataQuality: {
    completeness: number;
    confidence: number;
  };
  insufficientData: boolean;
  window: {
    from: string | null;
    to: string | null;
    days: number;
  };
}
