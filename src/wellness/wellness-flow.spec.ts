import { AnalyticsService } from '../analytics/analytics.service';
import { DemoWellnessProvider } from '../ai-guide/demo-wellness.provider';
import { AIOutputValidator } from '../ai-guide/ai-output.validator';
import { CandidateResolverService } from '../candidate-resolver/candidate-resolver.service';
import { DecisionEngineService } from '../decision-engine/decision-engine.service';
import { DailyMetric } from '../analytics/analytics.types';
import { emptyAvailability } from '../analytics/analytics.service';
import { buildFcmPayload } from '../notifications/fcm-payload';
import { NotificationPolicyService } from '../notifications/notification-policy.service';

describe('wellness flow', () => {
  const analytics = new AnalyticsService();
  const decisions = new DecisionEngineService();
  const resolver = new CandidateResolverService();
  const demo = new DemoWellnessProvider();
  const validator = new AIOutputValidator();
  const policy = new NotificationPolicyService();

  const features = [
    {
      featureId: 'facility_gym',
      propertyId: 'property_001',
      featureType: 'GYM',
      name: 'Gym',
      category: 'FITNESS',
      enabled: true,
      available: true,
      deepLink: 'app://facility/gym',
    },
    {
      featureId: 'facility_pool',
      propertyId: 'property_001',
      featureType: 'POOL',
      name: 'Swimming Pool',
      category: 'FITNESS',
      enabled: true,
      available: true,
      deepLink: 'app://facility/pool',
    },
    {
      featureId: 'service_spa',
      propertyId: 'property_001',
      featureType: 'SPA',
      name: 'Spa',
      category: 'WELLNESS',
      enabled: true,
      available: true,
      deepLink: 'app://service/spa',
    },
  ];

  it('turns high activity and low sleep into a spa recommendation and FCM payload', async () => {
    const calculated = analytics.calculate(recoveryDays());
    const decision = decisions.decide(calculated);
    const candidates = resolver.resolve({
      state: decision.state,
      propertyId: 'property_001',
      features,
      history: [],
      preferences: [],
      dismissedFeatureIds: [],
      now: new Date('2026-09-29T06:30:00.000Z'),
      cooldownHours: 20,
    });
    const ai = await demo.generateRecommendation({
      state: decision.state,
      reasonCode: decision.reasonCode,
      activity: calculated.activity.level,
      sleep: calculated.sleep.level,
      recovery: calculated.recovery.level,
      activityTrend: calculated.activity.trend,
      sleepTrend: calculated.sleep.trend,
      consistencyScore: calculated.consistency.score,
      candidates,
      preferences: [],
    });
    const validated = validator.validate(ai, candidates, decision.reasonCode);
    const notification = policy.evaluate({
      now: new Date('2026-09-29T06:30:00.000Z'),
      timezone: 'Asia/Kolkata',
      quietStartHour: 22,
      quietEndHour: 7,
      notificationsEnabled: true,
      hasDevice: true,
      recommendationExpiresAt: new Date('2026-09-30T06:30:00.000Z'),
      featureAvailable: true,
      hasFeature: true,
      duplicateNotification: false,
      lastNotificationAt: null,
      cooldownHours: 4,
      priority: 'NORMAL',
      eligible: validated.ok ? validated.value.notification.eligible : false,
    });

    expect(decision.state).toBe('RECOVERY_NEEDED');
    expect(candidates[0]?.featureId).toBe('service_spa');
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }
    expect(validated.value.title).toBe('Time to unwind');
    expect(validated.value.deepLink).toBe('app://service/spa');
    expect(notification.action).toBe('SEND');

    const payload = buildFcmPayload({
      title: validated.value.title,
      body: validated.value.message,
      notificationId: 'ntf_test',
      recommendationId: 'rec_test',
      type: 'WELLNESS_RECOMMENDATION',
      featureId: validated.value.featureId,
      deepLink: validated.value.deepLink,
    });
    expect(payload.data.deepLink).toBe('app://service/spa');
    expect(payload.data.schemaVersion).toBe('1.0');
  });

  it('uses a dismissal preference to choose the next available feature', async () => {
    const calculated = analytics.calculate(recoveryDays());
    const decision = decisions.decide(calculated);
    const candidates = resolver.resolve({
      state: decision.state,
      propertyId: 'property_001',
      features,
      history: [],
      preferences: [{ featureId: 'service_spa', preferenceScore: -0.8 }],
      dismissedFeatureIds: ['service_spa'],
      now: new Date('2026-09-29T06:30:00.000Z'),
      cooldownHours: 20,
    });
    const ai = await demo.generateRecommendation({
      state: decision.state,
      reasonCode: decision.reasonCode,
      activity: calculated.activity.level,
      sleep: calculated.sleep.level,
      recovery: calculated.recovery.level,
      activityTrend: calculated.activity.trend,
      sleepTrend: calculated.sleep.trend,
      consistencyScore: calculated.consistency.score,
      candidates,
      preferences: [{ featureId: 'service_spa', preferenceScore: -0.8 }],
    });

    expect(candidates.map((item) => item.featureId)).toEqual(['facility_pool']);
    expect(ai.recommendation.featureId).toBe('facility_pool');
    expect(ai.recommendation.message.toLowerCase()).toContain('swimming pool');
  });

  it('suggests personal care when no property features are available', async () => {
    const calculated = analytics.calculate(lowActivityDays());
    const decision = decisions.decide(calculated);
    const candidates = resolver.resolve({
      state: decision.state,
      propertyId: 'property_001',
      features: features.map((feature) => ({ ...feature, available: false })),
      history: [],
      preferences: [],
      dismissedFeatureIds: [],
      now: new Date('2026-09-29T06:30:00.000Z'),
      cooldownHours: 20,
    });
    const ai = await demo.generateRecommendation({
      state: decision.state,
      reasonCode: decision.reasonCode,
      activity: calculated.activity.level,
      sleep: calculated.sleep.level,
      recovery: calculated.recovery.level,
      activityTrend: calculated.activity.trend,
      sleepTrend: calculated.sleep.trend,
      consistencyScore: calculated.consistency.score,
      candidates,
      preferences: [],
    });
    const validated = validator.validate(ai, candidates, decision.reasonCode);

    expect(decision.state).toBe('LOW_ACTIVITY');
    expect(candidates).toEqual([]);
    expect(ai.recommendation.featureId).toBeNull();
    expect(ai.recommendation.type).toBe('DAILY_WELLNESS');
    expect(ai.recommendation.title.toLowerCase()).toContain('walk');
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.featureId).toBeNull();
      expect(validated.value.deepLink).toBeNull();
    }
  });
});

function recoveryDays(): DailyMetric[] {
  const steps = [9800, 10200, 8900, 11000, 9600, 10400, 8700];
  const sleep = [340, 360, 330, 350, 370, 345, 355];
  return steps.map((value, index) => ({
    date: `2026-09-${String(23 + index).padStart(2, '0')}`,
    steps: value,
    distanceMeters: 6000,
    activeCalories: 450,
    restingHeartRate: 66,
    averageHeartRate: 78,
    sleepMinutes: sleep[index],
    dataAvailability: emptyAvailability(true),
  }));
}

function lowActivityDays(): DailyMetric[] {
  const steps = [2100, 1800, 2500, 1900, 2200, 2000, 2300];
  const sleep = [430, 440, 450, 425, 435, 445, 420];
  return steps.map((value, index) => ({
    date: `2026-09-${String(23 + index).padStart(2, '0')}`,
    steps: value,
    distanceMeters: 1500,
    activeCalories: 180,
    restingHeartRate: 62,
    averageHeartRate: 72,
    sleepMinutes: sleep[index],
    dataAvailability: emptyAvailability(true),
  }));
}
