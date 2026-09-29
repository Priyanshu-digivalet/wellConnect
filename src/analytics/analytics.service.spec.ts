import { AnalyticsService, emptyAvailability } from './analytics.service';
import { DailyMetric } from './analytics.types';

describe('AnalyticsService', () => {
  const analytics = new AnalyticsService();

  it('calculates a 7-day average', () => {
    const result = analytics.calculate([
      day('2026-09-23', 7000, 420),
      day('2026-09-24', 8000, 420),
      day('2026-09-25', 8000, 420),
      day('2026-09-26', 8000, 420),
      day('2026-09-27', 8000, 420),
      day('2026-09-28', 8000, 420),
      day('2026-09-29', 9000, 420),
    ]);

    expect(result.activity.avgSteps7d).toBe(8000);
    expect(result.sleep.avgMinutes7d).toBe(420);
    expect(result.activity.todaySteps).toBe(9000);
    expect(result.dataQuality.completeness).toBe(1);
    expect(result.insufficientData).toBe(false);
  });

  it('calculates improving and declining trends', () => {
    const improving = analytics.calculate(series([1000, 1000, 1000, 1000, 5000, 5000, 5000], 450));
    const declining = analytics.calculate(series([9000, 9000, 9000, 9000, 9000, 9000, 9000], 0).map((item, index) => ({
      ...item,
      sleepMinutes: [500, 500, 500, 500, 300, 300, 300][index],
    })));

    expect(improving.activity.trend).toBe('IMPROVING');
    expect(declining.sleep.trend).toBe('DECLINING');
  });

  it('classifies activity levels', () => {
    expect(analytics.calculate(series([8000, 8000, 8000, 8000, 8000, 8000, 8000], 450)).activity.level).toBe('HIGH');
    expect(analytics.calculate(series([5000, 5000, 5000, 5000, 5000, 5000, 5000], 450)).activity.level).toBe('MODERATE');
    expect(analytics.calculate(series([2500, 2500, 2500, 2500, 2500, 2500, 2500], 450)).activity.level).toBe('LOW');
  });

  it('classifies sleep levels', () => {
    expect(analytics.calculate(series([5000, 5000, 5000, 5000, 5000, 5000, 5000], 450)).sleep.level).toBe('HIGH');
    expect(analytics.calculate(series([5000, 5000, 5000, 5000, 5000, 5000, 5000], 400)).sleep.level).toBe('MODERATE');
    expect(analytics.calculate(series([5000, 5000, 5000, 5000, 5000, 5000, 5000], 340)).sleep.level).toBe('LOW');
  });

  it('treats steps-only data as sufficient', () => {
    const result = analytics.calculate([
      stepsOnly('2026-09-23', 2500),
      stepsOnly('2026-09-24', 3000),
      stepsOnly('2026-09-25', 2800),
      stepsOnly('2026-09-26', 3200),
      stepsOnly('2026-09-27', 2900),
      stepsOnly('2026-09-28', 3100),
      stepsOnly('2026-09-29', 2251),
    ]);

    expect(result.insufficientData).toBe(false);
    expect(result.activity.level).toBe('LOW');
    expect(result.sleep.level).toBe('UNKNOWN');
  });

  it('marks insufficient data only when no usable metrics exist', () => {
    const result = analytics.calculate([
      {
        date: '2026-09-29',
        steps: 0,
        distanceMeters: 0,
        activeCalories: 0,
        restingHeartRate: null,
        averageHeartRate: null,
        sleepMinutes: null,
        dataAvailability: emptyAvailability(false),
      },
    ]);

    expect(result.insufficientData).toBe(true);
    expect(result.activity.level).toBe('UNKNOWN');
    expect(result.sleep.level).toBe('UNKNOWN');
  });
});

function series(steps: number[], sleep: number): DailyMetric[] {
  return steps.map((value, index) => day(`2026-09-${String(23 + index).padStart(2, '0')}`, value, sleep));
}

function day(date: string, steps: number, sleep: number): DailyMetric {
  return {
    date,
    steps,
    distanceMeters: 1000,
    activeCalories: 300,
    restingHeartRate: 62,
    averageHeartRate: 76,
    sleepMinutes: sleep,
    dataAvailability: emptyAvailability(true),
  };
}

function stepsOnly(date: string, steps: number): DailyMetric {
  return {
    date,
    steps,
    distanceMeters: 0,
    activeCalories: 0,
    restingHeartRate: null,
    averageHeartRate: null,
    sleepMinutes: null,
    dataAvailability: {
      steps: true,
      distance: false,
      activeCalories: false,
      restingHeartRate: false,
      averageHeartRate: false,
      sleep: false,
    },
  };
}
