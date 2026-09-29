import { PatternDetectionService } from './pattern-detection.service';
import { PatternDetectionInput } from './lifestyle-patterns.types';

describe('PatternDetectionService', () => {
  const detector = new PatternDetectionService();

  it('detects a low-activity afternoon window from hourly steps', () => {
    const input = baseInput({
      dailyRecords: Array.from({ length: 7 }).map((_, index) => ({
        date: `2026-09-${String(20 + index).padStart(2, '0')}`,
        steps: 6000,
        hourlySteps: buildHourlySteps({ lowStart: 14, lowEnd: 15 }),
        dayContext: null,
      })),
    });
    const result = detector.detect(input);
    expect(result.insights.some((item) => item.code === 'LOW_ACTIVITY_WINDOW')).toBe(true);
    expect(result.hints.lowActivityWindowStartHour).toBe(14);
  });

  it('detects meeting-heavy activity drops', () => {
    const input = baseInput({
      dailyRecords: [
        ...Array.from({ length: 4 }).map((_, index) => ({
          date: `2026-09-${String(10 + index).padStart(2, '0')}`,
          steps: 7000,
          hourlySteps: null,
          dayContext: { meetingHeavy: false },
        })),
        ...Array.from({ length: 3 }).map((_, index) => ({
          date: `2026-09-${String(14 + index).padStart(2, '0')}`,
          steps: 3200,
          hourlySteps: null,
          dayContext: { meetingHeavy: true },
        })),
      ],
    });
    const result = detector.detect(input);
    expect(result.insights.some((item) => item.code === 'MEETING_HEAVY_ACTIVITY_DROP')).toBe(true);
  });

  it('builds a wellness journey with pattern-based steps', () => {
    const input = baseInput({
      wellnessState: 'LOW_ACTIVITY',
      dailyRecords: Array.from({ length: 8 }).map((_, index) => ({
        date: `2026-09-${String(12 + index).padStart(2, '0')}`,
        steps: 2500,
        hourlySteps: buildHourlySteps({ lowStart: 14, lowEnd: 15 }),
        dayContext: null,
      })),
    });
    const result = detector.detect(input);
    expect(result.journey.steps.length).toBeGreaterThan(0);
    expect(result.summary.disclaimer.toLowerCase()).toContain('does not diagnose');
  });
});

function baseInput(overrides: Partial<PatternDetectionInput>): PatternDetectionInput {
  return {
    timezone: 'Asia/Kolkata',
    observationDays: 8,
    wellnessState: 'BALANCED',
    reasonCode: 'BALANCED',
    dailyRecords: [],
    feedbackEvents: [],
    preferences: [],
    ...overrides,
  };
}

function buildHourlySteps(input: { lowStart: number; lowEnd: number }): number[] {
  const buckets = new Array(24).fill(300);
  for (let hour = input.lowStart; hour <= input.lowEnd; hour += 1) {
    buckets[hour] = 20;
  }
  return buckets;
}
