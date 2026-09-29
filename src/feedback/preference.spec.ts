import { applyPreference } from './preference';

describe('preference signals', () => {
  it('increases the score for a positive action', () => {
    const next = applyPreference(null, 'BOOKED', 5);
    expect(next.preferenceScore).toBeGreaterThan(0);
    expect(next.positiveCount).toBe(1);
    expect(next.negativeCount).toBe(0);
    expect(next.interactionCount).toBe(1);
  });

  it('decreases the score for a negative action', () => {
    const next = applyPreference(
      { preferenceScore: 0.2, interactionCount: 1, positiveCount: 1, negativeCount: 0 },
      'DISMISSED',
    );
    expect(next.preferenceScore).toBeLessThan(0.2);
    expect(next.negativeCount).toBe(1);
    expect(next.positiveCount).toBe(1);
  });
});
