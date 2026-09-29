import { WellnessAnalytics } from '../analytics/analytics.types';
import { DecisionEngineService } from './decision-engine.service';

describe('DecisionEngineService', () => {
  const engine = new DecisionEngineService();

  it('maps high activity and low sleep to recovery needed', () => {
    const decision = engine.decide(analytics({ activity: 'HIGH', sleep: 'LOW' }));
    expect(decision.state).toBe('RECOVERY_NEEDED');
    expect(decision.reasonCode).toBe('HIGH_ACTIVITY_LOW_SLEEP');
  });

  it('maps low activity and normal sleep to low activity', () => {
    const decision = engine.decide(analytics({ activity: 'LOW', sleep: 'MODERATE' }));
    expect(decision.state).toBe('LOW_ACTIVITY');
    expect(decision.reasonCode).toBe('LOW_ACTIVITY');
  });

  it('maps high activity and adequate sleep to active', () => {
    const decision = engine.decide(analytics({ activity: 'HIGH', sleep: 'HIGH', consistency: 0.8 }));
    expect(decision.state).toBe('ACTIVE');
    expect(decision.reasonCode).toBe('HIGH_ACTIVITY_ADEQUATE_SLEEP');
  });

  it('maps moderate activity and moderate sleep to balanced', () => {
    const decision = engine.decide(analytics({ activity: 'MODERATE', sleep: 'MODERATE' }));
    expect(decision.state).toBe('BALANCED');
    expect(decision.reasonCode).toBe('BALANCED');
  });

  it('returns insufficient data without letting later rules run', () => {
    const decision = engine.decide(analytics({ activity: 'HIGH', sleep: 'HIGH', insufficientData: true }));
    expect(decision.state).toBe('INSUFFICIENT_DATA');
    expect(decision.reasonCode).toBe('INSUFFICIENT_DATA');
  });
});

function analytics(input: {
  activity: WellnessAnalytics['activity']['level'];
  sleep: WellnessAnalytics['sleep']['level'];
  consistency?: number;
  insufficientData?: boolean;
  sleepTrend?: WellnessAnalytics['sleep']['trend'];
}): WellnessAnalytics {
  return {
    activity: {
      level: input.activity,
      trend: 'STABLE',
      avgSteps7d: 0,
      todaySteps: 0,
    },
    sleep: {
      level: input.sleep,
      trend: input.sleepTrend ?? 'STABLE',
      avgMinutes7d: 0,
      todayMinutes: 0,
    },
    recovery: { level: 'MODERATE' },
    consistency: { score: input.consistency ?? 0.8 },
    dataQuality: { completeness: input.insufficientData ? 0.2 : 1, confidence: 1 },
    insufficientData: input.insufficientData ?? false,
    window: { from: '2026-09-23', to: '2026-09-29', days: 7 },
  };
}
