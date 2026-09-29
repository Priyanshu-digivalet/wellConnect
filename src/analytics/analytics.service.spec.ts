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

  it('marks insufficient data when fewer than three complete days are present', () => {
    const result = analytics.calculate([
      day('2026-09-28', 9000, 400),
      day('2026-09-29', 9000, 400),
    ]);

    expect(result.insufficientData).toBe(true);
    expect(result.activity.level).toBe('UNKNOWN');
    expect(result.sleep.level).toBe('UNKNOWN');
    expect(result.dataQuality.confidence).toBeLessThan(0.5);
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
