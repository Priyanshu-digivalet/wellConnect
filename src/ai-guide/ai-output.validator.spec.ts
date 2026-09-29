import { AICandidate, AIRecommendation } from './ai.types';
import { AIOutputValidator } from './ai-output.validator';

describe('AIOutputValidator', () => {
  const validator = new AIOutputValidator();
  const candidates: AICandidate[] = [
    {
      featureId: 'service_spa',
      name: 'Spa',
      category: 'WELLNESS',
      featureType: 'SPA',
      deepLink: 'app://service/spa',
    },
  ];

  it('accepts a valid response and uses the property deep link', () => {
    const result = validator.validate(valid(), candidates, 'HIGH_ACTIVITY_LOW_SLEEP');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureId).toBe('service_spa');
      expect(result.value.deepLink).toBe('app://service/spa');
    }
  });

  it('rejects a malformed response', () => {
    const result = validator.validate({}, candidates, 'HIGH_ACTIVITY_LOW_SLEEP');
    expect(result).toMatchObject({ ok: false, code: 'MALFORMED_AI_RESPONSE' });
  });

  it('rejects an unknown feature id', () => {
    const response = valid();
    response.recommendation.featureId = 'service_sauna';
    const result = validator.validate(response, candidates, 'HIGH_ACTIVITY_LOW_SLEEP');
    expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_FEATURE' });
  });

  it('accepts a personal-care response when no candidates are available', () => {
    const response = valid();
    response.recommendation.type = 'DAILY_WELLNESS';
    response.recommendation.category = 'ACTIVITY';
    response.recommendation.featureId = null;
    response.recommendation.title = 'Take a short walk';
    response.recommendation.message =
      'Your steps have been quieter lately. A short break and a walk can help reset your day.';
    response.recommendation.reasonCode = 'LOW_ACTIVITY';

    const result = validator.validate(response, [], 'LOW_ACTIVITY');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureId).toBeNull();
      expect(result.value.deepLink).toBeNull();
      expect(result.value.title).toBe('Take a short walk');
    }
  });

  it('rejects a feature id when no candidates were supplied', () => {
    const result = validator.validate(valid(), [], 'HIGH_ACTIVITY_LOW_SLEEP');
    expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_FEATURE' });
  });

  it('rejects a deep link that does not match the property feature', () => {
    const response = valid();
    response.recommendation.deepLink = 'https://evil.example/spa';
    const result = validator.validate(response, candidates, 'HIGH_ACTIVITY_LOW_SLEEP');
    expect(result).toMatchObject({ ok: false, code: 'INVALID_DEEP_LINK' });
  });

  it('rejects medical claims', () => {
    const response = valid();
    response.recommendation.message = 'Your heart rate pattern may indicate hypertension.';
    const result = validator.validate(response, candidates, 'HIGH_ACTIVITY_LOW_SLEEP');
    expect(result).toMatchObject({ ok: false, code: 'MEDICAL_CLAIM' });
  });
});

function valid(): AIRecommendation {
  return {
    recommendation: {
      type: 'WELLNESS_ACTIVITY',
      category: 'RECOVERY',
      featureId: 'service_spa',
      title: 'Time to unwind',
      message: 'The spa is available if you would like some time to relax.',
      reasonCode: 'HIGH_ACTIVITY_LOW_SLEEP',
      confidence: 0.84,
    },
    notification: {
      eligible: true,
      priority: 'NORMAL',
      delivery: 'PUSH',
      scheduleType: 'IMMEDIATE',
    },
    safety: { medicalAdvice: false },
  };
}
